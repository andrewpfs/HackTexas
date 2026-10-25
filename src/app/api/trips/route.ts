import { createTravelerProof, travelerCookieName, travelerCookieOptions } from "@/lib/trip-browser-identity";
import { randomInt, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { verifyCity } from "@/lib/city-search";
import { inviteCodeExists, saveTrip } from "@/lib/trip-repository";
import type { Trip } from "@/lib/trip-types";
import { validateCreateTripInput } from "@/lib/trip-validation";

const inviteCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeInviteCode() {
  let inviteCode = "";

  for (let index = 0; index < 6; index += 1) {
    const characterIndex = randomInt(0, inviteCharacters.length);
    inviteCode += inviteCharacters[characterIndex];
  }

  return inviteCode;
}

async function createUniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = makeInviteCode();
    const alreadyExists = await inviteCodeExists(inviteCode);

    if (!alreadyExists) {
      return inviteCode;
    }
  }

  throw new Error("Could not generate a unique invite code.");
}

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide valid trip details." }, { status: 400 });
  }

  // A verified phone is the sign-in for every traveler, hosts included.
  const session = readSessionValue((await cookies()).get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: "Verify your phone number before creating a trip." }, { status: 401 });
  }

  const validationResult = validateCreateTripInput(requestBody);
  if (!validationResult.valid) {
    return NextResponse.json(
      { error: validationResult.errors[0], errors: validationResult.errors },
      { status: 400 },
    );
  }

  if ((await verifyCity(validationResult.data.origin)) === "invalid") {
    return NextResponse.json({ error: "Pick a real city for where you are traveling from." }, { status: 400 });
  }

  try {
    const tripId = randomUUID();
    const inviteCode = await createUniqueInviteCode();
    const input = validationResult.data;
    const trip: Trip = {
      id: tripId,
      inviteCode,
      hostName: input.hostName,
      name: input.name,
      prompt: input.prompt,
      origin: input.origin,
      destination: input.destination,
      earliestPossibleDate: input.earliestPossibleDate,
      latestPossibleDate: input.latestPossibleDate,
      preferredDurationDays: input.preferredDurationDays,
      expectedTravelerCount: input.expectedTravelerCount,
      status: "collecting_preferences",
      createdAt: new Date().toISOString(),
      travelers: [
        {
          id: randomUUID(),
          name: input.hostName,
          isHost: true,
          departureLocation: input.origin,
          preferencesComplete: false,
          availabilityComplete: false,
          availableDates: [],
          phoneHash: session.phoneHash,
          phoneLast4: session.last4,
          phoneVotingVerified: true,
        },
      ],
    };

    await saveTrip(trip);

    const response = NextResponse.json({ trip: { id: trip.id, inviteCode: trip.inviteCode, hostTravelerId: trip.travelers[0].id } }, { status: 201 });
    response.cookies.set(travelerCookieName(trip.id), createTravelerProof(trip.id, trip.travelers[0].id), travelerCookieOptions);
    return response;
  } catch (error) {
    console.error("Failed to create trip:", error);
    return NextResponse.json(
      { error: "We could not create your trip. Please try again." },
      { status: 500 },
    );
  }
}
