import { NextResponse } from "next/server";
import { addPlacesToItinerary, getSerpApiKey } from "@/lib/serpapi-places";
import { claimPlacesLookup, finishPlacesLookup } from "@/lib/trip-repository";

// Muse and live travel searches can take a minute or more (with retries). Without this,
// Vercel stops the function early and the request fails part of the time.
export const maxDuration = 300;

// Looks up real places (Google Maps via SerpApi) for the shared itinerary.
// Runs at most once per itinerary; results are saved so credits are not reused.
export async function POST(
  _request: Request,
  context: RouteContext<"/api/trips/[tripId]/itinerary/places">,
) {
  const { tripId } = await context.params;
  const apiKey = getSerpApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: "Real place lookups are not configured.", configured: false },
      { status: 503 },
    );
  }

  try {
    const claim = await claimPlacesLookup(tripId);
    if (claim.status === "no-itinerary") {
      return NextResponse.json({ error: "This trip has no shared itinerary yet." }, { status: 404 });
    }
    if (claim.status !== "claimed") {
      return NextResponse.json({ status: claim.status });
    }

    let lookup;
    try {
      lookup = await addPlacesToItinerary(claim.itinerary, {
        apiKey,
        includeReviews: process.env.SERPAPI_INCLUDE_REVIEWS !== "false",
      });
    } catch (error) {
      await finishPlacesLookup(tripId, claim.itinerary.id, null, claim.itinerary.revision ?? 0);
      throw error;
    }

    // Nothing worked (bad key, quota, outage): release the claim so it can be retried.
    if (lookup.foundCount === 0 && lookup.failedCount > 0) {
      await finishPlacesLookup(tripId, claim.itinerary.id, null, claim.itinerary.revision ?? 0);
      return NextResponse.json(
        { error: "We couldn't reach the places service. Please try again." },
        { status: 502 },
      );
    }

    await finishPlacesLookup(tripId, claim.itinerary.id, lookup.days, claim.itinerary.revision ?? 0);
    return NextResponse.json({
      status: "added",
      foundCount: lookup.foundCount,
      failedCount: lookup.failedCount,
    });
  } catch (error) {
    console.error("Failed to look up itinerary places:", error);
    return NextResponse.json(
      { error: "We couldn't look up real places right now. Please try again." },
      { status: 500 },
    );
  }
}
