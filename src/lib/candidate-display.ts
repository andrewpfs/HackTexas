import type { CandidateActivity, CandidateDay } from "./trip-types";
import { activityIcon } from "./activity-icons";

export function activityEmoji(activity: Pick<CandidateActivity, "title" | "description" | "timeOfDay">) {
  const text = `${activity.title} ${activity.description}`.toLowerCase();
  const icon = activityIcon(activity);
  if (icon !== "📍") return icon;
  if (/transfer|airport|transit/.test(text)) return "🚆";
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
