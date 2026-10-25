import { NextResponse } from "next/server";
import { summarizeTripsForPhone } from "@/lib/my-trips";
import { checkCode, createSessionValue, hashPhone, lastFour, normalizePhone, sessionCookieName, sessionMaxAgeSeconds } from "@/lib/phone-auth";
import { findTripsByPhone, linkTravelerPhone } from "@/lib/trip-repository";

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
    const linked = await linkTravelerPhone(link.tripId, link.travelerId, phoneHash, lastFour(phone));
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
