"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TripSketch } from "@/lib/trip-types";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

// The first rough plan, drawn from the host's description before anyone votes.
export function TripSketchCard({ tripId, sketch, hostId }: { tripId: string; sketch: TripSketch | null; hostId: string }) {
  const router = useRouter();
  const { travelerId } = useTravelerIdentity(tripId);
  const isHostView = travelerId === hostId;
  const started = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sketch || started.current) return;
    started.current = true;
    fetch(`/api/trips/${tripId}/sketch`, { method: "POST" }).finally(() => router.refresh());
  }, [sketch, tripId, router]);

  async function redraw() {
    setBusy(true);
    await fetch(`/api/trips/${tripId}/sketch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retry: true }) });
    router.refresh();
    setBusy(false);
  }

  const pending = !sketch || sketch.status === "pending" || busy;

  return (
    <section className="rounded-3xl border border-[#172733]/8 bg-white p-6" aria-labelledby="sketch-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">First Draft</p>
          <h2 className="mt-1 text-xl font-bold" id="sketch-heading">Trip Sketch</h2>
        </div>
        <p className="text-sm text-[#738087]">
          {sketch?.source === "muse" ? "Drawn by Muse Spark from the trip description" : "From the trip description"}
        </p>
      </div>

      {pending ? (
        <div className="mt-5 space-y-3" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#276655]">
            <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[#276655]/30 border-t-[#276655]" />
            Muse is sketching the trip from the description…
          </p>
          <div className="h-16 animate-pulse rounded-2xl bg-[#efede7]" />
          <div className="h-28 animate-pulse rounded-2xl bg-[#efede7]" />
        </div>
      ) : sketch.status === "failed" ? (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#8f3f30] sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p>{sketch.error || "We couldn't sketch the trip."}</p>
          <button className="button-secondary" onClick={redraw} type="button">Try Again</button>
        </div>
      ) : (
        <>
          <p className="mt-4 leading-7 text-[#53666f]">{sketch.summary}</p>

          {sketch.places.length > 0 ? (
            <ol className="mt-4 flex flex-wrap items-center gap-2">
              {sketch.places.map((place, index) => (
                <li className="flex items-center gap-2" key={place.name}>
                  <span className="rounded-full bg-[#173f50] px-3.5 py-1.5 text-sm font-bold text-white" title={place.why}>{place.name}</span>
                  {index < sketch.places.length - 1 ? <span aria-hidden="true" className="text-[#e4664f]">→</span> : null}
                </li>
              ))}
            </ol>
          ) : null}

          <ol className="mt-5 grid gap-2 sm:grid-cols-2">
            {sketch.days.map((day) => (
              <li className="rounded-2xl bg-[#f7f7f3] p-4" key={day.dayNumber}>
                <p className="text-xs font-bold uppercase tracking-wide text-[#e4664f]">Day {day.dayNumber}</p>
                <p className="mt-0.5 font-bold text-[#173f50]">{day.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#718087]">{day.plan}</p>
              </li>
            ))}
          </ol>

          {sketch.suggestions.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">Muse Also Suggests</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {sketch.suggestions.map((idea) => (
                  <li className="rounded-2xl border border-dashed border-[#e4664f]/40 p-3 text-sm" key={idea.name}>
                    <span className="font-bold text-[#173f50]">{idea.name}</span>
                    <span className="block text-[#718087]">{idea.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-5 text-xs text-[#879196]">
            A starting point only. Once everyone shares preferences and dates, Muse builds three full options from this.
            {isHostView ? (
              <button className="ml-2 font-bold text-[#173f50] underline decoration-[#e4664f]/40 underline-offset-4" onClick={redraw} type="button">Redraw</button>
            ) : null}
          </p>
        </>
      )}
    </section>
  );
}
