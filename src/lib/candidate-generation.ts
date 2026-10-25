import type { CandidatePlanner } from "./candidate-planner";
import { validateCandidateOptions } from "./candidate-validation";
import { estimateGroupFlightTimes } from "./flight-time";
import { logWarn } from "./server-log";
import { buildPlanningContext } from "./planning-context";
import { getTripFeasibility } from "./trip-feasibility";
import type { Trip } from "./trip-types";

export async function generateCandidateOptionsForTrip(
  trip: Trip,
  planner: CandidatePlanner,
) {
  const contextResult = buildPlanningContext(trip);

  if (!contextResult.success) {
    return {
      success: false as const,
      reason: "not-ready" as const,
      blockers: contextResult.readiness.blockers.map((blocker) => blocker.message),
    };
  }

  // Flight time decides how many days are really spent at the destination.
  const context = contextResult.context;
  if (context.trip.destination) {
    const flightTimes = await estimateGroupFlightTimes(context.travelers.map((traveler) => traveler.departureLocation), context.trip.destination);
    if (flightTimes) context.trip.flightTimes = flightTimes;
  }
  // The group was warned about these before generating; Muse should address them.
  const warnings = getTripFeasibility(trip, context.trip.flightTimes ?? null);
  if (warnings.length > 0) context.trip.feasibilityWarnings = warnings.map((warning) => `${warning.title}: ${warning.detail}`);

  // The Muse planner already asks again after a bad answer, and the Muse client
  // retries temporary errors, so this checks the final answer once.
  const candidates = await planner.generateCandidates(context);
  const validation = validateCandidateOptions(candidates);
  if (!validation.valid) logWarn("generate", "options failed validation", { tripId: trip.id, errors: validation.errors.slice(0, 5) });

  if (!validation.valid) {
    return {
      success: false as const,
      reason: "invalid-output" as const,
      errors: validation.errors,
    };
  }

  return {
    success: true as const,
    candidates,
  };
}
