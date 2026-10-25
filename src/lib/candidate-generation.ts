import type { CandidatePlanner } from "./candidate-planner";
import { validateCandidateOptions } from "./candidate-validation";
import { estimateGroupFlightTimes } from "./flight-time";
import { MusePlannerError } from "./muse-client";
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

  // Muse sometimes breaks a rule (like a date outside the trip). Ask once more
  // before giving up, so one bad answer doesn't stop the group.
  let candidates;
  let validation;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      candidates = await planner.generateCandidates(context);
    } catch (error) {
      if (attempt === 1 || !(error instanceof MusePlannerError)) throw error;
      logWarn("generate", "Muse options failed, trying again", { tripId: trip.id, error: error.message });
      continue;
    }
    validation = validateCandidateOptions(candidates);
    if (validation.valid) break;
    logWarn("generate", "Muse options were invalid, trying again", { tripId: trip.id, errors: validation.errors.slice(0, 5) });
  }

  if (!candidates || !validation || !validation.valid) {
    return {
      success: false as const,
      reason: "invalid-output" as const,
      errors: validation?.errors ?? [],
    };
  }

  return {
    success: true as const,
    candidates,
  };
}
