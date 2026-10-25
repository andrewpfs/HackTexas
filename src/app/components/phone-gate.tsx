"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PhoneVerify } from "./phone-verify";

// Phone sign-in comes first: the form behind it only shows once this browser
// has a verified phone session.
export function PhoneGate({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  const [state, setState] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [last4, setLast4] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { signedIn: boolean; last4?: string }) => {
        setLast4(result.last4 ?? "");
        setState(result.signedIn ? "signed-in" : "signed-out");
      })
      .catch(() => setState("signed-out"));
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setLast4("");
    setState("signed-out");
  }

  if (state === "loading") {
    return <div className="h-40 animate-pulse rounded-3xl bg-[#f2f0ea]" />;
  }

  if (state === "signed-out") {
    return (
      <section className="rounded-3xl border border-[#173f50]/10 bg-[#f7f7f3] p-5 sm:p-6" aria-labelledby="phone-gate-title">
        <p className="eyebrow">Step 1</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight" id="phone-gate-title">{title}</h2>
        <p className="mt-2 mb-5 text-sm leading-6 text-[#66757d]">{description}</p>
        <div className="max-w-md">
          <PhoneVerify onVerified={(result) => { setLast4(result.last4); setState("signed-in"); }} />
        </div>
      </section>
    );
  }

  return (
    <>
      <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-[#53666f]">
        <span className="rounded-full bg-[#daf0ea] px-3 py-1 text-[#276655]">✓ Signed in as •••{last4}</span>
        <button className="text-[#607179] underline decoration-[#e4664f]/40 underline-offset-4 hover:text-[#e4664f]" onClick={signOut} type="button">Not you?</button>
      </p>
      {children}
    </>
  );
}
