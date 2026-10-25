import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { CandidateTripOption, TravelerPreferences, Trip, UpdateTripInput } from "./trip-types";
import { normalizeInviteCode } from "./trip-validation";
import { applyTripDetailsUpdate } from "./trip-updates";

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

export async function getTripByInviteCode(inviteCode: string) {
  const normalizedInviteCode = normalizeInviteCode(inviteCode);
  if (normalizedInviteCode === "") {
    return null;
  }

  const store = await readStore();
  for (const trip of store.trips) {
    if (trip.inviteCode.toUpperCase() === normalizedInviteCode) {
      return trip;
    }
  }

  return null;
}

export async function addTravelerToTrip(inviteCode: string, travelerName: string, departureLocation: string) {
  const normalizedInviteCode = normalizeInviteCode(inviteCode);
  const normalizedTravelerName = travelerName.trim().toLowerCase();
  const store = await readStore();

  for (let tripIndex = 0; tripIndex < store.trips.length; tripIndex += 1) {
    const trip = store.trips[tripIndex];
    if (trip.inviteCode.toUpperCase() !== normalizedInviteCode) {
      continue;
    }

    for (const traveler of trip.travelers) {
      if (traveler.name.trim().toLowerCase() === normalizedTravelerName) {
        return { status: "duplicate" as const };
      }
    }

    const traveler = {
      id: randomUUID(),
      name: travelerName.trim(),
      isHost: false,
      departureLocation: departureLocation.trim(),
      preferencesComplete: false,
      availabilityComplete: false,
      availableDates: [],
    };

    trip.travelers.push(traveler);
    trip.candidateOptions = undefined;
    trip.candidatesGeneratedAt = undefined;
    store.trips[tripIndex] = trip;
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(dataFilePath, JSON.stringify(store, null, 2), "utf8");

    return { status: "joined" as const, tripId: trip.id, travelerId: traveler.id };
  }

  return { status: "not-found" as const };
}

export async function updateTravelerPreferences(
  tripId: string,
  travelerId: string,
  preferences: TravelerPreferences,
  departureLocation: string,
) {
  const store = await readStore();

  for (let tripIndex = 0; tripIndex < store.trips.length; tripIndex += 1) {
    const trip = store.trips[tripIndex];
    if (trip.id !== tripId) {
      continue;
    }

    for (let travelerIndex = 0; travelerIndex < trip.travelers.length; travelerIndex += 1) {
      const traveler = trip.travelers[travelerIndex];
      if (traveler.id !== travelerId) {
        continue;
      }

      traveler.preferences = preferences;
      traveler.departureLocation = departureLocation.trim();
      traveler.preferencesComplete = true;
      trip.candidateOptions = undefined;
      trip.candidatesGeneratedAt = undefined;
      trip.travelers[travelerIndex] = traveler;
      store.trips[tripIndex] = trip;

      await mkdir(dataDirectory, { recursive: true });
      await writeFile(dataFilePath, JSON.stringify(store, null, 2), "utf8");

      return { status: "updated" as const, traveler };
    }

    return { status: "traveler-not-found" as const };
  }

  return { status: "trip-not-found" as const };
}

export async function updateTravelerAvailability(
  tripId: string,
  travelerId: string,
  availableDates: string[],
) {
  const store = await readStore();

  for (let tripIndex = 0; tripIndex < store.trips.length; tripIndex += 1) {
    const trip = store.trips[tripIndex];
    if (trip.id !== tripId) {
      continue;
    }

    for (let travelerIndex = 0; travelerIndex < trip.travelers.length; travelerIndex += 1) {
      const traveler = trip.travelers[travelerIndex];
      if (traveler.id !== travelerId) {
        continue;
      }

      traveler.availableDates = availableDates;
      traveler.availabilityComplete = true;
      trip.candidateOptions = undefined;
      trip.candidatesGeneratedAt = undefined;
      trip.travelers[travelerIndex] = traveler;
      store.trips[tripIndex] = trip;

      await mkdir(dataDirectory, { recursive: true });
      await writeFile(dataFilePath, JSON.stringify(store, null, 2), "utf8");

      return { status: "updated" as const, traveler };
    }

    return { status: "traveler-not-found" as const };
  }

  return { status: "trip-not-found" as const };
}

export async function updateTripDetails(
  tripId: string,
  hostTravelerId: string,
  input: UpdateTripInput,
) {
  const store = await readStore();

  for (let tripIndex = 0; tripIndex < store.trips.length; tripIndex += 1) {
    const trip = store.trips[tripIndex];
    if (trip.id !== tripId) {
      continue;
    }

    const hostTraveler = trip.travelers.find((traveler) => traveler.id === hostTravelerId);
    if (!hostTraveler || !hostTraveler.isHost) {
      return { status: "not-host" as const };
    }

    const affectedTravelerCount = applyTripDetailsUpdate(trip, input);
    store.trips[tripIndex] = trip;

    await mkdir(dataDirectory, { recursive: true });
    await writeFile(dataFilePath, JSON.stringify(store, null, 2), "utf8");
    return { status: "updated" as const, trip, affectedTravelerCount };
  }

  return { status: "trip-not-found" as const };
}

export async function saveCandidateOptions(
  tripId: string,
  candidateOptions: CandidateTripOption[],
) {
  const store = await readStore();

  for (let tripIndex = 0; tripIndex < store.trips.length; tripIndex += 1) {
    const trip = store.trips[tripIndex];
    if (trip.id !== tripId) {
      continue;
    }

    trip.candidateOptions = candidateOptions;
    trip.candidatesGeneratedAt = candidateOptions[0]?.generatedAt;
    store.trips[tripIndex] = trip;

    await mkdir(dataDirectory, { recursive: true });
    await writeFile(dataFilePath, JSON.stringify(store, null, 2), "utf8");
    return { status: "updated" as const, trip };
  }

  return { status: "trip-not-found" as const };
}
