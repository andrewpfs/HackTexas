import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { summarizeTripsForPhone } from "@/lib/my-trips";
import { checkCode, createSessionValue, encryptPhone, hashPhone, lastFour, normalizePhone, sessionCookieName, sessionMaxAgeSeconds } from "@/lib/phone-auth";
import { findTripsByPhone, getTripById, linkTravelerPhone } from "@/lib/trip-repository";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";

// Checks the code, signs the phone in, and optionally saves the current trip to it.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  const code = typeof body.code === "string" ? body.code : "";
  if (!phone) {
    return NextResponse.json({ error: "Enter a full phone number." }, { status: 400 });
  }
  if (!(await checkCode(phone, code))) {
    return NextResponse.json({ error: "That code didn't match or has expired. Try again or send a new one." }, { status: 401 });
  }

  const phoneHash = hashPhone(phone);
  const link = body.link as { tripId?: unknown; travelerId?: unknown } | undefined;
  if (link && typeof link.tripId === "string" && typeof link.travelerId === "string") {
    const trip = await getTripById(link.tripId);
    const proof = (await cookies()).get(travelerCookieName(link.tripId))?.value;
    // Preserve the existing phone save/restore flow for old unsigned travelers,
    // while phone verification alone cannot grant a new voting identity.
    const verifiedPhone = { phoneHash, last4: lastFour(phone), expiresAt: Date.now() + 1000 };
    const votingProof = trip ? canActAsTraveler(trip, link.travelerId, proof, verifiedPhone) : false;
    const linked = await linkTravelerPhone(link.tripId, link.travelerId, phoneHash, lastFour(phone), votingProof, encryptPhone(phone));
    if (linked.status === "taken") {
      return NextResponse.json({ error: "This traveler is already saved to a different phone." }, { status: 409 });
    }
  }

  const trips = summarizeTripsForPhone(await findTripsByPhone(phoneHash), phoneHash);
  const response = NextResponse.json({ signedIn: true, last4: lastFour(phone), trips });
  response.cookies.set(sessionCookieName, createSessionValue(phone), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
  return response;
}
