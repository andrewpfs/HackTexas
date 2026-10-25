import "server-only";

import { formatCalendarDate } from "./date-utils";
import { decryptPhone } from "./phone-auth";
import type { ItineraryProposal, Trip } from "./trip-types";

// Short texts to the group for the moments that need everyone: a vote opens or
// closes, the dates are set, or options are ready. Chat messages never text anyone.

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

export function voteOpenedText(trip: Trip, proposal: ItineraryProposal, origin: string) {
  const move = proposal.proposedDestination !== proposal.previousDestination ? ` from ${proposal.previousDestination} to ${proposal.proposedDestination}` : "";
  return `${proposal.requestedByName} wants to change "${tripName(trip)}"${move}. Vote here: ${origin}/trip/${trip.id}/itinerary`;
}

export function voteDecidedText(trip: Trip, proposal: ItineraryProposal, origin: string) {
  const link = `${origin}/trip/${trip.id}/itinerary`;
  if (proposal.status !== "approved") return `The group voted to keep the current plan for "${tripName(trip)}". ${link}`;
  const moved = proposal.proposedDestination !== proposal.previousDestination;
  return `The group approved the change${moved ? `. You're going to ${proposal.proposedDestination}!` : ` to "${tripName(trip)}".`} Pick flights again: ${link}`;
}

export function datesConfirmedText(trip: Trip, origin: string) {
  const dates = trip.confirmedDates!;
  return `${dates.confirmedByName} set the dates for "${tripName(trip)}": ${formatCalendarDate(dates.startDate, false)} – ${formatCalendarDate(dates.endDate)}. Tap to confirm you're in: ${origin}/trip/${trip.id}`;
}

export function optionsReadyText(trip: Trip, origin: string) {
  return `Trip options for "${tripName(trip)}" are ready. Vote for your favorite: ${origin}/trip/${trip.id}/options`;
}
