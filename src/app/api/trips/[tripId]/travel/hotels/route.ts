import { NextResponse } from "next/server";
import { getSerpApiKey } from "@/lib/serpapi-places";
import { getHotelSearchInputs } from "@/lib/travel-planning";
import { discoverHotels } from "@/lib/hotel-discovery";
import { claimHotelSearch, finishHotelSearch, getTripById, selectGroupHotel } from "@/lib/trip-repository";

async function readBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// One claimed Expedia discovery search, with Google Hotels as a fallback.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/travel/hotels">) {
  const { tripId } = await context.params;
  const body = await readBody(request);
  const apiKey = getSerpApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Hotel search is not configured.", configured: false }, { status: 503 });
  }

  const trip = await getTripById(tripId);
  const inputs = trip ? getHotelSearchInputs(trip) : null;
  if (!trip || !inputs) {
    return NextResponse.json({ error: "Create the shared itinerary before searching hotels." }, { status: 409 });
  }

  const claim = await claimHotelSearch(tripId, inputs.checkIn, inputs.checkOut, body.retry === true);
  if (claim.status !== "claimed") {
    return NextResponse.json({ status: claim.status });
  }

  try {
    const result = await discoverHotels({ apiKey }, getHotelSearchInputs(claim.trip)!);
    await finishHotelSearch(tripId, { status: "done", ...result }, claim.trip.travel?.hotels?.startedAt);
    return NextResponse.json({ status: "done", count: result.options.length });
  } catch (error) {
    console.error("Hotel search failed:", error);
    await finishHotelSearch(tripId, { status: "failed", error: "We couldn't load hotels right now." }, claim.trip.travel?.hotels?.startedAt);
    return NextResponse.json({ error: "We couldn't load hotels right now." }, { status: 502 });
  }
}

// The host picks the hotel for the group.
export async function PUT(request: Request, context: RouteContext<"/api/trips/[tripId]/travel/hotels">) {
  const { tripId } = await context.params;
  const body = await readBody(request);
  if (typeof body.travelerId !== "string" || typeof body.token !== "string") {
    return NextResponse.json({ error: "Choose a hotel." }, { status: 400 });
  }

  const result = await selectGroupHotel(tripId, body.travelerId, body.token);
  if (result.status === "not-host") {
    return NextResponse.json({ error: "Only the host picks the group hotel." }, { status: 403 });
  }
  if (result.status !== "updated") {
    return NextResponse.json({ error: "That hotel is no longer in the list." }, { status: 404 });
  }
  return NextResponse.json({ status: "updated" });
}
