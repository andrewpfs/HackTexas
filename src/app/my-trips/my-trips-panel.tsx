"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PhoneVerify, type VerifiedTrips } from "../components/phone-verify";
import { rememberTravelerId } from "@/lib/traveler-identity";

export function MyTripsPanel() {
  const [state, setState] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [data, setData] = useState<VerifiedTrips | null>(null);

  // Restoring a trip means this browser remembers you as that traveler again.
  function restore(result: VerifiedTrips) {
    for (const trip of result.trips) {
      rememberTravelerId(trip.tripId, trip.travelerId);
    }
    setData(result);
    setState("signed-in");
  }

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: VerifiedTrips & { signedIn: boolean }) => (result.signedIn ? restore(result) : setState("signed-out")))
      .catch(() => setState("signed-out"));
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setData(null);
    setState("signed-out");
  }

  if (state === "loading") {
    return <div className="mt-8 h-40 animate-pulse rounded-3xl bg-white" />;
  }

  if (state === "signed-out" || !data) {
    return (
      <section className="mt-8 max-w-md rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8">
        <PhoneVerify onVerified={restore} />
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-[#53666f]">Signed in as •••{data.last4}</p>
        <button className="text-sm font-bold text-[#607179] underline decoration-[#e4664f]/40 underline-offset-4 hover:text-[#e4664f]" onClick={signOut} type="button">Sign out</button>
      </div>
      {data.trips.length === 0 ? (
        <div className="mt-4 rounded-3xl bg-white p-6 text-[#718087]">
          No trips are saved to this phone yet. Open a trip and choose <b>Save With Your Phone</b>.
          <Link className="button-primary mt-5 flex w-fit" href="/create">Plan a Trip</Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {data.trips.map((trip) => (
            <li key={`${trip.tripId}-${trip.travelerId}`}>
              <Link className="flex items-center justify-between gap-4 rounded-3xl border border-[#172733]/8 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md" href={`/trip/${trip.tripId}`}>
                <span>
                  <span className="block text-lg font-bold text-[#173f50]">{trip.tripName}</span>
                  <span className="block text-sm text-[#718087]">
                    {trip.destination ? `${trip.destination} · ` : ""}{trip.window.replace(" to ", " – ")} · you are {trip.travelerName}{trip.isHost ? " (host)" : ""}
                  </span>
                </span>
                <span className="text-[#e4664f]" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
