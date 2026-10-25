import test from "node:test";
import assert from "node:assert/strict";
import { generateGroupItineraryForTrip } from "../src/lib/itinerary-generation";
import { MockItineraryPlanner } from "../src/lib/mock-itinerary-planner";
import { MuseItineraryPlanner } from "../src/lib/muse-itinerary-planner";
import { MusePlannerError } from "../src/lib/muse-client";
import { clearPlanningOutputs } from "../src/lib/trip-updates";
import { getVotingSummary, validateVoteInput } from "../src/lib/voting";
import type { CandidateTripOption, Traveler, Trip } from "../src/lib/trip-types";

const sharedDates = ["2026-12-17", "2026-12-18", "2026-12-19"];

function makeTraveler(id: string, name: string, isHost: boolean): Traveler {
  return {
    id,
    name,
    isHost,
    departureLocation: isHost ? "Austin, Texas" : "Houston, Texas",
    preferencesComplete: true,
    preferences: {
      currency: "USD",
      maximumBudget: 2000,
      preferredDurationDays: 3,
      activityInterests: ["Food", "Outdoors"],
      lodgingType: "Hotel",
      groupLodgingPreference: "Stay with the group",
      lodgingAmenities: [],
    },
    availabilityComplete: true,
    availableDates: sharedDates,
  };
}

function makeCandidate(id: string, title: string): CandidateTripOption {
  return {
    id,
    title,
    destination: "Japan",
    summary: "Summary",
    rationale: "Rationale",
    estimatedDurationDays: 2,
    suggestedStartDate: "2026-12-17",
    suggestedEndDate: "2026-12-18",
    highlights: ["Highlight"],
    considerations: ["Consideration"],
    days: [
      { dayNumber: 1, date: "2026-12-17", title: "Arrive", activities: [{ timeOfDay: "Evening", title: "Ramen dinner", description: "Eat together" }] },
      { dayNumber: 2, date: "2026-12-18", title: "Explore", activities: [{ timeOfDay: "Morning", title: "Temple walk", description: "Culture" }] },
    ],
    generatedAt: "2026-10-24T00:00:00.000Z",
  };
}

function makeTrip(): Trip {
  return {
    id: "trip-id",
    inviteCode: "ABC123",
    hostName: "Jay",
    prompt: "Japan winter trip",
    origin: "Austin, Texas",
    destination: "Japan",
    earliestPossibleDate: "2026-12-15",
    latestPossibleDate: "2026-12-31",
    status: "collecting_preferences",
    createdAt: "2026-10-24T00:00:00.000Z",
    travelers: [makeTraveler("jay", "Jay", true), makeTraveler("henry", "Henry", false), makeTraveler("maya", "Maya", false)],
    candidateOptions: [makeCandidate("a", "Balanced"), makeCandidate("b", "Food and Culture"), makeCandidate("c", "Relaxed")],
    candidatesSource: "mock",
  };
}

const votedAt = "2026-10-24T00:00:00.000Z";

test("vote input must reference a current option and keep feedback short", () => {
  const candidates = makeTrip().candidateOptions!;
  assert.equal(validateVoteInput({ candidateId: "b", feedback: "  Love it " }, candidates).valid, true);
  assert.equal(validateVoteInput({ candidateId: "zzz" }, candidates).valid, false);
  assert.equal(validateVoteInput({ candidateId: "a", feedback: "x".repeat(501) }, candidates).valid, false);

  const result = validateVoteInput({ candidateId: "a", feedback: "   " }, candidates);
  assert.ok(result.valid && result.data.feedback === undefined);
});

test("voting summary tallies votes, finds leaders, and lists who is missing", () => {
  const trip = makeTrip();
  trip.votes = [
    { travelerId: "jay", candidateId: "b", votedAt },
    { travelerId: "henry", candidateId: "b", votedAt },
    { travelerId: "ghost", candidateId: "a", votedAt },
  ];

  const summary = getVotingSummary(trip);
  assert.equal(summary.votedCount, 2);
  assert.equal(summary.allVoted, false);
  assert.deepEqual(summary.leadingCandidateIds, ["b"]);
  assert.deepEqual(summary.waitingOnNames, ["Maya"]);
  assert.deepEqual(summary.tallies[1].voterNames, ["Jay", "Henry"]);
});

test("itinerary generation waits for every joined traveler to vote", async () => {
  const trip = makeTrip();
  trip.votes = [{ travelerId: "jay", candidateId: "a", votedAt }];

  const result = await generateGroupItineraryForTrip(trip, new MockItineraryPlanner(), "mock");
  assert.equal(result.success, false);
  assert.ok(!result.success && result.reason === "votes-missing");
});

test("mock planner builds a valid itinerary from the leading option", async () => {
  const trip = makeTrip();
  trip.votes = [
    { travelerId: "jay", candidateId: "b", votedAt },
    { travelerId: "henry", candidateId: "b", votedAt },
    { travelerId: "maya", candidateId: "c", feedback: "I want an outdoor day.", votedAt },
  ];

  const result = await generateGroupItineraryForTrip(trip, new MockItineraryPlanner(), "mock");
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.itinerary.basedOnCandidateId, "b");
  assert.equal(result.itinerary.source, "mock");
  assert.equal(result.itinerary.days[0].activities[0].time, "7:00 PM");
  assert.equal(result.itinerary.days[0].activities[0].type, "Food");
  assert.ok(result.itinerary.compromises.some((item) => item.includes("Maya")));
});

function museResponse(content: unknown) {
  return (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
      status: 200,
    })) as unknown as typeof fetch;
}

const museItinerary = {
  basedOnOptionNumber: 2,
  title: "Food and Culture, Plus Hakone",
  destination: "Japan",
  startDate: "2026-12-17",
  endDate: "2026-12-18",
  summary: "Summary",
  compromiseExplanation: "Option 2 won, and Maya's outdoor request added a hike.",
  compromises: ["Added a Hakone hike for Maya."],
  days: [
    { dayNumber: 1, date: "2026-12-17", title: "Arrive", activities: [{ time: "6:00 PM", title: "Dinner", type: "Food", location: "Shinjuku", description: "Ramen" }] },
    { dayNumber: 2, date: "2026-12-18", title: "Hakone", activities: [{ time: "9:00 AM", title: "Hike", type: "Outdoors", location: "Hakone", description: "Trail" }] },
  ],
};

function votedTrip() {
  const trip = makeTrip();
  trip.votes = [
    { travelerId: "jay", candidateId: "b", votedAt },
    { travelerId: "henry", candidateId: "b", votedAt },
    { travelerId: "maya", candidateId: "c", feedback: "I want an outdoor day.", votedAt },
  ];
  return trip;
}

test("Muse itinerary output maps the option number and passes validation", async () => {
  const planner = new MuseItineraryPlanner({ apiKey: "k", fetchImpl: museResponse(museItinerary) });
  const result = await generateGroupItineraryForTrip(votedTrip(), planner, "muse");

  assert.equal(result.success, true);
  assert.ok(result.success && result.itinerary.basedOnCandidateId === "b");
});

test("Muse itinerary outside shared dates is rejected", async () => {
  const bad = { ...museItinerary, endDate: "2026-12-20" };
  const planner = new MuseItineraryPlanner({ apiKey: "k", fetchImpl: museResponse(bad) });
  const result = await generateGroupItineraryForTrip(votedTrip(), planner, "muse");

  assert.ok(!result.success && result.reason === "invalid-output");
});

test("Muse itinerary with an unknown option number throws a planner error", async () => {
  const planner = new MuseItineraryPlanner({
    apiKey: "k",
    fetchImpl: museResponse({ ...museItinerary, basedOnOptionNumber: 7 }),
  });

  await assert.rejects(generateGroupItineraryForTrip(votedTrip(), planner, "muse"), MusePlannerError);
});

test("clearing planning outputs drops candidates, votes, and itinerary together", () => {
  const trip = votedTrip();
  clearPlanningOutputs(trip);

  assert.equal(trip.candidateOptions, undefined);
  assert.equal(trip.candidatesSource, undefined);
  assert.equal(trip.votes, undefined);
  assert.equal(trip.itinerary, undefined);
});
