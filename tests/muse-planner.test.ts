import test from "node:test";
import assert from "node:assert/strict";
import { validateCandidateOptions } from "../src/lib/candidate-validation";
import {
  MuseCandidatePlanner,
  MusePlannerError,
} from "../src/lib/muse-candidate-planner";
import { buildPlanningContext } from "../src/lib/planning-context";
import type { Traveler, Trip } from "../src/lib/trip-types";

const sharedDates = ["2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"];

function makeTraveler(id: string, name: string, isHost: boolean): Traveler {
  return {
    id,
    name,
    isHost,
    departureLocation: isHost ? "Austin, Texas" : "Dallas, Texas",
    preferencesComplete: true,
    preferences: {
      currency: "USD",
      maximumBudget: 1500,
      preferredDurationDays: 3,
      activityInterests: ["Food", "Sightseeing"],
      lodgingType: "Hotel",
      groupLodgingPreference: "Stay with the group",
      lodgingAmenities: [],
    },
    availabilityComplete: true,
    availableDates: sharedDates,
  };
}

function makeContext(destination?: string) {
  const trip: Trip = {
    id: "trip-id",
    inviteCode: "ABC123",
    hostName: "Alex",
    prompt: "A fun group trip",
    origin: "Austin, Texas",
    destination,
    earliestPossibleDate: "2026-12-01",
    latestPossibleDate: "2026-12-10",
    status: "collecting_preferences",
    createdAt: "2026-10-24T00:00:00.000Z",
    travelers: [makeTraveler("a", "Alex", true), makeTraveler("b", "Jordan", false)],
  };
  const result = buildPlanningContext(trip);
  assert.equal(result.success, true);
  if (!result.success) {
    throw new Error("Expected a ready planning context.");
  }
  return result.context;
}

function makeCandidate(start: string, end: string, destination = "Tokyo") {
  return {
    title: "Option",
    destination,
    summary: "Summary",
    rationale: "Rationale",
    estimatedDurationDays: 2,
    suggestedStartDate: start,
    suggestedEndDate: end,
    highlights: ["One"],
    considerations: ["Two"],
    days: [
      {
        dayNumber: 1,
        date: start,
        title: "Day one",
        activities: [{ timeOfDay: "Morning", title: "Walk", description: "Explore" }],
      },
    ],
  };
}

function fakeFetch(content: unknown, status = 200) {
  const calls: { url: string; body: string }[] = [];
  const impl = (async (url: string, init: { body: string }) => {
    calls.push({ url, body: init.body });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
      { status },
    );
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const threeValid = {
  candidates: [
    makeCandidate("2026-12-03", "2026-12-04"),
    makeCandidate("2026-12-04", "2026-12-05"),
    makeCandidate("2026-12-05", "2026-12-06"),
  ],
};

test("parses structured output and passes validation", async () => {
  const { impl, calls } = fakeFetch(threeValid);
  const planner = new MuseCandidatePlanner({ apiKey: "test-key", fetchImpl: impl });
  const candidates = await planner.generateCandidates(makeContext());

  assert.equal(candidates.length, 3);
  assert.equal(validateCandidateOptions(candidates).valid, true);
  assert.ok(calls[0].url.endsWith("/chat/completions"));
  assert.equal(JSON.parse(calls[0].body).model, "muse-spark-1.3");
});

test("known destination is enforced on every candidate", async () => {
  const { impl } = fakeFetch(threeValid);
  const planner = new MuseCandidatePlanner({ apiKey: "test-key", fetchImpl: impl });
  const candidates = await planner.generateCandidates(makeContext("Japan"));

  assert.deepEqual(new Set(candidates.map((c) => c.destination)), new Set(["Japan"]));
});

test("rejects the wrong number of candidates", async () => {
  const { impl } = fakeFetch({ candidates: threeValid.candidates.slice(0, 2) });
  const planner = new MuseCandidatePlanner({ apiKey: "test-key", fetchImpl: impl });

  await assert.rejects(planner.generateCandidates(makeContext()), MusePlannerError);
});

test("rejects dates outside shared availability", async () => {
  const bad = {
    candidates: [
      makeCandidate("2026-12-03", "2026-12-04"),
      makeCandidate("2026-12-06", "2026-12-07"),
      makeCandidate("2026-12-05", "2026-12-06"),
    ],
  };
  const { impl } = fakeFetch(bad);
  const planner = new MuseCandidatePlanner({ apiKey: "test-key", fetchImpl: impl });

  await assert.rejects(planner.generateCandidates(makeContext()), MusePlannerError);
});

test("rejects malformed JSON and HTTP errors", async () => {
  const malformed = (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
      status: 200,
    })) as unknown as typeof fetch;
  const failing = fakeFetch({}, 500).impl;

  await assert.rejects(
    new MuseCandidatePlanner({ apiKey: "k", fetchImpl: malformed }).generateCandidates(
      makeContext(),
    ),
    MusePlannerError,
  );
  await assert.rejects(
    new MuseCandidatePlanner({ apiKey: "k", fetchImpl: failing }).generateCandidates(
      makeContext(),
    ),
    MusePlannerError,
  );
});
