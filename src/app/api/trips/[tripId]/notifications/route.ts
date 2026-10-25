import { NextResponse } from "next/server";
import { getTripById } from "@/lib/trip-repository";

// The trip's recent updates for the notification bar, newest first.
export async function GET(_request: Request, context: RouteContext<"/api/trips/[tripId]/notifications">) {
  const { tripId } = await context.params;
  const trip = await getTripById(tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  return NextResponse.json({ notifications: [...(trip.notifications ?? [])].reverse() }, { headers: { "Cache-Control": "no-store" } });
}
