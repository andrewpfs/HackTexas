import { getChangedStopKeys } from "./itinerary-diff";
import { buildRevisionRequest, carryOverPlaces, makeChatMessage, mentionsMuse, repairRevisedDays, validateRevisedDays, type RevisionRequest, type RevisionResult } from "./itinerary-revision";
import { createItineraryProposal, isMajorRevision } from "./itinerary-proposals";
import { buildPlanningContext } from "./planning-context";
import type { ChatMessage } from "./trip-types";

// Inject storage and Muse so tests never call providers or write real trip data.
type ChatDependencies = Pick<typeof import("./trip-repository"), "getTripById" | "appendChatMessage" | "changePersonalOverride" | "saveItineraryRevision" | "saveItineraryProposal"> & {
  revise: (request: RevisionRequest) => Promise<RevisionResult>;
};

export class ChatError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function handleItineraryChat(tripId: string, input: { travelerId: string; text: string; focus?: ChatMessage["focus"] }, dependencies: ChatDependencies) {
  const trip = await dependencies.getTripById(tripId);
  if (!trip) throw new ChatError("Trip not found.", 404);
  const traveler = trip.travelers.find((item) => item.id === input.travelerId);
  if (!traveler) throw new ChatError("Join this trip on this device to chat.", 403);
  if (!trip.itinerary) throw new ChatError("This trip has no shared itinerary yet.", 409);
  const message = makeChatMessage({ role: "traveler", authorName: traveler.name, travelerId: traveler.id, text: input.text, focus: input.focus });
  const appended = await dependencies.appendChatMessage(tripId, message);
  if (appended.status !== "added") throw new ChatError("Trip not found.", 404);
  let current = appended.trip;

  async function reply(text: string) {
    const added = await dependencies.appendChatMessage(tripId, makeChatMessage({ role: "muse", authorName: "Muse", text }));
    if (added.status === "added") current = added.trip;
    return { trip: current, changedStops: [] as string[] };
  }

  // Ordinary chat stops before constructing a revision request or choosing Muse.
  if (!mentionsMuse(input.text)) return { trip: current, changedStops: [] };
  if (current.pendingItineraryProposal?.status === "pending") return reply("Please finish voting on the open proposal first, then ask me to change the plan.");

  // Errors from Muse's last answer, sent back once so it can correct itself.
  let fixErrors: string[] = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const itinerary = current.itinerary;
    const planning = buildPlanningContext(current);
    if (!itinerary || !planning.success) return reply("Please complete the group's preferences and dates before asking me to edit the plan.");
    const request = buildRevisionRequest(planning.context, itinerary, current.chat ?? [], message);
    if (fixErrors.length > 0) {
      request.message.text += `\n\n(Your previous answer was rejected for these reasons: ${fixErrors.join(" ")} Answer again with every day and every stop fixed.)`;
    }
    const result = await dependencies.revise(request);
    const museMessage = makeChatMessage({ role: "muse", authorName: "Muse", text: result.reply });

    if (result.days) {
      result.days = repairRevisedDays(itinerary, result.days);
      // A revision keeps the itinerary's own days, so check against those dates
      // (the same rule used when the group approves a proposal).
      const validation = validateRevisedDays(itinerary, result.days, itinerary.days.map((day) => day.date), itinerary.basedOnCandidateId);
      if (!validation.valid) {
        console.warn("Muse revision rejected:", validation.errors);
        if (fixErrors.length === 0) {
          fixErrors = [...new Set(validation.errors)];
          continue;
        }
        return reply(`My proposed edit still didn't fit the trip (${validation.errors[0]}), so nothing changed. Could you say it another way?`);
      }
      const days = carryOverPlaces(itinerary.days, result.days);
      if (isMajorRevision(itinerary, result)) {
        const proposal = createItineraryProposal(current, traveler.id, { ...result, days });
        museMessage.text = "I've prepared a major trip change for the group to review. It has not been applied. Everyone who joined votes with the Approve or Reject buttons on the proposal card, and a majority must approve.";
        museMessage.changes = result.changes;
        const saved = await dependencies.saveItineraryProposal(tripId, proposal, museMessage);
        if (saved.status === "saved" || saved.status === "already-open") return { trip: saved.trip, changedStops: [] };
      } else {
        museMessage.changes = result.changes;
        const saved = await dependencies.saveItineraryRevision(tripId, itinerary.id, itinerary.revision ?? 0, days, museMessage);
        if (saved.status === "saved") return { trip: saved.trip, changedStops: getChangedStopKeys(itinerary.days, days) };
      }
      const refreshed = await dependencies.getTripById(tripId);
      if (!refreshed) throw new ChatError("Trip not found.", 404);
      current = refreshed;
      if (current.pendingItineraryProposal?.status === "pending") return { trip: current, changedStops: [] };
      continue;
    }

    if (result.personal) {
      const plan = result.personal;
      const day = itinerary.days.find((item) => item.dayNumber === plan.dayNumber);
      const stop = day?.activities.find((item) => item.title.trim().toLowerCase() === plan.stopTitle.toLowerCase());
      if (day && stop) {
        const saved = await dependencies.changePersonalOverride(tripId, { action: "add", travelerId: traveler.id, dayNumber: day.dayNumber, stopTime: stop.time, stopTitle: stop.title, title: plan.title.slice(0, 120), location: plan.location.slice(0, 160), note: plan.note.slice(0, 300) });
        if (saved.status === "updated") museMessage.changes = [`Personal plan for ${traveler.name}, Day ${day.dayNumber}: ${plan.title} instead of ${stop.title}`];
      }
    }
    const added = await dependencies.appendChatMessage(tripId, museMessage);
    return { trip: added.status === "added" ? added.trip : current, changedStops: [] };
  }
  return reply("The shared plan changed while I was thinking. Send your @muse request again for the newest version.");
}
