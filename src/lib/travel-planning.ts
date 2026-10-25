import { randomBytes } from "node:crypto";
import type { Booking, BookingItem, Trip } from "./trip-types";
import { addDaysToDate, type HotelSearch } from "./travel-search";
import { hotelShareForTraveler } from "./travel-display";

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

export function getHotelSearchInputs(trip: Trip): HotelSearch | null {
  const itinerary = trip.itinerary;
  if (!itinerary) {
    return null;
  }

  return {
    destination: itinerary.destination,
    checkIn: itinerary.startDate,
    // Check out the morning after the last day.
    checkOut: addDaysToDate(itinerary.endDate, 1),
    adults: Math.max(1, travelersNeedingLodging(trip).length),
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
  const flights = trip.travel?.flights?.[travelerId];
  const flight = flights?.options.find((option) => option.id === flights.selectedId);
  if (flight) {
    items.push({
      kind: "flight",
      label: `${flight.airline}, ${flight.departAirport} to ${flight.arriveAirport}`,
      detail: `Round trip · leaves ${flight.departTime}${flight.stops ? ` · ${flight.stops} stop${flight.stops === 1 ? "" : "s"}` : " · nonstop"}`,
      amount: flight.price,
      confirmationCode: confirmationCode("FLT"),
    });
  }

  const hotels = trip.travel?.hotels;
  const hotel = hotels?.options.find((option) => option.token === hotels.selectedToken);
  if (hotel && hotels && hotels.selectedByTravelerId === travelerId) {
    const nights = getNights(hotels.checkIn, hotels.checkOut);
    const amount = hotel.totalPrice ?? (hotel.pricePerNight ?? 0) * nights;
    items.push({
      kind: "hotel",
      label: hotel.name,
      detail: `${nights} night${nights === 1 ? "" : "s"} for the group · ${hotels.checkIn} to ${hotels.checkOut}`,
      amount,
      confirmationCode: confirmationCode("HTL"),
    });
  }

  if (items.length === 0) {
    return { error: "Pick your flight first. The host books the group hotel." };
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
