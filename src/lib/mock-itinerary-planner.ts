import type { CompromiseContext, ItineraryDraft, ItineraryPlanner } from "./itinerary-planner";
import type { CandidateActivity, CandidateTripOption, ItineraryActivityType } from "./trip-types";

const timeOfDayClock: Record<CandidateActivity["timeOfDay"], string> = {
  Morning: "9:00 AM",
  Afternoon: "2:00 PM",
  Evening: "7:00 PM",
};

const typeKeywords: [ItineraryActivityType, string[]][] = [
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
        activities: day.activities.map((activity) => {
          const type = guessActivityType(activity);
          return {
            time: timeOfDayClock[activity.timeOfDay],
            title: activity.title,
            type,
            location: base.destination,
            description: activity.description,
            placeSearchQuery: type === "Travel" ? "" : `${activity.title} ${base.destination}`,
          };
        }),
      })),
    };
  }
}
