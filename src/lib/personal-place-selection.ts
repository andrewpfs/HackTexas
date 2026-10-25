import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PlaceSuggestion } from "./trip-types";
import type { DestinationArea } from "./personal-location";

const secret = process.env.SESSION_SECRET?.trim() || randomBytes(32);
type Selection = { tripId: string; destination: string; place: PlaceSuggestion; area?: DestinationArea; expiresAt: number };

export function signPersonalPlace(tripId: string, destination: string, place: PlaceSuggestion, area?: DestinationArea) {
  const payload = Buffer.from(JSON.stringify({ tripId, destination, place, area, expiresAt: Date.now() + 30 * 60000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function readPersonalPlace(tripId: string, destination: string, token: unknown): Selection | null {
  if (typeof token !== "string") return null;
  try {
    const [payload, signature] = token.split(".");
    const expected = createHmac("sha256", secret).update(payload).digest("base64url");
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const selection = JSON.parse(Buffer.from(payload, "base64url").toString()) as Selection;
    if (selection.tripId !== tripId || selection.destination !== destination || selection.expiresAt < Date.now()) return null;
    return selection;
  } catch { return null; }
}
