import { randomUUID } from "node:crypto";
import { carryOverPlaces, makeChatMessage, validateRevisedDays, type RevisionResult } from "./itinerary-revision";
import type { GroupItinerary, ItineraryDay, ItineraryProposal, PersonalOverride, Trip } from "./trip-types";

export function destinationChanged(before: string, after: string) {
  return before.trim().toLowerCase() !== after.trim().toLowerCase();
}

function stopSignature(activity: ItineraryDay["activities"][number]) {
  return [activity.time, activity.title, activity.location, activity.type, activity.description, activity.placeSearchQuery].join("|");
}

// Model labels are advisory. Replacing at least half the stops on multiple days
// or changing the destination always needs the group's approval.
export function isMajorRevision(itinerary: GroupItinerary, result: RevisionResult) {
  if (result.proposedDestination && destinationChanged(itinerary.destination, result.proposedDestination)) return true;
  if (result.kind === "shared_major") return true;
  let rewrittenDays = 0;
  let wholeTripReplaced = result.days?.length === itinerary.days.length;
  for (const day of result.days ?? []) {
    const oldDay = itinerary.days.find((item) => item.dayNumber === day.dayNumber);
    if (!oldDay) return true;
    let retained = 0;
    for (const activity of day.activities) {
      if (oldDay.activities.some((old) => stopSignature(old) === stopSignature(activity))) retained += 1;
    }
    if (retained > 0) wholeTripReplaced = false;
    const size = Math.max(oldDay.activities.length, day.activities.length);
    if (size > 0 && retained <= size / 2) rewrittenDays += 1;
  }
  return rewrittenDays >= 2 || wholeTripReplaced;
}

// When the group rejects a small change (same city, at most 3 stops), the person who
// asked still gets it as their own plan for those stops. Bigger changes just stay rejected.
export const maximumPersonalStopsFromRejection = 3;

export function personalPlansFromProposal(itinerary: GroupItinerary, proposal: ItineraryProposal): PersonalOverride[] {
  if (destinationChanged(itinerary.destination, proposal.proposedDestination)) return [];
  const plans: PersonalOverride[] = [];
  for (const newDay of proposal.proposedDays) {
    const oldDay = itinerary.days.find((day) => day.dayNumber === newDay.dayNumber);
    if (!oldDay) return [];
    const count = Math.min(oldDay.activities.length, newDay.activities.length);
    for (let index = 0; index < count; index += 1) {
      const before = oldDay.activities[index];
      const after = newDay.activities[index];
      if (stopSignature(before) === stopSignature(after) || before.time === "") continue;
      plans.push({
        id: randomUUID(), travelerId: proposal.requestedByTravelerId,
        dayNumber: oldDay.dayNumber, stopTime: before.time, stopTitle: before.title,
        title: after.title.slice(0, 120), location: after.location.slice(0, 160), note: after.description.slice(0, 300),
        joinedBy: [], createdAt: new Date().toISOString(),
      });
    }
  }
  return plans.length <= maximumPersonalStopsFromRejection ? plans : [];
}

export function createItineraryProposal(trip: Trip, travelerId: string, result: RevisionResult): ItineraryProposal {
  const itinerary = trip.itinerary!;
  const traveler = trip.travelers.find((item) => item.id === travelerId)!;
  return {
    id: randomUUID(), createdAt: new Date().toISOString(),
    requestedByTravelerId: traveler.id, requestedByName: traveler.name,
    baseItineraryId: itinerary.id, baseRevision: itinerary.revision ?? 0,
    previousDestination: itinerary.destination,
    summary: result.reply, changes: result.changes,
    proposedDestination: result.proposedDestination?.trim() || itinerary.destination,
    proposedTripName: result.proposedTripName?.trim() || undefined,
    proposedDays: result.days!, votes: [], status: "pending",
  };
}

export function proposalMatchesBase(trip: Trip, proposal: ItineraryProposal) {
  return trip.itinerary?.id === proposal.baseItineraryId && (trip.itinerary.revision ?? 0) === proposal.baseRevision;
}

// Called inside the repository's optimistic transaction, including the final vote.
export function applyProposalVote(trip: Trip, proposalId: string, travelerId: string, choice: "approve" | "reject") {
  const proposal = trip.pendingItineraryProposal;
  if (!trip.travelers.some((traveler) => traveler.id === travelerId)) return "not-allowed";
  if (!proposal || proposal.id !== proposalId || proposal.status !== "pending") return "closed";
  if (!proposalMatchesBase(trip, proposal)) {
    finishProposal(trip, proposal, "stale", "The shared plan changed while this proposal was open. Request the change again with @muse.");
    return "stale";
  }
  proposal.votes = proposal.votes.filter((vote) => vote.travelerId !== travelerId);
  proposal.votes.push({ travelerId, choice, votedAt: new Date().toISOString() });
  let approvals = 0;
  let rejections = 0;
  for (const traveler of trip.travelers) {
    const vote = proposal.votes.find((item) => item.travelerId === traveler.id);
    if (!vote) return "pending";
    if (vote.choice === "approve") approvals += 1;
    else rejections += 1;
  }
  if (approvals <= rejections) {
    const itinerary = trip.itinerary!;
    const personal = personalPlansFromProposal(itinerary, proposal);
    if (personal.length > 0) {
      const replaced = (plan: PersonalOverride) => personal.some((item) => item.travelerId === plan.travelerId && item.dayNumber === plan.dayNumber && item.stopTime === plan.stopTime && item.stopTitle === plan.stopTitle);
      itinerary.overrides = [...(itinerary.overrides ?? []).filter((plan) => !replaced(plan)), ...personal];
      const list = personal.map((plan) => `Day ${plan.dayNumber}: ${plan.title} instead of ${plan.stopTitle}`).join("; ");
      finishProposal(trip, proposal, "rejected", `The group kept the shared plan. ${proposal.requestedByName} can still do it: it's now their personal plan (${list}). Anyone can join it.`);
    } else {
      finishProposal(trip, proposal, "rejected", "The group voted to keep the existing plan, so the change was not applied.");
    }
    return "rejected";
  }

  const itinerary = trip.itinerary!;
  const valid = validateRevisedDays(itinerary, proposal.proposedDays, itinerary.days.map((day) => day.date), itinerary.basedOnCandidateId);
  if (!valid.valid) {
    finishProposal(trip, proposal, "stale", "This proposal no longer fits the trip. Please request it again with @muse.");
    return "stale";
  }
  const moved = destinationChanged(itinerary.destination, proposal.proposedDestination);
  const oldDays = itinerary.days;
  if (moved) {
    // Even similarly named stops in a different city must be matched again.
    itinerary.days = carryOverPlaces([], proposal.proposedDays);
    itinerary.overrides = [];
    trip.destination = proposal.proposedDestination;
    const proposedName = proposal.proposedTripName?.trim();
    const oldCity = proposal.previousDestination.split(",")[0].trim().toLowerCase();
    const keepsOldCity = oldCity !== "" && proposedName?.toLowerCase().includes(oldCity);
    trip.name = proposedName && proposedName !== trip.name && !keepsOldCity ? proposedName : `${proposal.proposedDestination} Trip`;
    itinerary.destination = proposal.proposedDestination;
    itinerary.title = trip.name;
    trip.sketch = undefined;
  } else {
    itinerary.days = carryOverPlaces(oldDays, proposal.proposedDays);
    itinerary.overrides = (itinerary.overrides ?? []).filter((override) => {
      const before = oldDays.find((day) => day.dayNumber === override.dayNumber)?.activities.find((stop) => stop.time === override.stopTime && stop.title === override.stopTitle);
      return before && itinerary.days.some((day) => day.dayNumber === override.dayNumber && day.activities.some((stop) => stopSignature(stop) === stopSignature(before)));
    });
    if (proposal.proposedTripName) itinerary.title = proposal.proposedTripName;
  }
  // A whole-plan rewrite can invalidate lodging and flights even within one city.
  trip.travel = undefined;
  itinerary.revision = (itinerary.revision ?? 0) + 1;
  itinerary.updatedAt = new Date().toISOString();
  itinerary.summary = proposal.summary;
  itinerary.placesStatus = undefined;
  itinerary.placesStartedAt = undefined;
  finishProposal(trip, proposal, "approved", `Major trip change approved. ${moved ? `The trip moved from ${proposal.previousDestination} to ${proposal.proposedDestination}. ` : ""}The shared plan was updated; old travel searches and simulated bookings were cleared. Search again for travel.`);
  trip.lastApprovedItineraryProposal = structuredClone(proposal);
  return "approved";
}

function finishProposal(trip: Trip, proposal: ItineraryProposal, status: ItineraryProposal["status"], text: string) {
  proposal.status = status;
  proposal.decidedAt = new Date().toISOString();
  trip.chat = [...(trip.chat ?? []), makeChatMessage({ role: "muse", authorName: "Muse", text })].slice(-200);
}
