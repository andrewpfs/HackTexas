import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
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

  const validationResult = validateCreateTripInput(requestBody);
  if (!validationResult.valid) {
    return NextResponse.json(
      { error: validationResult.errors[0], errors: validationResult.errors },
      { status: 400 },
    );
  }

  try {
    const tripId = randomUUID();
    const inviteCode = await createUniqueInviteCode();
    const input = validationResult.data;
    const trip: Trip = {
      id: tripId,
      inviteCode,
      hostName: input.hostName,
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
          preferencesComplete: false,
        },
      ],
    };

    await saveTrip(trip);

    return NextResponse.json(
      { trip: { id: trip.id, inviteCode: trip.inviteCode } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create trip:", error);
    return NextResponse.json(
      { error: "We could not create your trip. Please try again." },
      { status: 500 },
    );
  }
}
