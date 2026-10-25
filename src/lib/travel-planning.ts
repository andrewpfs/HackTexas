import { randomBytes } from "node:crypto";
import { chosenFlights, shortCity } from "./flight-legs";
import type { Booking, BookingItem, Trip } from "./trip-types";
import type { HotelSearch } from "./travel-search";
import { hotelShareForTraveler } from "./travel-display";
import { hotelPriceTotal } from "./hotel-display";
import { getHotelStays, groupLodgers, isSoloLodger, needsLodging, selectedGroupHotel, stayNights } from "./hotel-stays";

// Travelers who need a bed. People who chose "No need" are staying elsewhere.
export function travelersNeedingLodging(trip: Trip) {
  return trip.travelers.filter((traveler) => traveler.preferences?.lodgingType !== "No need");
}

// The group's $ to $$$$ price level, as a 2 to 5 star hotel class. The middle choice wins.
export function groupHotelClass(trip: Trip) {
  const levels = travelersNeedingLodging(trip)
    .map((traveler) => traveler.preferences?.hotelStars)
    .filter((level): level is number => typeof level === "number")
    .map((level) => Math.min(4, level))
    .sort((a, b) => a - b);

  if (levels.length === 0) {
    return undefined;
  }
  return levels[Math.floor((levels.length - 1) / 2)] + 1;
}

// The search for one stay (one city). Only travelers sharing the group hotel count as guests.
export function getHotelSearchInputs(trip: Trip, stayIndex = 0): HotelSearch | null {
  const stay = getHotelStays(trip)[stayIndex];
  if (!stay) {
    return null;
  }

  return {
    destination: stay.plan.city,
    checkIn: stay.plan.checkIn,
    checkOut: stay.plan.checkOut,
    adults: Math.max(1, groupLodgers(trip).length),
    hotelClass: groupHotelClass(trip),
  };
}

export function getDepartureCity(trip: Trip, travelerId: string) {
  const traveler = trip.travelers.find((item) => item.id === travelerId);
  if (!traveler) {
    return null;
  }
  return traveler.departureLocation || (traveler.isHost ? trip.origin : "") || null;
}

export function getNights(checkIn: string, checkOut: string) {
  return Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000));
}

// The lowest lodging budget per night anyone gave, to flag hotels that fit everyone.
export function lowestLodgingBudgetPerNight(trip: Trip) {
  const budgets = travelersNeedingLodging(trip)
    .map((traveler) => traveler.preferences?.lodgingBudgetPerNight)
    .filter((budget): budget is number => typeof budget === "number");
  return budgets.length > 0 ? Math.min(...budgets) : null;
}

function confirmationCode(prefix: string) {
  return `DEMO-${prefix}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// What one traveler books: their own flight, plus the hotel if they are the one booking it.
export function buildBooking(trip: Trip, travelerId: string): { booking: Booking } | { error: string } {
  const items: BookingItem[] = [];
  // One ticket per leg the traveler picked (home, between cities, and home again).
  for (const { leg, flight } of chosenFlights(trip.travel?.flights?.[travelerId], trip.itinerary)) {
    items.push({
      kind: "flight",
      label: `${flight.airline}, ${flight.departAirport} to ${flight.arriveAirport}`,
      detail: `${leg.roundTrip ? "Round trip" : "One way"} · ${shortCity(leg.from)} to ${shortCity(leg.to)} · leaves ${flight.departTime}${flight.stops ? ` · ${flight.stops} stop${flight.stops === 1 ? "" : "s"}` : " · nonstop"}`,
      amount: flight.price,
      confirmationCode: confirmationCode("FLT"),
    });
  }

  // Every stay needs a hotel before anyone who sleeps there can confirm: the host picks
  // the group hotel, and travelers who book their own place pick theirs.
  const traveler = trip.travelers.find((item) => item.id === travelerId);
  const stays = getHotelStays(trip);
  if (traveler && needsLodging(traveler)) {
    const solo = isSoloLodger(traveler);
    const missing = stays.filter(({ result }) => (solo ? !result?.soloPicks?.[travelerId] : !result?.selectedToken)).map(({ plan }) => plan.city.split(",")[0]);
    if (missing.length > 0) {
      const list = missing.join(" and ");
      return { error: solo ? `Pick your own hotel in ${list} first.` : traveler.isHost ? `Pick the group hotel in ${list} first.` : `Wait for the host to pick the group hotel in ${list}, then you can confirm.` };
    }
  }

  for (const { plan, result } of stays) {
    const nights = stayNights(plan);
    const solo = traveler ? isSoloLodger(traveler) : false;
    const hotel = solo
      ? result?.options.find((option) => option.token === result.soloPicks?.[travelerId])
      : result?.selectedByTravelerId === travelerId ? selectedGroupHotel(result) : undefined;
    const amount = hotel ? hotelPriceTotal(hotel, nights) : null;
    if (!hotel || amount === null) continue;
    items.push({
      kind: "hotel",
      label: `${hotel.name}, ${plan.city}`,
      detail: `${nights} night${nights === 1 ? "" : "s"} ${solo ? "just for you" : "for the group"} · ${plan.checkIn} to ${plan.checkOut}`,
      amount,
      confirmationCode: confirmationCode("HTL"),
    });
  }

  if (items.length === 0) {
    return { error: "Choose a priced flight or hotel to check out. Check unpriced hotel results on the provider's site." };
  }

  return {
    booking: {
      travelerId,
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      bookedAt: new Date().toISOString(),
      hotelShare: hotelShareForTraveler(trip, travelerId),
    },
  };
}
