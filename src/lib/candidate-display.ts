import type { CandidateActivity, CandidateDay } from "./trip-types";

export function activityEmoji(activity: Pick<CandidateActivity, "title" | "description" | "timeOfDay">) {
  const text = `${activity.title} ${activity.description}`.toLowerCase();
  if (/flight|train|transfer|airport|transit|check.in|check.out/.test(text)) return "🚆";
  if (/food|meal|dinner|lunch|breakfast|ramen|cafe|restaurant/.test(text)) return "🍜";
  if (/museum|culture|temple|gallery|shrine|history/.test(text)) return "🏛️";
  if (/park|garden|hike|outdoor|beach|forest|trail/.test(text)) return "🌳";
  if (/shop|mall|boutique/.test(text)) return "🛍️";
  if (/nightlife|bar|club/.test(text)) return "🌙";
  if (/rest|free time|relax|buffer/.test(text)) return "☕";
  return "📍";
}

export function groupCandidateDays(days: CandidateDay[]) {
  const blocks: CandidateDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    blocks.push(days.slice(index, index + 7));
  }
  return blocks;
}
