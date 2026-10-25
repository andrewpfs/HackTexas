import { getTripById } from "@/lib/trip-repository";
import { lookupDestinationArea } from "@/lib/city-search";
import { signPersonalPlace } from "@/lib/personal-place-selection";
import { NextResponse } from "next/server";
import { getSerpApiKey, searchPlaces } from "@/lib/serpapi-places";

export async function GET(request: Request, context: RouteContext<"/api/trips/[tripId]/itinerary/place-search">) {
  const { tripId } = await context.params;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 160) return NextResponse.json({ places: [] });
  const apiKey = getSerpApiKey();
  if (!apiKey) return NextResponse.json({ places: [], available: false });
  try {
    const places = await searchPlaces({ apiKey, includeReviews: false }, query);
    if (new URL(request.url).searchParams.get("personal") === "1") {
      const trip = await getTripById(tripId);
      if (!trip?.itinerary) return NextResponse.json({ places: [], available: false });
      const destination = trip.itinerary.destination;
      const area = await lookupDestinationArea(destination);
      for (const place of places) place.selectionToken = signPersonalPlace(tripId, destination, place, area);
    }
    return NextResponse.json({ places, available: true });
  } catch {
    return NextResponse.json({ places: [], available: false });
  }
}
