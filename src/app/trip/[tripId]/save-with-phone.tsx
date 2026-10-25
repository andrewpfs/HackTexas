"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PhoneVerify } from "../../components/phone-verify";

// Saves this traveler to a phone so they can come back from any device.
export function SaveWithPhone({ tripId, travelerId, savedLast4 }: { tripId: string; travelerId: string; savedLast4?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [last4, setLast4] = useState(savedLast4);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const shown = last4 ?? savedLast4;
  if (shown) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#daf0ea] px-4 py-2.5 text-sm font-bold text-[#276655]" title="You can reopen this trip from any device under My Trips">
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        Saved to •••{shown}
      </span>
    );
  }

  return (
    <div className="relative" ref={wrapper}>
      <button
        aria-expanded={open}
        className="rounded-full border border-[#172733]/12 bg-white px-5 py-2.5 text-sm font-bold text-[#173f50] transition hover:-translate-y-0.5 hover:shadow-md"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Save With Your Phone
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-3 w-[20rem] rounded-3xl border border-[#172733]/10 bg-white p-5 shadow-[0_22px_60px_rgba(23,63,80,0.22)]" role="dialog" aria-label="Save this trip to your phone">
          <p className="text-lg font-bold text-[#173f50]">Keep This Trip</p>
          <p className="mb-4 mt-1 text-sm text-[#718087]">No account needed. Verify your phone and you can reopen this trip on any device.</p>
          <PhoneVerify
            link={{ tripId, travelerId }}
            onVerified={(result) => {
              setLast4(result.last4);
              setOpen(false);
              router.refresh();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
