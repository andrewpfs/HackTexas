import { addDays } from "./date-utils";
import { firstStop } from "./trip-destination";
import type { GroupItinerary, HotelOption, HotelSearchResult, Traveler, Trip } from "./trip-types";

// A trip that moves between cities needs a hotel in each one. Consecutive days that
// sleep in the same city are one stay: check in on its first day, check out the day
// the next stay starts (or the morning after the trip's last day).

export type StayPlan = { city: string; checkIn: string; checkOut: string };

export function planStays(itinerary: Pick<GroupItinerary, "days" | "destination" | "startDate" | "endDate">): StayPlan[] {
  const fallback = firstStop(itinerary.destination);
  if (itinerary.days.length === 0) return [{ city: fallback, checkIn: itinerary.startDate, checkOut: addDays(itinerary.endDate, 1) }];
  const stays: StayPlan[] = [];
  for (const day of itinerary.days) {
    const city = day.city?.trim() || fallback;
    const last = stays[stays.length - 1];
    if (last && last.city.toLowerCase() === city.toLowerCase()) continue;
    if (last) last.checkOut = day.date;
    stays.push({ city, checkIn: day.date, checkOut: addDays(itinerary.endDate, 1) });
  }
  return stays;
}

export function sameStay(result: Pick<HotelSearchResult, "city" | "checkIn" | "checkOut">, stay: StayPlan) {
  return (result.city ?? "").toLowerCase() === stay.city.toLowerCase() && result.checkIn === stay.checkIn && result.checkOut === stay.checkOut;
}

// The saved hotel search for each planned stay (undefined until it has been searched).
// Trips saved before multi-city stays had one `travel.hotels`; it counts as the only stay.
export function getHotelStays(trip: Pick<Trip, "itinerary" | "travel">): { plan: StayPlan; result: HotelSearchResult | undefined }[] {
  if (!trip.itinerary) return [];
  const plans = planStays(trip.itinerary);
  const saved = trip.travel?.hotelStays ?? [];
  const legacy = trip.travel?.hotels;
  return plans.map((plan) => ({
    plan,
    result: saved.find((result) => sameStay(result, plan)) ?? (plans.length === 1 && legacy && !trip.travel?.hotelStays ? { ...legacy, city: plan.city } : undefined),
  }));
}

export function selectedGroupHotel(result: HotelSearchResult | undefined): HotelOption | undefined {
  return result?.options.find((option) => option.token === result.selectedToken);
}

export function needsLodging(traveler: Traveler) {
  return traveler.preferences?.lodgingType !== "No need";
}

// Travelers who said they'd rather have their own place book their own hotel.
export function isSoloLodger(traveler: Traveler) {
  return needsLodging(traveler) && traveler.preferences?.groupLodgingPreference === "Prefer separate lodging";
}

// Travelers who share the group hotel and split its cost.
export function groupLodgers(trip: Pick<Trip, "travelers">) {
  return trip.travelers.filter((traveler) => needsLodging(traveler) && !isSoloLodger(traveler));
}

export function stayNights(stay: Pick<StayPlan, "checkIn" | "checkOut">) {
  return Math.max(1, Math.round((Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86400000));
}
