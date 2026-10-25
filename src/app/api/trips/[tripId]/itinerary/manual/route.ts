import { NextResponse } from "next/server";
import { editSharedStop, getTripById } from "@/lib/trip-repository";
import { prepareManualEdit, type ManualStopEdit } from "@/lib/manual-itinerary";
import { readManualPreview, signManualPreview } from "@/lib/manual-edit-preview";
import { getSerpApiKey } from "@/lib/serpapi-places";
import { readSelectedPlace } from "@/lib/selected-place";
import { lookupDestinationArea } from "@/lib/city-search";
import { personalLocationError } from "@/lib/personal-location";

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
    const selectedPlace = readSelectedPlace(body.place);
    if (selectedPlace && edit.activity.location !== selectedPlace.name) return NextResponse.json({ error: "Choose the place again." }, { status: 400 });
    if (selectedPlace) edit.activity.place = selectedPlace;
    const prepared = prepareManualEdit(trip, edit);
    // Group stops follow the same rule as personal plans: the place has to fit the
    // trip (same country, within about 2 hours of that day's other stops).
    if (selectedPlace) {
      const area = await lookupDestinationArea(trip.itinerary.destination);
      const locationError = personalLocationError(trip.itinerary, edit.dayNumber, prepared.old.time, prepared.old.title, selectedPlace, area);
      if (locationError) return NextResponse.json({ error: locationError }, { status: 400 });
    }
    let placeNote = "No place selected; travel time cannot be estimated for this stop.";
    if (selectedPlace) placeNote = "Selected real place.";
    if (!selectedPlace && getSerpApiKey() && body.placeSearchUnavailable !== true && text(body.location)) return NextResponse.json({ error: "Choose a real place from the suggestions." }, { status: 400 });
    if (!selectedPlace) placeNote = "Place search is unavailable or no location was entered. Travel time cannot be estimated.";
    const preview = prepareManualEdit(trip, edit);
    return NextResponse.json({ token: signManualPreview(tripId, edit), activity: edit.activity, warnings: preview.warnings, placeNote });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't edit this stop." }, { status: 400 });
  }
}
