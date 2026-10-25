import { formatCalendarDate, getCalendarMonths } from "@/lib/date-utils";

type HeatmapTraveler = { name: string; availabilityComplete: boolean; availableDates: string[] };

type AvailabilityHeatmapProps = {
  earliestPossibleDate: string;
  latestPossibleDate: string;
  travelers: HeatmapTraveler[];
};

const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

// The shade says how many travelers are free: the darker the green, the more people.
// Hover (or focus) a day to see exactly who.
export function AvailabilityHeatmap({ earliestPossibleDate, latestPossibleDate, travelers }: AvailabilityHeatmapProps) {
  const months = getCalendarMonths(earliestPossibleDate, latestPossibleDate);
  const total = travelers.length;

  return (
    <div className={`grid gap-8 ${months.length > 1 ? "lg:grid-cols-2" : ""}`}>
      {months.map((month) => (
        <div key={month.key}>
          <h3 className="text-center text-sm font-bold text-[#173f50]">{month.label}</h3>
          <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[0.7rem] font-bold uppercase tracking-wider text-[#879196]">
            {dayLabels.map((label, index) => <span key={index}>{label}</span>)}
            {Array.from({ length: month.leadingBlankDays }).map((_, index) => <span aria-hidden="true" key={`blank-${index}`} />)}
            {month.dates.map((date, dateIndex) => {
              const inWindow = date >= earliestPossibleDate && date <= latestPossibleDate;
              const free = travelers.filter((traveler) => traveler.availabilityComplete && traveler.availableDates.includes(date));
              const waiting = travelers.filter((traveler) => !traveler.availabilityComplete);
              const share = total > 0 ? free.length / total : 0;
              const dark = share > 0.55;
              const column = (month.leadingBlankDays + dateIndex) % 7;

              if (!inWindow) {
                return <span aria-hidden="true" className="h-12 rounded-xl border border-dashed border-[#172733]/10" key={date} />;
              }

              return (
                <div className="group relative h-12" key={date}>
                  <button
                    aria-label={`${formatCalendarDate(date)}: ${free.length} of ${total} available`}
                    className={`flex h-full w-full items-center justify-center rounded-xl text-sm font-bold transition hover:ring-2 hover:ring-[#173f50]/40 focus-visible:ring-2 focus-visible:ring-[#173f50] ${dark ? "text-white" : "text-[#3b505a]"}`}
                    style={{ backgroundColor: free.length === 0 ? "#eef0ec" : `rgba(31, 138, 98, ${(0.22 + 0.78 * share).toFixed(2)})` }}
                    type="button"
                  >
                    {Number(date.slice(8, 10))}
                  </button>
                  <div
                    className={`pointer-events-none absolute bottom-full z-30 mb-2 hidden w-48 rounded-2xl normal-case tracking-normal bg-[#173f50] p-3 text-left text-xs font-normal leading-5 text-white shadow-xl group-focus-within:block group-hover:block ${column >= 5 ? "right-0" : column <= 1 ? "left-0" : "left-1/2 -translate-x-1/2"}`}
                    role="tooltip"
                  >
                    <p className="font-bold text-[#f3c969]">{formatCalendarDate(date)}</p>
                    {free.length > 0 ? (
                      <p className="mt-1">{free.length === total ? "Everyone is free: " : "Free: "}{free.map((traveler) => traveler.name).join(", ")}</p>
                    ) : (
                      <p className="mt-1 text-white/70">{waiting.length === total ? "No one has submitted dates yet." : "No one is free."}</p>
                    )}
                    {waiting.length > 0 && free.length > 0 ? <p className="mt-1 text-white/60">Not submitted: {waiting.map((traveler) => traveler.name).join(", ")}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
