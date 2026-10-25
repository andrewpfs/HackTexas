import { NextResponse } from "next/server";
import { getSerpApiKey, searchPlaces } from "@/lib/serpapi-places";

export async function GET(request: Request, context: RouteContext<"/api/trips/[tripId]/itinerary/place-search">) {
  await context.params;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 160) return NextResponse.json({ places: [] });
  const apiKey = getSerpApiKey();
  if (!apiKey) return NextResponse.json({ places: [], available: false });
  try {
    const places = await searchPlaces({ apiKey, includeReviews: false }, query);
    return NextResponse.json({ places, available: true });
  } catch {
    return NextResponse.json({ places: [], available: false });
  }
}
