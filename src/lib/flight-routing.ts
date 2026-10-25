import type { FlightOption } from "./trip-types";
import { estimateTravel } from "./travel-time";
import type { FlightSearch, NearbyAirport } from "./travel-search";

// Finds flights even when the destination has no airport of its own (Niagara
// Falls, Yosemite, a small town): flights land at the nearest airports and each
// option says how long the drive is from there.

type Point = { latitude: number; longitude: number; countryCode?: string };

export type FlightRoutingDependencies = {
  findCityFlightId: (city: string) => Promise<string | null>;
  findNearbyAirports: (point: Point) => Promise<NearbyAirport[]>;
  lookupPoint: (place: string) => Promise<Point | null>;
  searchFlights: (search: FlightSearch) => Promise<FlightOption[]>;
};

export type FlightRoutingResult =
  | { ok: true; options: FlightOption[]; groundNote?: string }
  | { ok: false; error: string };

// Airports further than this from the destination need a drive at the end.
const sameCityKm = 25;
const airportsToTry = 5;

function shortName(place: string) {
  return place.split(",")[0].trim() || place;
}

async function airportCodesNear(place: string, dependencies: FlightRoutingDependencies) {
  const point = await dependencies.lookupPoint(place);
  if (!point) return { point: null, airports: [] as NearbyAirport[] };
  const all = await dependencies.findNearbyAirports(point);
  // Prefer airports in the same country, so a trip to the US side of Niagara Falls
  // doesn't fly into Toronto. Others still count when nothing closer works.
  const country = point.countryCode?.toUpperCase();
  const sameCountry = country ? all.filter((airport) => airport.countryCode === country) : [];
  const ordered = [...sameCountry, ...all.filter((airport) => !sameCountry.includes(airport))];
  return { point, airports: ordered.slice(0, airportsToTry) };
}

export async function findFlightsWithNearbyAirports(
  from: string,
  destination: string,
  dates: { outboundDate: string; returnDate?: string },
  dependencies: FlightRoutingDependencies,
): Promise<FlightRoutingResult> {
  const [fromId, toId] = await Promise.all([dependencies.findCityFlightId(from), dependencies.findCityFlightId(destination)]);
  if (fromId && toId) {
    const direct = await dependencies.searchFlights({ fromId, toId, ...dates });
    if (direct.length > 0) return { ok: true, options: direct };
  }

  // No flights into the place itself: try the airports around it.
  const near = await airportCodesNear(destination, dependencies);
  if (!near.point || near.airports.length === 0) {
    return { ok: false, error: `We couldn't find airports near ${shortName(destination)}.` };
  }
  const toCodes = near.airports.map((airport) => airport.code).join(",");

  let options: FlightOption[] = [];
  if (fromId) options = await dependencies.searchFlights({ fromId, toId: toCodes, ...dates });
  if (options.length === 0) {
    // The departure city may be small too.
    const origin = await airportCodesNear(from, dependencies);
    if (origin.airports.length > 0) {
      options = await dependencies.searchFlights({ fromId: origin.airports.map((airport) => airport.code).join(","), toId: toCodes, ...dates });
    }
  }
  if (options.length === 0) return { ok: true, options: [] };

  const destinationPoint = near.point;
  let anyDrive = false;
  const withDrives = options.map((option) => {
    const airport = near.airports.find((item) => item.code === option.arriveAirport);
    if (!airport || airport.distanceKm <= sameCityKm) return option;
    anyDrive = true;
    const drive = estimateTravel(airport, destinationPoint, "car");
    return { ...option, groundTransfer: { airport: airport.code, airportName: airport.name, minutes: drive.minutes, distanceKm: Math.round(drive.distanceKm), to: shortName(destination) } };
  });

  return {
    ok: true,
    options: withDrives,
    ...(anyDrive ? { groundNote: `${shortName(destination)} has no airport with flights from ${shortName(from)}, so these land at the nearest airports and you drive the rest.` } : {}),
  };
}
