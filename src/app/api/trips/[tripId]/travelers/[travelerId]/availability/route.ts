import { NextResponse } from "next/server";
import { getTripById, updateTravelerAvailability } from "@/lib/trip-repository";
import { validateTravelerAvailability } from "@/lib/trip-validation";

function makeAvailabilityResponse(
  trip: NonNullable<Awaited<ReturnType<typeof getTripById>>>,
  traveler: NonNullable<Awaited<ReturnType<typeof getTripById>>>["travelers"][number],
) {
  return {
    tripWindow: {
      earliestPossibleDate: trip.earliestPossibleDate,
      latestPossibleDate: trip.latestPossibleDate,
      preferredDurationDays: trip.preferredDurationDays,
    },
    traveler: {
      id: traveler.id,
      name: traveler.name,
      availabilityComplete: traveler.availabilityComplete === true,
      availableDates: traveler.availableDates || [],
      preferredDurationDays: traveler.preferences?.preferredDurationDays,
    },
  };
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/availability">,
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

  return NextResponse.json(makeAvailabilityResponse(trip, traveler));
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/availability">,
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

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide valid availability details." }, { status: 400 });
  }

  const validationResult = validateTravelerAvailability(
    requestBody,
    trip.earliestPossibleDate,
    trip.latestPossibleDate,
  );

  if (!validationResult.valid) {
    return NextResponse.json(
      { error: validationResult.errors[0], errors: validationResult.errors },
      { status: 400 },
    );
  }

  try {
    const result = await updateTravelerAvailability(
      tripId,
      travelerId,
      validationResult.data.availableDates,
    );

    if (result.status !== "updated") {
      return NextResponse.json({ error: "We couldn't find that traveler on this trip." }, { status: 404 });
    }

    return NextResponse.json(makeAvailabilityResponse(trip, result.traveler));
  } catch (error) {
    console.error("Failed to save traveler availability:", error);
    return NextResponse.json(
      { error: "We could not save your availability. Please try again." },
      { status: 500 },
    );
  }
}
