import { NextResponse } from "next/server";
import { addImagesToCandidateDays } from "@/lib/place-images";
import { addSerpPhotosToCandidates, getSerpApiKey } from "@/lib/serpapi-places";
import { claimOptionPhotos, finishOptionPhotos } from "@/lib/trip-repository";

// Finds a photo for each stop in the trip options. Wikipedia first (free), then
// Google Maps through SerpApi for stops it could not find. Runs once per set of options.
export async function POST(
  _request: Request,
  context: RouteContext<"/api/trips/[tripId]/candidates/photos">,
) {
  const { tripId } = await context.params;

  try {
    const claim = await claimOptionPhotos(tripId);
    if (claim.status === "no-candidates") {
      return NextResponse.json({ error: "This trip has no options yet." }, { status: 404 });
    }
    if (claim.status !== "claimed") {
      return NextResponse.json({ status: claim.status });
    }

    try {
      let candidates = await addImagesToCandidateDays(claim.candidates);

      const serpKey = getSerpApiKey();
      if (serpKey) {
        candidates = (await addSerpPhotosToCandidates(candidates, { apiKey: serpKey })).candidates;
      }

      await finishOptionPhotos(tripId, candidates);
    } catch (error) {
      await finishOptionPhotos(tripId, null);
      throw error;
    }

    return NextResponse.json({ status: "added" });
  } catch (error) {
    console.error("Failed to add option photos:", error);
    return NextResponse.json({ error: "We couldn't load photos right now." }, { status: 500 });
  }
}
