import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";
import { deleteTrip, getTripById, updateTripDetails } from "@/lib/trip-repository";
import { validateUpdateTripInput } from "@/lib/trip-validation";

export async function PUT(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]">,
) {
  const { tripId } = await context.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return NextResponse.json({ error: "We couldn't find that trip." }, { status: 404 });
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide valid trip details." }, { status: 400 });
  }

  if (typeof requestBody !== "object" || requestBody === null || Array.isArray(requestBody)) {
    return NextResponse.json({ error: "Please provide valid trip details." }, { status: 400 });
  }

  const values = requestBody as Record<string, unknown>;
  if (typeof values.hostTravelerId !== "string" || values.hostTravelerId.trim() === "") {
    return NextResponse.json({ error: "Only the host can edit trip details." }, { status: 403 });
  }

  const validation = validateUpdateTripInput(requestBody);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors[0], errors: validation.errors },
      { status: 400 },
    );
  }

  try {
    const result = await updateTripDetails(
      tripId,
      values.hostTravelerId,
      validation.data,
    );

    if (result.status === "not-host") {
      return NextResponse.json({ error: "Only the host can edit trip details." }, { status: 403 });
    }
    if (result.status === "trip-not-found") {
      return NextResponse.json({ error: "We couldn't find that trip." }, { status: 404 });
    }

    // Never send phone or assistant-token hashes to the browser.
    const publicTrip = {
      ...result.trip,
      travelers: result.trip.travelers.map((traveler) => ({ ...traveler, phoneHash: undefined, phoneEncrypted: undefined, assistantTokenHash: undefined })),
    };
    return NextResponse.json({
      trip: publicTrip,
      affectedTravelerCount: result.affectedTravelerCount,
    });
  } catch (error) {
    console.error("Failed to update trip details:", error);
    return NextResponse.json(
      { error: "We could not update the trip. Please try again." },
      { status: 500 },
    );
  }
}

// Deletes the trip for everyone. Only the host, proven by this browser's
// traveler cookie or their signed-in phone, can do it.
export async function DELETE(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]">,
) {
  const { tripId } = await context.params;
  const trip = await getTripById(tripId);
  if (!trip) {
    return NextResponse.json({ error: "We couldn't find that trip." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { hostTravelerId?: unknown };
  const hostTravelerId = typeof body.hostTravelerId === "string" ? body.hostTravelerId : "";
  const host = trip.travelers.find((traveler) => traveler.id === hostTravelerId);
  const cookieStore = await cookies();
  const session = readSessionValue(cookieStore.get(sessionCookieName)?.value);
  const proof = cookieStore.get(travelerCookieName(tripId))?.value;
  if (!host?.isHost || !canActAsTraveler(trip, host.id, proof, session)) {
    return NextResponse.json({ error: "Only the host can delete this trip." }, { status: 403 });
  }

  try {
    await deleteTrip(tripId);
  } catch (error) {
    console.error("Failed to delete trip:", error);
    return NextResponse.json({ error: "We could not delete the trip. Please try again." }, { status: 500 });
  }

  const response = NextResponse.json({ deleted: true });
  response.cookies.delete(travelerCookieName(tripId));
  return response;
}
