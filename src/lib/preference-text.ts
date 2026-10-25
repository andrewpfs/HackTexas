import type { TravelerPreferences } from "./trip-types";

// Keep legacy location notes visible in the current single question.
export function combinedPreferenceText(preferences: Pick<TravelerPreferences, "destinationPreferences" | "notes">) {
  const places = preferences.destinationPreferences?.trim() || "";
  const notes = preferences.notes?.trim() || "";
  if (!places) return notes;
  if (!notes || places === notes) return places;
  if (notes.includes(places)) return notes;
  if (places.includes(notes)) return places;
  return `${places}\n\n${notes}`;
}
