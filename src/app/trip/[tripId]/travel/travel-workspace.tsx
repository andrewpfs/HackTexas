"use client";

import Image from "next/image";
import { flightHighlights } from "@/lib/travel-display";
import { hotelPriceTotal } from "@/lib/hotel-display";
import type { StayPlan } from "@/lib/hotel-stays";
import { StayHotels } from "./stay-hotels";
import { EmailConfirmation } from "./email-confirmation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Booking, FlightSearchResult, HotelSearchResult } from "@/lib/trip-types";

type HotelShare = NonNullable<Booking["hotelShare"]>;
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type TravelerInfo = { id: string; name: string; isHost: boolean; departure: string; needsLodging: boolean; solo: boolean };

type TravelWorkspaceProps = {
  tripId: string;
  tripName: string;
  destination: string;
  lodgingCount: number;
  lowestBudgetPerNight: number | null;
  searchConfigured: boolean;
  travelers: TravelerInfo[];
  // One hotel search per city the group sleeps in.
  stays: { plan: StayPlan; nights: number; result: HotelSearchResult | null }[];
  // What each traveler owes whoever booked the group hotels.
  shares: Record<string, HotelShare | undefined>;
  flights: Record<string, FlightSearchResult>;
  bookings: Record<string, Booking>;
};

const money = (amount: number) => `$${Math.round(amount).toLocaleString("en-US")}`;

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

function formatTime(value: string) {
  // SerpApi sends local airport times like "2026-12-17 07:10".
  const [date, time] = value.split(" ");
  if (!date || !time) return value;
  const [hour, minute] = time.split(":").map(Number);
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${day}, ${((hour + 11) % 12) + 1}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function Spinner() {
  return <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />;
}

async function post(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data: data as { error?: string } };
}

export function TravelWorkspace(props: TravelWorkspaceProps) {
  const { tripId, travelers, stays, flights, bookings } = props;
  const router = useRouter();
  const { browserReady, travelerId } = useTravelerIdentity(tripId);
  const me = travelers.find((traveler) => traveler.id === travelerId);
  const myFlights = me ? flights[me.id] : undefined;
  const myBooking = me ? bookings[me.id] : undefined;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const startedHotels = useRef(false);
  const startedFlights = useRef(false);

  // Start the paid searches only once, and only when they have not run yet.
  const unsearchedStays = stays.map((stay, index) => (stay.result ? -1 : index)).filter((index) => index >= 0).join(",");
  useEffect(() => {
    if (!props.searchConfigured || unsearchedStays === "" || startedHotels.current) return;
    startedHotels.current = true;
    Promise.all(unsearchedStays.split(",").map((index) => post(`/api/trips/${tripId}/travel/hotels`, "POST", { stayIndex: Number(index) }))).finally(() => router.refresh());
  }, [props.searchConfigured, unsearchedStays, tripId, router]);

  useEffect(() => {
    if (!props.searchConfigured || !me || myFlights || startedFlights.current) return;
    startedFlights.current = true;
    post(`/api/trips/${tripId}/travel/flights`, "POST", { travelerId: me.id }).finally(() => router.refresh());
  }, [props.searchConfigured, me, myFlights, tripId, router]);

  async function act(key: string, url: string, method: string, body: unknown) {
    setBusy(key);
    setError("");
    const result = await post(url, method, body);
    if (!result.ok) setError(result.data.error || "Something went wrong. Please try again.");
    router.refresh();
    setBusy("");
  }

  const myFlight = myFlights?.options.find((option) => option.id === myFlights.selectedId);
  const highlights = flightHighlights(myFlights?.options ?? []);
  // What I pick in each city: the group hotel (if I'm the one booking it) or my own place.
  const myStays = stays.map(({ plan, nights, result }) => {
    const groupHotel = result?.options.find((option) => option.token === result.selectedToken);
    const ownHotel = me?.solo ? result?.options.find((option) => option.token === result?.soloPicks?.[me.id]) : undefined;
    const hotel = me?.solo ? ownHotel : groupHotel;
    const iBook = Boolean(hotel && (me?.solo || result?.selectedByTravelerId === me?.id));
    const total = hotel ? hotelPriceTotal(hotel, nights) : null;
    const booker = travelers.find((traveler) => traveler.id === result?.selectedByTravelerId);
    return { plan, hotel, iBook, total, booker };
  });
  const missingHotels = me?.needsLodging ? myStays.filter((stay) => !stay.hotel).map((stay) => stay.plan.city.split(",")[0]) : [];
  const missingList = missingHotels.join(" and ");
  const owedShare = myBooking?.hotelShare ?? (me ? props.shares[me.id] : undefined);
  const owedCopy = owedShare ? `You owe ${owedShare.bookerName} about ${money(owedShare.amount)} for your share of ${owedShare.hotelName}.` : "";
  const myTotal = (myFlight?.price ?? 0) + myStays.reduce((sum, stay) => sum + (stay.iBook ? stay.total ?? 0 : 0), 0);

  if (!props.searchConfigured) {
    return (
      <p className="mt-6 rounded-3xl bg-white p-6 text-[#718087]">
        Hotel and flight search need a SerpApi key. Add <code className="font-mono">SERPAPI_API_KEY</code> to the server settings.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {error ? <p className="rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#a34532]" role="alert">{error}</p> : null}

      {/* ---------- hotels: one section per city the group sleeps in ---------- */}
      {owedCopy ? <p className="rounded-2xl bg-[#fff8dc] p-4 text-sm font-bold text-[#6f5a16]">{owedCopy} <span className="block font-normal">Separate from your own flight charge.</span></p> : null}
      {me?.solo ? <p className="rounded-2xl bg-[#f4f1fb] p-4 text-sm text-[#4b3d8a]"><b>You&apos;re booking your own place.</b> You said you&apos;d prefer separate lodging, so pick your own hotel in each city below. You won&apos;t be charged a share of the group hotel.</p> : null}
      {stays.map((stay, index) => (
        <StayHotels
          act={act}
          busy={busy}
          key={`${stay.plan.city}-${stay.plan.checkIn}`}
          lodgingCount={props.lodgingCount}
          lowestBudgetPerNight={props.lowestBudgetPerNight}
          me={me ? { id: me.id, isHost: me.isHost, solo: me.solo } : null}
          nights={stay.nights}
          plan={stay.plan}
          result={stay.result ?? undefined}
          stayCount={stays.length}
          stayIndex={index}
          tripId={tripId}
        />
      ))}

      {/* ---------- flights ---------- */}
      <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="flight-heading">
        <p className="eyebrow">Getting There</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight" id="flight-heading">Your Flight</h2>

        {!browserReady ? null : !me ? (
          <p className="mt-4 text-sm text-[#718087]">Open this trip from your invite link on this device to see your flights.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-[#718087]">Round trip from {me.departure} · live prices from Google Flights via SerpApi</p>
            {!myFlights || myFlights.status === "pending" ? (
              <div className="mt-5 space-y-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#276655]" role="status"><Spinner /> Searching flights from {me.departure}…</p>
                {[0, 1, 2].map((index) => <div className="h-20 animate-pulse rounded-2xl bg-[#efede7]" key={index} />)}
              </div>
            ) : myFlights.status === "failed" ? (
              <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#8f3f30] sm:flex-row sm:items-center sm:justify-between" role="alert">
                <p>{myFlights.error || "We couldn't load flights."}</p>
                <button className="button-secondary" onClick={() => act("flight-retry", `/api/trips/${tripId}/travel/flights`, "POST", { travelerId: me.id, retry: true })} type="button">Try Again</button>
              </div>
            ) : myFlights.options.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-[#f7f7f3] p-4 text-sm text-[#718087]">No flights found for these dates.</p>
            ) : (
              <>
              {myFlights.groundNote ? (
                <p className="mt-5 rounded-2xl bg-[#eef6ff] p-4 text-sm leading-6 text-[#2f4f66]" role="note">🚗 {myFlights.groundNote}</p>
              ) : null}
              <ul className="mt-5 space-y-3">
                {myFlights.options.map((flight) => {
                  const picked = flight.id === myFlights.selectedId;
                  return (
                    <li className={`flex flex-col gap-4 rounded-2xl border-2 p-4 sm:flex-row sm:items-center ${picked ? "border-[#276655] bg-[#f3fbf8]" : "border-[#172733]/8"}`} key={flight.id}>
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f7f7f3]">{flight.airlineLogo ? <Image alt="" className="h-10 w-10 object-contain" height={40} src={flight.airlineLogo} unoptimized width={40} onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /> : <span aria-hidden="true">✈️</span>}</span>
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap gap-1.5">{flight.price === highlights.cheapest ? <span className="rounded-full bg-[#daf0ea] px-2 py-1 text-xs font-bold text-[#276655]">Cheapest</span> : null}{flight.durationMinutes === highlights.shortest ? <span className="rounded-full bg-[#deedff] px-2 py-1 text-xs font-bold text-[#2f6699]">Shortest</span> : null}</div>
                          <p className="font-bold text-[#173f50]">{formatTime(flight.departTime)} → {formatTime(flight.arriveTime)}</p>
                          <p className="text-sm text-[#718087]">
                            {flight.airline} · {flight.departAirport} → {flight.arriveAirport} · {formatDuration(flight.durationMinutes)} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops === 1 ? "" : "s"}`}
                          </p>
                          {flight.groundTransfer ? (
                            <p className="mt-1 text-sm font-semibold text-[#2f6699]">🚗 Then ~{formatDuration(flight.groundTransfer.minutes)} drive from {flight.groundTransfer.airportName} ({flight.groundTransfer.airport}) to {flight.groundTransfer.to}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <p className="text-right"><span className="text-xl font-extrabold text-[#173f50]">{money(flight.price)}</span><span className="block text-xs text-[#879196]">round trip</span></p>
                        <button
                          className={`rounded-full px-4 py-2 text-sm font-bold transition ${picked ? "bg-[#276655] text-white" : "bg-[#173f50] text-white hover:-translate-y-0.5"}`}
                          disabled={busy !== "" || Boolean(myBooking)}
                          onClick={() => act(`flight-${flight.id}`, `/api/trips/${tripId}/travel/flights`, "PUT", { travelerId: me.id, flightId: flight.id })}
                          type="button"
                        >
                          {busy === `flight-${flight.id}` ? "Saving…" : picked ? "Chosen ✓" : "Choose"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              </>
            )}
          </>
        )}

        <div className="mt-6 border-t border-dashed border-[#173f50]/15 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">The Group&apos;s Flights</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {travelers.map((traveler) => {
              const search = flights[traveler.id];
              const chosen = search?.options.find((option) => option.id === search.selectedId);
              return (
                <li className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7f7f3] px-4 py-3 text-sm" key={traveler.id}>
                  <span className="font-bold text-[#173f50]">{traveler.name}<span className="block text-xs font-normal text-[#879196]">from {traveler.departure || "unknown"}</span></span>
                  <span className={chosen ? "text-right font-semibold text-[#276655]" : "text-[#879196]"}>
                    {chosen ? <>{chosen.airline}<span className="block text-xs">arrives {formatTime(chosen.arriveTime)}</span></> : search?.status === "pending" ? "Searching…" : "Not chosen yet"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------- booking ---------- */}
      <section className="overflow-hidden rounded-3xl border border-[#172733]/8 bg-white" aria-labelledby="book-heading">
        <div className="bg-[#173f50] px-6 py-4 text-white sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f3c969]">Demo Mode · No Payment Is Taken</p>
          <h2 className="mt-1 text-2xl font-bold" id="book-heading">Ready To Book</h2>
        </div>

        <div className="p-6 sm:p-8">
          {!browserReady ? null : !me ? (
            <p className="text-sm text-[#718087]">Open this trip from your invite link on this device to book.</p>
          ) : myBooking ? (
            <div>
              <p className="flex items-center gap-2 text-lg font-bold text-[#276655]">
                <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                You&apos;re booked (demo)
              </p>
              <ul className="mt-4 divide-y divide-[#172733]/8 rounded-2xl border border-[#172733]/8">
                {myBooking.items.map((item) => (
                  <li className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between" key={item.confirmationCode}>
                    <span><span className="font-bold text-[#173f50]">{item.kind === "flight" ? "Flight" : "Hotel"}: {item.label}</span>{item.source === "assistant" ? <span className="ml-2 rounded-full bg-[#e7e2f5] px-2 py-0.5 text-xs font-bold text-[#4b3d8a]">By your assistant</span> : null}<span className="block text-sm text-[#718087]">{item.detail}</span></span>
                    <span className="text-right"><span className="font-mono text-sm font-bold text-[#276655]">{item.confirmationCode}</span><span className="block text-sm text-[#53666f]">{money(item.amount)}</span></span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-right text-lg font-extrabold text-[#173f50]">You Paid {money(myBooking.total)} {myBooking.items.every((item) => item.source !== "assistant") ? "(Simulated)" : "(Recorded)"}</p>
              {owedCopy ? <p className="mt-3 rounded-2xl bg-[#fff8dc] p-4 font-bold text-[#6f5a16]">{owedCopy} This is separate from the amount above.</p> : null}
              <EmailConfirmation booking={myBooking} tripId={props.tripId} travelerId={me.id} hotelShare={owedShare} tripName={props.tripName} />
              <p className="mt-2 text-xs text-[#879196]">
                {myBooking.items.some((item) => item.source === "assistant")
                  ? "Items marked “By your assistant” were recorded by your connected assistant. Demo items were not reserved and no card was charged."
                  : "These are demo confirmation codes. Nothing was reserved and no card was charged."}
              </p>
            </div>
          ) : (
            <div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between gap-4 rounded-2xl bg-[#f7f7f3] px-4 py-3">
                  <span><span className="font-bold text-[#173f50]">Your flight</span><span className="block text-[#718087]">{myFlight ? `${myFlight.airline}, ${myFlight.departAirport} → ${myFlight.arriveAirport}${myFlight.groundTransfer ? `, then ~${formatDuration(myFlight.groundTransfer.minutes)} drive` : ""}` : "Choose a flight above"}</span></span>
                  <b>{myFlight ? money(myFlight.price) : "—"}</b>
                </li>
                {me.needsLodging ? myStays.map((stay) => (
                  <li className="flex items-center justify-between gap-4 rounded-2xl bg-[#f7f7f3] px-4 py-3" key={`${stay.plan.city}-${stay.plan.checkIn}`}>
                    <span>
                      <span className="font-bold text-[#173f50]">{me.solo ? "Your hotel" : "Group hotel"} in {stay.plan.city}</span>
                      <span className="block text-[#718087]">
                        {!stay.hotel
                          ? me.solo ? "Pick your own hotel above" : "The host hasn't picked one yet"
                          : stay.iBook
                            ? `${stay.hotel.name} · ${me.solo ? "just for you" : "you book it for the group"}`
                            : `${stay.hotel.name} · ${stay.booker?.name ?? "The host"} books it`}
                      </span>
                    </span>
                    <b>{stay.hotel && stay.total === null ? "Price on provider" : stay.iBook ? money(stay.total ?? 0) : "—"}</b>
                  </li>
                )) : null}
              </ul>
              {myStays.some((stay) => stay.hotel && stay.total === null) ? <p className="mt-3 text-sm text-[#53666f]">A hotel with no listed price can&apos;t be booked here. Check its provider site, or refresh for a priced list.</p> : null}
              {missingHotels.length > 0 ? <p className="mt-4 rounded-2xl bg-[#f7f7f3] p-4 text-sm font-semibold text-[#53666f]" role="status">{me.solo ? `Pick your own hotel in ${missingList} above to confirm.` : me.isHost ? `Pick the group hotel in ${missingList} above, then everyone can confirm.` : `You can confirm once the host picks the group hotel in ${missingList}.`}</p> : null}
              {owedCopy ? <p className="mt-4 rounded-2xl bg-[#fff8dc] p-4 text-sm font-bold text-[#6f5a16]">{owedCopy} This is not part of your simulated charge.</p> : null}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-lg font-extrabold text-[#173f50]">Estimated total {money(myTotal)}</p>
                <button
                  className={`button-primary ${myTotal === 0 || missingHotels.length > 0 || busy !== "" ? "cursor-not-allowed opacity-60" : ""}`}
                  disabled={myTotal === 0 || missingHotels.length > 0 || busy !== ""}
                  onClick={() => act("book", `/api/trips/${tripId}/travel/book`, "POST", { travelerId: me.id })}
                  type="button"
                >
                  {busy === "book" ? "Booking…" : "Approve And Book (Demo)"}
                </button>
              </div>
            </div>
          )}

          <a className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-[#7a5ea8]/25 bg-[#f4f1fb] p-4 transition hover:-translate-y-0.5" href={`/trip/${tripId}/connect`}>
            <span>
              <span className="block font-bold text-[#4b3d8a]">Let your AI assistant book it</span>
              <span className="block text-sm text-[#718087]">Connect the Muse app or any MCP-capable assistant to your part of this trip.</span>
            </span>
            <span aria-hidden="true" className="text-[#7a5ea8]">→</span>
          </a>

          <div className="mt-6 border-t border-dashed border-[#173f50]/15 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">Who Has Booked</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {travelers.map((traveler) => (
                <span className={`rounded-full px-3 py-1.5 text-sm font-bold ${bookings[traveler.id] ? "bg-[#daf0ea] text-[#276655]" : "bg-[#f2f0ea] text-[#879196]"}`} key={traveler.id}>
                  {traveler.name} {bookings[traveler.id] ? "✓" : "· not yet"}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
