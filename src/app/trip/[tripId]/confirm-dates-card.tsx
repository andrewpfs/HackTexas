"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { describeTripDates, type DateSuggestion } from "@/lib/date-suggestions";
import { formatCalendarDate, getDatesInRange } from "@/lib/date-utils";
import type { GroupFlightTimes } from "@/lib/flight-time";
import type { ConfirmedTripDates, DatePriceCheck } from "@/lib/trip-types";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";
import { DateRangeCalendar } from "./date-range-calendar";

type CardTraveler = { id: string; name: string; isHost: boolean; availableDates: string[] };

type ConfirmDatesCardProps = {
  tripId: string;
  hostId: string;
  hostName: string;
  suggestions: DateSuggestion[];
  earliestPossibleDate: string;
  latestPossibleDate: string;
  travelers: CardTraveler[];
  confirmed: ConfirmedTripDates | null;
  destination: string | null;
  priceCheck: DatePriceCheck | null;
  faresConfigured: boolean;
  flightTimes: GroupFlightTimes | null;
};

function rangeLabel(startDate: string, endDate: string) {
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  return `${formatCalendarDate(startDate, !sameYear)} – ${formatCalendarDate(endDate)}`;
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function notFreeOn(travelers: CardTraveler[], startDate: string, endDate: string) {
  const days = getDatesInRange(startDate, endDate);
  return travelers.filter((traveler) => days.some((day) => !traveler.availableDates.includes(day)));
}

// Step between availability and options: the host picks the exact dates on a
// calendar (any days, even ones not everyone marked), then everyone says "I'm in".
// Only then can Muse plan options.
export function ConfirmDatesCard(props: ConfirmDatesCardProps) {
  const router = useRouter();
  const { browserReady, travelerId } = useTravelerIdentity(props.tripId);
  const isHost = browserReady && travelerId === props.hostId;
  const first = props.confirmed ?? props.suggestions[0] ?? null;
  const [startDate, setStartDate] = useState(first?.startDate ?? "");
  const [endDate, setEndDate] = useState(first?.endDate ?? "");
  const [busy, setBusy] = useState<"" | "confirm" | "fares" | "agree">("");
  const [error, setError] = useState("");

  const hasSelection = startDate !== "" && endDate !== "" && startDate <= endDate;
  const selectedDays = hasSelection ? getDatesInRange(startDate, endDate).length : 0;
  const minimumDays = props.flightTimes?.recommendedMinimumDays ?? 1;
  const selectedNotes = hasSelection ? [
    ...(selectedDays < minimumDays ? [`Only ${selectedDays} ${selectedDays === 1 ? "day" : "days"}: short for these flights (at least ${minimumDays} recommended).`] : []),
    ...describeTripDates(startDate, endDate).notes,
  ] : [];
  const selectedNotFree = hasSelection ? notFreeOn(props.travelers, startDate, endDate) : [];
  const isConfirmed = props.confirmed?.startDate === startDate && props.confirmed?.endDate === endDate;

  // Trips confirmed before "I'm in" existed count everyone as agreed.
  const agreedIds = props.confirmed ? props.confirmed.agreedTravelerIds ?? props.travelers.map((traveler) => traveler.id) : [];
  const agreedCount = props.travelers.filter((traveler) => traveler.isHost || agreedIds.includes(traveler.id)).length;
  const iAgreed = Boolean(travelerId && (agreedIds.includes(travelerId) || isHost));
  const isMember = Boolean(travelerId && props.travelers.some((traveler) => traveler.id === travelerId));
  const confirmedNotFree = props.confirmed ? notFreeOn(props.travelers, props.confirmed.startDate, props.confirmed.endDate) : [];
  const iAmNotFree = confirmedNotFree.some((traveler) => traveler.id === travelerId);

  function setRange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
    setError("");
  }

  function faresFor(start: string, end: string) {
    return props.priceCheck?.windows.find((window) => window.startDate === start && window.endDate === end)?.fares ?? null;
  }

  async function send(kind: "confirm" | "fares" | "agree") {
    setBusy(kind);
    setError("");
    try {
      const windows = [{ startDate, endDate }, ...props.suggestions].filter((window, index, all) => all.findIndex((other) => other.startDate === window.startDate && other.endDate === window.endDate) === index).slice(0, 3);
      const json = { "Content-Type": "application/json" };
      const response = kind === "confirm"
        ? await fetch(`/api/trips/${props.tripId}/dates`, { method: "PUT", headers: json, body: JSON.stringify({ hostTravelerId: travelerId, startDate, endDate }) })
        : kind === "agree"
          ? await fetch(`/api/trips/${props.tripId}/dates/agree`, { method: "POST", headers: json, body: JSON.stringify({ travelerId, startDate: props.confirmed?.startDate, endDate: props.confirmed?.endDate }) })
          : await fetch(`/api/trips/${props.tripId}/dates/prices`, { method: "POST", headers: json, body: JSON.stringify({ hostTravelerId: travelerId, windows }) });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy("");
    }
  }

  function renderFares(start: string, end: string) {
    const fares = faresFor(start, end);
    if (!fares) return null;
    return (
      <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {fares.map((fare) => (
          <span className="rounded-full bg-[#eef6ff] px-2.5 py-1 font-bold text-[#2f6699]" key={fare.from}>
            {fare.from.split(",")[0]}: {fare.lowestUsd === null ? "no fares found" : `from ${money(fare.lowestUsd)}`}
          </span>
        ))}
      </p>
    );
  }

  return (
    <section className="rounded-3xl border-2 border-[#e4664f]/25 bg-white p-6" aria-labelledby="confirm-dates">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Before Planning</p><h2 className="mt-1 text-xl font-bold" id="confirm-dates">Confirm The Trip Dates</h2></div>
        {props.confirmed ? (
          <span className={`w-fit rounded-full px-3 py-1 text-sm font-bold ${agreedCount === props.travelers.length ? "bg-[#daf0ea] text-[#276655]" : "bg-[#fff4d6] text-[#7a5b12]"}`}>
            {agreedCount === props.travelers.length ? "✓ Everyone is in" : `${agreedCount} of ${props.travelers.length} confirmed`}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-[#66757d]">
        {props.confirmed
          ? `${props.confirmed.confirmedByName} set ${rangeLabel(props.confirmed.startDate, props.confirmed.endDate)}. Muse plans options once everyone confirms they can go.`
          : isHost
            ? "Pick the exact days on the calendar. You can choose any days, even ones not everyone marked free. Then everyone confirms."
            : `Waiting for ${props.hostName} to pick the exact dates.`}
      </p>

      {props.confirmed ? (
        <div className="mt-4 rounded-2xl bg-[#f7f7f3] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">Who&apos;s In</p>
          <ul className="mt-2 space-y-1.5">
            {props.travelers.map((traveler) => {
              const agreed = traveler.isHost || agreedIds.includes(traveler.id);
              const busyThen = confirmedNotFree.some((other) => other.id === traveler.id);
              return (
                <li className="flex items-center justify-between gap-3 text-sm" key={traveler.id}>
                  <span className="font-semibold text-[#173f50]">{traveler.name}{traveler.id === travelerId ? " (you)" : ""}{busyThen ? <span className="ml-2 text-xs font-normal text-[#a34532]">didn&apos;t mark every day free</span> : null}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${agreed ? "bg-[#daf0ea] text-[#276655]" : "bg-[#fbe4d9] text-[#a34532]"}`}>{agreed ? "✓ In" : "Waiting"}</span>
                </li>
              );
            })}
          </ul>
          {isMember && !iAgreed ? (
            <div className="mt-4">
              {iAmNotFree ? <p className="mb-2 text-sm text-[#a34532]">These dates include days you didn&apos;t mark as free. Confirm only if you can make it, or ask {props.hostName} to change them.</p> : null}
              <button className="button-primary" disabled={busy !== ""} onClick={() => send("agree")} type="button">
                {busy === "agree" ? "Confirming…" : "I'm In For These Dates"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {props.flightTimes ? (
        <div className="mt-4 rounded-2xl bg-[#eef6ff] p-4 text-sm text-[#2f4f66]">
          <p className="font-bold text-[#173f50]">✈ Flight time</p>
          <p className="mt-1 leading-6">{props.flightTimes.note}</p>
          <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {props.flightTimes.estimates.map((estimate) => (
              <span className="rounded-full bg-white px-2.5 py-1 font-bold" key={estimate.from}>{estimate.from.split(",")[0]}: ~{estimate.hoursEachWay}h</span>
            ))}
          </p>
        </div>
      ) : null}

      {isHost && props.suggestions.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">Suggested</p>
          <ul className="mt-2 grid gap-2">
            {props.suggestions.map((suggestion, index) => {
              const selected = suggestion.startDate === startDate && suggestion.endDate === endDate;
              return (
                <li key={suggestion.startDate}>
                  <button
                    className={`w-full rounded-2xl border-2 p-4 text-left transition hover:border-[#173f50]/50 ${selected ? "border-[#173f50] bg-[#f3f8fa]" : "border-[#172733]/8 bg-white"}`}
                    onClick={() => setRange(suggestion.startDate, suggestion.endDate)}
                    type="button"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <b className="text-[#173f50]">{rangeLabel(suggestion.startDate, suggestion.endDate)}</b>
                      <span className="text-xs font-bold text-[#879196]">{index === 0 && props.suggestions.length > 1 ? "Best pick · " : props.suggestions.length === 1 ? "Only fit · " : ""}{suggestion.dayCount} {suggestion.dayCount === 1 ? "day" : "days"}</span>
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[#66757d]">{suggestion.notes.join(" ")}</span>
                    {renderFares(suggestion.startDate, suggestion.endDate)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {isHost || props.confirmed ? (
        <div className="mt-5 rounded-2xl bg-[#f7f7f3] p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">{isHost ? (props.suggestions.length > 0 ? "Or Pick Any Days" : "Pick The Days") : "Trip Dates"}</p>
          <DateRangeCalendar
            earliestPossibleDate={props.earliestPossibleDate}
            endDate={isHost ? endDate : props.confirmed?.endDate ?? ""}
            latestPossibleDate={props.latestPossibleDate}
            onChange={setRange}
            readOnly={!isHost}
            startDate={isHost ? startDate : props.confirmed?.startDate ?? ""}
            travelers={props.travelers}
          />
          {isHost ? (
            <>
              {hasSelection ? (
                <p className="mt-4 text-sm font-bold text-[#173f50]">{rangeLabel(startDate, endDate)} · {selectedDays} {selectedDays === 1 ? "day" : "days"}</p>
              ) : (
                <p className="mt-4 text-sm text-[#718087]">No dates picked yet.</p>
              )}
              {selectedNotFree.length > 0 ? (
                <p className="mt-2 rounded-xl bg-[#fff0ec] p-3 text-sm leading-6 text-[#8f3f30]" role="status">
                  ⚠ Not everyone marked these days free: {selectedNotFree.map((traveler) => traveler.name).join(", ")}. You can still pick them; they&apos;ll be asked to confirm they can make it.
                </p>
              ) : null}
              {selectedNotes.length > 0 ? <p className="mt-2 text-sm leading-6 text-[#53666f]">{selectedNotes.join(" ")}</p> : null}
              {props.suggestions.some((suggestion) => suggestion.startDate === startDate && suggestion.endDate === endDate) ? null : renderFares(startDate, endDate)}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button className="button-primary" disabled={busy !== "" || isConfirmed || !hasSelection} onClick={() => send("confirm")} type="button">
                  {busy === "confirm" ? "Saving…" : isConfirmed ? "Dates Set ✓" : props.confirmed ? "Change To These Dates" : "Set These Dates"}
                </button>
                {props.destination && props.faresConfigured ? (
                  <button className="button-secondary" disabled={busy !== "" || !hasSelection} onClick={() => send("fares")} type="button">
                    {busy === "fares" ? "Checking fares…" : "Check Real Flight Prices"}
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-xs leading-5 text-[#879196]">
                {props.confirmed ? "Changing the dates asks everyone to confirm again. " : ""}
                {props.destination
                  ? props.faresConfigured ? `Real fares compare round trips to ${props.destination} from each traveler's city (up to 3 date choices).` : "Real fare checks need a SerpApi key on the server."
                  : "Real fare checks need a destination. Holiday and day-of-week hints work without one."}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm font-semibold text-[#a34532]" role="alert">{error}</p> : null}
    </section>
  );
}
