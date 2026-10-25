import type { PlanningContext } from "./planning-context";
import type { CandidateTripOption } from "./trip-types";

export interface CandidatePlanner {
  generateCandidates(context: PlanningContext): Promise<CandidateTripOption[]>;
}
