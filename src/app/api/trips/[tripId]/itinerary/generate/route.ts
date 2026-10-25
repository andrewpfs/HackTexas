import { NextResponse } from "next/server";
import {
  isMockFallbackEnabled,
  selectItineraryPlanner,
} from "@/lib/candidate-planner-factory";
import { generateGroupItineraryForTrip } from "@/lib/itinerary-generation";
import { MockItineraryPlanner } from "@/lib/mock-itinerary-planner";
import { MusePlannerError } from "@/lib/muse-client";
import { getTripById, saveGroupItinerary } from "@/lib/trip-repository";
import type { PlannerSource } from "@/lib/trip-types";
import { logError } from "@/lib/server-log";

// Muse and the travel searches can take 20-45 seconds; don't let the host cut them off early.
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]/itinerary/generate">,
) {
  const { tripId } = await context.params;

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    requestBody = {};
  }
  const hostTravelerId =
    typeof requestBody === "object" && requestBody !== null
      ? (requestBody as Record<string, unknown>).hostTravelerId
      : undefined;

  try {
    const trip = await getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const host = trip.travelers.find((traveler) => traveler.id === hostTravelerId);
    if (!host || !host.isHost) {
      return NextResponse.json(
        { error: "Only the host can create the shared itinerary." },
        { status: 403 },
      );
    }

    const itineraryPath = `/trip/${trip.id}/itinerary`;
    if (trip.itinerary) {
      return NextResponse.json({ tripId: trip.id, itineraryPath, alreadyGenerated: true });
    }

    const selection = selectItineraryPlanner();
    let plannerSource: PlannerSource = selection.source;
    let result;

    try {
      result = await generateGroupItineraryForTrip(trip, selection.planner, selection.source);
    } catch (error) {
      if (!(error instanceof MusePlannerError)) {
        throw error;
      }

      logError("itinerary", "Muse itinerary planner failed", error, { tripId });

      if (!isMockFallbackEnabled()) {
        return NextResponse.json(
          { error: "Muse could not create the shared itinerary right now. Please try again." },
          { status: 502 },
        );
      }

      plannerSource = "mock-fallback";
      result = await generateGroupItineraryForTrip(trip, new MockItineraryPlanner(), plannerSource);
    }

    if (!result.success) {
      if (result.reason === "votes-missing") {
        return NextResponse.json(
          {
            error: `Still waiting on votes from ${result.waitingOnNames.join(", ")}.`,
            waitingOnNames: result.waitingOnNames,
          },
          { status: 409 },
        );
      }
      if (result.reason === "invalid-output") {
        logError("itinerary", "planner returned an invalid itinerary", undefined, { tripId, errors: result.errors.slice(0, 5) });
        return NextResponse.json(
          { error: "The planner could not create a valid itinerary. Please try again." },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: "The group needs current trip options and complete details first." },
        { status: 409 },
      );
    }

    const saveResult = await saveGroupItinerary(trip.id, result.itinerary);
    if (saveResult.status === "trip-not-found") {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    if (saveResult.status === "stale") {
      return NextResponse.json(
        { error: "The trip options changed while the itinerary was being built. Please vote again." },
        { status: 409 },
      );
    }
    if (saveResult.status === "already-saved") {
      return NextResponse.json({ tripId: trip.id, itineraryPath, alreadyGenerated: true });
    }

    return NextResponse.json(
      { tripId: trip.id, itineraryPath, alreadyGenerated: false, planner: plannerSource },
      { status: 201 },
    );
  } catch (error) {
    logError("itinerary", "crashed", error, { tripId });
    return NextResponse.json(
      { error: "We could not create the shared itinerary. Please try again." },
      { status: 500 },
    );
  }
}
