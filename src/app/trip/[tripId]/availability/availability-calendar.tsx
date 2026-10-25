"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatCalendarDate,
  getCalendarMonths,
  getDatesInRange,
} from "@/lib/date-utils";
import { useToday } from "@/lib/use-today";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type AvailabilityCalendarProps = {
  tripId: string;
  inviteCode: string;
  earliestPossibleDate: string;
  latestPossibleDate: string;
  preferredDurationDays?: number;
};

type AvailabilityResponse = {
  error?: string;
  errors?: string[];
  traveler?: {
    id: string;
    name: string;
    availabilityComplete: boolean;
    availableDates: string[];
    preferredDurationDays?: number;
  };
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AvailabilityCalendar({
  tripId,
  inviteCode,
  earliestPossibleDate,
  latestPossibleDate,
  preferredDurationDays,
}: AvailabilityCalendarProps) {
  const router = useRouter();
  const { browserReady, travelerId } = useTravelerIdentity(tripId);
  const [travelerName, setTravelerName] = useState("");
  const [travelerDuration, setTravelerDuration] = useState<number | undefined>();
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storedTravelerMissing, setStoredTravelerMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const drag = useRef<{ selecting: boolean; visited: Set<string> } | null>(null);
  const suppressClick = useRef(false);
  const today = useToday();
  const months = getCalendarMonths(earliestPossibleDate, latestPossibleDate);
  // Days that have already passed cannot be chosen.
  const allSelectableDates = getDatesInRange(earliestPossibleDate, latestPossibleDate).filter((date) => !today || date >= today);

  useEffect(() => {
    function endDrag() { drag.current = null; }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", endDrag);
    };
  }, []);

  function paintDate(date: string) {
    const currentDrag = drag.current;
    if (!currentDrag || currentDrag.visited.has(date) || !allSelectableDates.includes(date)) return;
    currentDrag.visited.add(date);
    setSelectedDates((previous) => {
      if (currentDrag.selecting) {
        if (previous.includes(date)) return previous;
        return [...previous, date].sort();
      }
      return previous.filter((item) => item !== date);
    });
    setSaveErrors([]);
  }

  useEffect(() => {
    if (!travelerId) {
      return;
    }

    async function loadAvailability() {
      try {
        const response = await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(travelerId as string)}/availability`,
        );
        const responseData = (await response.json()) as AvailabilityResponse;

        if (!response.ok || !responseData.traveler) {
          if (response.status === 404) {
            setStoredTravelerMissing(true);
          } else {
            setLoadError(responseData.error || "We could not load your availability. Please try again.");
          }
          return;
        }

        setTravelerName(responseData.traveler.name);
        setTravelerDuration(responseData.traveler.preferredDurationDays);
        setSelectedDates(responseData.traveler.availableDates);
      } catch {
        setLoadError("We could not load your availability. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadAvailability();
  }, [travelerId, tripId]);

  function toggleDate(date: string) {
    const nextDates = [...selectedDates];
    const dateIndex = nextDates.indexOf(date);

    if (dateIndex >= 0) {
      nextDates.splice(dateIndex, 1);
    } else {
      nextDates.push(date);
      nextDates.sort();
    }

    setSelectedDates(nextDates);
    setSaveErrors([]);
  }

  async function saveAvailability() {
    if (isSaving || !travelerId) {
      return;
    }

    if (selectedDates.length === 0) {
      setSaveErrors(["Select at least one available date."]);
      return;
    }

    setIsSaving(true);
    setSaveErrors([]);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(travelerId)}/availability`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ availableDates: selectedDates }),
        },
      );
      const responseData = (await response.json()) as AvailabilityResponse;

      if (!response.ok || !responseData.traveler) {
        setSaveErrors(responseData.errors || [responseData.error || "We could not save your availability. Please try again."]);
        return;
      }

      router.push(`/trip/${tripId}`);
      router.refresh();
    } catch {
      setSaveErrors(["We could not save your availability. Please try again."]);
    } finally {
      setIsSaving(false);
    }
  }

  if (!browserReady || (travelerId && isLoading)) {
    return (
      <div className="mt-8 rounded-3xl border border-[#172733]/8 bg-white p-7 sm:p-9">
        <p className="font-semibold text-[#607179]">Loading your availability...</p>
      </div>
    );
  }

  if (!travelerId || storedTravelerMissing) {
    return (
      <section className="mt-8 rounded-3xl border border-[#172733]/8 bg-white p-7 sm:p-9" aria-labelledby="identity-title">
        <p className="eyebrow">Browser Traveler Identity</p>
        <h2 className="mt-3 text-2xl font-bold" id="identity-title">This Browser Isn&apos;t Associated With A Traveler On This Trip Yet.</h2>
        <p className="mt-3 max-w-2xl leading-7 text-[#66757d]">
          Open the invite and join the trip in this browser to save availability for your traveler.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link className="button-primary" href={`/join?trip=${inviteCode}`}>Open invite</Link>
          <Link className="button-secondary" href={`/trip/${tripId}`}>Back to trip</Link>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="mt-8 rounded-3xl border border-[#172733]/8 bg-white p-7 sm:p-9">
        <p className="rounded-2xl bg-[#fff0ec] p-4 font-semibold text-[#a34532]" role="alert">{loadError}</p>
        <Link className="button-secondary mt-6" href={`/trip/${tripId}`}>Back to trip</Link>
      </section>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">{travelerName}&apos;s calendar</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Choose All Dates That Work</h2>
            <p className="mt-2 text-sm text-[#718087]">Click or drag to add or remove dates. On a phone, tap each date.</p>
            <p className="mt-2 text-sm leading-6 text-[#718087]">
              Selected {selectedDates.length} of {allSelectableDates.length} possible dates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary min-h-11 px-4 py-2 text-sm" onClick={() => setSelectedDates([...allSelectableDates])} type="button">I&apos;m Free for All Dates</button>
            <button className="button-secondary min-h-11 px-4 py-2 text-sm" onClick={() => setSelectedDates([])} type="button">Clear Dates</button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-[#f7f7f3] p-4 text-sm leading-6 text-[#53666f]">
          <p><strong>Host&apos;s planning window:</strong> {formatCalendarDate(earliestPossibleDate)} – {formatCalendarDate(latestPossibleDate)}</p>
          {preferredDurationDays ? <p><strong>Group&apos;s approximate trip length:</strong> {preferredDurationDays} days</p> : null}
          {travelerDuration ? <p><strong>Your preferred trip length:</strong> {travelerDuration} days</p> : null}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Availability calendars">
        {months.map((month) => (
          <div className="rounded-3xl border border-[#172733]/8 bg-white p-4 sm:p-6" key={month.key}>
            <h3 className="text-center text-lg font-bold">{month.label}</h3>
            <div className="mt-5 grid grid-cols-7 gap-1 text-center">
              {dayLabels.map((dayLabel) => (
                <div className="py-1 text-[0.68rem] font-bold uppercase tracking-wide text-[#879196]" key={dayLabel}>{dayLabel}</div>
              ))}
              {Array.from({ length: month.leadingBlankDays }).map((_, index) => (
                <div aria-hidden="true" key={`blank-${index}`} />
              ))}
              {month.dates.map((date) => {
                const selectable = date >= earliestPossibleDate && date <= latestPossibleDate && (!today || date >= today);
                const selected = selectedDates.includes(date);
                const dayNumber = Number(date.slice(8, 10));

                return (
                  <button
                    aria-label={`${formatCalendarDate(date)}${selected ? ", available" : ""}`}
                    aria-pressed={selectable ? selected : undefined}
                    className={`aspect-square min-w-0 rounded-xl text-sm font-bold transition sm:text-base ${
                      selected
                        ? "bg-[#173f50] text-white shadow-sm"
                        : selectable
                          ? "bg-[#f7f7f3] text-[#334a55] hover:bg-[#fbe4d9] hover:text-[#9e4837]"
                          : "cursor-not-allowed bg-transparent text-[#c1c7c7]"
                    }`}
                    disabled={!selectable}
                    key={date}
                    onPointerDown={(event) => {
                      suppressClick.current = false;
                      if (event.pointerType === "touch" || event.button !== 0) return;
                      event.preventDefault();
                      event.currentTarget.focus();
                      suppressClick.current = true;
                      drag.current = { selecting: !selectedDates.includes(date), visited: new Set() };
                      paintDate(date);
                    }}
                    onPointerEnter={(event) => {
                      if (event.buttons === 1) paintDate(date);
                    }}
                    onClick={(event) => {
                      if (event.detail === 0 || !suppressClick.current) toggleDate(date);
                      suppressClick.current = false;
                    }}
                    type="button"
                  >
                    {dayNumber}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-[#173f50] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#f3c969]">Your selection</p>
        <p className="mt-2 text-lg font-bold">{selectedDates.length} available {selectedDates.length === 1 ? "date" : "dates"} selected</p>
        <p className="mt-2 text-sm leading-6 text-white/65">Saving replaces your previous availability and updates the group overlap.</p>

        {saveErrors.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#a34532]" role="alert">
            <ul className="list-disc space-y-1 pl-5">
              {saveErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button className="button-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={saveAvailability} type="button">
            {isSaving ? "Saving availability..." : "Save My Availability"}
          </button>
          <Link className="text-center text-sm font-bold text-white/75 hover:text-white" href={`/trip/${tripId}`}>Cancel</Link>
        </div>
      </section>
    </div>
  );
}
