import type { Trip, UpdateTripInput } from "./trip-types";

// Candidates, votes, and the shared itinerary all depend on planning inputs, so
// they are cleared together whenever trip details or traveler answers change.
export function clearPlanningOutputs(trip: Trip) {
  // Options were already planned, so Muse redoes them for the new inputs.
  if (trip.candidateOptions?.length) trip.optionsNeedRefresh = true;
  trip.candidateOptions = undefined;
  trip.candidatesGeneratedAt = undefined;
  trip.candidatesSource = undefined;
  trip.optionPhotosStatus = undefined;
  trip.optionPhotosStartedAt = undefined;
  trip.votes = undefined;
  trip.itinerary = undefined;
  trip.chat = undefined;
  trip.travel = undefined;
  trip.pendingItineraryProposal = undefined;
  trip.lastApprovedItineraryProposal = undefined;
}

export function applyTripDetailsUpdate(trip: Trip, input: UpdateTripInput) {
  let affectedTravelerCount = 0;

  for (const traveler of trip.travelers) {
    const oldDates = traveler.availableDates || [];
    const keptDates: string[] = [];

    for (const date of oldDates) {
      if (date >= input.earliestPossibleDate && date <= input.latestPossibleDate) {
        keptDates.push(date);
      }
    }

    if (keptDates.length !== oldDates.length) {
      traveler.availableDates = keptDates;
      traveler.availabilityComplete = false;
      affectedTravelerCount += 1;
    }
  }

  trip.name = input.name;
  trip.prompt = input.prompt;
  trip.destination = input.destination;
  trip.earliestPossibleDate = input.earliestPossibleDate;
  trip.latestPossibleDate = input.latestPossibleDate;
  trip.preferredDurationDays = input.preferredDurationDays;
  trip.expectedTravelerCount = input.expectedTravelerCount;
  // The sketch is drawn from these details. It stays on screen and is redrawn in
  // the background because its inputs changed (see sketchNeedsRedraw).
  clearPlanningOutputs(trip);

  return affectedTravelerCount;
}

// Just over the 60-second route limit: a lock older than this belongs to a request the host already stopped.
const candidateGenerationTimeoutMs = 90 * 1000;

// True while some browser is planning options (the lock expires after 3 minutes).
export function isGeneratingCandidates(trip: Pick<Trip, "candidatesGeneratingSince">, now = Date.now()) {
  return Boolean(trip.candidatesGeneratingSince && now - Date.parse(trip.candidatesGeneratingSince) < candidateGenerationTimeoutMs);
}
