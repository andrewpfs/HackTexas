import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { textTravelers, voteDecidedText } from "@/lib/group-texts";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";
import { getTripById, voteOnItineraryProposal } from "@/lib/trip-repository";

export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/itinerary/proposal">) {
  const { tripId } = await context.params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 }); }
  if (!body || typeof body.travelerId !== "string" || typeof body.proposalId !== "string" || (body.choice !== "approve" && body.choice !== "reject")) {
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  }
  const trip = await getTripById(tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  const jar = await cookies();
  const session = readSessionValue(jar.get(sessionCookieName)?.value);
  if (!canActAsTraveler(trip, body.travelerId, jar.get(travelerCookieName(tripId))?.value, session)) {
    return NextResponse.json({ error: "Voting needs your original signed browser identity or a previously saved verified phone from My Trips. Older unsigned identities need trusted recovery before voting." }, { status: 403 });
  }
  const result = await voteOnItineraryProposal(tripId, body.proposalId, body.travelerId, body.choice);
  if (!("trip" in result)) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  if (result.status === "closed" || result.status === "not-allowed") return NextResponse.json({ error: "This proposal is closed. Refresh to see the current plan." }, { status: 409 });
  // The last vote decides the change; let everyone know how it went.
  const decided = result.status === "approved" || result.status === "rejected" ? result.trip.pendingItineraryProposal : undefined;
  if (decided) {
    const origin = new URL(request.url).origin;
    after(() => textTravelers(result.trip, voteDecidedText(result.trip, decided, origin)));
  }
  return NextResponse.json({ itinerary: result.trip.itinerary, messages: result.trip.chat ?? [], proposal: result.trip.pendingItineraryProposal, approvedProposal: result.trip.lastApprovedItineraryProposal ?? null });
}
