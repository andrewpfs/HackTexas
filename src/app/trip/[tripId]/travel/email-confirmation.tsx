"use client";

import { useState } from "react";
import type { Booking } from "@/lib/trip-types";
import { bookingConfirmationText } from "@/lib/travel-display";

export function EmailConfirmation({ tripName, booking, hotelShare }: { tripName: string; booking: Booking; hotelShare?: Booking["hotelShare"] }) {
  const [email, setEmail] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const text = bookingConfirmationText(tripName, booking, hotelShare);
  return <div className="mt-5 rounded-2xl border border-[#397bb3]/20 bg-[#eef6ff] p-4"><h3 className="font-bold text-[#173f50]">Confirmation Receipt</h3>
    <p className="mt-3 text-sm text-[#53666f]">Open a draft in your email app, then review and send it yourself.</p>
    <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`${tripName} — Booking Confirmation`)}&body=${encodeURIComponent(text)}`; }}>
      <label className="form-label" htmlFor="confirmation-email">Email Address</label><input autoComplete="email" className="form-control" id="confirmation-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
      <div className="flex flex-wrap gap-2"><button className="button-dark" type="submit">Open Email Draft</button><button className="button-secondary" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopyStatus("Confirmation copied."); } catch { setCopyStatus("Could not copy. Select the confirmation below."); } }} type="button">Copy Confirmation</button></div>
    </form><p className="mt-2 text-xs" role="status">{copyStatus}</p><pre className="mt-3 whitespace-pre-wrap border-t border-[#397bb3]/20 pt-3 font-sans text-xs leading-6">{text}</pre>
  </div>;
}
