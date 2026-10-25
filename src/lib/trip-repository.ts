import "server-only";

import { randomUUID } from "node:crypto";
import type { AvatarLook } from "./avatar-look";
import type {
  Booking,
  CandidateTripOption,
  CandidateVote,
  ChatMessage,
  ItineraryDay,
  ItineraryProposal,
  GroupItinerary,
  PlannerSource,
  PlaceSuggestion,
  Traveler,
  TravelerPreferences,
  Trip,
  TripSketch,
  ItineraryNoteKind,
  UpdateTripInput,
} from "./trip-types";
import { normalizeInviteCode } from "./trip-validation";
import { applyTripDetailsUpdate, clearPlanningOutputs, isGeneratingCandidates } from "./trip-updates";
import { needsPlaceLookup } from "./itinerary-diff";
import { jsonTripStore, type TripStore } from "./trip-store";
import { getSupabaseTripStore } from "./supabase-trip-store";
import { applyProposalVote, proposalMatchesBase } from "./itinerary-proposals";
import { applyManualEdit, type ManualStopEdit, type TravelWarning } from "./manual-itinerary";
import { personalLocationError, type DestinationArea } from "./personal-location";
import { getSketchBasis, sketchHasContent, sketchNeedsRedraw } from "./trip-sketch";
import { pushNotification, tripPath } from "./trip-notifications";

export async function editSharedStop(tripId: string, edit: ManualStopEdit, allowLongTravel: boolean) {
  return getStore().update<{ saved: boolean; warnings: TravelWarning[]; trip: Trip }>(tripId, (trip) => {
    const result = applyManualEdit(trip, edit, allowLongTravel);
    return { save: result.saved, result: { ...result, trip } };
  });
}

type JoinResult =
  | { status: "duplicate" }
  | { status: "joined" | "already-joined"; tripId: string; travelerId: string };
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

// Removes the whole trip for everyone. Callers must check that the requester is the host.
export async function deleteTrip(tripId: string) {
  return getStore().delete(tripId);
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

// The verified phone that is joining. Joining twice with the same phone returns the existing traveler.
export type JoiningPhone = { phoneHash: string; last4: string; phoneEncrypted?: string };

export async function addTravelerToTrip(inviteCode: string, travelerName: string, departureLocation: string, phone?: JoiningPhone) {
  const trip = await getTripByInviteCode(inviteCode);
  if (!trip) {
    return { status: "not-found" as const };
  }

  const normalizedTravelerName = travelerName.trim().toLowerCase();
  const result = await getStore().update<JoinResult>(trip.id, (current) => {
    const existing = phone ? current.travelers.find((traveler) => traveler.phoneHash === phone.phoneHash) : undefined;
    if (existing) {
      // Older sign-ins had no encrypted number; fill it in so this traveler gets group texts.
      const addNumber = !existing.phoneEncrypted && Boolean(phone?.phoneEncrypted);
      if (addNumber) existing.phoneEncrypted = phone?.phoneEncrypted;
      return { save: addNumber, result: { status: "already-joined" as const, tripId: current.id, travelerId: existing.id } };
    }
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
      ...(phone ? { phoneHash: phone.phoneHash, phoneLast4: phone.last4, phoneEncrypted: phone.phoneEncrypted, phoneVotingVerified: true } : {}),
    };

    current.travelers.push(traveler);
    clearPlanningOutputs(current);
    pushNotification(current, `${traveler.name} joined the trip.`, tripPath(current), traveler.id);
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

    // The current questionnaire no longer edits these optional historical budgets.
    traveler.preferences = {
      ...preferences,
      foodBudgetPerDay: preferences.foodBudgetPerDay ?? traveler.preferences?.foodBudgetPerDay,
      lodgingBudgetPerNight: preferences.lodgingBudgetPerNight ?? traveler.preferences?.lodgingBudgetPerNight,
      activitiesBudget: preferences.activitiesBudget ?? traveler.preferences?.activitiesBudget,
    };
    traveler.departureLocation = departureLocation.trim();
    const firstTime = !traveler.preferencesComplete;
    traveler.preferencesComplete = true;
    const hadOptions = Boolean(trip.candidateOptions?.length);
    clearPlanningOutputs(trip);
    pushNotification(trip, `${traveler.name} ${firstTime ? "shared" : "updated"} their preferences.${hadOptions ? " Muse is redoing the trip options." : ""}`, tripPath(trip), traveler.id);
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
    const firstTime = !traveler.availabilityComplete;
    traveler.availabilityComplete = true;
    pushNotification(trip, `${traveler.name} ${firstTime ? "shared" : "updated"} their available dates.${trip.candidateOptions?.length ? " Muse is redoing the trip options." : ""}`, tripPath(trip), traveler.id);
    // The first draft stays on screen; it is redrawn in the background once everyone has answered.
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
    pushNotification(trip, `${hostTraveler.name} changed the trip details.`, tripPath(trip), hostTraveler.id);
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
    trip.optionsNeedRefresh = undefined;
    trip.candidatesGeneratingSince = undefined;
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
    pushNotification(trip, "The shared itinerary is ready. Take a look and add notes.", tripPath(trip, "itinerary"));
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
  expectedRevision?: number,
) {
  const result = await getStore().update<{ status: "saved" | "released" | "stale" }>(tripId, (trip) => {
    const itinerary = trip.itinerary;
    if (!itinerary || itinerary.id !== itineraryId || (expectedRevision !== undefined && (itinerary.revision ?? 0) !== expectedRevision)) {
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

export async function saveItineraryProposal(tripId: string, proposal: ItineraryProposal, message: ChatMessage) {
  const result = await getStore().update<{ status: "saved" | "conflict" | "already-open"; trip: Trip }>(tripId, (trip) => {
    if (!proposalMatchesBase(trip, proposal)) return { save: false, result: { status: "conflict", trip } };
    if (trip.pendingItineraryProposal?.status === "pending") return { save: false, result: { status: "already-open", trip } };
    trip.pendingItineraryProposal = proposal;
    pushMessages(trip, [message]);
    return { save: true, result: { status: "saved", trip } };
  });
  return result ?? { status: "trip-not-found" as const };
}

export async function voteOnItineraryProposal(tripId: string, proposalId: string, travelerId: string, choice: "approve" | "reject") {
  const result = await getStore().update<{ status: string; trip: Trip }>(tripId, (trip) => {
    const status = applyProposalVote(trip, proposalId, travelerId, choice);
    return { save: status !== "not-allowed" && status !== "closed", result: { status, trip } };
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
    itinerary.overrides = (itinerary.overrides ?? []).filter((override) =>
      days.some((day) => day.dayNumber === override.dayNumber && day.activities.some((activity) => activity.time === override.stopTime && activity.title === override.stopTitle)),
    );
    itinerary.revision = expectedRevision + 1;
    itinerary.updatedAt = new Date().toISOString();
    // New stops still need their real place looked up.
    itinerary.placesStatus = needsPlaceLookup(days) ? undefined : "added";
    itinerary.placesStartedAt = undefined;
    pushMessages(trip, [museMessage]);
    pushNotification(trip, "Muse updated the shared itinerary.", tripPath(trip, "itinerary"));
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
      trip.candidateOptions = current.map((candidate, index) => ({ ...candidate, imageUrl: candidates[index].imageUrl ?? candidate.imageUrl, days: candidates[index].days }));
      trip.optionPhotosStatus = "added";
    } else {
      trip.optionPhotosStatus = undefined;
    }
    trip.optionPhotosStartedAt = undefined;
    return { save: true, result: { status: candidates ? ("saved" as const) : ("released" as const) } };
  });

  return result ?? { status: "stale" as const };
}

// A traveler picks their own avatar. This is cosmetic, so it never clears the plan.
export async function updateTravelerAvatar(tripId: string, travelerId: string, avatar: AvatarLook) {
  const result = await getStore().update<{ status: "updated" } | { status: "traveler-not-found" }>(tripId, (trip) => {
    const traveler = trip.travelers.find((item) => item.id === travelerId);
    if (!traveler) {
      return { save: false, result: { status: "traveler-not-found" as const } };
    }

    traveler.avatar = avatar;
    return { save: true, result: { status: "updated" as const } };
  });

  return result ?? { status: "trip-not-found" as const };
}

// ---------- travel: hotels, flights, demo bookings ----------

const searchTimeoutMs = 2 * 60 * 1000;

function isFreshPending(status: string | undefined, startedAt: string | undefined) {
  return status === "pending" && startedAt !== undefined && Date.now() - Date.parse(startedAt) < searchTimeoutMs;
}

type ClaimResult<T> = { status: "claimed"; trip: Trip } | { status: "skip"; current: T | undefined } | { status: "no-itinerary" };

// Marks the group hotel search as running. Returns "skip" when it already ran or is running.
export async function claimHotelSearch(tripId: string, checkIn: string, checkOut: string, force = false) {
  const result = await getStore().update<ClaimResult<NonNullable<Trip["travel"]>["hotels"]>>(tripId, (trip) => {
    if (!trip.itinerary) {
      return { save: false, result: { status: "no-itinerary" as const } };
    }
    const current = trip.travel?.hotels;
    if (current && !force && (current.status === "done" || isFreshPending(current.status, current.startedAt))) {
      return { save: false, result: { status: "skip" as const, current } };
    }

    trip.travel = { ...trip.travel, hotels: { status: "pending", startedAt: new Date().toISOString(), options: [], checkIn, checkOut } };
    return { save: true, result: { status: "claimed" as const, trip: structuredClone(trip) } };
  });
  return result ?? { status: "no-itinerary" as const };
}

export async function finishHotelSearch(tripId: string, update: Partial<NonNullable<NonNullable<Trip["travel"]>["hotels"]>>, expectedStartedAt?: string) {
  await getStore().update<null>(tripId, (trip) => {
    const current = trip.travel?.hotels;
    if (!current || current.startedAt !== expectedStartedAt) {
      return { save: false, result: null };
    }
    trip.travel = { ...trip.travel, hotels: { ...current, ...update, startedAt: undefined } };
    return { save: true, result: null };
  });
}

// The host picks the group's hotel. Picking it again un-picks it.
export async function selectGroupHotel(tripId: string, travelerId: string, token: string) {
  const result = await getStore().update<{ status: "updated" | "not-host" | "not-found" }>(tripId, (trip) => {
    const traveler = trip.travelers.find((item) => item.id === travelerId);
    if (!traveler?.isHost) {
      return { save: false, result: { status: "not-host" as const } };
    }
    const hotels = trip.travel?.hotels;
    if (!hotels?.options.some((option) => option.token === token)) {
      return { save: false, result: { status: "not-found" as const } };
    }

    const unpick = hotels.selectedToken === token;
    trip.travel = {
      ...trip.travel,
      hotels: { ...hotels, selectedToken: unpick ? undefined : token, selectedByTravelerId: unpick ? undefined : travelerId },
    };
    if (!unpick) {
      const hotelName = hotels.options.find((option) => option.token === token)?.name ?? "a hotel";
      pushNotification(trip, `${traveler.name} picked ${hotelName} for the group.`, tripPath(trip, "travel"), traveler.id);
    }
    return { save: true, result: { status: "updated" as const } };
  });
  return result ?? { status: "not-found" as const };
}

export async function claimFlightSearch(tripId: string, travelerId: string, from: string, force = false) {
  const result = await getStore().update<ClaimResult<NonNullable<NonNullable<Trip["travel"]>["flights"]>[string]>>(tripId, (trip) => {
    if (!trip.itinerary) {
      return { save: false, result: { status: "no-itinerary" as const } };
    }
    const current = trip.travel?.flights?.[travelerId];
    if (current && !force && current.from === from && (current.status === "done" || isFreshPending(current.status, current.startedAt))) {
      return { save: false, result: { status: "skip" as const, current } };
    }

    trip.travel = {
      ...trip.travel,
      flights: { ...trip.travel?.flights, [travelerId]: { status: "pending", startedAt: new Date().toISOString(), from, options: [] } },
    };
    return { save: true, result: { status: "claimed" as const, trip: structuredClone(trip) } };
  });
  return result ?? { status: "no-itinerary" as const };
}

export async function finishFlightSearch(
  tripId: string,
  travelerId: string,
  update: Partial<NonNullable<NonNullable<Trip["travel"]>["flights"]>[string]>,
  expectedStartedAt?: string,
) {
  await getStore().update<null>(tripId, (trip) => {
    const current = trip.travel?.flights?.[travelerId];
    if (!current || current.startedAt !== expectedStartedAt) {
      return { save: false, result: null };
    }
    trip.travel = { ...trip.travel, flights: { ...trip.travel?.flights, [travelerId]: { ...current, ...update, startedAt: undefined } } };
    return { save: true, result: null };
  });
}

// A traveler picks their own flight. Picking it again un-picks it.
export async function selectFlight(tripId: string, travelerId: string, flightId: string) {
  const result = await getStore().update<{ status: "updated" | "not-found" }>(tripId, (trip) => {
    const search = trip.travel?.flights?.[travelerId];
    if (!search?.options.some((option) => option.id === flightId)) {
      return { save: false, result: { status: "not-found" as const } };
    }
    const unpick = search.selectedId === flightId;
    trip.travel = { ...trip.travel, flights: { ...trip.travel?.flights, [travelerId]: { ...search, selectedId: unpick ? undefined : flightId } } };
    return { save: true, result: { status: "updated" as const } };
  });
  return result ?? { status: "not-found" as const };
}

export async function saveBooking(tripId: string, booking: Booking, expectedItinerary?: { id: string; revision: number }) {
  const result = await getStore().update<{ status: "saved" | "traveler-not-found" | "stale" }>(tripId, (trip) => {
    if (expectedItinerary && (trip.itinerary?.id !== expectedItinerary.id || (trip.itinerary?.revision ?? 0) !== expectedItinerary.revision)) return { save: false, result: { status: "stale" as const } };
    if (!trip.travelers.some((traveler) => traveler.id === booking.travelerId)) {
      return { save: false, result: { status: "traveler-not-found" as const } };
    }
    trip.travel = { ...trip.travel, bookings: { ...trip.travel?.bookings, [booking.travelerId]: booking } };
    const bookerName = trip.travelers.find((traveler) => traveler.id === booking.travelerId)?.name ?? "Someone";
    pushNotification(trip, `${bookerName} booked their travel.`, tripPath(trip, "travel"), booking.travelerId);
    return { save: true, result: { status: "saved" as const } };
  });
  return result ?? { status: "traveler-not-found" as const };
}

// ---------- personal overrides ----------

export type OverrideAction =
  | { action: "add"; travelerId: string; dayNumber: number; stopTime: string; stopTitle: string; title: string; location: string; note: string; place?: PlaceSuggestion; destinationArea?: DestinationArea; expectedDestination?: string; requireSelectedPlace?: boolean }
  | { action: "remove" | "join" | "leave"; travelerId: string; overrideId: string };

type OverrideResult = { status: "updated"; trip: Trip } | { status: "invalid-location"; error: string } | { status: "not-found" | "no-itinerary" | "not-allowed" };

export async function changePersonalOverride(tripId: string, change: OverrideAction) {
  const result = await getStore().update<OverrideResult>(tripId, (trip) => {
    const itinerary = trip.itinerary;
    if (!itinerary) {
      return { save: false, result: { status: "no-itinerary" as const } };
    }
    if (!trip.travelers.some((traveler) => traveler.id === change.travelerId)) {
      return { save: false, result: { status: "not-allowed" as const } };
    }

    const overrides = itinerary.overrides ?? [];

    if (change.action === "add") {
      const day = itinerary.days.find((item) => item.dayNumber === change.dayNumber);
      const stopExists = day?.activities.some((activity) => activity.time === change.stopTime && activity.title === change.stopTitle);
      if (!stopExists) {
        return { save: false, result: { status: "not-found" as const } };
      }

      if (change.expectedDestination && change.expectedDestination !== itinerary.destination) return { save: false, result: { status: "invalid-location" as const, error: "The destination changed. Select your place again." } };
      // The manual API requires a selected real place. Muse's existing internal
      // text-only alternatives remain compatible with its current workflow.
      let locationError: string | null = null;
      if (change.place || change.requireSelectedPlace) {
        locationError = personalLocationError(itinerary, change.dayNumber, change.stopTime, change.stopTitle, change.place, change.destinationArea);
      }
      if (locationError) return { save: false, result: { status: "invalid-location" as const, error: locationError } };

      // One plan per person per stop: a new one replaces the old one, and they leave any plan they had joined.
      const others = overrides
        .filter((item) => !(item.travelerId === change.travelerId && item.dayNumber === change.dayNumber && item.stopTime === change.stopTime && item.stopTitle === change.stopTitle))
        .map((item) =>
          item.dayNumber === change.dayNumber && item.stopTime === change.stopTime && item.stopTitle === change.stopTitle
            ? { ...item, joinedBy: item.joinedBy.filter((id) => id !== change.travelerId) }
            : item,
        );
      itinerary.overrides = [
        ...others,
        {
          id: randomUUID(),
          travelerId: change.travelerId,
          dayNumber: change.dayNumber,
          stopTime: change.stopTime,
          stopTitle: change.stopTitle,
          title: change.title,
          location: change.place?.address || change.place?.name || change.location,
          place: change.place,
          note: change.note,
          joinedBy: [],
          createdAt: new Date().toISOString(),
        },
      ];
      return { save: true, result: { status: "updated" as const, trip } };
    }

    const target = overrides.find((item) => item.id === change.overrideId);
    if (!target) {
      return { save: false, result: { status: "not-found" as const } };
    }

    if (change.action === "remove") {
      if (target.travelerId !== change.travelerId) {
        return { save: false, result: { status: "not-allowed" as const } };
      }
      itinerary.overrides = overrides.filter((item) => item.id !== target.id);
    } else if (change.action === "join") {
      // Joining someone's plan means leaving any other plan for the same stop.
      itinerary.overrides = overrides
        .filter((item) => !(item.travelerId === change.travelerId && item.dayNumber === target.dayNumber && item.stopTime === target.stopTime && item.stopTitle === target.stopTitle))
        .map((item) => {
          const sameStop = item.dayNumber === target.dayNumber && item.stopTime === target.stopTime && item.stopTitle === target.stopTitle;
          const joinedBy = item.joinedBy.filter((id) => id !== change.travelerId);
          return { ...item, joinedBy: item.id === target.id && item.travelerId !== change.travelerId ? [...joinedBy, change.travelerId] : sameStop ? joinedBy : item.joinedBy };
        });
    } else {
      itinerary.overrides = overrides.map((item) =>
        item.id === target.id ? { ...item, joinedBy: item.joinedBy.filter((id) => id !== change.travelerId) } : item,
      );
    }

    return { save: true, result: { status: "updated" as const, trip } };
  });

  return result ?? { status: "no-itinerary" as const };
}

// ---------- itinerary notes ----------

export type NoteAction =
  | { action: "add"; travelerId: string; kind: ItineraryNoteKind; text: string; dayNumber?: number; stopKey?: string; stopTitle?: string }
  | { action: "remove"; travelerId: string; noteId: string };

type NoteResult = { status: "updated"; trip: Trip } | { status: "no-itinerary" | "not-allowed" | "not-found" | "too-many" };

const maximumNotes = 300;

// Anyone on the trip can add a note; only the author can remove it.
export async function changeItineraryNote(tripId: string, change: NoteAction) {
  const result = await getStore().update<NoteResult>(tripId, (trip) => {
    const itinerary = trip.itinerary;
    if (!itinerary) return { save: false, result: { status: "no-itinerary" as const } };
    const author = trip.travelers.find((traveler) => traveler.id === change.travelerId);
    if (!author) return { save: false, result: { status: "not-allowed" as const } };
    const notes = itinerary.notes ?? [];

    if (change.action === "add") {
      if (notes.length >= maximumNotes) return { save: false, result: { status: "too-many" as const } };
      itinerary.notes = [...notes, {
        id: randomUUID(),
        travelerId: author.id,
        authorName: author.name,
        kind: change.kind,
        text: change.text,
        createdAt: new Date().toISOString(),
        ...(change.stopKey ? { dayNumber: change.dayNumber, stopKey: change.stopKey, stopTitle: change.stopTitle } : {}),
      }];
      return { save: true, result: { status: "updated" as const, trip } };
    }

    const target = notes.find((note) => note.id === change.noteId);
    if (!target) return { save: false, result: { status: "not-found" as const } };
    if (target.travelerId !== change.travelerId) return { save: false, result: { status: "not-allowed" as const } };
    itinerary.notes = notes.filter((note) => note.id !== target.id);
    return { save: true, result: { status: "updated" as const, trip } };
  });
  return result ?? { status: "no-itinerary" as const };
}

// ---------- trip sketch ----------

type SketchBasis = ReturnType<typeof getSketchBasis>;
type SketchClaim = { status: "claimed"; trip: Trip; basis: SketchBasis } | { status: "skip" | "not-found" };

// Marks the sketch as being drawn so only one viewer starts it. Hosts can ask for a fresh one.
// When a draft is already on screen it stays there while the new one is drawn.
export async function claimTripSketch(tripId: string, force: boolean) {
  const result = await getStore().update<SketchClaim>(tripId, (trip) => {
    const current = trip.sketch;
    const refreshRunning = current?.refreshing && isFreshPending("pending", current.refreshing.startedAt);
    if (!force && !sketchNeedsRedraw(trip)) {
      return { save: false, result: { status: "skip" as const } };
    }
    if (isFreshPending(current?.status, current?.startedAt) || refreshRunning) {
      return { save: false, result: { status: "skip" as const } };
    }
    const basis = getSketchBasis(trip);
    const startedAt = new Date().toISOString();
    if (current && sketchHasContent(current)) {
      current.refreshing = { startedAt, basisKey: basis.key };
      current.failedBasisKey = undefined;
    } else {
      trip.sketch = { status: "pending", startedAt, summary: "", places: [], days: [], suggestions: [] };
    }
    return { save: true, result: { status: "claimed" as const, trip: structuredClone(trip), basis } };
  });
  return result ?? { status: "not-found" as const };
}

type SketchOutcome =
  | { ok: true; draft: Pick<TripSketch, "summary" | "places" | "days" | "suggestions">; source: PlannerSource }
  | { ok: false; error: string };

// Saves the new draft, or keeps the old one on screen if a redraw failed.
export async function finishTripSketch(tripId: string, basis: SketchBasis, outcome: SketchOutcome) {
  await getStore().update<null>(tripId, (trip) => {
    const current = trip.sketch;
    if (outcome.ok) {
      const wasGroupUpdate = basis.stage === "group" && sketchHasContent(current);
      trip.sketch = { status: "done", ...outcome.draft, source: outcome.source, generatedAt: new Date().toISOString(), basisKey: basis.key, stage: basis.stage };
      if (wasGroupUpdate) pushNotification(trip, "Muse updated the first draft with everyone's preferences and dates.", tripPath(trip));
    } else if (current && sketchHasContent(current)) {
      current.refreshing = undefined;
      current.failedBasisKey = basis.key;
    } else {
      trip.sketch = { status: "failed", summary: "", places: [], days: [], suggestions: [], error: outcome.error, failedBasisKey: basis.key };
    }
    return { save: true, result: null };
  });
}

// ---------- phone and assistant links ----------

export async function findTripsByPhone(phoneHash: string) {
  return getStore().findByTraveler({ phoneHash });
}

export async function findTripsByAssistantToken(assistantTokenHash: string) {
  return getStore().findByTraveler({ assistantTokenHash });
}

// Saves a trip to a phone. A traveler already saved to a different phone can't be taken over.
export async function linkTravelerPhone(tripId: string, travelerId: string, phoneHash: string, last4: string, votingProof = false, phoneEncrypted?: string) {
  const result = await getStore().update<{ status: "linked" | "taken" | "traveler-not-found" }>(tripId, (trip) => {
    const traveler = trip.travelers.find((item) => item.id === travelerId);
    if (!traveler) return { save: false, result: { status: "traveler-not-found" as const } };
    if (traveler.phoneHash && traveler.phoneHash !== phoneHash) return { save: false, result: { status: "taken" as const } };
    if (!traveler.phoneHash) traveler.phoneVotingVerified = votingProof;
    else if (votingProof) traveler.phoneVotingVerified = true;
    traveler.phoneHash = phoneHash;
    traveler.phoneLast4 = last4;
    if (phoneEncrypted) traveler.phoneEncrypted = phoneEncrypted;
    return { save: true, result: { status: "linked" as const } };
  });
  return result ?? { status: "traveler-not-found" as const };
}

export async function setAssistantToken(tripId: string, travelerId: string, tokenHash: string | undefined) {
  const result = await getStore().update<{ status: "saved" | "traveler-not-found" }>(tripId, (trip) => {
    const traveler = trip.travelers.find((item) => item.id === travelerId);
    if (!traveler) return { save: false, result: { status: "traveler-not-found" as const } };
    traveler.assistantTokenHash = tokenHash;
    return { save: true, result: { status: "saved" as const } };
  });
  return result ?? { status: "traveler-not-found" as const };
}

// Takes a trip off a phone's "My Trips" list. The traveler stays in the trip.
export async function unlinkTravelerPhone(tripId: string, travelerId: string, phoneHash: string) {
  const result = await getStore().update<{ status: "unlinked" | "not-linked" }>(tripId, (trip) => {
    const traveler = trip.travelers.find((item) => item.id === travelerId);
    if (!traveler || traveler.phoneHash !== phoneHash) return { save: false, result: { status: "not-linked" as const } };
    traveler.phoneHash = undefined;
    traveler.phoneLast4 = undefined;
    traveler.phoneEncrypted = undefined;
    traveler.phoneVotingVerified = undefined;
    return { save: true, result: { status: "unlinked" as const } };
  });
  return result ?? { status: "not-linked" as const };
}

// The host approves the exact trip dates before options are generated.
// outsideSharedDates is true when the host overrides the group's availability.
// Changing the dates means everyone has to say "I'm in" again.
export async function confirmTripDates(tripId: string, hostTravelerId: string, startDate: string, endDate: string, outsideSharedDates = false) {
  const result = await getStore().update<{ status: "confirmed" | "not-host" | "already-planned"; trip?: Trip }>(tripId, (trip) => {
    const host = trip.travelers.find((traveler) => traveler.id === hostTravelerId);
    if (!host?.isHost) return { save: false, result: { status: "not-host" as const } };
    if (trip.candidateOptions?.length || trip.itinerary) return { save: false, result: { status: "already-planned" as const } };
    trip.confirmedDates = {
      startDate,
      endDate,
      confirmedAt: new Date().toISOString(),
      confirmedByName: host.name,
      agreedTravelerIds: [host.id],
      ...(outsideSharedDates ? { outsideSharedDates: true } : {}),
    };
    return { save: true, result: { status: "confirmed" as const, trip } };
  });
  return result ?? { status: "not-host" as const };
}

type AgreeResult = { status: "agreed"; trip: Trip } | { status: "traveler-not-found" | "no-dates" | "dates-changed" | "already-planned" };

// A traveler says "I'm in" for the dates the host set. The dates are sent back
// so nobody agrees to dates the host changed a moment ago.
export async function agreeToTripDates(tripId: string, travelerId: string, startDate: string, endDate: string) {
  const result = await getStore().update<AgreeResult>(tripId, (trip) => {
    if (!trip.travelers.some((traveler) => traveler.id === travelerId)) return { save: false, result: { status: "traveler-not-found" as const } };
    const dates = trip.confirmedDates;
    if (!dates) return { save: false, result: { status: "no-dates" as const } };
    if (dates.startDate !== startDate || dates.endDate !== endDate) return { save: false, result: { status: "dates-changed" as const } };
    if (trip.candidateOptions?.length || trip.itinerary) return { save: false, result: { status: "already-planned" as const } };
    const agreed = dates.agreedTravelerIds ?? [];
    if (!agreed.includes(travelerId)) {
      dates.agreedTravelerIds = [...agreed, travelerId];
      const name = trip.travelers.find((traveler) => traveler.id === travelerId)?.name ?? "Someone";
      const everyone = trip.travelers.every((traveler) => traveler.isHost || dates.agreedTravelerIds!.includes(traveler.id));
      pushNotification(trip, everyone ? `${name} confirmed. Everyone is in for the dates, so Muse can plan options.` : `${name} confirmed the trip dates.`, tripPath(trip), travelerId);
    }
    return { save: true, result: { status: "agreed" as const, trip } };
  });
  return result ?? { status: "traveler-not-found" as const };
}

export async function saveDatePriceCheck(tripId: string, check: NonNullable<Trip["datePriceCheck"]>) {
  await getStore().update(tripId, (trip) => {
    trip.datePriceCheck = check;
    return { save: true, result: null };
  });
}

// ---------- notifications ----------

// Records an update for the notification bar.
export async function addTripNotification(tripId: string, text: string, path: string, actorTravelerId?: string) {
  await getStore().update<null>(tripId, (trip) => {
    pushNotification(trip, text, path, actorTravelerId);
    return { save: true, result: null };
  });
}

// ---------- option generation lock ----------


// Only one viewer plans options at a time (Muse takes about 45 seconds).
export async function claimCandidateGeneration(tripId: string) {
  const result = await getStore().update<"claimed" | "busy">(tripId, (trip) => {
    if (isGeneratingCandidates(trip)) return { save: false, result: "busy" as const };
    trip.candidatesGeneratingSince = new Date().toISOString();
    return { save: true, result: "claimed" as const };
  });
  return result ?? "busy";
}

export async function releaseCandidateGeneration(tripId: string) {
  await getStore().update<null>(tripId, (trip) => {
    if (!trip.candidatesGeneratingSince) return { save: false, result: null };
    trip.candidatesGeneratingSince = undefined;
    return { save: true, result: null };
  });
}
