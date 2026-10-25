import type { Trip, UpdateTripInput } from "./trip-types";

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
  trip.candidateOptions = undefined;
  trip.candidatesGeneratedAt = undefined;

  return affectedTravelerCount;
}
