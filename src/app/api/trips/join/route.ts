import { NextResponse } from "next/server";
import { addTravelerToTrip, getTripByInviteCode } from "@/lib/trip-repository";
import type { JoinTripPreview, Trip } from "@/lib/trip-types";
import { normalizeInviteCode, validateJoinTripInput } from "@/lib/trip-validation";

function makeTripPreview(trip: Trip): JoinTripPreview {
  return {
    inviteCode: trip.inviteCode,
    displayName: trip.destination ? `${trip.destination} Trip` : "Group Trip",
    hostName: trip.hostName,
    prompt: trip.prompt,
    origin: trip.origin,
    destination: trip.destination,
    earliestPossibleDate: trip.earliestPossibleDate,
    latestPossibleDate: trip.latestPossibleDate,
    preferredDurationDays: trip.preferredDurationDays,
    travelerCount: trip.travelers.length,
    expectedTravelerCount: trip.expectedTravelerCount,
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const inviteCode = normalizeInviteCode(requestUrl.searchParams.get("inviteCode") || "");

  if (inviteCode === "") {
    return NextResponse.json({ error: "Invite code is required." }, { status: 400 });
  }

  const trip = await getTripByInviteCode(inviteCode);
  if (!trip) {
    return NextResponse.json(
      { error: "We couldn't find a trip with that invite code." },
      { status: 404 },
    );
  }

  return NextResponse.json({ trip: makeTripPreview(trip) });
}

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please provide an invite code and your name." },
      { status: 400 },
    );
  }

  const validationResult = validateJoinTripInput(requestBody);
  if (!validationResult.valid) {
    return NextResponse.json({ error: validationResult.error }, { status: 400 });
  }

  try {
    const result = await addTravelerToTrip(
      validationResult.data.inviteCode,
      validationResult.data.travelerName,
    );

    if (result.status === "not-found") {
      return NextResponse.json(
        { error: "We couldn't find a trip with that invite code." },
        { status: 404 },
      );
    }

    if (result.status === "duplicate") {
      return NextResponse.json(
        { error: "A traveler with this name has already joined this trip." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { tripId: result.tripId, travelerId: result.travelerId },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to join trip:", error);
    return NextResponse.json(
      { error: "We could not join the trip. Please try again." },
      { status: 500 },
    );
  }
}
