import { NextResponse } from "next/server";
import { buildBooking } from "@/lib/travel-planning";
import { getTripById, saveBooking } from "@/lib/trip-repository";

// Demo booking: records confirmation codes. No payment is taken and nothing is reserved.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/travel/book">) {
  const { tripId } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // handled below
  }
  if (typeof body.travelerId !== "string") {
    return NextResponse.json({ error: "Join this trip on this device first." }, { status: 400 });
  }

  const trip = await getTripById(tripId);
  if (!trip?.itinerary) {
    return NextResponse.json({ error: "Create the shared itinerary first." }, { status: 409 });
  }

  const result = buildBooking(trip, body.travelerId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const saved = await saveBooking(tripId, result.booking, { id: trip.itinerary.id, revision: trip.itinerary.revision ?? 0 });
  if (saved.status !== "saved") {
    return NextResponse.json({ error: "We couldn't find you on this trip." }, { status: 404 });
  }
  return NextResponse.json({ booking: result.booking });
}
