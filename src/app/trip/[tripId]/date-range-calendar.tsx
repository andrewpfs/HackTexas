"use client";

import { useEffect, useRef, useState } from "react";
import { formatCalendarDate, getCalendarMonths } from "@/lib/date-utils";
import { useToday } from "@/lib/use-today";

type CalendarTraveler = { name: string; availableDates: string[] };

type DateRangeCalendarProps = {
  // The months shown first: the trip's planning window.
  earliestPossibleDate: string;
  latestPossibleDate: string;
  travelers: CalendarTraveler[];
  startDate: string;
  endDate: string;
  readOnly?: boolean;
  onChange?: (startDate: string, endDate: string) => void;
};

const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

function monthStart(date: string, offset: number) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + offset;
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

function monthEnd(date: string, offset: number) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) + offset;
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

// The host's date picker. Click a start day then an end day, or drag across days.
// Shading shows how many travelers are free; any day can still be picked.
export function DateRangeCalendar({ earliestPossibleDate, latestPossibleDate, travelers, startDate, endDate, readOnly = false, onChange }: DateRangeCalendarProps) {
  const today = useToday();
  const [monthOffset, setMonthOffset] = useState(0);
  // Set after a single click: the next click finishes the range.
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const drag = useRef<{ anchor: string; moved: boolean } | null>(null);

  const windowMonths = getCalendarMonths(earliestPossibleDate, latestPossibleDate).length;
  const shownMonths = Math.min(2, Math.max(1, windowMonths));
  const months = getCalendarMonths(monthStart(earliestPossibleDate, monthOffset), monthEnd(earliestPossibleDate, monthOffset + shownMonths - 1));
  const total = travelers.length;

  useEffect(() => {
    function endDrag() {
      const current = drag.current;
      drag.current = null;
      if (!current) return;
      // A click without dragging waits for a second click to set the end day.
      setPendingStart(current.moved ? null : current.anchor);
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  function select(first: string, second: string) {
    onChange?.(first < second ? first : second, first < second ? second : first);
  }

  function isSelectable(date: string) {
    return !readOnly && (!today || date >= today);
  }

  function pickDay(date: string) {
    if (pendingStart && pendingStart !== date) {
      select(pendingStart, date);
      setPendingStart(null);
      return true;
    }
    return false;
  }

  function handlePointerDown(date: string, event: React.PointerEvent<HTMLButtonElement>) {
    if (!isSelectable(date) || event.button !== 0) return;
    event.preventDefault();
    if (pickDay(date)) return;
    drag.current = { anchor: date, moved: false };
    select(date, date);
  }

  // Mouse and pen drag across days. Touch uses tap, then tap, so the page can still scroll.
  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || event.pointerType === "touch") return;
    const target = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-date]");
    const date = target?.dataset.date;
    if (!date || !isSelectable(date)) return;
    if (date !== current.anchor) current.moved = true;
    select(current.anchor, date);
  }

  // Keyboard (Enter/Space) clicks have no pointer events.
  function handleKeyboardClick(date: string, event: React.MouseEvent<HTMLButtonElement>) {
    if (event.detail !== 0 || !isSelectable(date)) return;
    if (pickDay(date)) return;
    select(date, date);
    setPendingStart(date);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button aria-label="Earlier months" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#173f50]/15 text-[#173f50] transition hover:bg-[#f3f8fa] disabled:opacity-30" onClick={() => setMonthOffset((value) => value - 1)} type="button">‹</button>
        <p className="text-center text-xs font-semibold text-[#718087]" aria-live="polite">
          {readOnly ? "The dates the host set" : pendingStart ? `Now pick the last day (started ${formatCalendarDate(pendingStart, false)})` : "Click a start day, then an end day, or drag across days"}
        </p>
        <button aria-label="Later months" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#173f50]/15 text-[#173f50] transition hover:bg-[#f3f8fa]" onClick={() => setMonthOffset((value) => value + 1)} type="button">›</button>
      </div>
      <div className={`grid select-none gap-6 ${months.length > 1 ? "lg:grid-cols-2" : ""}`} onPointerMove={handlePointerMove}>
        {months.map((month) => (
          <div key={month.key}>
            <h3 className="text-center text-sm font-bold text-[#173f50]">{month.label}</h3>
            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[0.7rem] font-bold uppercase tracking-wider text-[#879196]">
              {dayLabels.map((label, index) => <span key={index}>{label}</span>)}
              {Array.from({ length: month.leadingBlankDays }).map((_, index) => <span aria-hidden="true" key={`blank-${index}`} />)}
              {month.dates.map((date) => {
                const free = travelers.filter((traveler) => traveler.availableDates.includes(date));
                const share = total > 0 ? free.length / total : 0;
                const selected = startDate !== "" && date >= startDate && date <= endDate;
                const isEdge = date === startDate || date === endDate;
                const past = Boolean(today && date < today);
                const inWindow = date >= earliestPossibleDate && date <= latestPossibleDate;
                const background = selected
                  ? isEdge ? "#173f50" : "#2f5f73"
                  : free.length === 0 ? (inWindow ? "#eef0ec" : "#f7f7f3") : `rgba(31, 138, 98, ${(0.18 + 0.6 * share).toFixed(2)})`;
                return (
                  <button
                    aria-label={`${formatCalendarDate(date)}: ${free.length} of ${total} free${selected ? ", selected" : ""}`}
                    aria-pressed={selected}
                    className={`relative flex h-10 items-center justify-center rounded-lg text-sm font-bold transition ${selected || share > 0.55 ? "text-white" : "text-[#3b505a]"} ${past ? "cursor-not-allowed opacity-35" : readOnly ? "cursor-default" : "cursor-pointer hover:ring-2 hover:ring-[#173f50]/40"} ${pendingStart === date ? "ring-2 ring-[#e4664f]" : ""}`}
                    data-date={date}
                    disabled={past}
                    key={date}
                    onClick={(event) => handleKeyboardClick(date, event)}
                    onPointerDown={(event) => handlePointerDown(date, event)}
                    style={{ backgroundColor: background }}
                    title={free.length === total ? "Everyone is free" : free.length === 0 ? "No one marked this day" : `Free: ${free.map((traveler) => traveler.name).join(", ")}`}
                    type="button"
                  >
                    {Number(date.slice(8, 10))}
                    {selected && free.length < total ? <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#f3a08f]" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#718087]">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: "rgba(31, 138, 98, 0.78)" }} />Everyone free</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: "rgba(31, 138, 98, 0.35)" }} />Some free</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#173f50]" />Trip dates</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#f3a08f]" />Not everyone free</span>
      </p>
    </div>
  );
}
