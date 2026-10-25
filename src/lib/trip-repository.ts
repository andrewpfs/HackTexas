import "server-only";

import { randomUUID } from "node:crypto";
import type {
  CandidateTripOption,
  CandidateVote,
  ChatMessage,
  ItineraryDay,
  GroupItinerary,
  PlannerSource,
  Traveler,
  TravelerPreferences,
  Trip,
  UpdateTripInput,
} from "./trip-types";
import { normalizeInviteCode } from "./trip-validation";
import { applyTripDetailsUpdate, clearPlanningOutputs } from "./trip-updates";
import { needsPlaceLookup } from "./itinerary-diff";
import { jsonTripStore, type TripStore } from "./trip-store";
import { getSupabaseTripStore } from "./supabase-trip-store";

type JoinResult =
  | { status: "duplicate" }
  | { status: "joined"; tripId: string; travelerId: string };
type TravelerUpdateResult =
  | { status: "traveler-not-found" }
  | { status: "updated"; traveler: Traveler };
type TripDetailsResult =
  | { status: "not-host" }
  | { status: "updated"; trip: Trip; affectedTravelerCount: number };
type VoteResult =
  | { status: "traveler-not-found" | "candidate-not-found" | "finalized" }
  | { status: "updated"; trip: Trip; vote: CandidateVote };
type ItinerarySaveResult =
  | { status: "stale" }
  | { status: "already-saved" | "updated"; trip: Trip };

// Supabase is used when its credentials are configured; otherwise trips are
// kept in the local data/trips.json file for offline development.
function getStore(): TripStore {
  return getSupabaseTripStore() ?? jsonTripStore;
}

export async function saveTrip(trip: Trip) {
  await getStore().insert(trip);
}

export async function getTripById(tripId: string) {
  if (tripId.trim() === "") {
    return null;
  }

  return getStore().getById(tripId);
}

export async function inviteCodeExists(inviteCode: string) {
  return (await getStore().getByInviteCode(inviteCode.toUpperCase())) !== null;
}

export async function getTripByInviteCode(inviteCode: string) {
  const normalizedInviteCode = normalizeInviteCode(inviteCode);
  if (normalizedInviteCode === "") {
    return null;
  }

  return getStore().getByInviteCode(normalizedInviteCode);
}

export async function addTravelerToTrip(inviteCode: string, travelerName: string, departureLocation: string) {
  const trip = await getTripByInviteCode(inviteCode);
  if (!trip) {
    return { status: "not-found" as const };
  }

  const normalizedTravelerName = travelerName.trim().toLowerCase();
  const result = await getStore().update<JoinResult>(trip.id, (current) => {
    for (const traveler of current.travelers) {
      if (traveler.name.trim().toLowerCase() === normalizedTravelerName) {
        return { save: false, result: { status: "duplicate" as const } };
      }
    }

    const traveler: Traveler = {
      id: randomUUID(),
      name: travelerName.trim(),
      isHost: false,
      departureLocation: departureLocation.trim(),
      preferencesComplete: false,
      availabilityComplete: false,
      availableDates: [],
    };

    current.travelers.push(traveler);
    clearPlanningOutputs(current);
    return {
      save: true,
      result: { status: "joined" as const, tripId: current.id, travelerId: traveler.id },
    };
  });

  return result ?? { status: "not-found" as const };
}

export async function updateTravelerPreferences(
  tripId: string,
  travelerId: string,
  preferences: TravelerPreferences,
  departureLocation: string,
) {
  const result = await getStore().update<TravelerUpdateResult>(tripId, (trip) => {
    const traveler = trip.travelers.find((item) => item.id === travelerId);
    if (!traveler) {
      return { save: false, result: { status: "traveler-not-found" as const } };
    }

    traveler.preferences = preferences;
    traveler.departureLocation = departureLocation.trim();
    traveler.preferencesComplete = true;
    clearPlanningOutputs(trip);
    return { save: true, result: { status: "updated" as const, traveler } };
  });

  return result ?? { status: "trip-not-found" as const };
}

export async function updateTravelerAvailability(
  tripId: string,
  travelerId: string,
  availableDates: string[],
) {
  const result = await getStore().update<TravelerUpdateResult>(tripId, (trip) => {
    const traveler = trip.travelers.find((item) => item.id === travelerId);
    if (!traveler) {
      return { save: false, result: { status: "traveler-not-found" as const } };
    }

    traveler.availableDates = availableDates;
    traveler.availabilityComplete = true;
    clearPlanningOutputs(trip);
    return { save: true, result: { status: "updated" as const, traveler } };
  });

  return result ?? { status: "trip-not-found" as const };
}

export async function updateTripDetails(
  tripId: string,
  hostTravelerId: string,
  input: UpdateTripInput,
) {
  const result = await getStore().update<TripDetailsResult>(tripId, (trip) => {
    const hostTraveler = trip.travelers.find((traveler) => traveler.id === hostTravelerId);
    if (!hostTraveler || !hostTraveler.isHost) {
      return { save: false, result: { status: "not-host" as const } };
    }

    const affectedTravelerCount = applyTripDetailsUpdate(trip, input);
    return { save: true, result: { status: "updated" as const, trip, affectedTravelerCount } };
  });

  return result ?? { status: "trip-not-found" as const };
}

export async function saveCandidateOptions(
  tripId: string,
  candidateOptions: CandidateTripOption[],
  source: PlannerSource,
) {
  const result = await getStore().update(tripId, (trip) => {
    clearPlanningOutputs(trip);
    trip.candidateOptions = candidateOptions;
    trip.candidatesGeneratedAt = candidateOptions[0]?.generatedAt;
    trip.candidatesSource = source;
    return { save: true, result: { status: "updated" as const, trip } };
  });

  return result ?? { status: "trip-not-found" as const };
}

export async function saveTravelerVote(
  tripId: string,
  travelerId: string,
  candidateId: string,
  feedback: string | undefined,
) {
  const result = await getStore().update<VoteResult>(tripId, (trip) => {
    if (!trip.travelers.some((traveler) => traveler.id === travelerId)) {
      return { save: false, result: { status: "traveler-not-found" as const } };
    }
    if (!trip.candidateOptions?.some((candidate) => candidate.id === candidateId)) {
      return { save: false, result: { status: "candidate-not-found" as const } };
    }
    if (trip.itinerary) {
      return { save: false, result: { status: "finalized" as const } };
    }

    const vote: CandidateVote = {
      travelerId,
      candidateId,
      feedback,
      votedAt: new Date().toISOString(),
    };
    const otherVotes = (trip.votes || []).filter((item) => item.travelerId !== travelerId);
    trip.votes = [...otherVotes, vote];
    return { save: true, result: { status: "updated" as const, trip, vote } };
  });

  return result ?? { status: "trip-not-found" as const };
}

export async function saveGroupItinerary(tripId: string, itinerary: GroupItinerary) {
  const result = await getStore().update<ItinerarySaveResult>(tripId, (trip) => {
    // The trip may have changed while the planner was running.
    if (trip.itinerary) {
      return { save: false, result: { status: "already-saved" as const, trip } };
    }
    if (!trip.candidateOptions?.some((candidate) => candidate.id === itinerary.basedOnCandidateId)) {
      return { save: false, result: { status: "stale" as const } };
    }

    trip.itinerary = itinerary;
    return { save: true, result: { status: "updated" as const, trip } };
  });

  return result ?? { status: "trip-not-found" as const };
}

const placesLookupTimeoutMs = 3 * 60 * 1000;

type PlacesClaimResult =
  | { status: "no-itinerary" | "already-added" | "in-progress" }
  | { status: "claimed"; itinerary: GroupItinerary };

// Marks the itinerary's place lookup as running so a second viewer does not
// start a duplicate lookup. A lookup stuck for over 3 minutes can be retried.
export async function claimPlacesLookup(tripId: string) {
  const result = await getStore().update<PlacesClaimResult>(tripId, (trip) => {
    const itinerary = trip.itinerary;
    if (!itinerary) {
      return { save: false, result: { status: "no-itinerary" as const } };
    }
    if (itinerary.placesStatus === "added") {
      return { save: false, result: { status: "already-added" as const } };
    }

    const startedAt = itinerary.placesStartedAt ? Date.parse(itinerary.placesStartedAt) : 0;
    if (itinerary.placesStatus === "pending" && Date.now() - startedAt < placesLookupTimeoutMs) {
      return { save: false, result: { status: "in-progress" as const } };
    }

    itinerary.placesStatus = "pending";
    itinerary.placesStartedAt = new Date().toISOString();
    return { save: true, result: { status: "claimed" as const, itinerary: structuredClone(itinerary) } };
  });

  return result ?? { status: "no-itinerary" as const };
}

// Saves looked-up places, or releases the claim when `days` is null so the
// lookup can be tried again.
export async function finishPlacesLookup(
  tripId: string,
  itineraryId: string,
  days: GroupItinerary["days"] | null,
) {
  const result = await getStore().update<{ status: "saved" | "released" | "stale" }>(tripId, (trip) => {
    const itinerary = trip.itinerary;
    if (!itinerary || itinerary.id !== itineraryId) {
      return { save: false, result: { status: "stale" as const } };
    }

    if (days) {
      itinerary.days = days;
      itinerary.placesStatus = "added";
    } else {
      itinerary.placesStatus = undefined;
    }
    itinerary.placesStartedAt = undefined;
    return { save: true, result: { status: days ? ("saved" as const) : ("released" as const) } };
  });

  return result ?? { status: "stale" as const };
}

const maximumStoredMessages = 200;

function pushMessages(trip: Trip, messages: ChatMessage[]) {
  trip.chat = [...(trip.chat || []), ...messages].slice(-maximumStoredMessages);
}

export async function appendChatMessage(tripId: string, message: ChatMessage) {
  const result = await getStore().update<{ status: "added"; trip: Trip }>(tripId, (trip) => {
    pushMessages(trip, [message]);
    return { save: true, result: { status: "added" as const, trip } };
  });

  return result ?? { status: "trip-not-found" as const };
}

type RevisionSaveResult =
  | { status: "conflict" | "no-itinerary" }
  | { status: "saved"; trip: Trip };

// Saves a revised plan together with Muse's reply. The save only goes through if
// nobody else changed the plan since the revision was requested.
export async function saveItineraryRevision(
  tripId: string,
  itineraryId: string,
  expectedRevision: number,
  days: ItineraryDay[],
  museMessage: ChatMessage,
) {
  const result = await getStore().update<RevisionSaveResult>(tripId, (trip) => {
    const itinerary = trip.itinerary;
    if (!itinerary || itinerary.id !== itineraryId) {
      return { save: false, result: { status: "no-itinerary" as const } };
    }
    if ((itinerary.revision ?? 0) !== expectedRevision) {
      return { save: false, result: { status: "conflict" as const } };
    }

    itinerary.days = days;
    itinerary.revision = expectedRevision + 1;
    itinerary.updatedAt = new Date().toISOString();
    // New stops still need their real place looked up.
    itinerary.placesStatus = needsPlaceLookup(days) ? undefined : "added";
    itinerary.placesStartedAt = undefined;
    pushMessages(trip, [museMessage]);
    return { save: true, result: { status: "saved" as const, trip } };
  });

  return result ?? { status: "trip-not-found" as const };
}

const optionPhotosTimeoutMs = 3 * 60 * 1000;

type PhotosClaimResult =
  | { status: "no-candidates" | "already-added" | "in-progress" }
  | { status: "claimed"; candidates: CandidateTripOption[] };

// Marks the option photo lookup as running so only one viewer starts it.
export async function claimOptionPhotos(tripId: string) {
  const result = await getStore().update<PhotosClaimResult>(tripId, (trip) => {
    if (!trip.candidateOptions || trip.candidateOptions.length === 0) {
      return { save: false, result: { status: "no-candidates" as const } };
    }
    if (trip.optionPhotosStatus === "added") {
      return { save: false, result: { status: "already-added" as const } };
    }

    const startedAt = trip.optionPhotosStartedAt ? Date.parse(trip.optionPhotosStartedAt) : 0;
    if (trip.optionPhotosStatus === "pending" && Date.now() - startedAt < optionPhotosTimeoutMs) {
      return { save: false, result: { status: "in-progress" as const } };
    }

    trip.optionPhotosStatus = "pending";
    trip.optionPhotosStartedAt = new Date().toISOString();
    return { save: true, result: { status: "claimed" as const, candidates: structuredClone(trip.candidateOptions) } };
  });

  return result ?? { status: "no-candidates" as const };
}

// Saves the photos found for each stop. The options are matched by id, so a
// regenerated set of options is never overwritten with old photos.
export async function finishOptionPhotos(tripId: string, candidates: CandidateTripOption[] | null) {
  const result = await getStore().update<{ status: "saved" | "released" | "stale" }>(tripId, (trip) => {
    const current = trip.candidateOptions;
    const sameOptions =
      current &&
      candidates &&
      current.length === candidates.length &&
      current.every((candidate, index) => candidate.id === candidates[index].id);

    if (candidates && !sameOptions) {
      return { save: false, result: { status: "stale" as const } };
    }

    if (candidates && current) {
      trip.candidateOptions = current.map((candidate, index) => ({ ...candidate, days: candidates[index].days }));
      trip.optionPhotosStatus = "added";
    } else {
      trip.optionPhotosStatus = undefined;
    }
    trip.optionPhotosStartedAt = undefined;
    return { save: true, result: { status: candidates ? ("saved" as const) : ("released" as const) } };
  });

  return result ?? { status: "stale" as const };
}
