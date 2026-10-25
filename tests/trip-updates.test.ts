import test from "node:test";
import assert from "node:assert/strict";
import { applyTripDetailsUpdate } from "../src/lib/trip-updates";
import type { Trip, UpdateTripInput } from "../src/lib/trip-types";

function makeTrip(): Trip {
  return {
    id: "trip-id", inviteCode: "ABC123", hostName: "Jay", prompt: "Old brief", origin: "Austin",
    destination: "Chicago", earliestPossibleDate: "2026-12-01", latestPossibleDate: "2026-12-10",
    status: "collecting_preferences", createdAt: "2026-10-24T00:00:00.000Z",
    travelers: [
      { id: "host", name: "Jay", isHost: true, departureLocation: "Austin", preferencesComplete: false, availabilityComplete: true, availableDates: ["2026-12-02", "2026-12-05", "2026-12-09"] },
      { id: "guest", name: "Tin", isHost: false, departureLocation: "Houston", preferencesComplete: false, availabilityComplete: true, availableDates: ["2026-12-05", "2026-12-06"] },
    ],
    candidateOptions: [{ id: "old", title: "Old", destination: "Chicago", summary: "Old", rationale: "Old", estimatedDurationDays: 2, suggestedStartDate: "2026-12-05", suggestedEndDate: "2026-12-06", highlights: ["Old"], considerations: ["Old"], days: [], generatedAt: "2026-10-24T00:00:00.000Z" }],
    candidatesGeneratedAt: "2026-10-24T00:00:00.000Z",
  };
}

test("host trip edits trim out-of-window dates and invalidate candidates", () => {
  const trip = makeTrip();
  const input: UpdateTripInput = { name: "Winter Weekend", prompt: "New brief", destination: "Denver", earliestPossibleDate: "2026-12-04", latestPossibleDate: "2026-12-07", preferredDurationDays: 3, expectedTravelerCount: 2 };
  const affected = applyTripDetailsUpdate(trip, input);
  assert.equal(affected, 1);
  assert.deepEqual(trip.travelers[0].availableDates, ["2026-12-05"]);
  assert.equal(trip.travelers[0].availabilityComplete, false);
  assert.equal(trip.travelers[1].availabilityComplete, true);
  assert.equal(trip.name, "Winter Weekend");
  assert.equal(trip.candidateOptions, undefined);
  assert.equal(trip.candidatesGeneratedAt, undefined);
});
