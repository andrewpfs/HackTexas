"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { describeTripDates, type DateSuggestion } from "@/lib/date-suggestions";
import { formatCalendarDate, getDatesInRange } from "@/lib/date-utils";
import type { GroupFlightTimes } from "@/lib/flight-time";
import type { DatePriceCheck } from "@/lib/trip-types";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type ConfirmDatesCardProps = {
  tripId: string;
  hostId: string;
  hostName: string;
  suggestions: DateSuggestion[];
  sharedDates: string[];
  confirmed: { startDate: string; endDate: string; confirmedByName: string } | null;
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

// Step between availability and options: the host reviews the suggested dates,
// can change them, and confirms. Only then can Muse plan options.
export function ConfirmDatesCard(props: ConfirmDatesCardProps) {
  const router = useRouter();
  const { browserReady, travelerId } = useTravelerIdentity(props.tripId);
  const isHost = browserReady && travelerId === props.hostId;
  const first = props.confirmed ?? props.suggestions[0] ?? null;
  const [startDate, setStartDate] = useState(first?.startDate ?? props.sharedDates[0] ?? "");
  const [endDate, setEndDate] = useState(first?.endDate ?? props.sharedDates[0] ?? "");
  const [busy, setBusy] = useState<"" | "confirm" | "fares">("");
  const [error, setError] = useState("");

  const selectedDays = startDate && endDate && startDate <= endDate ? getDatesInRange(startDate, endDate).length : 0;
  const minimumDays = props.flightTimes?.recommendedMinimumDays ?? 1;
  const selectedNotes = selectedDays > 0 ? [
    ...(selectedDays < minimumDays ? [`Only ${selectedDays} ${selectedDays === 1 ? "day" : "days"}: short for these flights (at least ${minimumDays} recommended).`] : []),
    ...describeTripDates(startDate, endDate).notes,
  ] : [];
  const shared = new Set(props.sharedDates);
  const endChoices = props.sharedDates.filter((date) => date >= startDate);
  const isConfirmed = props.confirmed?.startDate === startDate && props.confirmed?.endDate === endDate;

  function faresFor(start: string, end: string) {
    return props.priceCheck?.windows.find((window) => window.startDate === start && window.endDate === end)?.fares ?? null;
  }

  async function send(kind: "confirm" | "fares") {
    setBusy(kind);
    setError("");
    try {
      const windows = [{ startDate, endDate }, ...props.suggestions].filter((window, index, all) => all.findIndex((other) => other.startDate === window.startDate && other.endDate === window.endDate) === index).slice(0, 3);
      const response = kind === "confirm"
        ? await fetch(`/api/trips/${props.tripId}/dates`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostTravelerId: travelerId, startDate, endDate }) })
        : await fetch(`/api/trips/${props.tripId}/dates/prices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostTravelerId: travelerId, windows }) });
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
        {props.confirmed ? <span className="w-fit rounded-full bg-[#daf0ea] px-3 py-1 text-sm font-bold text-[#276655]">✓ Confirmed by {props.confirmed.confirmedByName}</span> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-[#66757d]">
        {props.confirmed
          ? `Muse will only plan options for ${rangeLabel(props.confirmed.startDate, props.confirmed.endDate)}.`
          : isHost
            ? "Pick the exact days before Muse plans options. These suggestions fit everyone's availability and dodge pricey travel days."
            : `Waiting for ${props.hostName} to confirm the exact dates. Here's what the app suggests.`}
      </p>

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

      {props.suggestions.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {props.suggestions.map((suggestion, index) => {
            const selected = suggestion.startDate === startDate && suggestion.endDate === endDate;
            return (
              <li key={suggestion.startDate}>
                <button
                  className={`w-full rounded-2xl border-2 p-4 text-left transition ${selected ? "border-[#173f50] bg-[#f3f8fa]" : "border-[#172733]/8 bg-white"} ${isHost ? "hover:border-[#173f50]/50" : "cursor-default"}`}
                  disabled={!isHost}
                  onClick={() => { setStartDate(suggestion.startDate); setEndDate(suggestion.endDate); }}
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
      ) : null}

      {isHost ? (
        <div className="mt-5 rounded-2xl bg-[#f7f7f3] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">Or Choose Your Own</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="form-label" htmlFor="trip-start">Leave</label>
              <select className="form-control" id="trip-start" onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); }} value={startDate}>
                {props.sharedDates.map((date) => <option key={date} value={date}>{formatCalendarDate(date, false)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="trip-end">Come Back</label>
              <select className="form-control" id="trip-end" onChange={(event) => setEndDate(event.target.value)} value={endDate}>
                {endChoices.map((date) => <option disabled={!shared.has(date)} key={date} value={date}>{formatCalendarDate(date, false)}</option>)}
              </select>
            </div>
          </div>
          {selectedNotes.length > 0 ? <p className="mt-3 text-sm leading-6 text-[#53666f]">{selectedNotes.join(" ")}</p> : null}
          {props.suggestions.some((suggestion) => suggestion.startDate === startDate && suggestion.endDate === endDate) ? null : renderFares(startDate, endDate)}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className="button-primary" disabled={busy !== "" || isConfirmed} onClick={() => send("confirm")} type="button">
              {busy === "confirm" ? "Confirming…" : isConfirmed ? "Dates Confirmed ✓" : props.confirmed ? "Change To These Dates" : "Confirm These Dates"}
            </button>
            {props.destination && props.faresConfigured ? (
              <button className="button-secondary" disabled={busy !== ""} onClick={() => send("fares")} type="button">
                {busy === "fares" ? "Checking fares…" : "Check Real Flight Prices"}
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#879196]">
            {props.destination
              ? props.faresConfigured ? `Real fares compare round trips to ${props.destination} from each traveler's city (up to 3 date choices).` : "Real fare checks need a SerpApi key on the server."
              : "Real fare checks need a destination. Holiday and day-of-week hints work without one."}
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm font-semibold text-[#a34532]" role="alert">{error}</p> : null}
    </section>
  );
}
