import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { summarizeTripsForPhone } from "@/lib/my-trips";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { findTripsByPhone } from "@/lib/trip-repository";

// The signed-in phone's trips, used to restore your identity on a new device.
export async function GET() {
  const session = readSessionValue((await cookies()).get(sessionCookieName)?.value);
  if (!session) {
    return NextResponse.json({ signedIn: false, trips: [] });
  }

  const trips = summarizeTripsForPhone(await findTripsByPhone(session.phoneHash), session.phoneHash);
  return NextResponse.json({ signedIn: true, last4: session.last4, trips }, { headers: { "Cache-Control": "no-store" } });
}
