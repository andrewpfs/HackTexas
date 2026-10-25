export type TravelMode = "walk" | "bike" | "car" | "transit";

export const travelModes: { mode: TravelMode; label: string; icon: string }[] = [
  { mode: "walk", label: "Walk", icon: "🚶" },
  { mode: "bike", label: "Bike", icon: "🚲" },
  { mode: "transit", label: "Transit", icon: "🚇" },
  { mode: "car", label: "Car", icon: "🚗" },
];

type Point = { latitude: number; longitude: number };

// Streets are longer than a straight line, so distances are scaled up a bit.
const routeFactor = 1.3;
const speedsKmPerHour: Record<TravelMode, number> = { walk: 4.8, bike: 14, car: 24, transit: 28 };
// Finding parking and getting in and out of the car.
const carOverheadMinutes = 4;

export function getStraightLineKm(from: Point, to: Point) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

// Rough trip estimate between two stops; real routing is a Google Maps tap away.
export function estimateTravel(from: Point, to: Point, mode: TravelMode) {
  const distanceKm = getStraightLineKm(from, to) * routeFactor;
  const driving = (distanceKm / speedsKmPerHour[mode]) * 60 + (mode === "car" ? carOverheadMinutes : mode === "transit" ? 8 : 0);

  return { distanceKm, minutes: Math.max(1, Math.round(driving)) };
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

export function formatDistance(distanceKm: number) {
  const miles = distanceKm * 0.621371;
  return miles < 0.1 ? "< 0.1 mi" : `${miles.toFixed(1)} mi`;
}
