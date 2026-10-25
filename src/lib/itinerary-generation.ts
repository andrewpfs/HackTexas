import { randomUUID } from "node:crypto";
import { buildCompromiseContext, type ItineraryPlanner } from "./itinerary-planner";
import { validateItineraryDraft } from "./itinerary-validation";
import { buildPlanningContext } from "./planning-context";
import { MusePlannerError } from "./muse-client";
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
  // One more try when Muse's itinerary breaks a rule (dates, missing days, ...),
  // telling it what was wrong. This is the usual cause of "sometimes it fails".
  let draft: Awaited<ReturnType<typeof planner.generateItinerary>> | null = null;
  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      draft = await planner.generateItinerary(attempt === 0 ? compromiseContext : { ...compromiseContext, previousAttemptProblems: errors }, candidates);
    } catch (error) {
      if (!(error instanceof MusePlannerError) || error.transient || attempt === 1) throw error;
      errors = [error.message];
      draft = null;
      continue;
    }
    const validation = validateItineraryDraft(
      draft,
      contextResult.context.groupAvailability.sharedDates,
      candidates.map((candidate) => candidate.id),
    );
    if (validation.valid) break;
    errors = validation.errors;
    console.warn("Muse itinerary was unusable:", errors);
    draft = null;
  }

  if (!draft) {
    return { success: false as const, reason: "invalid-output" as const, errors };
  }

  const itinerary: GroupItinerary = {
    id: randomUUID(),
    ...draft,
    source,
    generatedAt: new Date().toISOString(),
  };

  return { success: true as const, itinerary };
}
