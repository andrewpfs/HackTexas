"use client";

import Image from "next/image";
import { useState } from "react";
import type { PlaceOptions as PlaceOptionsData } from "@/lib/trip-types";
import type { ChatState } from "./proposal-card";

// The 3 real places Muse found for one stop. Tap one to see reviews, then propose
// it to the group (a vote) or keep it as your own plan.
export function PlaceOptions({ tripId, messageId, options, travelerId, onUpdate }: {
  tripId: string;
  messageId: string;
  options: PlaceOptionsData;
  travelerId: string | null;
  onUpdate: (state: ChatState) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function choose(placeIndex: number, mode: "group" | "me") {
    setBusy(`${placeIndex}-${mode}`);
    setError("");
    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary/place-choice`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelerId, messageId, placeIndex, mode }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Couldn't save that choice.");
      else onUpdate(data);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-bold text-[#6f5a16]">Options for Day {options.dayNumber}: {options.stopTitle}</p>
      {options.places.map((place, index) => {
        const expanded = open === index;
        const picked = options.chosen?.placeIndex === index;
        return (
          <div className={`overflow-hidden rounded-2xl border bg-white text-[#273b46] ${picked ? "border-[#276655]" : "border-[#172733]/10"}`} key={`${place.name}-${index}`}>
            <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(expanded ? null : index)} type="button">
              {place.thumbnail ? (
                <Image alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" height={56} src={place.thumbnail} unoptimized width={56} />
              ) : (
                <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f2f0ea] text-2xl">🍽️</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-[#173f50]">{place.name}</span>
                <span className="block text-xs text-[#53666f]">
                  {place.rating ? `★ ${place.rating}` : "No rating"}{place.reviewCount ? ` (${place.reviewCount.toLocaleString("en-US")})` : ""}{place.price ? ` · ${place.price}` : ""}{place.category ? ` · ${place.category}` : ""}
                </span>
                {picked ? <span className="mt-1 block text-xs font-bold text-[#276655]">✓ {options.chosen!.travelerName} {options.chosen!.mode === "group" ? "proposed this to the group" : "is going here"}</span> : null}
              </span>
              <span aria-hidden="true" className="text-[#879196]">{expanded ? "▴" : "▾"}</span>
            </button>
            {expanded ? (
              <div className="border-t border-[#172733]/8 p-3 text-sm">
                {place.address ? <p className="text-[#53666f]">📍 {place.address}</p> : null}
                {place.reviews.slice(0, 2).map((review, reviewIndex) => (
                  <p className="mt-2 rounded-xl bg-[#f7f7f3] p-2 text-xs leading-5 text-[#53666f]" key={reviewIndex}>
                    {review.rating ? `★ ${review.rating} · ` : ""}&ldquo;{review.snippet}&rdquo;
                  </p>
                ))}
                <a className="mt-2 inline-block text-xs font-bold text-[#2f6699] underline" href={place.mapsUrl} rel="noreferrer" target="_blank">Open in Google Maps</a>
                {!options.chosen && travelerId ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="min-h-10 rounded-full bg-[#173f50] px-3 text-xs font-bold text-white disabled:opacity-60" disabled={busy !== ""} onClick={() => choose(index, "group")} type="button">
                      {busy === `${index}-group` ? "Proposing…" : "Propose To Group"}
                    </button>
                    <button className="min-h-10 rounded-full border border-[#173f50]/30 px-3 text-xs font-bold text-[#173f50] disabled:opacity-60" disabled={busy !== ""} onClick={() => choose(index, "me")} type="button">
                      {busy === `${index}-me` ? "Saving…" : "Just For Me"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {!options.chosen ? <p className="text-[11px] leading-4 text-[#718087]">Proposing starts a group vote. If the group says no, it becomes your personal plan.</p> : null}
      {error ? <p className="text-xs font-semibold text-[#a34532]" role="alert">{error}</p> : null}
    </div>
  );
}
