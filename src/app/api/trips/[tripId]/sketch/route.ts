import { NextResponse } from "next/server";
import { isMockFallbackEnabled, selectSketchPlanner } from "@/lib/candidate-planner-factory";
import { MusePlannerError } from "@/lib/muse-client";
import { getSketchRequest, MockSketchPlanner } from "@/lib/trip-sketch";
import { claimTripSketch, finishTripSketch } from "@/lib/trip-repository";

// Draws the first rough plan from the host's trip description.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/sketch">) {
  const { tripId } = await context.params;

  let force = false;
  try {
    force = ((await request.json()) as { retry?: unknown }).retry === true;
  } catch {
    // An empty body means "draw it if it isn't there yet".
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
    await finishTripSketch(tripId, { status: "done", summary: "No shared dates are available yet. Change availability before drawing a trip sketch.", places: [], days: [], suggestions: [], source: "mock", generatedAt: new Date().toISOString() });
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

    await finishTripSketch(tripId, { status: "done", ...draft, source, generatedAt: new Date().toISOString() });
    return NextResponse.json({ status: "done" });
  } catch (error) {
    console.error("Trip sketch failed:", error);
    await finishTripSketch(tripId, { status: "failed", summary: "", places: [], days: [], suggestions: [], error: "Muse couldn't sketch the trip right now." });
    return NextResponse.json({ error: "Muse couldn't sketch the trip right now." }, { status: 502 });
  }
}
