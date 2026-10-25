import type { CandidateTripOption, Trip } from "./trip-types";

export const maximumFeedbackLength = 500;

export type CandidateTally = {
  candidateId: string;
  candidateTitle: string;
  optionNumber: number;
  voteCount: number;
  voterNames: string[];
};

export type VotingSummary = {
  votedCount: number;
  travelerCount: number;
  allVoted: boolean;
  tallies: CandidateTally[];
  leadingCandidateIds: string[];
  waitingOnNames: string[];
};

export type VoteValidationResult =
  | { valid: true; data: { candidateId: string; feedback?: string } }
  | { valid: false; errors: string[] };

export function validateVoteInput(
  body: unknown,
  candidates: CandidateTripOption[],
): VoteValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, errors: ["Please choose a trip option."] };
  }

  const values = body as Record<string, unknown>;
  const errors: string[] = [];

  const candidateId = typeof values.candidateId === "string" ? values.candidateId : "";
  if (!candidates.some((candidate) => candidate.id === candidateId)) {
    errors.push("Please choose one of the current trip options.");
  }

  let feedback: string | undefined;
  if (values.feedback !== undefined && values.feedback !== null) {
    if (typeof values.feedback !== "string") {
      errors.push("Feedback must be text.");
    } else if (values.feedback.trim().length > maximumFeedbackLength) {
      errors.push(`Feedback must be ${maximumFeedbackLength} characters or fewer.`);
    } else if (values.feedback.trim() !== "") {
      feedback = values.feedback.trim();
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: { candidateId, feedback } };
}

export function getVotingSummary(trip: Trip): VotingSummary {
  const candidates = trip.candidateOptions || [];
  const travelerIds = new Set(trip.travelers.map((traveler) => traveler.id));
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));

  // Ignore votes from travelers or options that no longer exist.
  const votes = (trip.votes || []).filter(
    (vote) => travelerIds.has(vote.travelerId) && candidateIds.has(vote.candidateId),
  );

  const tallies: CandidateTally[] = candidates.map((candidate, index) => {
    const voterNames: string[] = [];
    for (const vote of votes) {
      if (vote.candidateId !== candidate.id) {
        continue;
      }
      const voter = trip.travelers.find((traveler) => traveler.id === vote.travelerId);
      if (voter) {
        voterNames.push(voter.name);
      }
    }

    return {
      candidateId: candidate.id,
      candidateTitle: candidate.title,
      optionNumber: index + 1,
      voteCount: voterNames.length,
      voterNames,
    };
  });

  let highestCount = 0;
  for (const tally of tallies) {
    highestCount = Math.max(highestCount, tally.voteCount);
  }

  const leadingCandidateIds =
    highestCount === 0
      ? []
      : tallies.filter((tally) => tally.voteCount === highestCount).map((tally) => tally.candidateId);

  const votedTravelerIds = new Set(votes.map((vote) => vote.travelerId));
  const waitingOnNames = trip.travelers
    .filter((traveler) => !votedTravelerIds.has(traveler.id))
    .map((traveler) => traveler.name);

  return {
    votedCount: votedTravelerIds.size,
    travelerCount: trip.travelers.length,
    allVoted: trip.travelers.length > 0 && waitingOnNames.length === 0,
    tallies,
    leadingCandidateIds,
    waitingOnNames,
  };
}
