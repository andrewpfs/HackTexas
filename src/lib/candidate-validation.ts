import type { CandidateTripOption } from "./trip-types";
import { isValidISODate } from "./date-utils";

function hasText(value: string) {
  return typeof value === "string" && value.trim() !== "";
}

export function validateCandidateOptions(candidates: CandidateTripOption[]) {
  const errors: string[] = [];

  if (candidates.length !== 3) {
    errors.push("The planner must return exactly 3 candidate options.");
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const candidateNumber = index + 1;

    if (
      !hasText(candidate.id) ||
      !hasText(candidate.title) ||
      !hasText(candidate.destination) ||
      !hasText(candidate.summary) ||
      !hasText(candidate.rationale) ||
      !hasText(candidate.generatedAt)
    ) {
      errors.push(`Candidate ${candidateNumber} is missing required text.`);
    }

    if (!hasText(candidate.suggestedStartDate) || !hasText(candidate.suggestedEndDate)) {
      errors.push(`Candidate ${candidateNumber} is missing its date range.`);
    } else if (
      !isValidISODate(candidate.suggestedStartDate) ||
      !isValidISODate(candidate.suggestedEndDate)
    ) {
      errors.push(`Candidate ${candidateNumber} must use YYYY-MM-DD dates.`);
    } else if (candidate.suggestedStartDate > candidate.suggestedEndDate) {
      errors.push(`Candidate ${candidateNumber} has an invalid date range.`);
    }

    if (candidate.estimatedDurationDays < 1) {
      errors.push(`Candidate ${candidateNumber} must last at least one day.`);
    }

    if (!Array.isArray(candidate.days) || candidate.days.length === 0) {
      errors.push(`Candidate ${candidateNumber} must include sample itinerary days.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
