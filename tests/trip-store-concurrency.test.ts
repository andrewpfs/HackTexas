import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseTripStore } from "../src/lib/supabase-trip-store";
import type { Trip } from "../src/lib/trip-types";

// A tiny in-memory stand-in for the Supabase table, with the same optimistic
// locking rule: an update only lands if the version hasn't changed. Every call
// takes a few random milliseconds, like a real network round trip.
function fakeClient(trip: Trip) {
  const row = { id: trip.id, data: structuredClone(trip), version: 1 };
  const pause = () => new Promise((resolve) => setTimeout(resolve, Math.random() * 15));
  const client = {
    from() {
      return {
        select() {
          return { eq() { return { async maybeSingle() { await pause(); return { data: structuredClone(row), error: null }; } }; } };
        },
        update(values: { data: Trip; version: number }) {
          return {
            eq() {
              return {
                eq(_column: string, version: number) {
                  return {
                    async select() {
                      await pause();
                      if (row.version !== version) return { data: [], error: null };
                      row.data = structuredClone(values.data);
                      row.version = values.version;
                      return { data: [{ id: row.id }], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, row };
}

test("8 phones saving the same trip at once all land without overwriting each other", async () => {
  const trip = { id: "t", inviteCode: "ABC123", hostName: "Jay", prompt: "", origin: "Austin", earliestPossibleDate: "2026-12-01", latestPossibleDate: "2026-12-05", status: "collecting_preferences", createdAt: "", travelers: [] } as unknown as Trip;
  const { client, row } = fakeClient(trip);
  const store = createSupabaseTripStore(client);

  const writers = Array.from({ length: 8 }, (_, index) =>
    store.update(trip.id, (current) => {
      current.travel = { ...current.travel, flights: { ...current.travel?.flights, [`traveler-${index}`]: { status: "done", from: "Austin", options: [] } } };
      return { save: true, result: index };
    }),
  );
  const results = await Promise.all(writers);

  assert.deepEqual(results.sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(Object.keys(row.data.travel?.flights ?? {}).length, 8);
  assert.equal(row.version, 9);
});
