import "server-only";

import { formatCalendarDate } from "./date-utils";
import { decryptPhone } from "./phone-auth";
import { addTripNotification } from "./trip-repository";
import type { ItineraryProposal, Trip } from "./trip-types";

// Group updates for the moments that need everyone: a vote opens or closes, the
// dates are set, or options are ready. They always appear in the in-app
// notification bar; texts are sent too when Twilio texting is configured.

export function isGroupTextingConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

async function sendText(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: process.env.TWILIO_FROM_NUMBER!.trim(), To: to, Body: body }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message || `Twilio returned ${response.status}`);
  }
}

// Texts every traveler who signed in with a phone, except whoever caused the update.
export async function textTravelers(trip: Trip, body: string, exceptTravelerId?: string) {
  if (!isGroupTextingConfigured()) return;
  const numbers = [...new Set(trip.travelers
    .filter((traveler) => traveler.id !== exceptTravelerId)
    .map((traveler) => decryptPhone(traveler.phoneEncrypted))
    .filter((phone): phone is string => phone !== null))];
  const results = await Promise.allSettled(numbers.map((phone) => sendText(phone, `TravelSync: ${body}`)));
  for (const result of results) {
    if (result.status === "rejected") console.error("Group text failed:", result.reason instanceof Error ? result.reason.message : result.reason);
  }
}

function tripName(trip: Trip) {
  return trip.name || (trip.destination ? `${trip.destination} Trip` : "your group trip");
}

// One group update: the words, and the trip page it points to.
export type GroupUpdate = { text: string; path: string };

// Shows the update in everyone's notification bar, and texts it when texting is set up.
export async function notifyGroup(trip: Trip, update: GroupUpdate, origin: string, exceptTravelerId?: string) {
  try {
    await addTripNotification(trip.id, update.text, update.path, exceptTravelerId);
  } catch (error) {
    console.error("Saving a notification failed:", error instanceof Error ? error.message : error);
  }
  await textTravelers(trip, `${update.text} ${origin}${update.path}`, exceptTravelerId);
}

export function voteOpenedText(trip: Trip, proposal: ItineraryProposal): GroupUpdate {
  const move = proposal.proposedDestination !== proposal.previousDestination ? ` from ${proposal.previousDestination} to ${proposal.proposedDestination}` : "";
  return { text: `${proposal.requestedByName} wants to change "${tripName(trip)}"${move}. Vote on it.`, path: `/trip/${trip.id}/itinerary` };
}

export function voteDecidedText(trip: Trip, proposal: ItineraryProposal): GroupUpdate {
  const path = `/trip/${trip.id}/itinerary`;
  if (proposal.status !== "approved") return { text: `The group voted to keep the current plan for "${tripName(trip)}".`, path };
  const moved = proposal.proposedDestination !== proposal.previousDestination;
  return { text: `The group approved the change${moved ? `. You're going to ${proposal.proposedDestination}!` : ` to "${tripName(trip)}".`} Pick flights again.`, path };
}

export function datesConfirmedText(trip: Trip): GroupUpdate {
  const dates = trip.confirmedDates!;
  return { text: `${dates.confirmedByName} set the dates for "${tripName(trip)}": ${formatCalendarDate(dates.startDate, false)} – ${formatCalendarDate(dates.endDate)}. Confirm you're in.`, path: `/trip/${trip.id}` };
}

export function optionsReadyText(trip: Trip): GroupUpdate {
  return { text: `Trip options for "${tripName(trip)}" are ready. Vote for your favorite.`, path: `/trip/${trip.id}/options` };
}
