import { NextResponse } from "next/server";
import { changePersonalOverride, type OverrideAction } from "@/lib/trip-repository";
import { readSelectedPlace } from "@/lib/selected-place";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// A traveler skips a group stop to do their own thing, or joins someone else's plan.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/itinerary/overrides">) {
  const { tripId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Tell us what you'd rather do." }, { status: 400 });
  }

  const travelerId = text(body.travelerId, 80);
  if (!travelerId) {
    return NextResponse.json({ error: "Join this trip on this device first." }, { status: 400 });
  }

  let change: OverrideAction;
  if (body.action === "add") {
    const title = text(body.title, 120);
    if (!title || typeof body.dayNumber !== "number") {
      return NextResponse.json({ error: "Say what you'd rather do." }, { status: 400 });
    }
    change = {
      action: "add",
      travelerId,
      dayNumber: body.dayNumber,
      stopTime: text(body.stopTime, 40),
      stopTitle: text(body.stopTitle, 200),
      title,
      location: text(body.location, 160),
      place: readSelectedPlace(body.place) ?? undefined,
      note: text(body.note, 300),
    };
  } else if (body.action === "remove" || body.action === "join" || body.action === "leave") {
    change = { action: body.action, travelerId, overrideId: text(body.overrideId, 80) };
  } else {
    return NextResponse.json({ error: "Unknown change." }, { status: 400 });
  }

  const result = await changePersonalOverride(tripId, change);
  if (result.status !== "updated") {
    const messages = { "not-found": "That stop changed. Refresh and try again.", "no-itinerary": "There's no shared itinerary yet.", "not-allowed": "You can only change your own plans." };
    return NextResponse.json({ error: messages[result.status] }, { status: result.status === "not-allowed" ? 403 : 404 });
  }
  return NextResponse.json({ itinerary: result.trip.itinerary, messages: result.trip.chat ?? [] });
}
