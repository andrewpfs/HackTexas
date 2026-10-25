import { NextResponse } from "next/server";
import { createAssistantToken, hashAssistantToken } from "@/lib/assistant-connector";
import { setAssistantToken } from "@/lib/trip-repository";

// Creates a new connection token for this traveler's AI assistant. The old one stops working.
export async function POST(_request: Request, context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/assistant-token">) {
  const { tripId, travelerId } = await context.params;
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
  const saved = await setAssistantToken(tripId, travelerId, undefined);
  if (saved.status !== "saved") {
    return NextResponse.json({ error: "We couldn't find you on this trip." }, { status: 404 });
  }
  return NextResponse.json({ disconnected: true });
}
