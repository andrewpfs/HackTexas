import type { PlanningContext } from "./planning-context";
import type { CandidateTripOption, GroupItinerary, Trip } from "./trip-types";
import { getVotingSummary } from "./voting";

export type CompromiseVote = {
  travelerName: string;
  optionNumber: number;
  feedback: string | null;
};

// Everything the compromise step needs: the group's planning context, the three
// options, and how each traveler voted. Traveler IDs are left out on purpose.
export type CompromiseContext = {
  planning: PlanningContext;
  options: (Omit<CandidateTripOption, "id" | "generatedAt"> & { optionNumber: number })[];
  votes: CompromiseVote[];
  tallies: { optionNumber: number; voteCount: number }[];
  leadingOptionNumbers: number[];
};

export type ItineraryDraft = Omit<GroupItinerary, "id" | "source" | "generatedAt">;

export interface ItineraryPlanner {
  generateItinerary(context: CompromiseContext, candidates: CandidateTripOption[]): Promise<ItineraryDraft>;
}

export function buildCompromiseContext(trip: Trip, planning: PlanningContext): CompromiseContext {
  const candidates = trip.candidateOptions || [];
  const summary = getVotingSummary(trip);
  const votes: CompromiseVote[] = [];

  for (const vote of trip.votes || []) {
    const traveler = trip.travelers.find((item) => item.id === vote.travelerId);
    const optionIndex = candidates.findIndex((candidate) => candidate.id === vote.candidateId);
    if (!traveler || optionIndex === -1) {
      continue;
    }

    votes.push({
      travelerName: traveler.name,
      optionNumber: optionIndex + 1,
      feedback: vote.feedback || null,
    });
  }

  return {
    planning,
    options: candidates.map((candidate, index) => ({
      optionNumber: index + 1,
      title: candidate.title,
      destination: candidate.destination,
      summary: candidate.summary,
      rationale: candidate.rationale,
      estimatedDurationDays: candidate.estimatedDurationDays,
      suggestedStartDate: candidate.suggestedStartDate,
      suggestedEndDate: candidate.suggestedEndDate,
      highlights: candidate.highlights,
      considerations: candidate.considerations,
      days: candidate.days,
    })),
    votes,
    tallies: summary.tallies.map((tally) => ({
      optionNumber: tally.optionNumber,
      voteCount: tally.voteCount,
    })),
    leadingOptionNumbers: summary.tallies
      .filter((tally) => summary.leadingCandidateIds.includes(tally.candidateId))
      .map((tally) => tally.optionNumber),
  };
}
