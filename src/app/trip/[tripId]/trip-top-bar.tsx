"use client";

import Link from "next/link";
import { CopyInviteLink } from "./copy-invite-link";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type TravelerSummary = {
  id: string;
  isHost: boolean;
  departureLocation: string;
  preferencesComplete: boolean;
  availabilityComplete: boolean;
};

// One slim row above the ticket: the way back, plus the viewer's own next step or host controls.
export function TripTopBar({ tripId, joinPath, travelers }: { tripId: string; joinPath: string; travelers: TravelerSummary[] }) {
  const { travelerId } = useTravelerIdentity(tripId);
  const me = travelers.find((traveler) => traveler.id === travelerId);
  const needsStep = me ? !me.preferencesComplete || !me.availabilityComplete : false;
  const nextHref = me?.preferencesComplete ? `/trip/${tripId}/availability` : `/trip/${tripId}/preferences`;
  const pill = "rounded-full border border-[#172733]/12 bg-white px-4 py-2 text-sm font-bold text-[#173f50] transition hover:-translate-y-0.5 hover:shadow-md";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href="/">← All trips</Link>

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {me && needsStep ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#e4664f] bg-[#fff4ef] py-1.5 pl-4 pr-1.5 shadow-[0_8px_22px_rgba(228,102,79,0.16)]">
            <span className="text-sm font-bold text-[#173f50]">
              {me.preferencesComplete ? "Set your availability" : "Complete your preferences and availability"}
            </span>
            <Link className="rounded-full bg-[#e4664f] px-4 py-2 text-sm font-bold text-white" href={nextHref}>
              {me.preferencesComplete ? "Set My Availability" : "Complete My Preferences"} →
            </Link>
          </div>
        ) : null}

        {me?.isHost ? (
          <>
            <Link className="rounded-full bg-[#173f50] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-md" href={`/trip/${tripId}/edit`}>Edit Trip Details</Link>
            <CopyInviteLink className={pill} joinPath={joinPath} />
          </>
        ) : null}

        {me && !needsStep ? (
          <>
            <Link className={pill} href={`/trip/${tripId}/preferences`}>My Preferences</Link>
            <Link className={pill} href={`/trip/${tripId}/availability`}>My Availability</Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
