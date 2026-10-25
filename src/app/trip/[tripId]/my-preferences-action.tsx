"use client";

import Link from "next/link";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type TravelerSummary = {
  id: string;
  isHost: boolean;
  departureLocation: string;
  preferencesComplete: boolean;
  availabilityComplete: boolean;
};

export function MyPreferencesAction({ tripId, travelers }: { tripId: string; travelers: TravelerSummary[] }) {
  const { travelerId } = useTravelerIdentity(tripId);
  const currentTraveler = travelers.find((traveler) => traveler.id === travelerId);
  if (!currentTraveler) return null;

  if (currentTraveler.isHost) {
    return <section className="mt-6 rounded-3xl border border-[#173f50]/10 bg-[#fffaf1] p-6 sm:p-8" aria-labelledby="host-actions"><p className="eyebrow">Host Controls</p><h2 className="mt-2 text-2xl font-bold" id="host-actions">Keep the trip moving</h2><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Link className="button-dark" href={`/trip/${tripId}/edit`}>Edit Trip Details</Link><a className="button-secondary" href="#invite-group">Invite / Copy Link</a><Link className="button-secondary" href={`/trip/${tripId}/preferences`}>{currentTraveler.preferencesComplete ? "Edit My Preferences" : "Complete My Preferences"}</Link><Link className="button-secondary" href={`/trip/${tripId}/availability`}>{currentTraveler.availabilityComplete ? "Edit My Availability" : "Set My Availability"}</Link></div></section>;
  }

  return <section className="mt-6 rounded-3xl border border-[#e4664f]/20 bg-white p-6 sm:p-8" aria-labelledby="your-todo"><p className="eyebrow">Your To-Do</p><h2 className="mt-2 text-2xl font-bold" id="your-todo">Finish your traveler details</h2><div className="mt-5 grid gap-3 sm:grid-cols-3"><Link className="todo-card" href={`/trip/${tripId}/preferences`}><span>Preferences</span><strong>{currentTraveler.preferencesComplete ? "Complete · Edit" : "Complete now →"}</strong></Link><Link className="todo-card" href={`/trip/${tripId}/availability`}><span>Availability</span><strong>{currentTraveler.availabilityComplete ? "Set · Edit" : "Set dates →"}</strong></Link><Link className="todo-card" href={`/trip/${tripId}/preferences`}><span>Departure city</span><strong>{currentTraveler.departureLocation ? `${currentTraveler.departureLocation} · Edit` : "Complete now →"}</strong></Link></div></section>;
}
