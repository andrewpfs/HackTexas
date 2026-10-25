import { NextResponse } from "next/server";
import { lookupDestinationArea } from "@/lib/city-search";
import { flightLegsKey, planFlightLegs, shortCity } from "@/lib/flight-legs";
import { findFlightsWithNearbyAirports } from "@/lib/flight-routing";
import { getSerpApiKey } from "@/lib/serpapi-places";
import { getDepartureCity } from "@/lib/travel-planning";
import { findCityFlightId, findNearbyAirports, searchFlights } from "@/lib/travel-search";
import { claimFlightSearch, finishFlightSearch, getTripById, selectFlight } from "@/lib/trip-repository";
import type { FlightLeg } from "@/lib/trip-types";

// Muse and live travel searches can take a minute or more (with retries). Without this,
// Vercel stops the function early and the request fails part of the time.
export const maxDuration = 300;


async function readBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Each traveler gets their own flights from their own departure city: one one-way
// flight per leg of the trip (home to the first city, between cities, and home),
// just like a multi-city trip needs a hotel in each city.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/travel/flights">) {
  const { tripId } = await context.params;
  const body = await readBody(request);
  const apiKey = getSerpApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Flight search is not configured.", configured: false }, { status: 503 });
  }
  if (typeof body.travelerId !== "string") {
    return NextResponse.json({ error: "Join this trip on this device first." }, { status: 400 });
  }

  const trip = await getTripById(tripId);
  if (!trip?.itinerary) {
    return NextResponse.json({ error: "Create the shared itinerary before searching flights." }, { status: 409 });
  }
  const from = getDepartureCity(trip, body.travelerId);
  if (!from) {
    return NextResponse.json({ error: "Add your departure city first." }, { status: 409 });
  }

  const plans = planFlightLegs(trip.itinerary, from);
  const legsKey = flightLegsKey(plans);
  const claim = await claimFlightSearch(tripId, body.travelerId, from, legsKey, body.retry === true);
  if (claim.status !== "claimed") {
    return NextResponse.json({ status: claim.status });
  }
  const startedAt = claim.trip.travel?.flights?.[body.travelerId]?.startedAt;

  const dependencies = {
    findCityFlightId: (city: string) => findCityFlightId(city),
    findNearbyAirports: (point: { latitude: number; longitude: number }) => findNearbyAirports(point),
    lookupPoint: async (place: string) => {
      const area = await lookupDestinationArea(place);
      return area?.latitude !== undefined && area.longitude !== undefined ? { latitude: area.latitude, longitude: area.longitude, countryCode: area.countryCode } : null;
    },
    searchFlights: (search: Parameters<typeof searchFlights>[1]) => searchFlights({ apiKey }, search),
  };

  try {
    const legs: FlightLeg[] = await Promise.all(plans.map(async (plan, index): Promise<FlightLeg> => {
      try {
        const result = await findFlightsWithNearbyAirports(plan.from, plan.to, { outboundDate: plan.date }, dependencies);
        if (!result.ok) return { ...plan, options: [], error: result.error };
        if (result.options.length === 0) {
          // Between two cities on the trip, a train or drive is often the better way anyway.
          const between = index > 0 && index < plans.length - 1;
          return { ...plan, options: [], error: between ? `No flights found from ${shortCity(plan.from)} to ${shortCity(plan.to)} that day. A train or drive is usually the way to go.` : `No flights found from ${shortCity(plan.from)} to ${shortCity(plan.to)} that day.` };
        }
        return { ...plan, options: result.options, ...(result.groundNote ? { groundNote: result.groundNote } : {}) };
      } catch (error) {
        console.error(`Flight search failed for ${plan.from} to ${plan.to}:`, error);
        return { ...plan, options: [], error: `We couldn't load flights from ${shortCity(plan.from)} to ${shortCity(plan.to)} right now.` };
      }
    }));

    const allFailed = legs.length > 0 && legs.every((leg) => leg.options.length === 0);
    await finishFlightSearch(tripId, body.travelerId, {
      status: allFailed ? "failed" : "done",
      legs,
      legsKey,
      options: [],
      selectedId: undefined,
      groundNote: undefined,
      error: allFailed ? legs[0]?.error ?? "We couldn't find flights for this trip." : undefined,
    }, startedAt);
    return NextResponse.json({ status: allFailed ? "failed" : "done", legs: legs.length });
  } catch (error) {
    console.error("Flight search failed:", error);
    await finishFlightSearch(tripId, body.travelerId, { status: "failed", error: "We couldn't load flights right now." }, startedAt);
    return NextResponse.json({ error: "We couldn't load flights right now." }, { status: 502 });
  }
}

// A traveler picks their own flight (one per leg on multi-city trips).
export async function PUT(request: Request, context: RouteContext<"/api/trips/[tripId]/travel/flights">) {
  const { tripId } = await context.params;
  const body = await readBody(request);
  if (typeof body.travelerId !== "string" || typeof body.flightId !== "string") {
    return NextResponse.json({ error: "Choose a flight." }, { status: 400 });
  }

  const result = await selectFlight(tripId, body.travelerId, body.flightId, typeof body.legIndex === "number" ? body.legIndex : undefined);
  if (result.status !== "updated") {
    return NextResponse.json({ error: "That flight is no longer in the list." }, { status: 404 });
  }
  return NextResponse.json({ status: "updated" });
}
