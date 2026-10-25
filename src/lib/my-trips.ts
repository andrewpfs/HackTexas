import "server-only";

import type { Trip } from "./trip-types";

export type MyTrip = {
  tripId: string;
  travelerId: string;
  travelerName: string;
  tripName: string;
  destination: string | null;
  window: string;
  isHost: boolean;
};

// The trips a verified phone belongs to, with only what the "My Trips" list needs.
export function summarizeTripsForPhone(trips: Trip[], phoneHash: string): MyTrip[] {
  const result: MyTrip[] = [];
  for (const trip of trips) {
    for (const traveler of trip.travelers) {
      if (traveler.phoneHash !== phoneHash) continue;
      result.push({
        tripId: trip.id,
        travelerId: traveler.id,
        travelerName: traveler.name,
        tripName: trip.name || (trip.destination ? `${trip.destination} Trip` : "Group Trip"),
        destination: trip.destination ?? null,
        window: `${trip.earliestPossibleDate} to ${trip.latestPossibleDate}`,
        isHost: traveler.isHost,
      });
    }
  }
  return result.sort((a, b) => b.window.localeCompare(a.window));
}
