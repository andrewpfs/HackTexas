import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";
import { agreeToTripDates, getTripById } from "@/lib/trip-repository";

// A traveler confirms they can go on the dates the host set.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/dates/agree">) {
  const { tripId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { travelerId?: unknown; startDate?: unknown; endDate?: unknown };
  const travelerId = typeof body.travelerId === "string" ? body.travelerId : "";
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";

  const trip = await getTripById(tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  const cookieStore = await cookies();
  const session = readSessionValue(cookieStore.get(sessionCookieName)?.value);
  if (!canActAsTraveler(trip, travelerId, cookieStore.get(travelerCookieName(tripId))?.value, session)) {
    return NextResponse.json({ error: "Open this trip on the device you joined with to confirm." }, { status: 403 });
  }

  const result = await agreeToTripDates(tripId, travelerId, startDate, endDate);
  if (result.status === "dates-changed") {
    return NextResponse.json({ error: "The host just changed the dates. Take a look at the new ones." }, { status: 409 });
  }
  if (result.status === "no-dates") {
    return NextResponse.json({ error: "The host hasn't set the dates yet." }, { status: 409 });
  }
  if (result.status === "already-planned") {
    return NextResponse.json({ error: "Options are already planned for these dates." }, { status: 409 });
  }
  if (result.status !== "agreed") {
    return NextResponse.json({ error: "We couldn't find you on this trip." }, { status: 404 });
  }
  return NextResponse.json({ agreedTravelerIds: result.trip.confirmedDates?.agreedTravelerIds ?? [] });
}
