"use client";

import Image from "next/image";
import { useState } from "react";
import { expediaSearchUrl, hotelPage, hotelPriceTotal, hotelProviderLabel } from "@/lib/hotel-display";
import type { StayPlan } from "@/lib/hotel-stays";
import type { HotelSearchResult } from "@/lib/trip-types";

const money = (amount: number) => `$${Math.round(amount).toLocaleString("en-US")}`;

function Spinner() {
  return <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />;
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

type StayHotelsProps = {
  tripId: string;
  stayIndex: number;
  stayCount: number;
  plan: StayPlan;
  nights: number;
  result: HotelSearchResult | undefined;
  me: { id: string; isHost: boolean; solo: boolean } | null;
  lodgingCount: number;
  lowestBudgetPerNight: number | null;
  busy: string;
  act: (key: string, url: string, method: string, body: unknown) => void;
};

// The hotel list for one stay (one city). The host picks the group hotel; a traveler
// who books their own place picks just for themselves.
export function StayHotels(props: StayHotelsProps) {
  const { tripId, stayIndex, plan, result, me, busy, act } = props;
  const [pageNumber, setPageNumber] = useState(1);
  const paged = hotelPage(result?.options ?? [], pageNumber);
  const groupPick = result?.options.find((option) => option.token === result.selectedToken);
  const myPick = me?.solo ? result?.options.find((option) => option.token === result?.soloPicks?.[me.id]) : undefined;
  const url = `/api/trips/${tripId}/travel/hotels`;

  return (
    <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby={`stay-heading-${stayIndex}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{props.stayCount > 1 ? `Stay ${stayIndex + 1} of ${props.stayCount}` : "Where You'll Stay"}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight" id={`stay-heading-${stayIndex}`}>Hotels In {plan.city}</h2>
          <p className="mt-1 text-sm text-[#718087]">
            {shortDate(plan.checkIn)} – {shortDate(plan.checkOut)} · {props.nights} night{props.nights === 1 ? "" : "s"} for {props.lodgingCount} traveler{props.lodgingCount === 1 ? "" : "s"}{result?.feedLabel ? ` · ${result.feedLabel}` : ""}
          </p>
        </div>
        {me?.solo ? (
          <p className={`rounded-full px-4 py-2 text-sm font-bold ${myPick ? "bg-[#daf0ea] text-[#276655]" : "bg-[#e7e2f5] text-[#4b3d8a]"}`}>{myPick ? `Your hotel: ${myPick.name}` : "You book your own place here"}</p>
        ) : groupPick ? (
          <p className="rounded-full bg-[#daf0ea] px-4 py-2 text-sm font-bold text-[#276655]">Group hotel: {groupPick.name}</p>
        ) : (
          <p className="text-sm font-semibold text-[#879196]">{me?.isHost ? "Pick one for the group." : "The host picks the group hotel."}</p>
        )}
      </div>

      {result?.providerNote ? <p className="mt-3 text-xs leading-5 text-[#53666f]">{result.providerNote}</p> : null}
      {result?.status === "done" ? (
        <button className="mt-3 rounded-full border border-[#173f50]/20 px-4 py-2 text-xs font-bold text-[#173f50] hover:bg-[#edf5fb] disabled:opacity-50" disabled={busy !== ""} onClick={() => { setPageNumber(1); act(`refresh-${stayIndex}`, url, "POST", { stayIndex, refresh: true }); }} type="button">
          {busy === `refresh-${stayIndex}` ? "Finding different hotels…" : "Refresh: Show Different Hotels"}
        </button>
      ) : null}

      {!result || result.status === "pending" ? (
        <div className="mt-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#276655]" role="status"><Spinner /> Searching hotels in {plan.city}…</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((index) => <div className="h-72 animate-pulse rounded-2xl bg-[#efede7]" key={index} />)}
          </div>
        </div>
      ) : result.status === "failed" ? (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#8f3f30] sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p>{result.error || "We couldn't load hotels."}</p>
          <button className="button-secondary" onClick={() => act(`retry-${stayIndex}`, url, "POST", { stayIndex, retry: true })} type="button">Try Again</button>
        </div>
      ) : result.options.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-[#f7f7f3] p-4 text-sm text-[#718087]">No hotels matched these dates. Refresh to try a different list.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paged.options.map((hotel) => {
            const pickedForGroup = hotel.token === result.selectedToken;
            const pickedByMe = me?.solo && hotel.token === result.soloPicks?.[me.id];
            const perPerson = hotel.pricePerNight !== null ? hotel.pricePerNight / Math.max(1, me?.solo ? 1 : props.lodgingCount) : null;
            const fits = perPerson !== null && props.lowestBudgetPerNight !== null && perPerson <= props.lowestBudgetPerNight;
            const total = hotelPriceTotal(hotel, props.nights);
            return (
              <article className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-white transition ${pickedForGroup || pickedByMe ? "border-[#276655] shadow-[0_12px_30px_rgba(39,102,85,0.18)]" : "border-[#172733]/8"}`} key={hotel.token}>
                <div className="relative h-40 bg-[#efede7]">
                  {hotel.thumbnail ? <Image alt="" className="object-cover" fill sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw" src={hotel.thumbnail} unoptimized /> : <span aria-hidden="true" className="flex h-full items-center justify-center text-4xl">🏨</span>}
                  {pickedForGroup ? <span className="absolute left-3 top-3 rounded-full bg-[#276655] px-3 py-1 text-xs font-bold text-white">Group Hotel</span> : null}
                  {pickedByMe ? <span className="absolute left-3 top-3 rounded-full bg-[#7a5ea8] px-3 py-1 text-xs font-bold text-white">Your Hotel</span> : null}
                  {fits ? <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#276655]">Fits everyone&apos;s budget</span> : null}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-bold leading-snug text-[#173f50]">{hotel.name}</p>
                  <p className="mt-2 text-xs font-bold text-[#397bb3]">{hotelProviderLabel(hotel)}{hotel.provider === "expedia" ? " · Expedia ↗" : ""}</p>
                  <p className="mt-1 text-sm text-[#718087]">
                    {hotel.rating !== null ? <span className="font-bold text-[#b0661c]">★ {hotel.rating.toFixed(1)}</span> : null}
                    {hotel.reviewCount !== null ? ` · ${hotel.reviewCount.toLocaleString("en-US")} reviews` : ""}
                    {hotel.hotelClass ? ` · ${hotel.hotelClass}` : ""}
                  </p>
                  {hotel.amenities.length > 0 ? <p className="mt-2 line-clamp-2 text-xs text-[#879196]">{hotel.amenities.join(" · ")}</p> : null}
                  <div className="mt-auto pt-4">
                    {hotel.pricePerNight !== null ? (
                      <p className="text-sm text-[#53666f]">
                        <span className="text-xl font-extrabold text-[#173f50]">{money(hotel.pricePerNight)}</span> / night
                        {total !== null ? <span className="block text-xs text-[#879196]">{money(total)} total{!me?.solo && perPerson !== null ? ` · about ${money(perPerson)} per person per night` : ""}</span> : null}
                      </p>
                    ) : <p className="text-sm font-semibold text-[#53666f]">{hotel.provider === "expedia" ? "See current price on Expedia (can't be booked here)" : "Price not listed"}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {me?.solo ? (
                        <button className={`rounded-full px-4 py-2 text-sm font-bold transition ${pickedByMe ? "bg-[#7a5ea8] text-white" : "bg-[#173f50] text-white"}`} disabled={busy !== ""} onClick={() => act(`hotel-${stayIndex}-${hotel.token}`, url, "PUT", { travelerId: me.id, stayIndex, token: hotel.token, solo: true })} type="button">
                          {busy === `hotel-${stayIndex}-${hotel.token}` ? "Saving…" : pickedByMe ? "Picked ✓" : "Pick For Me"}
                        </button>
                      ) : me?.isHost ? (
                        <button className={`rounded-full px-4 py-2 text-sm font-bold transition ${pickedForGroup ? "bg-[#276655] text-white" : "bg-[#173f50] text-white"}`} disabled={busy !== ""} onClick={() => act(`hotel-${stayIndex}-${hotel.token}`, url, "PUT", { travelerId: me.id, stayIndex, token: hotel.token })} type="button">
                          {busy === `hotel-${stayIndex}-${hotel.token}` ? "Saving…" : pickedForGroup ? "Picked ✓" : "Pick For The Group"}
                        </button>
                      ) : null}
                      <a className="rounded-full border border-[#172733]/15 px-4 py-2 text-sm font-bold text-[#173f50] hover:bg-[#f7f7f3]" href={hotel.link} rel="noopener noreferrer" target="_blank">{hotel.provider === "expedia" ? "View On Expedia ↗" : "View On Provider ↗"}</a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {paged.totalPages > 1 ? <nav aria-label={`Hotel pages in ${plan.city}`} className="mt-6 flex flex-wrap justify-center gap-2">
        <button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={paged.page === 1} onClick={() => setPageNumber(paged.page - 1)} type="button">Previous</button>
        {Array.from({ length: paged.totalPages }, (_, index) => index + 1).map((number) => <button aria-current={paged.page === number ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-bold ${paged.page === number ? "bg-[#173f50] text-white" : "bg-white"}`} key={number} onClick={() => setPageNumber(number)} type="button">{number}</button>)}
        <button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={paged.page === paged.totalPages} onClick={() => setPageNumber(paged.page + 1)} type="button">Next</button>
      </nav> : null}
      {result?.status === "done" && (paged.page === paged.totalPages || paged.totalPages === 0) ? <a className="mt-5 block text-center text-sm font-bold text-[#173f50] underline underline-offset-4" href={result.expediaSearchUrl || expediaSearchUrl()} rel="noopener noreferrer" target="_blank">View More On Expedia ↗</a> : null}
    </section>
  );
}
