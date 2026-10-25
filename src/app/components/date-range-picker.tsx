"use client";

import { useState, useSyncExternalStore } from "react";

type DateRangePickerProps = {
  startName: string;
  endName: string;
  initialStart?: string;
  initialEnd?: string;
};

const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shortFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function toISO(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return shortFormatter.format(new Date(`${value}T00:00:00Z`));
}

function MonthGrid(props: {
  year: number;
  monthIndex: number;
  start: string;
  end: string;
  hover: string;
  minDate: string;
  onPick: (date: string) => void;
  onHover: (date: string) => void;
}) {
  const { year, monthIndex, start, end, hover, minDate } = props;
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  // While choosing the end date, preview the range up to the hovered day.
  const rangeEnd = end || (start && hover > start ? hover : "");
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => index + 1),
  ];

  return (
    <div>
      <p className="text-center text-sm font-bold text-[#173f50]">
        {monthFormatter.format(new Date(Date.UTC(year, monthIndex, 1)))}
      </p>
      <div className="mt-3 grid grid-cols-7 text-center text-xs font-bold text-[#879196]">
        {dayLabels.map((label, index) => <span key={index}>{label}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7">
        {cells.map((day, index) => {
          if (day === null) {
            return <span key={`blank-${index}`} />;
          }

          const date = toISO(year, monthIndex, day);
          const isPast = minDate !== "" && date < minDate;
          const isStart = date === start;
          const isEnd = date === end;
          const inRange = start !== "" && rangeEnd !== "" && date > start && date < rangeEnd;
          const isPreviewEnd = !end && rangeEnd === date && date !== start;
          const hasBand = start !== "" && rangeEnd !== "" && (isStart || isEnd || isPreviewEnd || inRange);

          return (
            <span
              className={`flex h-10 items-center justify-center ${hasBand ? "bg-[#fbe4d9]" : ""} ${isStart && rangeEnd ? "rounded-l-full" : ""} ${(isEnd || isPreviewEnd) ? "rounded-r-full" : ""}`}
              key={date}
            >
              <button
                aria-label={formatDate(date)}
                aria-pressed={isStart || isEnd}
                disabled={isPast}
                title={isPast ? "This date has already passed" : undefined}
                className={`h-9 w-9 rounded-full text-sm font-semibold transition ${isPast ? "cursor-not-allowed text-[#c3c9cb] line-through" : ""} ${isStart || isEnd ? "bg-[#e4664f] text-white" : isPreviewEnd ? "bg-[#f1a690] text-white" : "text-[#273b46] hover:bg-[#f2c968]/50"}`}
                onClick={() => props.onPick(date)}
                onMouseEnter={() => !isPast && props.onHover(date)}
                type="button"
              >
                {day}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function subscribeToNothing() {
  return () => {};
}

// Today's date is only known in the browser; the server render has none.
function getToday() {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth(), now.getDate());
}

function getServerToday() {
  return null;
}

// One calendar for a whole date range: tap the first day, then the last day.
export function DateRangePicker({ startName, endName, initialStart = "", initialEnd = "" }: DateRangePickerProps) {
  const today = useSyncExternalStore(subscribeToNothing, getToday, getServerToday);
  const [monthOffset, setMonthOffset] = useState(0);
  const baseDate = initialStart || today;
  const base = baseDate ? new Date(`${baseDate}T00:00:00Z`) : null;
  const visibleMonth = base
    ? (() => {
        const shown = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset, 1));
        return { year: shown.getUTCFullYear(), monthIndex: shown.getUTCMonth() };
      })()
    : null;
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [hover, setHover] = useState("");

  function pick(date: string) {
    if (!start || end) {
      setStart(date);
      setEnd("");
      return;
    }

    if (date < start) {
      setStart(date);
      return;
    }

    setEnd(date);
  }

  const minDate = today ?? "";
  const todayMonthStart = today ? new Date(`${today.slice(0, 8)}01T00:00:00Z`).getTime() : 0;
  const canGoBack = visibleMonth
    ? Date.UTC(visibleMonth.year, visibleMonth.monthIndex, 1) > todayMonthStart
    : false;

  function moveMonth(offset: number) {
    setMonthOffset((current) => current + offset);
  }

  const month = visibleMonth ?? { year: 2000, monthIndex: 0 };
  const second = new Date(Date.UTC(month.year, month.monthIndex + 1, 1));
  const dayTotal = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1 : 0;

  return (
    <div>
      <input name={startName} type="hidden" value={start} />
      <input name={endName} type="hidden" value={end} />

      <div className="flex items-center justify-between gap-3">
        <button aria-label="Previous month" className={`button-secondary !min-h-10 !px-4 ${canGoBack ? "" : "cursor-not-allowed opacity-40"}`} disabled={!canGoBack} onClick={() => moveMonth(-1)} type="button">←</button>
        <p className="text-center text-sm font-bold text-[#53666f]" role="status">
          {start && end
            ? `${formatDate(start)} → ${formatDate(end)} · ${dayTotal} ${dayTotal === 1 ? "day" : "days"}`
            : start
              ? `Starts ${formatDate(start)}. Now pick the last day.`
              : "Tap the first day, then the last day."}
        </p>
        <button aria-label="Next month" className="button-secondary !min-h-10 !px-4" onClick={() => moveMonth(1)} type="button">→</button>
      </div>

      {visibleMonth ? (
        <div className="mt-5 grid gap-8 sm:grid-cols-2" onMouseLeave={() => setHover("")}>
          <MonthGrid {...visibleMonth} end={end} hover={hover} minDate={minDate} onHover={setHover} onPick={pick} start={start} />
          <div className="hidden sm:block">
            <MonthGrid year={second.getUTCFullYear()} monthIndex={second.getUTCMonth()} end={end} hover={hover} minDate={minDate} onHover={setHover} onPick={pick} start={start} />
          </div>
        </div>
      ) : (
        <div className="mt-5 h-72" aria-hidden="true" />
      )}
    </div>
  );
}
