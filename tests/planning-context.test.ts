import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlanningContext,
  calculatePlanningReadiness,
} from "../src/lib/planning-context";
import { describeTripDates, suggestTripDates } from "../src/lib/date-suggestions";
import type {
  Traveler,
  TravelerPreferences,
  Trip,
} from "../src/lib/trip-types";

function makePreferences(maximumBudget: number): TravelerPreferences {
  return {
    currency: "USD",
    maximumBudget,
    preferredDurationDays: 4,
    activityInterests: ["Food", "Sightseeing"],
    lodgingType: "Hotel",
    groupLodgingPreference: "Stay with the group",
    lodgingAmenities: ["Near public transit"],
  };
}

function makeCompleteTraveler(
  id: string,
  name: string,
  isHost: boolean,
  availableDates: string[],
): Traveler {
  return {
    id,
    name,
    isHost,
    departureLocation: isHost ? "Austin, Texas" : "Houston, Texas",
    preferencesComplete: true,
    preferences: makePreferences(isHost ? 1800 : 2200),
    availabilityComplete: true,
    availableDates,
  };
}

function makeTrip(travelers: Traveler[]): Trip {
  return {
    id: "private-trip-id",
    inviteCode: "SECRET",
    hostName: "Host Person",
    prompt: "Plan a group trip",
    origin: "Austin, Texas",
    destination: "Chicago",
    earliestPossibleDate: "2026-12-01",
    latestPossibleDate: "2026-12-10",
    preferredDurationDays: 3,
    expectedTravelerCount: 2,
    status: "collecting_preferences",
    createdAt: "2026-10-24T00:00:00.000Z",
    travelers,
  };
}

function makeReadyTrip() {
  const guest = makeCompleteTraveler(
    "private-guest-id",
    "Guest Person",
    false,
    ["2026-12-05", "2026-12-03", "2026-12-04"],
  );
  const host = makeCompleteTraveler(
    "private-host-id",
    "Host Person",
    true,
    ["2026-12-04", "2026-12-03", "2026-12-05"],
  );

  const trip = makeTrip([guest, host]);
  trip.confirmedDates = { startDate: "2026-12-03", endDate: "2026-12-05", confirmedAt: "2026-10-25T00:00:00.000Z", confirmedByName: "Host Person" };
  return trip;
}

test("missing preferences creates a named blocker", () => {
  const trip = makeReadyTrip();
  trip.travelers[0].preferencesComplete = false;
  trip.travelers[0].preferences = undefined;

  const readiness = calculatePlanningReadiness(trip);

  assert.equal(readiness.readyForCandidateGeneration, false);
  assert.equal(readiness.blockers[0].code, "preferences_incomplete");
  assert.match(readiness.blockers[0].message, /Guest Person/);
});

test("missing availability creates a named blocker", () => {
  const trip = makeReadyTrip();
  trip.travelers[1].availabilityComplete = false;
  trip.travelers[1].availableDates = undefined;

  const readiness = calculatePlanningReadiness(trip);

  assert.equal(readiness.readyForCandidateGeneration, false);
  const availabilityBlocker = readiness.blockers.find((blocker) => {
    return blocker.code === "availability_incomplete";
  });
  assert.equal(availabilityBlocker?.travelerName, "Host Person");
});

test("complete travelers with overlapping dates are ready", () => {
  const readiness = calculatePlanningReadiness(makeReadyTrip());

  assert.equal(readiness.readyForCandidateGeneration, true);
  assert.deepEqual(readiness.sharedDates, [
    "2026-12-03",
    "2026-12-04",
    "2026-12-05",
  ]);
  assert.equal(readiness.viableWindows.length, 1);
});

test("complete travelers without overlap receive a blocker", () => {
  const trip = makeReadyTrip();
  trip.travelers[0].availableDates = ["2026-12-01"];
  trip.travelers[1].availableDates = ["2026-12-02"];

  const readiness = calculatePlanningReadiness(trip);

  assert.equal(readiness.readyForCandidateGeneration, false);
  assert.equal(readiness.blockers[0].code, "no_shared_dates");
});

test("a shared window shorter than the preferred duration is only a warning", () => {
  const trip = makeReadyTrip();
  trip.preferredDurationDays = 5;

  const readiness = calculatePlanningReadiness(trip);

  assert.equal(readiness.readyForCandidateGeneration, true);
  assert.equal(readiness.viableWindows.length, 0);
  assert.equal(readiness.warnings[0].code, "shared_window_shorter_than_preferred");
  assert.match(readiness.warnings[0].message, /3 days/);
  assert.match(readiness.warnings[0].message, /5-day trip/);
});

test("fewer joined travelers than expected creates only a warning", () => {
  const trip = makeReadyTrip();
  trip.expectedTravelerCount = 4;

  const readiness = calculatePlanningReadiness(trip);

  assert.equal(readiness.readyForCandidateGeneration, true);
  assert.equal(readiness.blockers.length, 0);
  assert.equal(readiness.warnings[0].code, "fewer_travelers_than_expected");
});

test("a supplied destination uses known destination mode", () => {
  const readiness = calculatePlanningReadiness(makeReadyTrip());

  assert.equal(readiness.planningMode, "known_destination");
});

test("a missing destination uses unknown destination mode without a blocker", () => {
  const trip = makeReadyTrip();
  trip.destination = undefined;

  const readiness = calculatePlanningReadiness(trip);

  assert.equal(readiness.planningMode, "unknown_destination");
  assert.equal(readiness.readyForCandidateGeneration, true);
});

test("planning context excludes storage and identity details", () => {
  const result = buildPlanningContext(makeReadyTrip());

  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  const serializedContext = JSON.stringify(result.context);
  assert.equal(serializedContext.includes("SECRET"), false);
  assert.equal(serializedContext.includes("private-trip-id"), false);
  assert.equal(serializedContext.includes("private-host-id"), false);
  assert.equal(serializedContext.includes("createdAt"), false);
});

test("planning context has deterministic traveler and date ordering", () => {
  const result = buildPlanningContext(makeReadyTrip());

  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.context.travelers[0].name, "Host Person");
  assert.equal(result.context.travelers[0].departureLocation, "Austin, Texas");
  assert.equal(result.context.travelers[1].name, "Guest Person");
  assert.equal(result.context.travelers[1].departureLocation, "Houston, Texas");
  assert.deepEqual(result.context.travelers[1].availableDates, [
    "2026-12-03",
    "2026-12-04",
    "2026-12-05",
  ]);
});

test("legacy host origin is used but a guest without an origin is blocked", () => {
  const trip = makeReadyTrip();
  trip.travelers[0].departureLocation = undefined;
  trip.travelers[1].departureLocation = undefined;

  const readiness = calculatePlanningReadiness(trip);

  const originBlockers = readiness.blockers.filter((blocker) => blocker.code === "departure_location_missing");
  assert.equal(originBlockers.length, 1);
  assert.equal(originBlockers[0].travelerName, "Guest Person");
});

test("an old trip without availability fields remains readable but not ready", () => {
  const oldTraveler: Traveler = {
    id: "old-id",
    name: "Old Traveler",
    isHost: true,
    preferencesComplete: false,
  };
  const oldTrip = makeTrip([oldTraveler]);

  const readiness = calculatePlanningReadiness(oldTrip);
  const contextResult = buildPlanningContext(oldTrip);

  assert.equal(readiness.readyForCandidateGeneration, false);
  assert.equal(readiness.availabilityCompleteCount, 0);
  assert.equal(contextResult.success, false);
});

test("options wait until the host confirms dates the whole group shares", () => {
  const trip = makeReadyTrip();
  trip.confirmedDates = undefined;
  assert.equal(calculatePlanningReadiness(trip).blockers[0]?.code, "dates_not_confirmed");

  trip.confirmedDates = { startDate: "2026-12-04", endDate: "2026-12-06", confirmedAt: "", confirmedByName: "Host Person" };
  assert.match(calculatePlanningReadiness(trip).blockers[0]?.message ?? "", /again/);

  trip.itinerary = {} as Trip["itinerary"];
  assert.equal(calculatePlanningReadiness(trip).readyForCandidateGeneration, true);
});

test("confirmed dates narrow what Muse may plan", () => {
  const trip = makeReadyTrip();
  trip.confirmedDates = { startDate: "2026-12-04", endDate: "2026-12-05", confirmedAt: "", confirmedByName: "Host Person" };
  const result = buildPlanningContext(trip);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.context.groupAvailability.sharedDates, ["2026-12-04", "2026-12-05"]);
  assert.equal(result.context.trip.hostPreferredDurationDays, 2);
});

test("date suggestions dodge holiday peaks and pricey weekend flights", () => {
  const picks = suggestTripDates([{ startDate: "2026-12-08", endDate: "2026-12-30", dayCount: 23 }], 4);
  assert.equal(picks.length, 3);
  for (const pick of picks) assert.equal(pick.endDate < "2026-12-19", true);
  assert.match(describeTripDates("2026-12-23", "2026-12-27").notes[0], /Christmas/);
  assert.match(describeTripDates("2026-11-24", "2026-11-28").notes[0], /Thanksgiving/);
  assert.match(describeTripDates("2026-12-08", "2026-12-11").notes.join(" "), /Tue/);
});
