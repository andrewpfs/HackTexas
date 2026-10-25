import { Avatar } from "../../components/avatar";
import type { PlanningReadiness } from "@/lib/planning-context";
import type { Trip } from "@/lib/trip-types";
import { formatCalendarDate, type DateWindow } from "@/lib/date-utils";
import { GenerateCandidatesAction } from "./generate-candidates-action";
import { ReadinessNotes } from "./readiness-notes";

type CrewCardProps = {
  trip: Trip;
  readiness: PlanningReadiness;
  longestSharedWindow: DateWindow | null;
  candidatesAvailable: boolean;
  itineraryReady: boolean;
  votedCount: number;
};

function formatWindow(window: DateWindow) {
  return window.startDate === window.endDate
    ? formatCalendarDate(window.startDate)
    : `${formatCalendarDate(window.startDate, false)} – ${formatCalendarDate(window.endDate)}`;
}

function Check({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${done ? "bg-[#daf0ea] text-[#276655]" : "bg-[#fbe4d9] text-[#a34532]"}`}>
      <span aria-hidden="true">{done ? "✓" : "•"}</span>
      {label}
    </span>
  );
}

// The crew and the planning readiness in one card, pinned beside the page as you scroll.
export function CrewCard({ trip, readiness, longestSharedWindow, candidatesAvailable, itineraryReady, votedCount }: CrewCardProps) {
  const ready = readiness.readyForCandidateGeneration;
  const statusText = itineraryReady
    ? "The shared itinerary is ready."
    : candidatesAvailable
      ? `Options are ready. ${votedCount} of ${trip.travelers.length} have voted.`
      : ready
        ? "Ready for trip suggestions. Everyone who joined has finished."
        : "Still getting ready. The group needs everyone's details first.";
  const good = ready || candidatesAvailable || itineraryReady;

  return (
    <aside className="overflow-hidden rounded-3xl border border-[#172733]/8 bg-white shadow-[0_14px_38px_rgba(23,63,80,0.09)] lg:sticky lg:top-24" aria-labelledby="crew-heading">
      <div className="p-6 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">The Crew</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight" id="crew-heading">Who&apos;s Going</h2>
          </div>
          <p className="text-sm font-bold text-[#52766c]">{trip.travelers.length} traveler(s) joined</p>
        </div>
        <p className={`mt-4 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold ${good ? "bg-[#daf0ea] text-[#276655]" : "bg-[#fbe4d9] text-[#a34532]"}`} role="status">
          <svg aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
            {good ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
          </svg>
          {statusText}
        </p>
      </div>

      <ul className="divide-y divide-[#172733]/8 px-3">
        {trip.travelers.map((traveler) => (
          <li className="flex items-center gap-3.5 px-3 py-3.5" key={traveler.id}>
            <span className="shrink-0"><Avatar label={`${traveler.name}'s avatar`} seed={traveler.id} size={52} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {traveler.name}
                {traveler.isHost ? <span className="ml-2 rounded-full bg-[#f3c969] px-2 py-0.5 align-[1px] text-[0.65rem] font-extrabold uppercase tracking-wider text-[#173f50]">Host</span> : null}
              </p>
              <p className="truncate text-xs text-[#718087]">Departing from {traveler.departureLocation || (traveler.isHost ? trip.origin : "Not added yet")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Check done={traveler.preferencesComplete} label="Preferences" />
                <Check done={traveler.availabilityComplete === true} label="Availability" />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t border-[#172733]/8 p-6 pt-5">
        <div className="flex justify-between gap-4 text-sm"><span className="text-[#718087]">Preferences</span><b>{readiness.preferencesCompleteCount} of {trip.travelers.length}</b></div>
        <div className="flex justify-between gap-4 text-sm"><span className="text-[#718087]">Availability</span><b>{readiness.availabilityCompleteCount} of {trip.travelers.length}</b></div>
        <div className="flex justify-between gap-4 text-sm"><span className="text-[#718087]">Shared window</span><b>{longestSharedWindow ? formatWindow(longestSharedWindow) : "None yet"}</b></div>
        <ReadinessNotes
          blockers={readiness.blockers}
          travelers={trip.travelers.map((traveler) => ({ id: traveler.id, name: traveler.name }))}
          tripId={trip.id}
          warnings={readiness.warnings}
        />
        <div className="pt-1">
          <GenerateCandidatesAction candidatesAvailable={candidatesAvailable} itineraryReady={itineraryReady} ready={ready} tripId={trip.id} />
        </div>
      </div>
    </aside>
  );
}
