import { planStays } from "./hotel-stays";
import type { FlightLeg, FlightOption, FlightSearchResult, GroupItinerary } from "./trip-types";

// Like hotels (one per city), a multi-city trip needs one flight per leg:
// home to the first city, one between each pair of cities, and back home.
// Houston to Tokyo, Tokyo to Kyoto, Kyoto to Tokyo, Tokyo to Houston.

export type FlightLegPlan = { from: string; to: string; date: string };

function sameCity(a: string, b: string) {
  return a.split(",")[0].trim().toLowerCase() === b.split(",")[0].trim().toLowerCase();
}

export function planFlightLegs(itinerary: Pick<GroupItinerary, "days" | "destination" | "startDate" | "endDate">, home: string): FlightLegPlan[] {
  const stays = planStays(itinerary);
  const legs: FlightLegPlan[] = [];
  let at = home;
  for (const stay of stays) {
    if (!sameCity(at, stay.city)) legs.push({ from: at, to: stay.city, date: stay.checkIn });
    at = stay.city;
  }
  if (!sameCity(at, home)) legs.push({ from: at, to: home, date: itinerary.endDate });
  return legs;
}

export function flightLegsKey(legs: FlightLegPlan[]) {
  return legs.map((leg) => `${leg.from.toLowerCase()}>${leg.to.toLowerCase()}@${leg.date}`).join("|");
}

// Every leg of a saved search. Searches from before legs existed count as one round trip.
export function flightLegsOf(result: FlightSearchResult | undefined, itinerary?: Pick<GroupItinerary, "destination" | "startDate">): FlightLeg[] {
  if (!result) return [];
  if (result.legs) return result.legs;
  if (result.options.length === 0 && !result.selectedId) return [];
  return [{ from: result.from, to: itinerary?.destination ?? "", date: itinerary?.startDate ?? "", options: result.options, selectedId: result.selectedId, groundNote: result.groundNote, roundTrip: true }];
}

export function chosenFlight(leg: FlightLeg): FlightOption | undefined {
  return leg.options.find((option) => option.id === leg.selectedId);
}

// The flights a traveler picked, one per leg (legs without a pick are left out).
export function chosenFlights(result: FlightSearchResult | undefined, itinerary?: Pick<GroupItinerary, "destination" | "startDate">) {
  return flightLegsOf(result, itinerary).flatMap((leg) => {
    const flight = chosenFlight(leg);
    return flight ? [{ leg, flight }] : [];
  });
}

export function shortCity(place: string) {
  return place.split(",")[0].trim() || place;
}
