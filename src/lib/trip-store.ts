import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Trip } from "./trip-types";

// The mutator changes the trip in place and returns a result. Returning
// { save: false } leaves the stored trip untouched.
export type TripMutation<Result> = (trip: Trip) => { save: boolean; result: Result };

export interface TripStore {
  getById(tripId: string): Promise<Trip | null>;
  getByInviteCode(inviteCode: string): Promise<Trip | null>;
  insert(trip: Trip): Promise<void>;
  update<Result>(tripId: string, mutate: TripMutation<Result>): Promise<Result | null>;
}

const dataDirectory = path.join(process.cwd(), "data");
const dataFilePath = path.join(dataDirectory, "trips.json");

async function readTrips(): Promise<Trip[]> {
  try {
    const parsedData: unknown = JSON.parse(await readFile(dataFilePath, "utf8"));
    const possibleStore = parsedData as { trips?: unknown } | null;
    return Array.isArray(possibleStore?.trips) ? (possibleStore.trips as Trip[]) : [];
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code === "ENOENT" || error instanceof SyntaxError) {
      return [];
    }
    throw error;
  }
}

async function writeTrips(trips: Trip[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataFilePath, JSON.stringify({ trips }, null, 2), "utf8");
}

// Local file store for development without Supabase credentials.
export const jsonTripStore: TripStore = {
  async getById(tripId) {
    const trips = await readTrips();
    return trips.find((trip) => trip.id === tripId) || null;
  },

  async getByInviteCode(inviteCode) {
    const trips = await readTrips();
    return trips.find((trip) => trip.inviteCode.toUpperCase() === inviteCode) || null;
  },

  async insert(trip) {
    const trips = await readTrips();
    trips.push(trip);
    await writeTrips(trips);
  },

  async update(tripId, mutate) {
    const trips = await readTrips();
    const trip = trips.find((item) => item.id === tripId);
    if (!trip) {
      return null;
    }

    const { save, result } = mutate(trip);
    if (save) {
      await writeTrips(trips);
    }
    return result;
  },
};
