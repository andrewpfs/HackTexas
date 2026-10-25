import { NextResponse } from "next/server";
import { getTripById, updateTravelerPreferences } from "@/lib/trip-repository";
import { validateTravelerPreferences } from "@/lib/trip-validation";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/preferences">,
) {
  const { tripId, travelerId } = await context.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return NextResponse.json({ error: "We couldn't find that trip." }, { status: 404 });
  }

  const traveler = trip.travelers.find((item) => item.id === travelerId);
  if (!traveler) {
    return NextResponse.json({ error: "We couldn't find that traveler on this trip." }, { status: 404 });
  }

  return NextResponse.json({
    traveler: {
      id: traveler.id,
      name: traveler.name,
      isHost: traveler.isHost,
      preferencesComplete: traveler.preferencesComplete,
      departureLocation: traveler.departureLocation || (traveler.isHost ? trip.origin : ""),
      preferences: traveler.preferences,
    },
  });
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/preferences">,
) {
  const { tripId, travelerId } = await context.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return NextResponse.json({ error: "We couldn't find that trip." }, { status: 404 });
  }

  const travelerExists = trip.travelers.some((traveler) => traveler.id === travelerId);
  if (!travelerExists) {
    return NextResponse.json({ error: "We couldn't find that traveler on this trip." }, { status: 404 });
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide valid preference details." }, { status: 400 });
  }

  const validationResult = validateTravelerPreferences(requestBody);
  if (!validationResult.valid) {
    return NextResponse.json(
      { error: validationResult.errors[0], errors: validationResult.errors },
      { status: 400 },
    );
  }

  const values = requestBody as Record<string, unknown>;
  if (typeof values.departureLocation !== "string" || values.departureLocation.trim() === "") {
    return NextResponse.json(
      { error: "Departure city is required.", errors: ["Where you are traveling from is required."] },
      { status: 400 },
    );
  }

  try {
    const result = await updateTravelerPreferences(
      tripId,
      travelerId,
      validationResult.data,
      values.departureLocation.trim(),
    );
    if (result.status !== "updated") {
      return NextResponse.json({ error: "We couldn't find that traveler on this trip." }, { status: 404 });
    }

    return NextResponse.json({
      traveler: {
        id: result.traveler.id,
        name: result.traveler.name,
        isHost: result.traveler.isHost,
        preferencesComplete: result.traveler.preferencesComplete,
        departureLocation: result.traveler.departureLocation,
        preferences: result.traveler.preferences,
      },
    });
  } catch (error) {
    console.error("Failed to save traveler preferences:", error);
    return NextResponse.json(
      { error: "We could not save your preferences. Please try again." },
      { status: 500 },
    );
  }
}
