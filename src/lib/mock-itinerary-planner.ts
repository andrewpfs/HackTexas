import type { CompromiseContext, ItineraryDraft, ItineraryPlanner } from "./itinerary-planner";
import type { CandidateActivity, CandidateTripOption, ItineraryActivity, ItineraryActivityType } from "./trip-types";

const typeKeywords: [ItineraryActivityType, string[]][] = [
  ["Free time", ["free time", "buffer", "flexible", "check-in", "check-out"]],
  ["Food", ["food", "dinner", "lunch", "breakfast", "market", "ramen", "cafe", "eat"]],
  ["Museums & Culture", ["museum", "temple", "shrine", "gallery", "history", "culture"]],
  ["Outdoors", ["hike", "park", "garden", "beach", "trail", "mountain"]],
  ["Shopping", ["shop", "mall", "boutique"]],
  ["Nightlife", ["bar", "club", "night"]],
  ["Relaxation", ["spa", "onsen", "relax", "rest"]],
  ["Travel", ["arrive", "arrival", "depart", "transfer", "train", "flight"]],
];

function guessActivityType(activity: CandidateActivity): ItineraryActivityType {
  const text = `${activity.title} ${activity.description}`.toLowerCase();
  for (const [type, keywords] of typeKeywords) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return type;
    }
  }
  return "Sightseeing";
}

function makeDayActivities(activities: CandidateActivity[], destination: string) {
  const stops: ItineraryActivity[] = [];
  const periods: CandidateActivity["timeOfDay"][] = ["Morning", "Afternoon", "Evening"];
  const times: Record<CandidateActivity["timeOfDay"], string[]> = {
    Morning: ["9:00 AM", "10:00 AM", "11:00 AM"],
    Afternoon: ["2:00 PM", "3:00 PM", "4:00 PM"],
    Evening: ["7:00 PM", "8:00 PM", "9:00 PM"],
  };
  for (const period of periods) {
    let count = 0;
    for (const activity of activities) {
      if (activity.timeOfDay !== period || count >= 3) continue;
      const type = guessActivityType(activity);
      stops.push({ time: times[period][count], title: activity.title, type, location: destination, description: activity.description, placeSearchQuery: type === "Travel" || type === "Free time" ? "" : `${activity.title} ${destination}` });
      count += 1;
    }
    // Add ordinary travel-life space only between already scheduled periods.
    if (period === "Morning" && count > 0 && activities.some((activity) => activity.timeOfDay !== "Morning")) {
      stops.push({ time: "12:00 PM", title: "Lunch And Travel Buffer", type: "Food", location: destination, description: "An unhurried meal and time to reach the next neighborhood.", placeSearchQuery: "" });
    }
    if (period === "Afternoon" && count > 0 && activities.some((activity) => activity.timeOfDay === "Evening")) {
      stops.push({ time: "5:00 PM", title: "Rest Or Explore Freely", type: "Free time", location: destination, description: "Leave room for rest, wandering, or a flexible break before dinner.", placeSearchQuery: "" });
    }
  }
  return stops;
}

// Deterministic stand-in for Muse: keeps the leading option as-is and records
// the group's feedback without changing the plan.
export class MockItineraryPlanner implements ItineraryPlanner {
  async generateItinerary(
    context: CompromiseContext,
    candidates: CandidateTripOption[],
  ): Promise<ItineraryDraft> {
    const baseNumber = context.leadingOptionNumbers[0] ?? 1;
    const base = candidates[baseNumber - 1];
    const supporters = context.votes.filter((vote) => vote.optionNumber === baseNumber);
    const others = context.votes.filter((vote) => vote.optionNumber !== baseNumber);

    const compromises: string[] = [];
    for (const vote of others) {
      compromises.push(
        `${vote.travelerName} preferred Option ${vote.optionNumber}. The demo planner keeps Option ${baseNumber} unchanged.`,
      );
    }
    for (const vote of context.votes) {
      if (vote.feedback) {
        compromises.push(`Feedback from ${vote.travelerName} noted for the group: "${vote.feedback}"`);
      }
    }

    return {
      basedOnCandidateId: base.id,
      title: base.title,
      destination: base.destination,
      startDate: base.suggestedStartDate,
      endDate: base.suggestedEndDate,
      summary: base.summary,
      compromiseExplanation: `${supporters.length} of ${context.votes.length} travelers chose Option ${baseNumber}, so it became the shared plan. The demo planner does not rewrite days around feedback; Muse does that when it is connected.`,
      compromises,
      days: base.days.map((day) => ({
        dayNumber: day.dayNumber,
        date: day.date,
        title: day.title,
        activities: makeDayActivities(day.activities, base.destination),
      })),
    };
  }
}
