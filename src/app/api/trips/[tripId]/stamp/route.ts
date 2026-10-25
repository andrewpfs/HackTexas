import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getTripById } from "@/lib/trip-repository";

// A short fingerprint of the trip. It changes whenever anyone saves anything,
// so open pages know when to reload.
export async function GET(
  _request: Request,
  context: RouteContext<"/api/trips/[tripId]/stamp">,
) {
  const { tripId } = await context.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const stamp = createHash("sha1").update(JSON.stringify(trip)).digest("hex").slice(0, 16);
  return NextResponse.json({ stamp }, { headers: { "Cache-Control": "no-store" } });
}
