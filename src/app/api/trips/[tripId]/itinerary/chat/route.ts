import { NextResponse } from "next/server";
import { isMockFallbackEnabled, selectItineraryReviser } from "@/lib/candidate-planner-factory";
import { getChangedStopKeys } from "@/lib/itinerary-diff";
import {
  buildRevisionRequest,
  carryOverPlaces,
  makeChatMessage,
  MockItineraryReviser,
  validateChatInput,
  validateRevisedDays,
  type RevisionResult,
} from "@/lib/itinerary-revision";
import { MusePlannerError } from "@/lib/muse-client";
import { buildPlanningContext } from "@/lib/planning-context";
import { appendChatMessage, getTripById, saveItineraryRevision } from "@/lib/trip-repository";
import type { Trip } from "@/lib/trip-types";

const maximumAttempts = 2;

function respond(trip: Trip, changedStops: string[] = []) {
  return NextResponse.json({
    itinerary: trip.itinerary,
    messages: trip.chat || [],
    changedStops,
  });
}

// A traveler writes feedback; Muse reads it and either updates the shared plan or replies.
export async function POST(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]/itinerary/chat">,
) {
  const { tripId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  }

  const input = validateChatInput(body);
  if (!input.valid) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  try {
    const trip = await getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const traveler = trip.travelers.find((item) => item.id === input.data.travelerId);
    if (!traveler) {
      return NextResponse.json({ error: "Join this trip on this device to chat." }, { status: 403 });
    }
    if (!trip.itinerary) {
      return NextResponse.json({ error: "This trip has no shared itinerary yet." }, { status: 409 });
    }

    const userMessage = makeChatMessage({
      role: "traveler",
      travelerId: traveler.id,
      authorName: traveler.name,
      text: input.data.text,
      focus: input.data.focus,
    });
    const appended = await appendChatMessage(tripId, userMessage);
    if (appended.status !== "added") {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    let current = appended.trip;
    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      const itinerary = current.itinerary;
      const contextResult = buildPlanningContext(current);
      if (!itinerary || !contextResult.success) {
        return respond(current);
      }

      const revisionRequest = buildRevisionRequest(
        contextResult.context,
        itinerary,
        current.chat || [],
        userMessage,
      );

      const selection = selectItineraryReviser();
      let result: RevisionResult;
      try {
        result = await selection.reviser.revise(revisionRequest);
      } catch (error) {
        if (!(error instanceof MusePlannerError)) {
          throw error;
        }

        console.error("Muse reviser failed:", error.message);
        if (!isMockFallbackEnabled()) {
          return NextResponse.json(
            { error: "Muse couldn't answer right now. Your message was saved; try again in a moment." },
            { status: 502 },
          );
        }
        result = await new MockItineraryReviser().revise();
      }

      let days = null;
      let reply = result.reply;
      let changes = result.changes;

      if (result.days) {
        const validation = validateRevisedDays(
          itinerary,
          result.days,
          contextResult.context.groupAvailability.sharedDates,
          itinerary.basedOnCandidateId,
        );

        if (validation.valid) {
          days = carryOverPlaces(itinerary.days, result.days);
        } else {
          console.error("Muse revision was invalid:", validation.errors);
          reply = "I tried to change the plan, but my edit didn't fit the trip dates, so nothing changed. Could you say it another way?";
          changes = [];
        }
      }

      const museMessage = makeChatMessage({
        role: "muse",
        authorName: "Muse",
        text: reply,
        changes: days ? changes : undefined,
      });

      if (!days) {
        const added = await appendChatMessage(tripId, museMessage);
        return added.status === "added" ? respond(added.trip) : respond(current);
      }

      const saved = await saveItineraryRevision(
        tripId,
        itinerary.id,
        itinerary.revision ?? 0,
        days,
        museMessage,
      );

      if (saved.status === "saved") {
        return respond(saved.trip, getChangedStopKeys(itinerary.days, days));
      }
      if (saved.status !== "conflict") {
        return NextResponse.json({ error: "We couldn't update the plan." }, { status: 409 });
      }

      // Someone else changed the plan while Muse was thinking; try again on the newest version.
      const refreshed = await getTripById(tripId);
      if (!refreshed) {
        return NextResponse.json({ error: "Trip not found." }, { status: 404 });
      }
      current = refreshed;
    }

    const added = await appendChatMessage(
      tripId,
      makeChatMessage({
        role: "muse",
        authorName: "Muse",
        text: "The plan was just changed by someone else, so I held off. Send your message again to apply it to the newest version.",
      }),
    );
    return added.status === "added" ? respond(added.trip) : respond(current);
  } catch (error) {
    console.error("Failed to handle itinerary chat:", error);
    return NextResponse.json({ error: "We couldn't send that message. Please try again." }, { status: 500 });
  }
}
