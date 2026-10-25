"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function ReturningTraveler() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()).then((data) => setSignedIn(data.signedIn === true)).catch(() => {});
  }, []);
  return <section className="mx-auto my-10 flex max-w-5xl flex-col items-start justify-between gap-5 rounded-3xl border border-[#397bb3]/20 bg-white p-6 sm:flex-row sm:items-center sm:p-8" aria-labelledby="returning-title"><div><p className="eyebrow">Returning Traveler</p><h2 className="mt-2 text-2xl font-bold" id="returning-title">{signedIn ? "Resume My Trips" : "Already Have A Trip?"}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[#66757d]">{signedIn ? "Your saved trips are ready to pick up where you left off." : "Use the phone number you saved to your trip. Verify it in My Trips to restore your traveler without joining again."}</p></div><Link className="button-dark shrink-0" href="/my-trips">{signedIn ? "Resume My Trips →" : "Find My Trips →"}</Link></section>;
}
