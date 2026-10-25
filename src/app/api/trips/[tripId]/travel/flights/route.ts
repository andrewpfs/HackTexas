import { NextResponse } from "next/server";
import { getSerpApiKey } from "@/lib/serpapi-places";
import { getDepartureCity } from "@/lib/travel-planning";
import { lookupDestinationArea } from "@/lib/city-search";
import { findFlightsWithNearbyAirports } from "@/lib/flight-routing";
import { findCityFlightId, findNearbyAirports, searchFlights } from "@/lib/travel-search";
import { claimFlightSearch, finishFlightSearch, getTripById, selectFlight } from "@/lib/trip-repository";

async function readBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Each traveler gets their own flight search from their own departure city.
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

  const claim = await claimFlightSearch(tripId, body.travelerId, from, body.retry === true);
  if (claim.status !== "claimed") {
    return NextResponse.json({ status: claim.status });
  }

  try {
    const destination = claim.trip.itinerary!.destination;
    const startedAt = claim.trip.travel?.flights?.[body.travelerId]?.startedAt;
    const result = await findFlightsWithNearbyAirports(from, destination, {
      outboundDate: claim.trip.itinerary!.startDate,
      returnDate: claim.trip.itinerary!.endDate,
    }, {
      findCityFlightId: (city) => findCityFlightId(city),
      findNearbyAirports: (point) => findNearbyAirports(point),
      lookupPoint: async (place) => {
        const area = await lookupDestinationArea(place);
        return area?.latitude !== undefined && area.longitude !== undefined ? { latitude: area.latitude, longitude: area.longitude, countryCode: area.countryCode } : null;
      },
      searchFlights: (search) => searchFlights({ apiKey }, search),
    });
    if (!result.ok) {
      await finishFlightSearch(tripId, body.travelerId, { status: "failed", error: result.error }, startedAt);
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    await finishFlightSearch(tripId, body.travelerId, { status: "done", options: result.options, groundNote: result.groundNote }, startedAt);
    return NextResponse.json({ status: "done", count: result.options.length });
  } catch (error) {
    console.error("Flight search failed:", error);
    await finishFlightSearch(tripId, body.travelerId, { status: "failed", error: "We couldn't load flights right now." }, claim.trip.travel?.flights?.[body.travelerId]?.startedAt);
    return NextResponse.json({ error: "We couldn't load flights right now." }, { status: 502 });
  }
}

// A traveler picks their own flight.
export async function PUT(request: Request, context: RouteContext<"/api/trips/[tripId]/travel/flights">) {
  const { tripId } = await context.params;
  const body = await readBody(request);
  if (typeof body.travelerId !== "string" || typeof body.flightId !== "string") {
    return NextResponse.json({ error: "Choose a flight." }, { status: 400 });
  }

  const result = await selectFlight(tripId, body.travelerId, body.flightId);
  if (result.status !== "updated") {
    return NextResponse.json({ error: "That flight is no longer in the list." }, { status: 404 });
  }
  return NextResponse.json({ status: "updated" });
}
