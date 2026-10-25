"use client";

import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type Issue = { code: string; message: string; travelerName?: string };

type ReadinessNotesProps = {
  tripId: string;
  blockers: Issue[];
  warnings: Issue[];
  travelers: { id: string; name: string }[];
};

const missingLabels: Record<string, string> = {
  preferences_incomplete: "Preferences",
  availability_incomplete: "Availability",
  departure_location_missing: "Departure city",
};

function InfoIcon() {
  return (
    <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

// What the group is waiting on. The traveler's own items are left out because
// they already have their own to-do card.
export function ReadinessNotes({ tripId, blockers, warnings, travelers }: ReadinessNotesProps) {
  const { travelerId } = useTravelerIdentity(tripId);
  const myName = travelers.find((traveler) => traveler.id === travelerId)?.name;

  const waitingOn = new Map<string, string[]>();
  const groupBlockers: Issue[] = [];
  for (const blocker of blockers) {
    if (blocker.travelerName && missingLabels[blocker.code]) {
      if (blocker.travelerName === myName) continue;
      waitingOn.set(blocker.travelerName, [...(waitingOn.get(blocker.travelerName) ?? []), missingLabels[blocker.code]]);
    } else {
      groupBlockers.push(blocker);
    }
  }

  return (
    <>
      {waitingOn.size > 0 || groupBlockers.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-[#172733]/8 bg-[#f7f7f3] p-4">
          {waitingOn.size > 0 ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">Waiting On</p>
              <ul className="mt-3 flex flex-wrap gap-3">
                {[...waitingOn.entries()].map(([name, missing]) => (
                  <li className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm" key={name}>
                    <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#173f50] text-sm font-bold text-white">{name.charAt(0).toUpperCase()}</span>
                    <span>
                      <span className="block text-sm font-bold text-[#173f50]">{name}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {missing.map((label) => <span className="rounded-full bg-[#fbe4d9] px-2 py-0.5 text-xs font-bold text-[#a34532]" key={label}>{label}</span>)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {groupBlockers.map((blocker) => (
            <p className="mt-3 flex gap-2 rounded-xl bg-[#fbe4d9] p-3 text-sm font-semibold text-[#a34532]" key={blocker.code}>
              <InfoIcon />
              <span>{blocker.message}{blocker.code === "no_shared_dates" ? " Edit availability before generating trip options." : blocker.code === "dates_not_confirmed" ? " See Confirm The Trip Dates." : ""}</span>
            </p>
          ))}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {warnings.map((warning) => (
            <li className="flex gap-2 rounded-xl bg-[#f7f7f3] px-4 py-3 text-sm text-[#53666f]" key={warning.code}>
              <InfoIcon />
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
