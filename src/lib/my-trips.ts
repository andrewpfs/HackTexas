import "server-only";

import type { Trip } from "./trip-types";
import { tripDestinationLabel } from "./trip-destination";

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
        tripName: trip.name || (tripDestinationLabel(trip) ? `${tripDestinationLabel(trip)} Trip` : "Group Trip"),
        destination: tripDestinationLabel(trip),
        window: `${trip.earliestPossibleDate} to ${trip.latestPossibleDate}`,
        isHost: traveler.isHost,
      });
    }
  }
  return result.sort((a, b) => b.window.localeCompare(a.window));
}
