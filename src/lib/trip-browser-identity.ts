import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Trip } from "./trip-types";
import type { Session } from "./phone-auth";

export function travelerCookieName(tripId: string) {
  return `tp_traveler_${tripId}`;
}

export function createTravelerProof(tripId: string, travelerId: string) {
  const payload = Buffer.from(JSON.stringify({ tripId, travelerId, expiresAt: Date.now() + 30 * 86400000 })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET?.trim() || "hacktx-dev-session-secret-change-me").update(`traveler:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function canActAsTraveler(trip: Trip, travelerId: string, proof: string | undefined, session: Session | null) {
  const traveler = trip.travelers.find((item) => item.id === travelerId);
  if (!traveler) return false;
  if (session && traveler.phoneHash === session.phoneHash && traveler.phoneVotingVerified !== false) return true;
  if (!proof) return false;
  const [payload, signature] = proof.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", process.env.SESSION_SECRET?.trim() || "hacktx-dev-session-secret-change-me").update(`traveler:${payload}`).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const identity = JSON.parse(Buffer.from(payload, "base64url").toString());
    return identity.tripId === trip.id && identity.travelerId === travelerId && identity.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export const travelerCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 };
