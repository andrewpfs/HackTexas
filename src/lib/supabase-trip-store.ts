import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Trip } from "./trip-types";
import type { TripStore } from "./trip-store";

const tableName = "trips";
// Several phones save the same trip at once (votes, each traveler's flight search,
// a hotel search per city, photos), so a save can lose the race a few times in a row.
const maximumUpdateAttempts = 12;

// Wait a little longer after each lost race, with randomness so the phones stop
// colliding in lockstep: about 50ms, 100ms, 200ms ... up to about 1 second.
function conflictDelay(attempt: number) {
  const base = Math.min(1000, 50 * 2 ** attempt);
  return new Promise((resolve) => setTimeout(resolve, base * (0.5 + Math.random())));
}

type TripRow = {
  id: string;
  data: Trip;
  version: number;
};

let cachedClient: SupabaseClient | null = null;

function getClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

// A request cancelled mid-flight (a refresh, a dev-server restart, a brief network blip) is worth one more try.
function isTransient(message: string) {
  return /abort|fetch failed|network|timeout|ECONNRESET|ETIMEDOUT/i.test(message);
}

async function withRetry<T extends { error: { message: string } | null }>(run: () => PromiseLike<T>): Promise<T> {
  const first = await run();
  if (first.error && isTransient(first.error.message)) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return run();
  }
  return first;
}

function fail(action: string, message: string): never {
  throw new Error(`Supabase could not ${action}: ${message}`);
}

// Exported for tests, which pass a fake client.
export function createSupabaseTripStore(client: SupabaseClient): TripStore {
  async function readRow(tripId: string) {
    const { data, error } = await withRetry(() =>
      client.from(tableName).select("id, data, version").eq("id", tripId).maybeSingle<TripRow>(),
    );

    if (error) {
      fail("load the trip", error.message);
    }
    return data;
  }

  return {
    async getById(tripId) {
      return (await readRow(tripId))?.data ?? null;
    },

    async getByInviteCode(inviteCode) {
      const { data, error } = await withRetry(() =>
        client.from(tableName).select("data").eq("invite_code", inviteCode.toUpperCase()).maybeSingle<{ data: Trip }>(),
      );

      if (error) {
        fail("look up the invite code", error.message);
      }
      return data?.data ?? null;
    },

    // Uses Postgres JSON containment, so it finds the trip without loading every trip.
    async findByTraveler(match) {
      const traveler = match.phoneHash !== undefined ? { phoneHash: match.phoneHash } : { assistantTokenHash: match.assistantTokenHash };
      const { data, error } = await client.from(tableName).select("data").contains("data", { travelers: [traveler] });
      if (error) {
        fail("look up your trips", error.message);
      }
      return (data ?? []).map((row: { data: Trip }) => row.data);
    },

    async insert(trip) {
      const { error } = await client.from(tableName).insert({
        id: trip.id,
        invite_code: trip.inviteCode.toUpperCase(),
        data: trip,
      });

      if (error) {
        fail("save the trip", error.message);
      }
    },

    async delete(tripId) {
      const { data, error } = await client.from(tableName).delete().eq("id", tripId).select("id");
      if (error) {
        fail("delete the trip", error.message);
      }
      return (data ?? []).length > 0;
    },

    // Optimistic locking: the write only succeeds if nobody else saved the trip
    // since it was read. On a conflict the trip is re-read and the change retried,
    // so two travelers voting at the same moment never overwrite each other.
    async update(tripId, mutate) {
      for (let attempt = 0; attempt < maximumUpdateAttempts; attempt += 1) {
        const row = await readRow(tripId);
        if (!row) {
          return null;
        }

        const { save, result } = mutate(row.data);
        if (!save) {
          return result;
        }

        const { data, error } = await client
          .from(tableName)
          .update({ data: row.data, version: row.version + 1, updated_at: new Date().toISOString() })
          .eq("id", tripId)
          .eq("version", row.version)
          .select("id");

        if (error) {
          fail("update the trip", error.message);
        }
        if (data && data.length > 0) {
          if (attempt > 0) console.log(`[store] saved trip ${tripId} after ${attempt} conflicts`);
          return result;
        }
        await conflictDelay(attempt);
      }

      console.error(`[store] gave up saving trip ${tripId} after ${maximumUpdateAttempts} conflicts`);
      fail("update the trip", "too many people changed it at once. Please try again.");
    },
  };
}

export function getSupabaseTripStore(): TripStore | null {
  const client = getClient();
  return client ? createSupabaseTripStore(client) : null;
}

export function isSupabaseConfigured() {
  return getClient() !== null;
}
