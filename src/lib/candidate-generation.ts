import type { CandidatePlanner } from "./candidate-planner";
import { validateCandidateOptions } from "./candidate-validation";
import { buildPlanningContext } from "./planning-context";
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

  const candidates = await planner.generateCandidates(contextResult.context);
  const validation = validateCandidateOptions(candidates);

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
