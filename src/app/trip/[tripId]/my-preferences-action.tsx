"use client";

import Link from "next/link";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type TravelerSummary = {
  id: string;
  preferencesComplete: boolean;
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

  return (
    <Link className="button-primary mt-6 w-full sm:w-auto" href={`/trip/${tripId}/preferences`}>
      {label} <span aria-hidden="true">→</span>
    </Link>
  );
}
