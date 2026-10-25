import { randomUUID } from "node:crypto";
import { buildCompromiseContext, type ItineraryPlanner } from "./itinerary-planner";
import { validateItineraryDraft } from "./itinerary-validation";
import { buildPlanningContext } from "./planning-context";
import type { GroupItinerary, PlannerSource, Trip } from "./trip-types";
import { getVotingSummary } from "./voting";

export async function generateGroupItineraryForTrip(
  trip: Trip,
  planner: ItineraryPlanner,
  source: PlannerSource,
) {
  const candidates = trip.candidateOptions || [];
  if (candidates.length === 0) {
    return { success: false as const, reason: "no-candidates" as const };
  }

  const voting = getVotingSummary(trip);
  if (!voting.allVoted) {
    return {
      success: false as const,
      reason: "votes-missing" as const,
      waitingOnNames: voting.waitingOnNames,
    };
  }

  const contextResult = buildPlanningContext(trip);
  if (!contextResult.success) {
    return { success: false as const, reason: "not-ready" as const };
  }

  const compromiseContext = buildCompromiseContext(trip, contextResult.context);
  const draft = await planner.generateItinerary(compromiseContext, candidates);
  const validation = validateItineraryDraft(
    draft,
    contextResult.context.groupAvailability.sharedDates,
    candidates.map((candidate) => candidate.id),
  );

  if (!validation.valid) {
    return { success: false as const, reason: "invalid-output" as const, errors: validation.errors };
  }

  const itinerary: GroupItinerary = {
    id: randomUUID(),
    ...draft,
    source,
    generatedAt: new Date().toISOString(),
  };

  return { success: true as const, itinerary };
}
