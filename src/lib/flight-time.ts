import { lookupDestinationArea } from "./city-search";
import { getStraightLineKm } from "./travel-time";

// Rough flight times from straight-line distance, so trip length can account for
// travel days (Austin to Tokyo is most of a day each way). Not a schedule.

export type FlightEstimate = { from: string; to: string; distanceKm: number; hoursEachWay: number };

export type GroupFlightTimes = {
  estimates: FlightEstimate[];
  longestHoursEachWay: number;
  recommendedMinimumDays: number;
  note: string;
};

// Jets cruise around 800 km/h; add time for takeoff and landing, and a likely
// connection on long trips.
export function estimateFlightHours(distanceKm: number) {
  if (distanceKm < 250) return 1;
  const connection = distanceKm > 3000 ? 2 : 0;
  return Math.round((distanceKm / 800 + 0.75 + connection) * 2) / 2;
}

// The shortest trip worth taking, counting an arrival day and a flight home.
export function recommendedMinimumDays(hoursEachWay: number) {
  if (hoursEachWay <= 2.5) return 2;
  if (hoursEachWay <= 5) return 3;
  if (hoursEachWay <= 9) return 5;
  if (hoursEachWay <= 12) return 6;
  return 7;
}

export function flightTimeNote(times: Pick<GroupFlightTimes, "longestHoursEachWay" | "recommendedMinimumDays">, destination: string) {
  const hours = times.longestHoursEachWay;
  const longHaul = hours > 9 ? " Day 1 is mostly flying and landing, and the last day is the flight home." : "";
  return `The longest flight to ${destination} is about ${hours} hours each way.${longHaul} Plan at least ${times.recommendedMinimumDays} days.`;
}

const pointCache = new Map<string, { latitude: number; longitude: number } | null>();

async function cityPoint(city: string) {
  const key = city.trim().toLowerCase();
  if (pointCache.has(key)) return pointCache.get(key)!;
  const area = await lookupDestinationArea(city);
  const point = area?.latitude !== undefined && area.longitude !== undefined ? { latitude: area.latitude, longitude: area.longitude } : null;
  if (point) pointCache.set(key, point);
  return point;
}

// Flight estimates from every departure city to the destination, or null when the cities can't be found.
export async function estimateGroupFlightTimes(origins: string[], destination: string): Promise<GroupFlightTimes | null> {
  const uniqueOrigins = [...new Set(origins.map((origin) => origin.trim()).filter(Boolean))];
  const [to, ...froms] = await Promise.all([cityPoint(destination), ...uniqueOrigins.map(cityPoint)]);
  if (!to) return null;
  const estimates: FlightEstimate[] = [];
  uniqueOrigins.forEach((from, index) => {
    const point = froms[index];
    if (!point) return;
    const distanceKm = Math.round(getStraightLineKm(point, to));
    estimates.push({ from, to: destination, distanceKm, hoursEachWay: estimateFlightHours(distanceKm) });
  });
  if (estimates.length === 0) return null;
  const longestHoursEachWay = Math.max(...estimates.map((estimate) => estimate.hoursEachWay));
  const recommended = recommendedMinimumDays(longestHoursEachWay);
  return {
    estimates,
    longestHoursEachWay,
    recommendedMinimumDays: recommended,
    note: flightTimeNote({ longestHoursEachWay, recommendedMinimumDays: recommended }, destination),
  };
}
