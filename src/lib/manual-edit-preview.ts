import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ManualStopEdit } from "./manual-itinerary";

// A short-lived signed preview preserves the exact place match shown to the user.
// Saving never needs a second provider lookup. Without SESSION_SECRET, previews
// expire when this server process restarts.
const previewSecret = process.env.SESSION_SECRET?.trim() || randomBytes(32);
export function signManualPreview(tripId: string, edit: ManualStopEdit) {
  const payload = Buffer.from(JSON.stringify({ tripId, edit, expiresAt: Date.now() + 15 * 60000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", previewSecret).update(payload).digest("base64url")}`;
}
export function readManualPreview(tripId: string, token: string): ManualStopEdit {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Preview this stop before saving.");
  const expected = createHmac("sha256", previewSecret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Preview expired. Go back and review the stop again.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (data.tripId !== tripId || data.expiresAt < Date.now()) throw new Error("Preview expired. Go back and review the stop again.");
  return data.edit;
}
