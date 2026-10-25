import type { FlightOption, HotelOption } from "./trip-types";

const serpApiUrl = "https://serpapi.com/search.json";
const wikidataApi = "https://www.wikidata.org/w/api.php";
const wikidataSparql = "https://query.wikidata.org/sparql";
const userAgent = "HackTXTripPlanner/1.0 (student hackathon project)";

export type TravelSearchConfig = { apiKey: string; fetchImpl?: typeof fetch };

async function serpGet(config: TravelSearchConfig, params: Record<string, string>) {
  const url = new URL(serpApiUrl);
  for (const [key, value] of Object.entries({ ...params, api_key: config.apiKey })) {
    url.searchParams.set(key, value);
  }

  const response = await (config.fetchImpl ?? fetch)(url);
  if (!response.ok) {
    throw new Error(`SerpApi returned HTTP ${response.status}.`);
  }
  const body = (await response.json()) as Record<string, unknown>;
  if (typeof body.error === "string") {
    throw new Error(`SerpApi error: ${body.error}`);
  }
  return body;
}

// ---------- hotels ----------

type SerpHotel = {
  name?: string;
  type?: string;
  property_token?: string;
  link?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  rate_per_night?: { lowest?: string; extracted_lowest?: number };
  total_rate?: { lowest?: string; extracted_lowest?: number };
  overall_rating?: number;
  reviews?: number;
  hotel_class?: string;
  images?: { thumbnail?: string; original_image?: string }[];
  amenities?: string[];
};

export type HotelSearch = {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  // 2-5 stars, from the group's $ to $$$$ price level.
  hotelClass?: number;
  // Google Hotels sort: 3 = lowest price, 8 = highest rating. Omitted = relevance.
  sortBy?: "3" | "8";
};

export async function searchHotels(config: TravelSearchConfig, search: HotelSearch): Promise<HotelOption[]> {
  const params: Record<string, string> = {
    engine: "google_hotels",
    q: `hotels in ${search.destination}`,
    check_in_date: search.checkIn,
    check_out_date: search.checkOut,
    adults: String(Math.max(1, search.adults)),
    currency: "USD",
    hl: "en",
    gl: "us",
    rating: "8",
  };
  if (search.hotelClass) {
    params.hotel_class = String(search.hotelClass);
  }
  if (search.sortBy) {
    params.sort_by = search.sortBy;
  }

  const body = await serpGet(config, params);
  const properties = Array.isArray(body.properties) ? (body.properties as SerpHotel[]) : [];

  return properties
    .filter((hotel) => hotel.name)
    .slice(0, 27)
    .map((hotel) => {
      const query = encodeURIComponent(`${hotel.name} ${search.destination}`);
      return {
        provider: "google_hotels" as const,
        token: hotel.property_token || hotel.name!,
        name: hotel.name!,
        kind: hotel.type || "hotel",
        pricePerNight: typeof hotel.rate_per_night?.extracted_lowest === "number" ? hotel.rate_per_night.extracted_lowest : null,
        totalPrice: typeof hotel.total_rate?.extracted_lowest === "number" ? hotel.total_rate.extracted_lowest : null,
        rating: typeof hotel.overall_rating === "number" ? Math.round(hotel.overall_rating * 10) / 10 : null,
        reviewCount: typeof hotel.reviews === "number" ? hotel.reviews : null,
        hotelClass: hotel.hotel_class || null,
        thumbnail: hotel.images?.[0]?.thumbnail || hotel.images?.[0]?.original_image || null,
        amenities: (hotel.amenities || []).slice(0, 6),
        latitude: hotel.gps_coordinates?.latitude,
        longitude: hotel.gps_coordinates?.longitude,
        link: hotel.link || `https://www.google.com/travel/search?q=${query}`,
      };
    });
}

// ---------- places for flights ----------

type WikidataSearch = { search?: { id: string; description?: string }[] };
type WikidataEntities = { entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: string } } }[]> }> };

// Google Flights accepts a city's Freebase id (like /m/0vzm for Austin) and then
// searches every airport in that city. Wikidata knows those ids.
export async function findCityFlightId(city: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const [name, ...rest] = city.split(",").map((part) => part.trim()).filter(Boolean);
  if (!name) {
    return null;
  }

  const searchUrl = new URL(wikidataApi);
  searchUrl.search = new URLSearchParams({
    action: "wbsearchentities", search: name, language: "en", type: "item", limit: "6", format: "json",
  }).toString();
  const searchResponse = await fetchImpl(searchUrl, { headers: { "User-Agent": userAgent } });
  if (!searchResponse.ok) {
    return null;
  }

  const results = ((await searchResponse.json()) as WikidataSearch).search ?? [];
  const hints = rest.map((part) => part.toLowerCase());
  // Prefer the result that mentions the state or country the traveler picked, then any city.
  const ranked = [
    ...results.filter((item) => hints.some((hint) => item.description?.toLowerCase().includes(hint))),
    ...results.filter((item) => /city|capital|town|metropolis|municipality/i.test(item.description ?? "")),
    ...results,
  ];
  const ids = [...new Set(ranked.map((item) => item.id))].slice(0, 6);
  if (ids.length === 0) {
    return null;
  }

  const entitiesUrl = new URL(wikidataApi);
  entitiesUrl.search = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props: "claims", format: "json" }).toString();
  const entitiesResponse = await fetchImpl(entitiesUrl, { headers: { "User-Agent": userAgent } });
  if (!entitiesResponse.ok) {
    return null;
  }

  const entities = ((await entitiesResponse.json()) as WikidataEntities).entities ?? {};
  for (const id of ids) {
    const freebase = entities[id]?.claims?.P646?.[0]?.mainsnak?.datavalue?.value;
    if (typeof freebase === "string" && freebase.startsWith("/")) {
      return freebase;
    }
  }
  return null;
}

// ---------- nearby airports ----------

export type NearbyAirport = { code: string; name: string; latitude: number; longitude: number; distanceKm: number; countryCode?: string };

type SparqlResponse = { results?: { bindings?: Record<string, { value?: string }>[] } };

// Airports with an IATA code near a point, nearest first. Places like Niagara
// Falls or Yosemite have no airport of their own, so flights land at one of these
// and the group drives the rest. Free (Wikidata), no API key.
export async function findNearbyAirports(point: { latitude: number; longitude: number }, fetchImpl: typeof fetch = fetch, radiusKm = 200): Promise<NearbyAirport[]> {
  const query = `SELECT DISTINCT ?airport ?airportLabel ?iata ?coord ?dist ?country WHERE {
  SERVICE wikibase:around {
    ?airport wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${point.longitude} ${point.latitude})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
    bd:serviceParam wikibase:distance ?dist .
  }
  VALUES ?type { wd:Q1248784 wd:Q644371 wd:Q94993988 }
  ?airport wdt:P31 ?type ;
           wdt:P238 ?iata .
  FILTER NOT EXISTS { ?airport wdt:P576 ?closed }
  OPTIONAL { ?airport wdt:P17/wdt:P297 ?country }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY ?dist LIMIT 40`;
  try {
    const url = new URL(wikidataSparql);
    url.search = new URLSearchParams({ query, format: "json" }).toString();
    const response = await fetchImpl(url, { headers: { "User-Agent": userAgent, Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return [];
    const rows = ((await response.json()) as SparqlResponse).results?.bindings ?? [];
    const airports: NearbyAirport[] = [];
    for (const row of rows) {
      const code = row.iata?.value?.trim().toUpperCase() ?? "";
      const match = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(row.coord?.value ?? "");
      const distanceKm = Number(row.dist?.value);
      if (!/^[A-Z]{3}$/.test(code) || !match || !Number.isFinite(distanceKm)) continue;
      if (airports.some((airport) => airport.code === code)) continue;
      const countryCode = row.country?.value?.trim().toUpperCase();
      airports.push({ code, name: row.airportLabel?.value ?? code, longitude: Number(match[1]), latitude: Number(match[2]), distanceKm, ...(countryCode ? { countryCode } : {}) });
    }
    return airports;
  } catch {
    return [];
  }
}

// ---------- flights ----------

type SerpLeg = {
  departure_airport?: { name?: string; id?: string; time?: string };
  arrival_airport?: { name?: string; id?: string; time?: string };
  airline?: string;
  airline_logo?: string;
  flight_number?: string;
  duration?: number;
};

type SerpItinerary = {
  flights?: SerpLeg[];
  total_duration?: number;
  price?: number;
  type?: string;
  airline_logo?: string;
  booking_token?: string;
  departure_token?: string;
};

export type FlightSearch = {
  fromId: string;
  toId: string;
  outboundDate: string;
  // Leave out for a one-way flight (each leg of a multi-city trip).
  returnDate?: string;
};

export async function searchFlights(config: TravelSearchConfig, search: FlightSearch): Promise<FlightOption[]> {
  const body = await serpGet(config, {
    engine: "google_flights",
    departure_id: search.fromId,
    arrival_id: search.toId,
    outbound_date: search.outboundDate,
    ...(search.returnDate ? { return_date: search.returnDate, type: "1" } : { type: "2" }),
    adults: "1",
    currency: "USD",
    hl: "en",
    gl: "us",
  });

  const best = Array.isArray(body.best_flights) ? (body.best_flights as SerpItinerary[]) : [];
  const other = Array.isArray(body.other_flights) ? (body.other_flights as SerpItinerary[]) : [];

  return [...best, ...other]
    .filter((option) => Array.isArray(option.flights) && option.flights.length > 0 && typeof option.price === "number")
    .slice(0, 6)
    .map((option, index) => {
      const legs = option.flights!;
      const first = legs[0];
      const last = legs[legs.length - 1];
      return {
        id: option.departure_token || option.booking_token || `${first.flight_number}-${index}`,
        airline: [...new Set(legs.map((leg) => leg.airline).filter(Boolean))].join(" + ") || "Airline",
        airlineLogo: option.airline_logo || first.airline_logo || null,
        flightNumbers: legs.map((leg) => leg.flight_number).filter(Boolean) as string[],
        departAirport: first.departure_airport?.id || "",
        departTime: first.departure_airport?.time || "",
        arriveAirport: last.arrival_airport?.id || "",
        arriveTime: last.arrival_airport?.time || "",
        durationMinutes: option.total_duration ?? legs.reduce((sum, leg) => sum + (leg.duration ?? 0), 0),
        stops: legs.length - 1,
        price: option.price!,
      };
    });
}

export function addDaysToDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
