import { cookies } from "next/headers";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { bookingConfirmationText } from "@/lib/travel-display";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";
import { getTripById } from "@/lib/trip-repository";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Emails a traveler their own booking confirmation. The content is built on the
// server from the saved booking, so this can't be used to send arbitrary text.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/confirmation-email">) {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD;
  if (!smtpHost || !smtpUser || !smtpPassword) {
    return NextResponse.json({ error: "Email sending isn't set up yet." }, { status: 503 });
  }

  let body: { travelerId?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid request." }, { status: 400 });
  }
  const travelerId = typeof body.travelerId === "string" ? body.travelerId : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!emailPattern.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { tripId } = await context.params;
  const trip = await getTripById(tripId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const cookieStore = await cookies();
  const session = readSessionValue(cookieStore.get(sessionCookieName)?.value);
  if (!canActAsTraveler(trip, travelerId, cookieStore.get(travelerCookieName(tripId))?.value, session)) {
    return NextResponse.json({ error: "Open this trip from your invite link to email your confirmation." }, { status: 403 });
  }

  const booking = trip.travel?.bookings?.[travelerId];
  if (!booking) {
    return NextResponse.json({ error: "No booking found to confirm." }, { status: 404 });
  }

  const tripName = trip.name || `${trip.destination || "Group"} Trip`;
  const text = bookingConfirmationText(tripName, booking);
  const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPassword } });
  try {
    await transporter.sendMail({
      from: `"TravelSync" <${smtpUser}>`,
      to: email,
      subject: `${tripName} — Booking Confirmation`,
      text,
      html: `<div style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6">${escapeHtml(text)}</div>`,
    });
  } catch (error) {
    console.error("Confirmation email failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not send the email. Try again." }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}
