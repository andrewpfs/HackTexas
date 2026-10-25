"use client";

import { useState } from "react";
import type { Booking } from "@/lib/trip-types";
import { bookingConfirmationText } from "@/lib/travel-display";

export function EmailConfirmation({ tripId, travelerId, tripName, booking, hotelShare }: { tripId: string; travelerId: string; tripName: string; booking: Booking; hotelShare?: Booking["hotelShare"] }) {
  const [email, setEmail] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [sending, setSending] = useState(false);
  async function sendEmail() {
    setSending(true);
    setCopyStatus("");
    try {
      const response = await fetch(`/api/trips/${tripId}/confirmation-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ travelerId, email }) });
      if (response.status === 503) {
        // Email isn't configured on this server, so fall back to the user's own mail app.
        window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`${tripName} — Booking Confirmation`)}&body=${encodeURIComponent(text)}`;
        setSending(false);
        return;
      }
      const data = await response.json().catch(() => ({}));
      setCopyStatus(response.ok ? `Confirmation sent to ${email}.` : data.error || "Could not send the email.");
    } catch {
      setCopyStatus("Could not send the email.");
    }
    setSending(false);
  }
  const text = bookingConfirmationText(tripName, booking, hotelShare);
  return <div className="mt-5 rounded-2xl border border-[#397bb3]/20 bg-[#eef6ff] p-4"><h3 className="font-bold text-[#173f50]">Confirmation Receipt</h3>
    <p className="mt-3 text-sm text-[#53666f]">Email this confirmation to yourself. Demo items are simulated.</p>
    <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void sendEmail(); }}>
      <label className="form-label" htmlFor="confirmation-email">Email Address</label><input autoComplete="email" className="form-control" id="confirmation-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
      <div className="flex flex-wrap gap-2"><button className="button-dark" disabled={sending} type="submit">{sending ? "Sending…" : "Send Confirmation Email"}</button><button className="button-secondary" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopyStatus("Confirmation copied."); } catch { setCopyStatus("Could not copy. Select the confirmation below."); } }} type="button">Copy Confirmation</button></div>
    </form><p className="mt-2 text-xs" role="status">{copyStatus}</p><pre className="mt-3 whitespace-pre-wrap border-t border-[#397bb3]/20 pt-3 font-sans text-xs leading-6">{text}</pre>
  </div>;
}
