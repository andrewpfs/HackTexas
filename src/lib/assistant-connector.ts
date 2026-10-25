import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { getNights } from "./travel-planning";
import type { Booking, BookingItem, Trip } from "./trip-types";

function secret() {
  return process.env.SESSION_SECRET?.trim() || "hacktx-dev-session-secret-change-me";
}

// Tokens are shown to the traveler once; only a keyed hash is stored.
export function createAssistantToken() {
  return `tp_${randomBytes(24).toString("base64url")}`;
}

export function hashAssistantToken(token: string) {
  return createHmac("sha256", secret()).update(`assistant:${token}`).digest("hex");
}

export function findTravelerByToken(trips: Trip[], tokenHash: string) {
  for (const trip of trips) {
    const traveler = trip.travelers.find((item) => item.assistantTokenHash === tokenHash);
    if (traveler) return { trip, traveler };
  }
  return null;
}

// ---------- what the assistant can see: only this traveler's view of the trip ----------

export function describeMyTrip(trip: Trip, travelerId: string) {
  const me = trip.travelers.find((traveler) => traveler.id === travelerId)!;
  const itinerary = trip.itinerary;
  const overrides = itinerary?.overrides ?? [];

  return {
    trip: trip.name || (trip.destination ? `${trip.destination} Trip` : "Group Trip"),
    you: me.name,
    departureCity: me.departureLocation || (me.isHost ? trip.origin : null),
    group: trip.travelers.map((traveler) => traveler.name),
    destination: itinerary?.destination ?? trip.destination ?? null,
    dates: itinerary ? { start: itinerary.startDate, end: itinerary.endDate } : { possibleWindowStart: trip.earliestPossibleDate, possibleWindowEnd: trip.latestPossibleDate },
    stage: itinerary ? "shared itinerary ready" : trip.candidateOptions ? "group is voting on options" : "group is still sharing preferences",
    itinerary: itinerary?.days.map((day) => ({
      day: day.dayNumber,
      date: day.date,
      title: day.title,
      stops: day.activities.map((stop) => {
        const mine = overrides.find(
          (plan) => plan.dayNumber === day.dayNumber && plan.stopTime === stop.time && plan.stopTitle === stop.title &&
            (plan.travelerId === travelerId || plan.joinedBy.includes(travelerId)),
        );
        return mine
          ? { time: stop.time, yourPlan: mine.title, location: mine.location, insteadOfGroupStop: stop.title }
          : { time: stop.time, title: stop.title, place: stop.place?.name ?? stop.location, address: stop.place?.address ?? null };
      }),
    })) ?? null,
  };
}

export function describeMyBookings(trip: Trip, travelerId: string) {
  const flights = trip.travel?.flights?.[travelerId];
  const flight = flights?.options.find((option) => option.id === flights.selectedId);
  const hotels = trip.travel?.hotels;
  const hotel = hotels?.options.find((option) => option.token === hotels.selectedToken);
  const booker = trip.travelers.find((traveler) => traveler.id === hotels?.selectedByTravelerId);
  const lodgingCount = Math.max(1, trip.travelers.filter((traveler) => traveler.preferences?.lodgingType !== "No need").length);
  const nights = hotels ? getNights(hotels.checkIn, hotels.checkOut) : 0;
  const hotelTotal = hotel ? hotel.totalPrice ?? (hotel.pricePerNight ?? 0) * nights : null;
  const booking = trip.travel?.bookings?.[travelerId];
  const bookedKinds = new Set(booking?.items.map((item) => item.kind));

  return {
    note: "Ask the traveler for approval before paying for anything. Call mark_booked after a real booking so the group can see it.",
    items: [
      {
        item: "flight",
        status: bookedKinds.has("flight") ? "booked" : flight ? "chosen, not booked" : "not chosen yet",
        chosen: flight ? { airline: flight.airline, from: flight.departAirport, to: flight.arriveAirport, departs: flight.departTime, arrives: flight.arriveTime, stops: flight.stops, roundTripPriceUsd: flight.price } : null,
        youBookThis: true,
      },
      {
        item: "hotel",
        status: bookedKinds.has("hotel") ? "booked" : hotel ? "chosen by the group, not booked" : "not chosen yet",
        chosen: hotel ? { name: hotel.name, checkIn: hotels!.checkIn, checkOut: hotels!.checkOut, nights, totalUsd: hotelTotal, yourShareUsd: hotelTotal !== null ? Math.round(hotelTotal / lodgingCount) : null } : null,
        youBookThis: Boolean(hotel && hotels?.selectedByTravelerId === travelerId),
        bookedBy: booker?.name ?? null,
      },
    ],
    confirmations: booking?.items.map((item) => ({ item: item.kind, code: item.confirmationCode, amountUsd: item.amount, source: item.source ?? "demo" })) ?? [],
  };
}

export function describeBookingDetails(trip: Trip, travelerId: string, item: "flight" | "hotel") {
  if (item === "flight") {
    const flights = trip.travel?.flights?.[travelerId];
    const flight = flights?.options.find((option) => option.id === flights.selectedId);
    if (!flight || !trip.itinerary) return { error: "No flight is chosen yet. Choose one on the trip's Book Travel page." };
    const query = encodeURIComponent(`flights from ${flight.departAirport} to ${flight.arriveAirport} on ${trip.itinerary.startDate} returning ${trip.itinerary.endDate}`);
    return {
      ...flight,
      returnDate: trip.itinerary.endDate,
      bookingSearchUrl: `https://www.google.com/travel/flights?q=${query}`,
      note: "This is a round-trip fare. Pick the matching return flight on the airline or Google Flights before paying.",
    };
  }

  const hotels = trip.travel?.hotels;
  const hotel = hotels?.options.find((option) => option.token === hotels.selectedToken);
  if (!hotel || !hotels) return { error: "The group hasn't picked a hotel yet." };
  return {
    name: hotel.name,
    checkIn: hotels.checkIn,
    checkOut: hotels.checkOut,
    guests: Math.max(1, trip.travelers.filter((traveler) => traveler.preferences?.lodgingType !== "No need").length),
    pricePerNightUsd: hotel.pricePerNight,
    totalUsd: hotel.totalPrice,
    rating: hotel.rating,
    link: hotel.link,
    youBookThis: hotels.selectedByTravelerId === travelerId,
  };
}

// Records a booking the traveler's own assistant made. Replaces any earlier record of the same kind.
export function addAssistantBooking(trip: Trip, travelerId: string, item: Pick<BookingItem, "kind" | "confirmationCode" | "amount"> & { label?: string }): Booking {
  const existing = trip.travel?.bookings?.[travelerId];
  const label = item.label || (item.kind === "flight" ? "Flight booked by your assistant" : "Hotel booked by your assistant");
  const items = [
    ...(existing?.items ?? []).filter((entry) => entry.kind !== item.kind),
    { kind: item.kind, label, detail: "Booked through a connected assistant", amount: item.amount, confirmationCode: item.confirmationCode, source: "assistant" as const },
  ];
  return { travelerId, items, total: items.reduce((sum, entry) => sum + entry.amount, 0), bookedAt: new Date().toISOString() };
}
