import { searchHotels, type HotelSearch, type TravelSearchConfig } from "./travel-search";
import type { HotelOption } from "./trip-types";
import { expediaSearchUrl } from "./hotel-display";

// Restrict both direct URLs and Google's optional redirect wrapper.
export function normalizeExpediaUrl(value: string): string | null {
  try {
    let url = new URL(value);
    if ((url.hostname === "www.google.com" || url.hostname === "google.com") && url.pathname === "/url") {
      url = new URL(url.searchParams.get("q") || url.searchParams.get("url") || "");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname !== "expedia.com" && !url.hostname.endsWith(".expedia.com")) return null;
    url.hash = "";
    url.search = "";
    if (url.hostname === "expedia.com") url.hostname = "www.expedia.com";
    return url.toString();
  } catch { return null; }
}

export function expediaHotelOptions(results: unknown[]): HotelOption[] {
  const options: HotelOption[] = [];
  const seen = new Set<string>();
  for (const raw of results) {
    if (!raw || typeof raw !== "object") continue;
    const result = raw as { title?: unknown; link?: unknown };
    if (typeof result.title !== "string" || typeof result.link !== "string") continue;
    const link = normalizeExpediaUrl(result.link);
    if (!link) continue;
    // Exclude destination guides, search pages, and unrelated Expedia content.
    const property = new URL(link).pathname.match(/\.h(\d+)\.Hotel-Information\/?$/i);
    if (!property || seen.has(property[1])) continue;
    seen.add(property[1]);
    options.push({
      token: `expedia-${property[1]}`, provider: "expedia", name: result.title.replace(/\s*[-|:]\s*Expedia.*$/i, "").trim(), kind: "hotel",
      pricePerNight: null, totalPrice: null, rating: null, reviewCount: null, hotelClass: null, thumbnail: null, amenities: [], link,
    });
    if (options.length === 27) break;
  }
  return options;
}

// Each refresh shows a different feed instead of the same list again:
// Expedia pages first, then priced Google Hotels by lowest price, then by rating.
export async function discoverHotelFeed(config: TravelSearchConfig, search: HotelSearch, feed = 0) {
  const step = feed % 3;
  if (step === 0) return { ...(await discoverHotels(config, search)), feedLabel: "Expedia and Google Hotels" };
  const sortBy = step === 1 ? "3" : "8";
  const options = await searchHotels(config, { ...search, sortBy });
  return {
    options,
    expediaSearchUrl: expediaSearchUrl(),
    feedLabel: step === 1 ? "Lowest price first" : "Highest rated first",
    providerNote: `Google Hotels via SerpApi, ${step === 1 ? "lowest price first" : "highest rated first"}. Refresh again for a different list.`,
  };
}

export async function discoverHotels(config: TravelSearchConfig, search: HotelSearch) {
  const organic: unknown[] = [];
  let failedPages = 0;
  for (const start of [0, 10, 20]) {
    const url = new URL("https://serpapi.com/search.json");
    url.search = new URLSearchParams({ engine: "google", q: `site:expedia.com ${search.destination} hotels ${search.checkIn} to ${search.checkOut}`, start: String(start), hl: "en", gl: "us", api_key: config.apiKey }).toString();
    try {
      const response = await (config.fetchImpl ?? fetch)(url);
      if (!response.ok) throw new Error("Hotel discovery unavailable");
      const body = await response.json();
      if (body.error) throw new Error("Hotel discovery unavailable");
      if (Array.isArray(body.organic_results)) organic.push(...body.organic_results);
    } catch { failedPages += 1; }
  }
  const expedia = expediaHotelOptions(organic);
  if (expedia.length) return { options: expedia, expediaSearchUrl: expediaSearchUrl(), providerNote: failedPages ? "Some Expedia discovery pages were unavailable; showing the results we found." : "Expedia pages discovered through Google Search via SerpApi. Check current prices and availability on Expedia." };
  const options = await searchHotels(config, search);
  return { options, expediaSearchUrl: expediaSearchUrl(), providerNote: "Expedia discovery was unavailable or found no hotel pages. Showing Google Hotels results instead." };
}

