import "server-only";
import { chosenFlight, chosenFlights, flightLegsOf } from "./flight-legs";

import { createHmac, randomBytes } from "node:crypto";
import { getHotelStays, groupLodgers, isSoloLodger, selectedGroupHotel, stayNights } from "./hotel-stays";
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
  // One flight per leg: home to the first city, between cities, and home.
  const legs = flightLegsOf(trip.travel?.flights?.[travelerId], trip.itinerary);
  const flightLegs = legs.map((leg) => {
    const flight = chosenFlight(leg);
    return { from: leg.from, to: leg.to, date: leg.date, chosen: flight ? { airline: flight.airline, from: flight.departAirport, to: flight.arriveAirport, departs: flight.departTime, arrives: flight.arriveTime, stops: flight.stops, priceUsd: flight.price, fare: leg.roundTrip ? "round trip" : "one way", driveAfterLanding: flight.groundTransfer ?? null } : null };
  });
  // One hotel per city the group sleeps in; solo lodgers have their own pick.
  const me = trip.travelers.find((traveler) => traveler.id === travelerId);
  const solo = me ? isSoloLodger(me) : false;
  const lodgingCount = Math.max(1, groupLodgers(trip).length);
  const stays = getHotelStays(trip).map(({ plan, result }) => {
    const hotel = solo ? result?.options.find((option) => option.token === result.soloPicks?.[travelerId]) : selectedGroupHotel(result);
    const nights = stayNights(plan);
    const totalUsd = hotel ? hotel.totalPrice ?? (hotel.pricePerNight ?? 0) * nights : null;
    return {
      city: plan.city, checkIn: plan.checkIn, checkOut: plan.checkOut, nights,
      chosen: hotel ? { name: hotel.name, totalUsd, yourShareUsd: totalUsd !== null ? Math.round(solo ? totalUsd : totalUsd / lodgingCount) : null } : null,
      youBookThis: Boolean(hotel && (solo || result?.selectedByTravelerId === travelerId)),
      bookedBy: solo ? "you" : trip.travelers.find((traveler) => traveler.id === result?.selectedByTravelerId)?.name ?? null,
    };
  });
  const booking = trip.travel?.bookings?.[travelerId];
  const bookedKinds = new Set(booking?.items.map((item) => item.kind));

  return {
    note: "Ask the traveler for approval before paying for anything. Call mark_booked after a real booking so the group can see it.",
    items: [
      {
        item: "flight",
        status: bookedKinds.has("flight") ? "booked" : flightLegs.length > 0 && flightLegs.every((leg) => leg.chosen) ? "chosen, not booked" : "not chosen for every leg yet",
        legs: flightLegs,
        youBookThis: true,
      },
      {
        item: "hotel",
        status: bookedKinds.has("hotel") ? "booked" : stays.every((stay) => stay.chosen) ? "chosen, not booked" : "not chosen for every city yet",
        stays,
        bookingOwnPlace: solo,
      },
    ],
    confirmations: booking?.items.map((item) => ({ item: item.kind, code: item.confirmationCode, amountUsd: item.amount, source: item.source ?? "demo" })) ?? [],
  };
}

export function describeBookingDetails(trip: Trip, travelerId: string, item: "flight" | "hotel") {
  if (item === "flight") {
    const chosen = chosenFlights(trip.travel?.flights?.[travelerId], trip.itinerary);
    if (chosen.length === 0 || !trip.itinerary) return { error: "No flight is chosen yet. Choose one on the trip's Book Travel page." };
    const itinerary = trip.itinerary;
    return {
      legs: chosen.map(({ leg, flight }) => {
        const query = encodeURIComponent(leg.roundTrip
          ? `flights from ${flight.departAirport} to ${flight.arriveAirport} on ${itinerary.startDate} returning ${itinerary.endDate}`
          : `one way flights from ${flight.departAirport} to ${flight.arriveAirport} on ${leg.date}`);
        return { ...flight, date: leg.date, fare: leg.roundTrip ? "round trip" : "one way", bookingSearchUrl: `https://www.google.com/travel/flights?q=${query}` };
      }),
      note: "Each leg is its own ticket. Book every leg the traveler approved, and the drive after landing where one is listed.",
    };
  }

  const me = trip.travelers.find((traveler) => traveler.id === travelerId);
  const solo = me ? isSoloLodger(me) : false;
  const stays = getHotelStays(trip).map(({ plan, result }) => {
    const hotel = solo ? result?.options.find((option) => option.token === result.soloPicks?.[travelerId]) : selectedGroupHotel(result);
    return hotel ? {
      city: plan.city, name: hotel.name, checkIn: plan.checkIn, checkOut: plan.checkOut,
      guests: solo ? 1 : Math.max(1, groupLodgers(trip).length),
      pricePerNightUsd: hotel.pricePerNight, totalUsd: hotel.totalPrice, rating: hotel.rating, link: hotel.link,
      youBookThis: solo || result?.selectedByTravelerId === travelerId,
    } : { city: plan.city, checkIn: plan.checkIn, checkOut: plan.checkOut, error: "No hotel picked for this city yet." };
  });
  if (stays.length === 0 || stays.every((stay) => "error" in stay)) return { error: "The group hasn't picked a hotel yet." };
  return { stays };
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
