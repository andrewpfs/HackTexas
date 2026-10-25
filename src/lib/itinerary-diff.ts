import type { ItineraryDay } from "./trip-types";

export function getStopKey(day: ItineraryDay, activity: ItineraryDay["activities"][number]) {
  return `${day.dayNumber}|${activity.time}|${activity.title}`;
}

// Stops that are new or reworded in a revised plan.
export function getChangedStopKeys(oldDays: ItineraryDay[], newDays: ItineraryDay[]) {
  const before = new Set<string>();
  for (const day of oldDays) {
    for (const activity of day.activities) {
      before.add(getStopKey(day, activity));
    }
  }

  const changed: string[] = [];
  for (const day of newDays) {
    for (const activity of day.activities) {
      const key = getStopKey(day, activity);
      if (!before.has(key)) {
        changed.push(key);
      }
    }
  }
  return changed;
}

// Whether any stop that should have a real place does not have one yet.
export function needsPlaceLookup(days: ItineraryDay[]) {
  return days.some((day) =>
    day.activities.some(
      (activity) =>
        !activity.place &&
        activity.type !== "Travel" &&
        activity.type !== "Free time" &&
        (activity.placeSearchQuery ?? "x").trim() !== "",
    ),
  );
}
