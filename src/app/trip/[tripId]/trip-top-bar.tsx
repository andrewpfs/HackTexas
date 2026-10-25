"use client";

import Link from "next/link";
import { CopyInviteLink } from "./copy-invite-link";
import { SaveWithPhone } from "./save-with-phone";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type TravelerSummary = {
  id: string;
  isHost: boolean;
  departureLocation: string;
  preferencesComplete: boolean;
  availabilityComplete: boolean;
  phoneLast4?: string;
};

// One slim row above the ticket: the way back, plus the viewer's own next step or host controls.
export function TripTopBar({ tripId, joinPath, travelers }: { tripId: string; joinPath: string; travelers: TravelerSummary[] }) {
  const { travelerId } = useTravelerIdentity(tripId);
  const me = travelers.find((traveler) => traveler.id === travelerId);
  const needsStep = me ? !me.preferencesComplete || !me.availabilityComplete : false;
  const nextHref = me?.preferencesComplete ? `/trip/${tripId}/availability` : `/trip/${tripId}/preferences`;
  const pill = "rounded-full border border-[#172733]/12 bg-white px-5 py-2.5 text-sm font-bold text-[#173f50] transition hover:-translate-y-0.5 hover:shadow-md";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href="/">← All trips</Link>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {me ? <SaveWithPhone savedLast4={me.phoneLast4} travelerId={me.id} tripId={tripId} /> : null}
          {me?.isHost ? (
            <>
              <Link className="rounded-full bg-[#173f50] px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-md" href={`/trip/${tripId}/edit`}>Edit Trip Details</Link>
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

      {me && needsStep ? (
        <div className="flex flex-col gap-4 rounded-3xl border-2 border-[#e4664f] bg-[#fff4ef] p-5 shadow-[0_10px_28px_rgba(228,102,79,0.14)] sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="text-lg font-bold text-[#173f50]">
              {me.preferencesComplete ? "Set Your Availability" : "Complete Your Preferences And Availability"}
            </p>
            <p className="mt-1 text-sm text-[#718087]">The group can&apos;t see trip options until everyone has finished. It takes about two minutes.</p>
          </div>
          <Link className="button-primary shrink-0" href={nextHref}>
            {me.preferencesComplete ? "Set My Availability" : "Complete My Preferences"} <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
