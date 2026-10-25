import { NextResponse } from "next/server";
import { editSharedStop, getTripById } from "@/lib/trip-repository";
import { prepareManualEdit, type ManualStopEdit } from "@/lib/manual-itinerary";
import { readManualPreview, signManualPreview } from "@/lib/manual-edit-preview";
import { getSerpApiKey, lookupPlace } from "@/lib/serpapi-places";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/itinerary/manual">) {
  const { tripId } = await context.params;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Enter a stop to edit." }, { status: 400 });
    }
    if (body.mode === "save") {
      const edit = readManualPreview(tripId, text(body.token));
      const result = await editSharedStop(tripId, edit, body.allowLongTravel === true);
      if (!result) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
      if (!result.saved) return NextResponse.json({ error: "Review the long travel warning before saving.", warnings: result.warnings }, { status: 409 });
      return NextResponse.json({ itinerary: result.trip.itinerary, messages: result.trip.chat ?? [] });
    }
    const trip = await getTripById(tripId);
    if (!trip?.itinerary) return NextResponse.json({ error: "No shared itinerary yet." }, { status: 404 });
    const edit: ManualStopEdit = {
      travelerId: text(body.travelerId),
      itineraryId: text(body.itineraryId),
      expectedRevision: body.expectedRevision,
      dayNumber: body.dayNumber,
      stopIndex: body.stopIndex,
      action: body.action,
      activity: {
        title: text(body.title),
        time: text(body.time),
        location: text(body.location),
        description: text(body.description),
        type: "Sightseeing",
        placeSearchQuery: "",
      },
    };
    prepareManualEdit(trip, edit);
    let placeNote = "No place selected; travel time cannot be estimated for this stop.";
    const apiKey = getSerpApiKey();
    if (body.matchPlace === true && apiKey) {
      try {
        const place = await lookupPlace({ apiKey, includeReviews: false }, `${edit.activity.title} ${edit.activity.location || trip.itinerary.destination}`);
        if (place) {
          edit.activity.place = place;
          placeNote = "Check this place match before saving.";
        }
      } catch {
        placeNote = "Place search is unavailable. You can still save this freeform stop.";
      }
    }
    const preview = prepareManualEdit(trip, edit);
    return NextResponse.json({ token: signManualPreview(tripId, edit), activity: edit.activity, warnings: preview.warnings, placeNote });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't edit this stop." }, { status: 400 });
  }
}
