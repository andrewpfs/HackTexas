import { NextResponse } from "next/server";
import { getSerpApiKey } from "@/lib/serpapi-places";
import { getHotelSearchInputs } from "@/lib/travel-planning";
import { discoverHotelFeed } from "@/lib/hotel-discovery";
import { getHotelStays } from "@/lib/hotel-stays";
import { claimHotelSearch, finishHotelSearch, getTripById, selectStayHotel } from "@/lib/trip-repository";

// Muse and the travel searches can take 20-45 seconds; don't let the host cut them off early.
export const maxDuration = 60;

async function readBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stayIndexOf(body: Record<string, unknown>) {
  return typeof body.stayIndex === "number" && Number.isInteger(body.stayIndex) && body.stayIndex >= 0 ? body.stayIndex : 0;
}

// One claimed hotel search for one stay (one city). "refresh" shows the next feed.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/travel/hotels">) {
  const { tripId } = await context.params;
  const body = await readBody(request);
  const apiKey = getSerpApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Hotel search is not configured.", configured: false }, { status: 503 });
  }

  const stayIndex = stayIndexOf(body);
  const trip = await getTripById(tripId);
  if (!trip || !getHotelSearchInputs(trip, stayIndex)) {
    return NextResponse.json({ error: "Create the shared itinerary before searching hotels." }, { status: 409 });
  }

  const claim = await claimHotelSearch(tripId, stayIndex, body.retry === true, body.refresh === true);
  if (claim.status !== "claimed") {
    return NextResponse.json({ status: claim.status });
  }

  const stay = getHotelStays(claim.trip)[stayIndex];
  const startedAt = stay.result?.startedAt;
  try {
    const result = await discoverHotelFeed({ apiKey }, getHotelSearchInputs(claim.trip, stayIndex)!, stay.result?.feed ?? 0);
    await finishHotelSearch(tripId, stay.plan, { status: "done", ...result }, startedAt);
    return NextResponse.json({ status: "done", count: result.options.length });
  } catch (error) {
    console.error("Hotel search failed:", error);
    await finishHotelSearch(tripId, stay.plan, { status: "failed", error: "We couldn't load hotels right now." }, startedAt);
    return NextResponse.json({ error: "We couldn't load hotels right now." }, { status: 502 });
  }
}

// The host picks the group hotel for a stay; travelers who book their own place pick theirs.
export async function PUT(request: Request, context: RouteContext<"/api/trips/[tripId]/travel/hotels">) {
  const { tripId } = await context.params;
  const body = await readBody(request);
  if (typeof body.travelerId !== "string" || typeof body.token !== "string") {
    return NextResponse.json({ error: "Choose a hotel." }, { status: 400 });
  }

  const result = await selectStayHotel(tripId, body.travelerId, stayIndexOf(body), body.token, body.solo === true);
  if (result.status === "not-host") {
    return NextResponse.json({ error: "Only the host picks the group hotel." }, { status: 403 });
  }
  if (result.status === "not-solo") {
    return NextResponse.json({ error: "You're staying with the group. The host picks the group hotel." }, { status: 403 });
  }
  if (result.status !== "updated") {
    return NextResponse.json({ error: "That hotel is no longer in the list." }, { status: 404 });
  }
  return NextResponse.json({ status: "updated" });
}
