import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isValidISODate } from "@/lib/date-utils";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { getTravelerDepartureLocation } from "@/lib/planning-context";
import { getSerpApiKey } from "@/lib/serpapi-places";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";
import { findCityFlightId, searchFlights } from "@/lib/travel-search";
import { getTripById, saveDatePriceCheck } from "@/lib/trip-repository";

const maximumWindows = 3;
const maximumOrigins = 4;

// Looks up real round-trip fares for a few date choices so the host can compare them.
// At most 3 date choices x 4 departure cities = 12 SerpApi searches, only when the host asks.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/dates/prices">) {
  const { tripId } = await context.params;
  const apiKey = getSerpApiKey();
  if (!apiKey) return NextResponse.json({ error: "Live fares need a SerpApi key on the server." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { hostTravelerId?: unknown; windows?: unknown };
  const trip = await getTripById(tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  const hostTravelerId = typeof body.hostTravelerId === "string" ? body.hostTravelerId : "";
  const cookieStore = await cookies();
  const session = readSessionValue(cookieStore.get(sessionCookieName)?.value);
  if (!trip.travelers.find((traveler) => traveler.id === hostTravelerId)?.isHost || !canActAsTraveler(trip, hostTravelerId, cookieStore.get(travelerCookieName(tripId))?.value, session)) {
    return NextResponse.json({ error: "Only the host can check fares." }, { status: 403 });
  }
  const destination = trip.destination?.trim();
  if (!destination) return NextResponse.json({ error: "Fares need a destination. Muse picks one when it plans options." }, { status: 409 });

  // The host may override availability, so any real date range can be priced.
  const windows = (Array.isArray(body.windows) ? body.windows : [])
    .filter((window): window is { startDate: string; endDate: string } => typeof window?.startDate === "string" && typeof window?.endDate === "string")
    .filter((window) => isValidISODate(window.startDate) && isValidISODate(window.endDate) && window.startDate <= window.endDate)
    .slice(0, maximumWindows);
  if (windows.length === 0) return NextResponse.json({ error: "Pick a start date and an end date." }, { status: 400 });

  const origins = [...new Set(trip.travelers.map((traveler) => getTravelerDepartureLocation(trip, traveler)).filter(Boolean))].slice(0, maximumOrigins);
  const [toId, ...fromIds] = await Promise.all([findCityFlightId(destination), ...origins.map((origin) => findCityFlightId(origin))]);
  if (!toId) return NextResponse.json({ error: `We couldn't find airports for ${destination}.` }, { status: 422 });

  const results = await Promise.all(windows.map(async (window) => ({
    ...window,
    fares: await Promise.all(origins.map(async (from, index) => {
      const fromId = fromIds[index];
      if (!fromId) return { from, lowestUsd: null };
      try {
        const options = await searchFlights({ apiKey }, { fromId, toId, outboundDate: window.startDate, returnDate: window.endDate });
        return { from, lowestUsd: options.length > 0 ? Math.min(...options.map((option) => option.price)) : null };
      } catch (error) {
        console.error("Date fare check failed:", error);
        return { from, lowestUsd: null };
      }
    })),
  })));

  const check = { checkedAt: new Date().toISOString(), destination, windows: results };
  await saveDatePriceCheck(tripId, check);
  return NextResponse.json({ datePriceCheck: check });
}
