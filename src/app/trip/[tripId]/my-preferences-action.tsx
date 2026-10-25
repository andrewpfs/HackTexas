"use client";

import Link from "next/link";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type TravelerSummary = {
  id: string;
  preferencesComplete: boolean;
  availabilityComplete: boolean;
};

type MyPreferencesActionProps = {
  tripId: string;
  travelers: TravelerSummary[];
};

export function MyPreferencesAction({ tripId, travelers }: MyPreferencesActionProps) {
  const { travelerId } = useTravelerIdentity(tripId);
  let currentTraveler: TravelerSummary | null = null;

  for (const traveler of travelers) {
    if (traveler.id === travelerId) {
      currentTraveler = traveler;
      break;
    }
  }

  if (!currentTraveler) {
    return null;
  }

  const label = currentTraveler.preferencesComplete
    ? "Edit My Preferences"
    : "Complete My Preferences";
  const availabilityLabel = currentTraveler.availabilityComplete
    ? "Edit My Availability"
    : "Set My Availability";

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link className="button-primary w-full sm:w-auto" href={`/trip/${tripId}/preferences`}>
        {label} <span aria-hidden="true">→</span>
      </Link>
      <Link className="button-secondary w-full sm:w-auto" href={`/trip/${tripId}/availability`}>
        {availabilityLabel} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
