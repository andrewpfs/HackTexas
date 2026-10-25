import { NextResponse } from "next/server";
import { getTripById } from "@/lib/trip-repository";

// Current plan and chat, polled by the itinerary page so everyone sees changes.
export async function GET(
  _request: Request,
  context: RouteContext<"/api/trips/[tripId]/itinerary">,
) {
  const { tripId } = await context.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }
  if (!trip.itinerary) {
    return NextResponse.json({ error: "This trip has no shared itinerary yet." }, { status: 404 });
  }

  return NextResponse.json({ itinerary: trip.itinerary, messages: trip.chat || [], proposal: trip.pendingItineraryProposal ?? null, approvedProposal: trip.lastApprovedItineraryProposal ?? null }, { headers: { "Cache-Control": "no-store" } });
}
