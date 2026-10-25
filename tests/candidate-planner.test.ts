import test from "node:test";
import assert from "node:assert/strict";
import type { CandidatePlanner } from "../src/lib/candidate-planner";
import { generateCandidateOptionsForTrip } from "../src/lib/candidate-generation";
import { validateCandidateOptions } from "../src/lib/candidate-validation";
import { MockCandidatePlanner } from "../src/lib/mock-candidate-planner";
import { buildPlanningContext } from "../src/lib/planning-context";
import type {
  CandidateTripOption,
  Traveler,
  TravelerPreferences,
  Trip,
} from "../src/lib/trip-types";

function makePreferences(
  budget: number,
  durationDays: number,
): TravelerPreferences {
  return {
    currency: "USD",
    maximumBudget: budget,
    preferredDurationDays: durationDays,
    activityInterests: ["Food", "Sightseeing", "Museums & Culture"],
    lodgingType: "Hotel",
    groupLodgingPreference: "Stay with the group",
    lodgingAmenities: ["Near public transit"],
  };
}

function makeTraveler(
  id: string,
  name: string,
  isHost: boolean,
  availableDates: string[],
): Traveler {
  return {
    id,
    name,
    isHost,
    departureLocation: isHost ? "Austin, Texas" : "Dallas, Texas",
    preferencesComplete: true,
    preferences: makePreferences(isHost ? 1500 : 1900, isHost ? 4 : 3),
    availabilityComplete: true,
    availableDates,
  };
}

function makeTrip(destination: string | undefined, preferredDurationDays = 3): Trip {
  const sharedDates = [
    "2026-12-03",
    "2026-12-04",
    "2026-12-05",
    "2026-12-06",
  ];

  return {
    id: "trip-id",
    inviteCode: "ABC123",
    hostName: "Alex",
    prompt: "A fun group trip",
    origin: "Austin, Texas",
    destination,
    earliestPossibleDate: "2026-12-01",
    latestPossibleDate: "2026-12-10",
    preferredDurationDays,
    expectedTravelerCount: 2,
    status: "collecting_preferences",
    createdAt: "2026-10-24T00:00:00.000Z",
    travelers: [
      makeTraveler("host-id", "Alex", true, sharedDates),
      makeTraveler("guest-id", "Jordan", false, sharedDates),
    ],
    confirmedDates: { startDate: "2026-12-03", endDate: "2026-12-06", confirmedAt: "2026-10-25T00:00:00.000Z", confirmedByName: "Alex" },
  };
}

async function planTrip(trip: Trip) {
  const contextResult = buildPlanningContext(trip);
  assert.equal(contextResult.success, true);

  if (!contextResult.success) {
    throw new Error("Test trip should be ready.");
  }

  const planner = new MockCandidatePlanner();
  return planner.generateCandidates(contextResult.context);
}

function removeGeneratedMetadata(candidates: CandidateTripOption[]) {
  const copy = JSON.parse(JSON.stringify(candidates)) as CandidateTripOption[];

  for (const candidate of copy) {
    candidate.id = "stable-id";
    candidate.generatedAt = "stable-time";
  }

  return copy;
}

test("known destination planning returns exactly three options for that destination", async () => {
  const candidates = await planTrip(makeTrip("Japan"));

  assert.equal(candidates.length, 3);
  for (const candidate of candidates) {
    assert.equal(candidate.destination, "Japan");
  }
});

test("unknown destination planning returns three different destinations", async () => {
  const candidates = await planTrip(makeTrip(undefined));
  const destinations: string[] = [];

  for (const candidate of candidates) {
    if (!destinations.includes(candidate.destination)) {
      destinations.push(candidate.destination);
    }
  }

  assert.equal(candidates.length, 3);
  assert.equal(destinations.length, 3);
});

test("candidate dates stay inside shared availability", async () => {
  const trip = makeTrip("Chicago");
  const candidates = await planTrip(trip);
  const sharedDates = trip.travelers[0].availableDates || [];

  for (const candidate of candidates) {
    assert.equal(sharedDates.includes(candidate.suggestedStartDate), true);
    assert.equal(sharedDates.includes(candidate.suggestedEndDate), true);

    for (const day of candidate.days) {
      assert.equal(sharedDates.includes(day.date), true);
    }
  }
});

test("the same context produces substantively stable mock output", async () => {
  const trip = makeTrip(undefined);
  const firstCandidates = await planTrip(trip);
  const secondCandidates = await planTrip(trip);

  assert.deepEqual(
    removeGeneratedMetadata(firstCandidates),
    removeGeneratedMetadata(secondCandidates),
  );
});

test("confirmed dates shorter than the preferred length are used exactly", async () => {
  const candidates = await planTrip(makeTrip("Seattle", 7));

  for (const candidate of candidates) {
    assert.equal(candidate.estimatedDurationDays, 4);
    assert.equal(candidate.suggestedStartDate, "2026-12-03");
    assert.equal(candidate.suggestedEndDate, "2026-12-06");
  }
});

test("mock candidate output passes the validation boundary", async () => {
  const candidates = await planTrip(makeTrip("Chicago"));
  const validation = validateCandidateOptions(candidates);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test("an incomplete trip is rejected before the planner is called", async () => {
  const trip = makeTrip("Chicago");
  trip.travelers[1].preferencesComplete = false;
  trip.travelers[1].preferences = undefined;
  let plannerWasCalled = false;

  const trackingPlanner: CandidatePlanner = {
    async generateCandidates() {
      plannerWasCalled = true;
      return [];
    },
  };

  const result = await generateCandidateOptionsForTrip(trip, trackingPlanner);

  assert.equal(result.success, false);
  assert.equal(plannerWasCalled, false);
  if (!result.success) {
    assert.equal(result.reason, "not-ready");
  }
});

