import { buildRevisionRequest, carryOverPlaces, detectRequestScope, makeChatMessage, mentionsMuse, personalPlansFromRevision, repairRevisedDays, validateRevisedDays, type PersonalPlan, type RevisionRequest, type RevisionResult } from "./itinerary-revision";
import { createItineraryProposal, isMajorRevision } from "./itinerary-proposals";
import { buildPlanningContext } from "./planning-context";
import type { ChatMessage, PlaceSuggestion } from "./trip-types";

// Inject storage and Muse so tests never call providers or write real trip data.
type ChatDependencies = Pick<typeof import("./trip-repository"), "getTripById" | "appendChatMessage" | "changePersonalOverride" | "saveItineraryRevision" | "saveItineraryProposal"> & {
  revise: (request: RevisionRequest) => Promise<RevisionResult>;
  // Real places for "show me other options" requests. Missing in tests and without SerpApi.
  findPlaces?: (query: string) => Promise<PlaceSuggestion[]>;
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

  // A request that is only about the sender ("I'd rather skip the museum") becomes
  // their personal plan, never a group vote.
  const scope = detectRequestScope(input.text);
  async function savePersonalPlans(plans: PersonalPlan[], museMessage: ChatMessage, itinerary: NonNullable<typeof current.itinerary>) {
    const saved: string[] = [];
    for (const plan of plans) {
      const day = itinerary.days.find((item) => item.dayNumber === plan.dayNumber);
      const stop = day?.activities.find((item) => item.title.trim().toLowerCase() === plan.stopTitle.trim().toLowerCase());
      if (!day || !stop) continue;
      const result = await dependencies.changePersonalOverride(tripId, { action: "add", travelerId: traveler!.id, dayNumber: day.dayNumber, stopTime: stop.time, stopTitle: stop.title, title: plan.title.slice(0, 120), location: plan.location.slice(0, 160), note: plan.note.slice(0, 300) });
      if (result.status === "updated") saved.push(`Personal plan for ${traveler!.name}, Day ${day.dayNumber}: ${plan.title} instead of ${stop.title}`);
    }
    if (saved.length > 0) museMessage.changes = saved;
    return saved.length > 0;
  }

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

    // Muse's own personal plan wins unless the traveler spoke for the whole group.
    if (result.personal && scope !== "group") {
      await savePersonalPlans([result.personal], museMessage, itinerary);
      const added = await dependencies.appendChatMessage(tripId, museMessage);
      return { trip: added.status === "added" ? added.trip : current, changedStops: [] };
    }

    if (result.days && scope === "personal" && !isMajorRevision(itinerary, result)) {
      const plans = personalPlansFromRevision(itinerary.days, result.days);
      if (plans.length > 0 && await savePersonalPlans(plans, museMessage, itinerary)) {
        museMessage.text = `That sounds like just you, so I made it your personal plan. The group plan stays the same, and friends can join you. If you meant it for everyone, say "we" and I'll put it to a vote.`;
        const added = await dependencies.appendChatMessage(tripId, museMessage);
        return { trip: added.status === "added" ? added.trip : current, changedStops: [] };
      }
    }

    if (result.days) {
      // Questions, personal plans and place options still work during a vote;
      // only a new change to the shared plan has to wait for it.
      if (current.pendingItineraryProposal?.status === "pending") return reply("There's already a group vote open. Please finish voting on it first, then ask me for this change.");
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
      // Muse never edits the shared plan directly: every group change goes to a vote.
      // If the group says no to a small change, it becomes the requester's personal plan.
      const major = isMajorRevision(itinerary, result);
      const proposal = createItineraryProposal(current, traveler.id, { ...result, days });
      museMessage.text = major
        ? `${result.reply} This is a big change, so it goes to a group vote. Nothing changes until a majority approves.`
        : `${result.reply} I've put it to a group vote. If the group says no, ${traveler.name} can still do it as a personal plan.`;
      museMessage.changes = result.changes;
      const saved = await dependencies.saveItineraryProposal(tripId, proposal, museMessage);
      if (saved.status === "saved") return { trip: saved.trip, changedStops: [], proposalOpened: true };
      if (saved.status === "already-open") return { trip: saved.trip, changedStops: [] };
      const refreshed = await dependencies.getTripById(tripId);
      if (!refreshed) throw new ChatError("Trip not found.", 404);
      current = refreshed;
      if (current.pendingItineraryProposal?.status === "pending") return { trip: current, changedStops: [] };
      continue;
    }

    if (result.alternatives) {
      const wanted = result.alternatives;
      const day = itinerary.days.find((item) => item.dayNumber === wanted.dayNumber);
      const stop = day?.activities.find((item) => item.title.trim().toLowerCase() === wanted.stopTitle.toLowerCase());
      let places: PlaceSuggestion[] = [];
      if (day && stop && dependencies.findPlaces) {
        try { places = (await dependencies.findPlaces(wanted.searchQuery)).slice(0, 3); }
        catch (error) { console.error("Place options failed:", error); }
      }
      if (day && stop && places.length > 0) {
        museMessage.placeOptions = { requestedByTravelerId: traveler.id, dayNumber: day.dayNumber, stopTime: stop.time, stopTitle: stop.title, places };
      } else {
        museMessage.text = `${result.reply} I couldn't load real options for that stop right now, so try asking again in a moment.`;
      }
      const added = await dependencies.appendChatMessage(tripId, museMessage);
      return { trip: added.status === "added" ? added.trip : current, changedStops: [] };
    }

    // A personal plan when the traveler spoke for the group: Muse misread it, so just reply.
    const added = await dependencies.appendChatMessage(tripId, museMessage);
    return { trip: added.status === "added" ? added.trip : current, changedStops: [] };
  }
  return reply("The shared plan changed while I was thinking. Send your @muse request again for the newest version.");
}
