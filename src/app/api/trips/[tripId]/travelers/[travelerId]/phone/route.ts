import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { unlinkTravelerPhone } from "@/lib/trip-repository";

// Removes a trip from the signed-in phone's "My Trips" list. The traveler stays in the trip.
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/phone">,
) {
  const session = readSessionValue((await cookies()).get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: "Sign in with your phone first." }, { status: 401 });
  }

  const { tripId, travelerId } = await context.params;
  const result = await unlinkTravelerPhone(tripId, travelerId, session.phoneHash);
  if (result.status !== "unlinked") {
    return NextResponse.json({ error: "This trip isn't saved to your phone." }, { status: 404 });
  }
  return NextResponse.json({ removed: true });
}
