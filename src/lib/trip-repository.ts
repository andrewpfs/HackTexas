import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Trip } from "./trip-types";

type TripStore = {
  trips: Trip[];
};

const dataDirectory = path.join(process.cwd(), "data");
const dataFilePath = path.join(dataDirectory, "trips.json");

async function readStore(): Promise<TripStore> {
  try {
    const fileContents = await readFile(dataFilePath, "utf8");
    const parsedData: unknown = JSON.parse(fileContents);

    if (typeof parsedData !== "object" || parsedData === null) {
      return { trips: [] };
    }

    const possibleStore = parsedData as { trips?: unknown };
    if (!Array.isArray(possibleStore.trips)) {
      return { trips: [] };
    }

    return { trips: possibleStore.trips as Trip[] };
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code === "ENOENT" || error instanceof SyntaxError) {
      return { trips: [] };
    }

    throw error;
  }
}

export async function saveTrip(trip: Trip) {
  const store = await readStore();
  store.trips.push(trip);

  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataFilePath, JSON.stringify(store, null, 2), "utf8");
}

export async function getTripById(tripId: string) {
  if (tripId.trim() === "") {
    return null;
  }

  const store = await readStore();
  for (const trip of store.trips) {
    if (trip.id === tripId) {
      return trip;
    }
  }

  return null;
}

export async function inviteCodeExists(inviteCode: string) {
  const store = await readStore();
  for (const trip of store.trips) {
    if (trip.inviteCode === inviteCode) {
      return true;
    }
  }

  return false;
}
