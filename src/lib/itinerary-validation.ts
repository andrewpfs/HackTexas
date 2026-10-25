import { getDatesInRange, isValidISODate } from "./date-utils";
import type { ItineraryDraft } from "./itinerary-planner";
import { itineraryActivityTypes } from "./trip-types";

function hasText(value: unknown) {
  return typeof value === "string" && value.trim() !== "";
}

export function validateItineraryDraft(
  draft: ItineraryDraft,
  sharedDates: string[],
  candidateIds: string[],
) {
  const errors: string[] = [];

  if (!candidateIds.includes(draft.basedOnCandidateId)) {
    errors.push("The itinerary must be based on one of the current trip options.");
  }

  if (
    !hasText(draft.title) ||
    !hasText(draft.destination) ||
    !hasText(draft.summary) ||
    !hasText(draft.compromiseExplanation)
  ) {
    errors.push("The itinerary is missing required text.");
  }

  if (!Array.isArray(draft.compromises)) {
    errors.push("The itinerary must list its compromises.");
  }

  if (!isValidISODate(draft.startDate) || !isValidISODate(draft.endDate) || draft.startDate > draft.endDate) {
    errors.push("The itinerary has an invalid date range.");
    return { valid: false, errors };
  }

  const tripDates = getDatesInRange(draft.startDate, draft.endDate);
  const shared = new Set(sharedDates);
  if (!tripDates.every((date) => shared.has(date))) {
    errors.push("The itinerary uses dates outside the group's shared availability.");
  }

  if (!Array.isArray(draft.days) || draft.days.length === 0) {
    errors.push("The itinerary must include at least one day.");
    return { valid: false, errors };
  }

  for (const day of draft.days) {
    if (!tripDates.includes(day.date)) {
      errors.push(`Day ${day.dayNumber} falls outside the itinerary dates.`);
    }
    if (!Array.isArray(day.activities) || day.activities.length === 0) {
      errors.push(`Day ${day.dayNumber} has no activities.`);
      continue;
    }
    for (const activity of day.activities) {
      if (!hasText(activity.time) || !hasText(activity.title)) {
        errors.push(`Day ${day.dayNumber} has an activity without a time or title.`);
      }
      if (!itineraryActivityTypes.includes(activity.type)) {
        errors.push(`Day ${day.dayNumber} has an activity with an unknown type.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
