import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { confirmedDatesStillShared } from "@/lib/date-suggestions";
import { isValidISODate } from "@/lib/date-utils";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { calculatePlanningReadiness } from "@/lib/planning-context";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";
import { confirmTripDates, getTripById } from "@/lib/trip-repository";

// The host confirms the exact trip dates. They must be days everyone marked free.
export async function PUT(request: Request, context: RouteContext<"/api/trips/[tripId]/dates">) {
  const { tripId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { hostTravelerId?: unknown; startDate?: unknown; endDate?: unknown };
  const hostTravelerId = typeof body.hostTravelerId === "string" ? body.hostTravelerId : "";
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";
  if (!isValidISODate(startDate) || !isValidISODate(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "Pick a start date and an end date." }, { status: 400 });
  }

  const trip = await getTripById(tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  const cookieStore = await cookies();
  const session = readSessionValue(cookieStore.get(sessionCookieName)?.value);
  if (!trip.travelers.find((traveler) => traveler.id === hostTravelerId)?.isHost || !canActAsTraveler(trip, hostTravelerId, cookieStore.get(travelerCookieName(tripId))?.value, session)) {
    return NextResponse.json({ error: "Only the host can confirm the trip dates." }, { status: 403 });
  }
  if (!confirmedDatesStillShared({ startDate, endDate }, calculatePlanningReadiness(trip).sharedDates)) {
    return NextResponse.json({ error: "Every day of the trip has to be a day the whole group is free." }, { status: 400 });
  }

  const result = await confirmTripDates(tripId, hostTravelerId, startDate, endDate);
  if (result.status === "already-planned") {
    return NextResponse.json({ error: "Options already exist. Edit the trip details to start planning over." }, { status: 409 });
  }
  if (result.status !== "confirmed") {
    return NextResponse.json({ error: "Only the host can confirm the trip dates." }, { status: 403 });
  }
  return NextResponse.json({ confirmedDates: result.trip?.confirmedDates });
}
