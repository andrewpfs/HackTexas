import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Trip } from "./trip-types";
import type { TripStore } from "./trip-store";

const tableName = "trips";
const maximumUpdateAttempts = 5;

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

function fail(action: string, message: string): never {
  throw new Error(`Supabase could not ${action}: ${message}`);
}

function createSupabaseTripStore(client: SupabaseClient): TripStore {
  async function readRow(tripId: string) {
    const { data, error } = await client
      .from(tableName)
      .select("id, data, version")
      .eq("id", tripId)
      .maybeSingle<TripRow>();

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
      const { data, error } = await client
        .from(tableName)
        .select("data")
        .eq("invite_code", inviteCode.toUpperCase())
        .maybeSingle<{ data: Trip }>();

      if (error) {
        fail("look up the invite code", error.message);
      }
      return data?.data ?? null;
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
          return result;
        }
      }

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
