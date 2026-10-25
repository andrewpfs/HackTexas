"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PhoneVerify, type VerifiedTrips } from "../components/phone-verify";
import { forgetTravelerId, rememberTravelerId } from "@/lib/traveler-identity";

export function MyTripsPanel() {
  const [state, setState] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [data, setData] = useState<VerifiedTrips | null>(null);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  // Hosts delete the trip for everyone; other travelers only take it off their list.
  async function removeTrip(trip: VerifiedTrips["trips"][number]) {
    const question = trip.isHost
      ? `Delete "${trip.tripName}" for everyone? This can't be undone.`
      : `Remove "${trip.tripName}" from your trips? You'll stay in the group.`;
    if (!window.confirm(question)) return;

    setBusyTripId(trip.tripId);
    setError("");
    try {
      const response = trip.isHost
        ? await fetch(`/api/trips/${trip.tripId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostTravelerId: trip.travelerId }) })
        : await fetch(`/api/trips/${trip.tripId}/travelers/${trip.travelerId}/phone`, { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error || "Something went wrong. Please try again.");
        return;
      }
      forgetTravelerId(trip.tripId);
      setData((current) => current && { ...current, trips: current.trips.filter((item) => item.tripId !== trip.tripId) });
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusyTripId(null);
    }
  }

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
      {error ? <p className="mt-3 rounded-2xl bg-[#fff0ec] p-3 text-sm font-semibold text-[#a34532]" role="alert">{error}</p> : null}
      {data.trips.length === 0 ? (
        <div className="mt-4 rounded-3xl bg-white p-6 text-[#718087]">
          No trips are saved to this phone yet. Open a trip and choose <b>Save With Your Phone</b>.
          <Link className="button-primary mt-5 flex w-fit" href="/create">Plan a Trip</Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {data.trips.map((trip) => (
            <li className="flex items-stretch gap-2" key={`${trip.tripId}-${trip.travelerId}`}>
              <Link className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-3xl border border-[#172733]/8 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md" href={`/trip/${trip.tripId}`}>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-bold text-[#173f50]">{trip.tripName}</span>
                  <span className="block text-sm text-[#718087]">
                    {trip.destination ? `${trip.destination} · ` : ""}{trip.window.replace(" to ", " – ")} · you are {trip.travelerName}{trip.isHost ? " (host)" : ""}
                  </span>
                </span>
                <span className="text-[#e4664f]" aria-hidden="true">→</span>
              </Link>
              <button
                aria-label={trip.isHost ? `Delete ${trip.tripName}` : `Remove ${trip.tripName} from my trips`}
                className="shrink-0 rounded-3xl border border-[#172733]/8 bg-white px-4 text-sm font-bold text-[#a34532] transition hover:bg-[#fff0ec] disabled:opacity-50"
                disabled={busyTripId === trip.tripId}
                onClick={() => removeTrip(trip)}
                type="button"
              >
                {busyTripId === trip.tripId ? "…" : trip.isHost ? "Delete" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
