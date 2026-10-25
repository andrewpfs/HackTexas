"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TripSketch } from "@/lib/trip-types";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";
import { activityIcon } from "@/lib/activity-icons";

const dayColors = ["border-[#397bb3]/25 bg-[#edf5fd]", "border-[#276655]/25 bg-[#eaf6f0]", "border-[#ae7d2a]/25 bg-[#fff6e3]"];

function sketchSections(plan: string) {
  // Keep prose intact when the sketch has no explicit time-of-day labels.
  return plan.split(/(?=\b(?:Morning|Afternoon|Evening)\s*:)/i).filter((section) => section.trim() !== "");
}

type TripSketchCardProps = {
  tripId: string;
  sketch: TripSketch | null;
  hostId: string;
  destination: string;
  origin: string;
  dateLabel: string;
  // The draft's inputs changed (or it doesn't exist yet), so a new one should be drawn.
  needsRedraw: boolean;
  basisKey: string;
  // True once everyone has shared preferences and dates.
  groupReady: boolean;
};

// The first rough plan, drawn from the host's description before anyone votes.
// It stays put while people join and answer; once everyone has, Muse redraws it for
// the whole group in the background and the new draft replaces it when it's ready.
export function TripSketchCard({ tripId, sketch, hostId, destination, origin, dateLabel, needsRedraw, basisKey, groupReady }: TripSketchCardProps) {
  const router = useRouter();
  const { travelerId } = useTravelerIdentity(tripId);
  const isHostView = travelerId === hostId;
  const requested = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);

  // Ask once per set of inputs; the server makes sure only one draw runs.
  useEffect(() => {
    if (!needsRedraw || requested.current.has(basisKey)) return;
    requested.current.add(basisKey);
    fetch(`/api/trips/${tripId}/sketch`, { method: "POST" }).finally(() => router.refresh());
  }, [needsRedraw, basisKey, tripId, router]);

  async function redraw() {
    setBusy(true);
    await fetch(`/api/trips/${tripId}/sketch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retry: true }) });
    router.refresh();
    setBusy(false);
  }

  const hasContent = Boolean(sketch && sketch.status === "done" && sketch.summary.trim() !== "");
  const pending = !hasContent && (!sketch || sketch.status === "pending" || busy);
  const updating = hasContent && (Boolean(sketch?.refreshing) || needsRedraw || busy);
  const updateFailed = hasContent && !updating && sketch?.failedBasisKey === basisKey;

  return (
    <section className="overflow-hidden rounded-3xl border border-[#397bb3]/20 bg-gradient-to-br from-white via-white to-[#eaf3fb] p-6 shadow-sm" aria-labelledby="sketch-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">First Draft</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#173f50] sm:text-3xl" id="sketch-heading">{destination}</h2>
          <p className="mt-2 text-sm font-bold text-[#397bb3]">✦ Trip Sketch · {origin} → {destination}</p>
          <p className="mt-1 text-sm text-[#53666f]">{dateLabel}</p>
        </div>
        <p className="text-sm text-[#738087]">
          {sketch?.stage === "group"
            ? sketch.source === "muse" ? "Updated by Muse Spark with everyone's preferences and dates" : "Updated with everyone's preferences and dates"
            : sketch?.source === "muse" ? "Drawn by Muse Spark from the trip description" : "From the trip description"}
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
      ) : !sketch || sketch.status === "failed" ? (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#8f3f30] sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p>{sketch?.error || "We couldn't sketch the trip."}</p>
          <button className="button-secondary" onClick={redraw} type="button">Try Again</button>
        </div>
      ) : (
        <>
          {updating ? (
            <p className="mt-5 flex items-center gap-2 rounded-2xl bg-[#eaf6f0] px-4 py-3 text-sm font-semibold text-[#276655]" role="status">
              <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#276655]/30 border-t-[#276655]" />
              {groupReady ? "Muse is updating this draft with everyone's preferences and dates. The new one appears here when it's ready." : "Muse is redrawing this draft with the new trip details. The new one appears here when it's ready."}
            </p>
          ) : updateFailed ? (
            <p className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-[#fff0ec] px-4 py-3 text-sm font-semibold text-[#8f3f30]" role="status">
              Muse couldn&apos;t update the draft with the latest changes.
              <button className="font-bold underline underline-offset-4" onClick={redraw} type="button">Try Again</button>
            </p>
          ) : !groupReady ? (
            <p className="mt-5 rounded-2xl bg-[#f7f7f3] px-4 py-3 text-sm text-[#53666f]">This draft stays the same while people join. Once everyone has shared preferences and dates, Muse updates it for the whole group.</p>
          ) : null}
          <p className="mt-5 rounded-2xl bg-[#173f50] p-5 text-lg leading-7 text-white">{sketch.summary}</p>

          {sketch.places.length > 0 ? (
            <ol className="mt-4 flex flex-wrap items-center gap-2">
              {sketch.places.map((place, index) => (
                <li className="flex items-center gap-2" key={place.name}>
                  <span className="rounded-full bg-[#173f50] px-3.5 py-1.5 text-sm font-bold text-white" title={place.why}>📍 {place.name}</span>
                  {index < sketch.places.length - 1 ? <span aria-hidden="true" className="text-[#e4664f]">→</span> : null}
                </li>
              ))}
            </ol>
          ) : null}

          <ol className="mt-6 grid gap-3 sm:grid-cols-2">
            {sketch.days.map((day, index) => (
              <li className={`rounded-2xl border p-5 shadow-sm ${dayColors[index % dayColors.length]}`} key={day.dayNumber}>
                <p className="text-xs font-bold uppercase tracking-wide text-[#397bb3]">🗓 Day {day.dayNumber}</p>
                <p className="mt-1 text-lg font-bold text-[#173f50]">{activityIcon({ title: day.title })} {day.title}</p>
                <div className="mt-3 divide-y divide-[#173f50]/10">{sketchSections(day.plan).map((section, sectionIndex) => <p className="py-2 text-sm leading-6 text-[#53666f]" key={sectionIndex}><span aria-hidden="true">{activityIcon({ title: section })}</span> {section}</p>)}</div>
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
            A starting point only. Once everyone shares preferences and dates and confirms the trip days, Muse builds three full options from this.
            {isHostView ? (
              <button className="ml-2 font-bold text-[#173f50] underline decoration-[#e4664f]/40 underline-offset-4" onClick={redraw} type="button">Redraw</button>
            ) : null}
          </p>
        </>
      )}
    </section>
  );
}
