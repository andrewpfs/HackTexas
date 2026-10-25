import type { GroupItinerary, ItineraryActivity, PlaceReview, PlaceSuggestion } from "./trip-types";

const serpApiUrl = "https://serpapi.com/search.json";
const reviewsPerPlace = 2;
const parallelLookups = 4;

// Accepts either spelling of the env var name.
export function getSerpApiKey() {
  return (process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY || "").trim() || null;
}

export type SerpApiConfig = {
  apiKey: string;
  includeReviews?: boolean;
  fetchImpl?: typeof fetch;
};

type SerpPlace = {
  title?: string;
  place_id?: string;
  country_code?: string;
  region?: string;
  data_id?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  type?: string | string[];
  types?: string[];
  address?: string;
  thumbnail?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
};

type SerpReview = {
  rating?: number;
  date?: string;
  snippet?: string;
  user?: { name?: string };
};

async function serpGet(config: SerpApiConfig, params: Record<string, string>) {
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

// Google Maps sometimes returns several types, e.g. ["Shinto shrine", "Tourist attraction"].
function getCategory(place: SerpPlace) {
  const type = Array.isArray(place.type) ? place.type[0] : place.type;
  return type || place.types?.[0] || null;
}

function makeMapsUrl(place: SerpPlace) {
  const query = encodeURIComponent([place.title, place.address].filter(Boolean).join(" "));
  const placeId = place.place_id ? `&query_place_id=${encodeURIComponent(place.place_id)}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${query}${placeId}`;
}

async function fetchReviews(config: SerpApiConfig, place: SerpPlace): Promise<PlaceReview[]> {
  if (!config.includeReviews || !place.data_id) {
    return [];
  }

  try {
    const body = await serpGet(config, {
      engine: "google_maps_reviews",
      data_id: place.data_id,
      hl: "en",
      sort_by: "qualityScore",
    });
    const reviews = Array.isArray(body.reviews) ? (body.reviews as SerpReview[]) : [];

    return reviews
      .filter((review) => typeof review.snippet === "string" && review.snippet.trim() !== "")
      .slice(0, reviewsPerPlace)
      .map((review) => ({
        author: review.user?.name || "Google reviewer",
        rating: typeof review.rating === "number" ? review.rating : null,
        snippet: review.snippet!.trim(),
        date: review.date || "",
      }));
  } catch {
    // Reviews are a bonus; the place card still shows without them.
    return [];
  }
}

// Finds the top Google Maps result for a search, or null if nothing matched.
export async function searchPlaces(config: SerpApiConfig, query: string): Promise<PlaceSuggestion[]> {
  const body = await serpGet(config, { engine: "google_maps", type: "search", q: query, hl: "en" });

  // A broad search returns local_results; a search that names one exact place
  // returns place_results instead.
  const localResults = Array.isArray(body.local_results) ? (body.local_results as SerpPlace[]) : [];
  const exact = body.place_results as SerpPlace | undefined;
  const results = localResults.length > 0 ? localResults.slice(0, 5) : exact ? [exact] : [];
  const suggestions: PlaceSuggestion[] = [];
  for (const place of results) {
    if (!place.title) continue;
    suggestions.push({
    name: place.title,
    placeId: place.place_id || place.data_id,
    countryCode: place.country_code,
    region: place.region,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.reviews === "number" ? place.reviews : null,
    price: place.price || null,
    category: getCategory(place),
    address: place.address || null,
    thumbnail: place.thumbnail || null,
    latitude: typeof place.gps_coordinates?.latitude === "number" ? place.gps_coordinates.latitude : undefined,
    longitude: typeof place.gps_coordinates?.longitude === "number" ? place.gps_coordinates.longitude : undefined,
    mapsUrl: makeMapsUrl(place),
    reviews: await fetchReviews(config, place),
    });
  }
  return suggestions;
}

export async function lookupPlace(config: SerpApiConfig, query: string): Promise<PlaceSuggestion | null> {
  const places = await searchPlaces(config, query);
  return places[0] ?? null;
}

export function getPlaceSearchQuery(activity: ItineraryActivity, destination: string) {
  if (activity.type === "Travel" || activity.type === "Free time") {
    return null;
  }
  if (activity.placeSearchQuery !== undefined) {
    return activity.placeSearchQuery.trim() || null;
  }
  // Itineraries created before search queries existed.
  return `${activity.title} ${activity.location || destination}`;
}

// Looks up a real place for each activity. Individual failures are skipped so
// one bad search never blocks the rest of the itinerary.
export async function addPlacesToItinerary(
  itinerary: GroupItinerary,
  config: SerpApiConfig,
): Promise<{ days: GroupItinerary["days"]; foundCount: number; failedCount: number }> {
  const days = structuredClone(itinerary.days);
  const jobs: { activity: ItineraryActivity; query: string }[] = [];

  for (const day of days) {
    for (const activity of day.activities) {
      const query = getPlaceSearchQuery(activity, itinerary.destination);
      // Stops that already have a place (kept across plan revisions) are not searched again.
      if (query && !activity.place) {
        jobs.push({ activity, query });
      }
    }
  }

  const cache = new Map<string, Promise<PlaceSuggestion | null>>();
  let foundCount = 0;
  let failedCount = 0;
  let nextJob = 0;

  async function worker() {
    while (nextJob < jobs.length) {
      const job = jobs[nextJob];
      nextJob += 1;

      const key = job.query.toLowerCase();
      if (!cache.has(key)) {
        cache.set(key, lookupPlace(config, job.query));
      }

      try {
        const place = await cache.get(key)!;
        if (place) {
          job.activity.place = place;
          foundCount += 1;
        }
      } catch {
        failedCount += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: parallelLookups }, worker));
  return { days, foundCount, failedCount };
}

type PhotoStops = {
  destination: string;
  heroPlace?: string;
  imageUrl?: string;
  days: { imageUrl?: string; activities: { title: string; placeName?: string; imageUrl?: string }[] }[];
};

// Fill missing candidate and day headers only, caching repeated queries.
export async function addSerpPhotosToCandidates<T extends PhotoStops>(
  candidates: T[],
  config: SerpApiConfig,
  parallel = 4,
): Promise<{ candidates: T[]; searched: number }> {
  const jobs: { query: string; target: { imageUrl?: string } }[] = [];
  for (const candidate of candidates) {
    if (!candidate.imageUrl) jobs.push({ query: candidate.heroPlace || candidate.destination, target: candidate });
    for (const day of candidate.days) {
      if (day.imageUrl) continue;
      const representative = day.activities.find((activity) => activity.placeName) ?? day.activities[0];
      const name = representative?.placeName || representative?.title || candidate.destination;
      jobs.push({ query: name + " " + candidate.destination, target: day });
    }
  }

  const cache = new Map<string, Promise<string | null>>();
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next];
      next += 1;
      const key = job.query.toLowerCase();
      if (!cache.has(key)) {
        cache.set(key, lookupPlace({ ...config, includeReviews: false }, job.query).then((place) => place?.thumbnail ?? null).catch(() => null));
      }
      const photo = await cache.get(key)!;
      if (photo) {
        job.target.imageUrl = photo;
      }
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));

  return { candidates, searched: cache.size };
}
