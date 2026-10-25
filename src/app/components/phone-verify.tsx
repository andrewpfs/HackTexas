"use client";

import { FormEvent, useState } from "react";

export type VerifiedTrips = {
  last4: string;
  trips: { tripId: string; travelerId: string; travelerName: string; tripName: string; destination: string | null; window: string; isHost: boolean }[];
};

type PhoneVerifyProps = {
  link?: { tripId: string; travelerId: string };
  onVerified: (result: VerifiedTrips) => void;
  submitLabel?: string;
};

// Two steps: text a code to a phone, then type it in. No account or password.
export function PhoneVerify({ link, onVerified, submitLabel = "Text Me A Code" }: PhoneVerifyProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/phone/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const data = (await response.json()) as { error?: string; demoCode?: string };
      if (!response.ok) {
        setError(data.error || "We couldn't send a code.");
        return;
      }
      setDemoCode(data.demoCode ?? null);
      setStep("code");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/phone/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code, link }) });
      const data = (await response.json()) as VerifiedTrips & { error?: string };
      if (!response.ok) {
        setError(data.error || "That code didn't work.");
        return;
      }
      onVerified(data);
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {step === "phone" ? (
        <form className="space-y-3" onSubmit={sendCode}>
          <label className="form-label" htmlFor="phone-number">Phone Number</label>
          <input autoComplete="tel" className="form-control" id="phone-number" inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="example: (512) 555-0134" required type="tel" value={phone} />
          <button className="button-primary w-full" disabled={busy} type="submit">{busy ? "Sending…" : submitLabel}</button>
          <p className="text-xs text-[#879196]">We only use your number to find your trips again. Message and data rates may apply.</p>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={verify}>
          <label className="form-label" htmlFor="phone-code">Enter The 6-Digit Code</label>
          <input autoComplete="one-time-code" className="form-control text-center font-mono text-2xl tracking-[0.4em]" id="phone-code" inputMode="numeric" maxLength={8} onChange={(event) => setCode(event.target.value)} placeholder="······" required value={code} />
          {demoCode ? (
            <p className="rounded-2xl bg-[#fff8dc] p-3 text-sm text-[#6f5a16]">
              Demo mode: text messages aren&apos;t set up yet, so here is your code: <b className="font-mono text-base tracking-widest">{demoCode}</b>
            </p>
          ) : (
            <p className="text-sm text-[#718087]">We texted a code to {phone}.</p>
          )}
          <button className="button-primary w-full" disabled={busy} type="submit">{busy ? "Checking…" : "Verify"}</button>
          <div className="flex justify-between text-sm">
            <button className="font-semibold text-[#607179] hover:text-[#e4664f]" onClick={() => { setStep("phone"); setCode(""); }} type="button">Change number</button>
            <button className="font-semibold text-[#607179] hover:text-[#e4664f]" disabled={busy} onClick={() => sendCode()} type="button">Send a new code</button>
          </div>
        </form>
      )}
      {error ? <p className="mt-3 text-sm font-semibold text-[#a34532]" role="alert">{error}</p> : null}
    </div>
  );
}
