import { NextResponse } from "next/server";
import { getSerpApiKey } from "@/lib/serpapi-places";
import { getDepartureCity } from "@/lib/travel-planning";
import { findCityFlightId, searchFlights } from "@/lib/travel-search";
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
    const [fromId, toId] = await Promise.all([findCityFlightId(from), findCityFlightId(claim.trip.itinerary!.destination)]);
    if (!fromId || !toId) {
      await finishFlightSearch(tripId, body.travelerId, { status: "failed", error: `We couldn't find airports for ${!fromId ? from : claim.trip.itinerary!.destination}.` }, claim.trip.travel?.flights?.[body.travelerId]?.startedAt);
      return NextResponse.json({ error: "We couldn't find the airports." }, { status: 422 });
    }

    const options = await searchFlights({ apiKey }, {
      fromId,
      toId,
      outboundDate: claim.trip.itinerary!.startDate,
      returnDate: claim.trip.itinerary!.endDate,
    });
    await finishFlightSearch(tripId, body.travelerId, { status: "done", options }, claim.trip.travel?.flights?.[body.travelerId]?.startedAt);
    return NextResponse.json({ status: "done", count: options.length });
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
