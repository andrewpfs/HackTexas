import type { Trip } from "./trip-types";

// For a multi-city plan like "London → Paris → Berlin", the first stop.
export function firstStop(destination: string) {
  return destination.split(/\s*(?:→|->|;|\/|\s+then\s+|\s+&\s+|\s+and\s+|\s+to\s+)\s*/i)[0].trim() || destination.trim();
}

// Where the trip is going: the host's pick, or once the group has an itinerary,
// the place it settled on (the first stop for a backpacking-style trip).
export function tripDestinationLabel(trip: Pick<Trip, "destination" | "itinerary">) {
  if (trip.destination?.trim()) return trip.destination.trim();
  const planned = trip.itinerary?.destination?.trim();
  return planned ? firstStop(planned) : null;
}
