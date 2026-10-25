import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { datesConfirmedText, textTravelers } from "@/lib/group-texts";
import { confirmedDatesStillShared } from "@/lib/date-suggestions";
import { addDays, getDatesInRange, isValidISODate } from "@/lib/date-utils";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { calculatePlanningReadiness } from "@/lib/planning-context";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";
import { confirmTripDates, getTripById } from "@/lib/trip-repository";

const maximumTripDays = 30;

// The host sets the exact trip dates. Usually days everyone marked free, but the
// host can override and pick any days; the card warns who isn't free.
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
  // Allow "yesterday" so a host in an earlier time zone isn't blocked near midnight.
  if (startDate < addDays(new Date().toISOString().slice(0, 10), -1)) {
    return NextResponse.json({ error: "Those dates have already passed." }, { status: 400 });
  }
  if (getDatesInRange(startDate, endDate).length > maximumTripDays) {
    return NextResponse.json({ error: `Pick ${maximumTripDays} days or fewer.` }, { status: 400 });
  }
  const outsideSharedDates = !confirmedDatesStillShared({ startDate, endDate }, calculatePlanningReadiness(trip).sharedDates);

  const result = await confirmTripDates(tripId, hostTravelerId, startDate, endDate, outsideSharedDates);
  if (result.status === "already-planned") {
    return NextResponse.json({ error: "Options already exist. Edit the trip details to start planning over." }, { status: 409 });
  }
  if (result.status !== "confirmed") {
    return NextResponse.json({ error: "Only the host can confirm the trip dates." }, { status: 403 });
  }
  const confirmedTrip = result.trip!;
  const origin = new URL(request.url).origin;
  after(() => textTravelers(confirmedTrip, datesConfirmedText(confirmedTrip, origin), hostTravelerId));
  return NextResponse.json({ confirmedDates: confirmedTrip.confirmedDates });
}
