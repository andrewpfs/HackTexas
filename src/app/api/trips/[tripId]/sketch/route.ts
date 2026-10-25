import { NextResponse } from "next/server";
import { isMockFallbackEnabled, selectSketchPlanner } from "@/lib/candidate-planner-factory";
import { MusePlannerError } from "@/lib/muse-client";
import { getSketchRequest, MockSketchPlanner } from "@/lib/trip-sketch";
import { claimTripSketch, finishTripSketch } from "@/lib/trip-repository";

// Muse and live travel searches can take a minute or more (with retries). Without this,
// Vercel stops the function early and the request fails part of the time.
export const maxDuration = 300;

// Draws the first rough plan from the host's description, and redraws it for the
// whole group once everyone has shared preferences and dates. The current draft
// stays on screen until the new one is ready.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/sketch">) {
  const { tripId } = await context.params;

  let force = false;
  try {
    force = ((await request.json()) as { retry?: unknown }).retry === true;
  } catch {
    // An empty body means "draw it if it's missing or out of date".
  }

  const claim = await claimTripSketch(tripId, force);
  if (claim.status === "not-found") {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }
  if (claim.status !== "claimed") {
    return NextResponse.json({ status: "skip" });
  }

  const sketchRequest = getSketchRequest(claim.trip);
  if (sketchRequest.days === 0) {
    await finishTripSketch(tripId, claim.basis, { ok: true, source: "mock", draft: { summary: "No shared dates are available yet. Change availability or have the host pick dates before drawing a trip sketch.", places: [], days: [], suggestions: [] } });
    return NextResponse.json({ status: "done" });
  }
  const selection = selectSketchPlanner();
  try {
    let draft;
    let source: "muse" | "mock" | "mock-fallback" = selection.source;
    try {
      draft = await selection.planner.sketch(sketchRequest);
    } catch (error) {
      if (!(error instanceof MusePlannerError) || !isMockFallbackEnabled()) throw error;
      draft = await new MockSketchPlanner().sketch(sketchRequest);
      source = "mock-fallback";
    }

    await finishTripSketch(tripId, claim.basis, { ok: true, draft, source });
    return NextResponse.json({ status: "done" });
  } catch (error) {
    console.error("Trip sketch failed:", error);
    await finishTripSketch(tripId, claim.basis, { ok: false, error: "Muse couldn't sketch the trip right now." });
    return NextResponse.json({ error: "Muse couldn't sketch the trip right now." }, { status: 502 });
  }
}
