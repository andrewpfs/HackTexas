import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAssistantToken, hashAssistantToken } from "@/lib/assistant-connector";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";
import { getTripById, setAssistantToken } from "@/lib/trip-repository";

// Only the traveler themself (this browser's traveler cookie or their signed-in phone)
// may connect or disconnect an assistant, since the token can record bookings.
async function isTraveler(tripId: string, travelerId: string) {
  const trip = await getTripById(tripId);
  if (!trip) return false;
  const cookieStore = await cookies();
  const session = readSessionValue(cookieStore.get(sessionCookieName)?.value);
  return canActAsTraveler(trip, travelerId, cookieStore.get(travelerCookieName(tripId))?.value, session);
}

// Creates a new connection token for this traveler's AI assistant. The old one stops working.
export async function POST(_request: Request, context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/assistant-token">) {
  const { tripId, travelerId } = await context.params;
  if (!(await isTraveler(tripId, travelerId))) {
    return NextResponse.json({ error: "Open this trip from your invite link on this device first." }, { status: 403 });
  }
  const token = createAssistantToken();
  const saved = await setAssistantToken(tripId, travelerId, hashAssistantToken(token));
  if (saved.status !== "saved") {
    return NextResponse.json({ error: "We couldn't find you on this trip." }, { status: 404 });
  }
  return NextResponse.json({ token });
}

// Disconnects the assistant.
export async function DELETE(_request: Request, context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/assistant-token">) {
  const { tripId, travelerId } = await context.params;
  if (!(await isTraveler(tripId, travelerId))) {
    return NextResponse.json({ error: "Open this trip from your invite link on this device first." }, { status: 403 });
  }
  const saved = await setAssistantToken(tripId, travelerId, undefined);
  if (saved.status !== "saved") {
    return NextResponse.json({ error: "We couldn't find you on this trip." }, { status: 404 });
  }
  return NextResponse.json({ disconnected: true });
}
