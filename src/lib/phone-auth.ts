import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const sessionCookie = "tp_session";
const sessionDays = 30;
const codeMinutes = 10;
const maxSendsPerWindow = 5;
const sendWindowMs = 15 * 60 * 1000;
const maxCheckAttempts = 6;

function secret() {
  const value = process.env.SESSION_SECRET?.trim();
  if (value) return value;
  // Development only: real deployments must set SESSION_SECRET.
  return "hacktx-dev-session-secret-change-me";
}

export function isSmsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
}

// Accepts US numbers like (512) 555-0134 and international numbers with a +country code.
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// Phone numbers are stored only as a keyed hash plus the last four digits.
export function hashPhone(phone: string) {
  return createHmac("sha256", secret()).update(`phone:${phone}`).digest("hex");
}

export function lastFour(phone: string) {
  return phone.slice(-4);
}

// For group texts the real number is kept too, but only encrypted (AES-256-GCM)
// with a key derived from SESSION_SECRET. Trip data can reach the browser, so it
// must never hold a readable number.
function phoneKey() {
  return createHash("sha256").update(`phone-encryption:${secret()}`).digest();
}

export function encryptPhone(phone: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", phoneKey(), iv);
  const encrypted = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptPhone(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", phoneKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---------- codes ----------

type DemoCode = { codeHash: string; expiresAt: number; attempts: number };
const demoCodes = new Map<string, DemoCode>();
const sendLog = new Map<string, number[]>();

function hashCode(phone: string, code: string) {
  return createHmac("sha256", secret()).update(`code:${phone}:${code}`).digest("hex");
}

function twilioAuth() {
  return `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;
}

export type SendResult = { status: "sent"; demoCode?: string } | { status: "rate-limited" | "failed"; error: string };

export async function sendCode(phone: string): Promise<SendResult> {
  const now = Date.now();
  const recent = (sendLog.get(phone) ?? []).filter((time) => now - time < sendWindowMs);
  if (recent.length >= maxSendsPerWindow) {
    return { status: "rate-limited", error: "Too many codes. Wait a few minutes and try again." };
  }
  sendLog.set(phone, [...recent, now]);

  if (isSmsConfigured()) {
    const response = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
      method: "POST",
      headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, Channel: "sms" }),
    });
    if (!response.ok) {
      console.error("Twilio send failed:", response.status, await response.text().catch(() => ""));
      return { status: "failed", error: "We couldn't text that number. Check it and try again." };
    }
    return { status: "sent" };
  }

  // Demo mode: no SMS provider is configured, so the code is shown on screen.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  demoCodes.set(phone, { codeHash: hashCode(phone, code), expiresAt: now + codeMinutes * 60 * 1000, attempts: 0 });
  return { status: "sent", demoCode: code };
}

export async function checkCode(phone: string, code: string): Promise<boolean> {
  const cleaned = code.replace(/\D/g, "");
  if (cleaned.length < 4 || cleaned.length > 10) return false;

  if (isSmsConfigured()) {
    const response = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, {
      method: "POST",
      headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, Code: cleaned }),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === "approved";
  }

  const entry = demoCodes.get(phone);
  if (!entry || entry.expiresAt < Date.now() || entry.attempts >= maxCheckAttempts) return false;
  entry.attempts += 1;
  const expected = Buffer.from(entry.codeHash);
  const actual = Buffer.from(hashCode(phone, cleaned));
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (ok) demoCodes.delete(phone);
  return ok;
}

// ---------- sessions ----------

export type Session = { phoneHash: string; last4: string; expiresAt: number; phoneEncrypted?: string };

function sign(payload: string) {
  return createHmac("sha256", secret()).update(`session:${payload}`).digest("base64url");
}

export function createSessionValue(phone: string) {
  const session: Session = { phoneHash: hashPhone(phone), last4: lastFour(phone), expiresAt: Date.now() + sessionDays * 86400000, phoneEncrypted: encryptPhone(phone) };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionValue(value: string | undefined): Session | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export const sessionCookieName = sessionCookie;
export const sessionMaxAgeSeconds = sessionDays * 86400;
