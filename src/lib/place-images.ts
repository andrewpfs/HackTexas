const wikipediaApi = "https://en.wikipedia.org/w/api.php";
const userAgent = "HackTXTripPlanner/1.0 (student hackathon project)";

type WikipediaResponse = {
  query?: { pages?: Record<string, { title?: string; original?: { source?: string }; thumbnail?: { source?: string } }> };
};

async function searchWikipediaImage(query: string, fetchImpl: typeof fetch) {
  if (query.trim() === "") {
    return null;
  }

  const url = new URL(wikipediaApi);
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1200",
    format: "json",
  }).toString();

  try {
    let response = await fetchImpl(url, { headers: { "User-Agent": userAgent } });

    // Wikipedia asks busy callers to slow down; wait a moment and try again.
    for (let attempt = 1; attempt <= 3 && (response.status === 429 || response.status === 503); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      response = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
    }
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as WikipediaResponse;
    const page = Object.values(body.query?.pages ?? {})[0];
    const image = page?.thumbnail?.source ?? page?.original?.source;
    return image ? { title: page?.title ?? "", image } : null;
  } catch {
    return null;
  }
}

// Finds a free-to-use photo of a landmark or destination from Wikipedia.
// Returns null when nothing matches; callers fall back to a plain background.
export async function findPlaceImage(query: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  return (await searchWikipediaImage(query, fetchImpl))?.image ?? null;
}

const fillerWords = new Set(["the", "and", "for", "with", "visit", "walk", "stroll", "tour", "time", "day", "night", "morning", "afternoon", "evening", "local", "casual", "easy", "free", "group", "welcome", "farewell", "arrival", "check", "dinner", "lunch", "breakfast", "street", "food", "market", "park"]);

function significantWords(text: string) {
  // "Sensō-ji" and "Senso-ji" should count as the same word.
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !fillerWords.has(word));
}

// A photo for one itinerary stop. The Wikipedia page found has to share a word with
// the stop's name, so a vague stop like "Easy park unwind" gets no wrong photo.
export async function findActivityImage(
  title: string,
  destination: string,
  fetchImpl: typeof fetch = fetch,
  placeName = "",
) {
  // The named landmark is the best search; the stop's own title is the backup.
  for (const name of [placeName, title]) {
    if (name.trim() === "") continue;

    const found = await searchWikipediaImage(`${name} ${destination}`, fetchImpl);
    if (!found) continue;

    const pageWords = new Set(significantWords(found.title));
    if (significantWords(name).some((word) => pageWords.has(word))) {
      return found.image;
    }
  }

  return null;
}

// Looks up one image per candidate in parallel. Failures are ignored.
export async function addImagesToCandidates<T extends { destination: string; heroPlace?: string; imageUrl?: string }>(
  candidates: T[],
  fetchImpl: typeof fetch = fetch,
): Promise<(T & { imageUrl?: string })[]> {
  return Promise.all(
    candidates.map(async (candidate) => {
      const image =
        (await findPlaceImage(candidate.heroPlace || "", fetchImpl)) ??
        (await findPlaceImage(candidate.destination, fetchImpl));
      return image ? { ...candidate, imageUrl: image } : candidate;
    }),
  );
}

type DaysOfCandidate = { destination: string; days: { imageUrl?: string; activities: { title: string; placeName?: string; imageUrl?: string }[] }[] };

// One representative photo per day, never a lookup for each individual stop.
export async function addImagesToCandidateDays<T extends DaysOfCandidate>(candidates: T[], fetchImpl: typeof fetch = fetch): Promise<T[]> {
  for (const candidate of candidates) {
    for (const day of candidate.days) {
      if (day.imageUrl) continue;
      const saved = day.activities.find((activity) => activity.imageUrl);
      if (saved?.imageUrl) {
        day.imageUrl = saved.imageUrl;
        continue;
      }
      const representative = day.activities.find((activity) => activity.placeName) ?? day.activities[0];
      const query = representative?.placeName || representative?.title || candidate.destination;
      day.imageUrl = (await findPlaceImage(query + " " + candidate.destination, fetchImpl)) ?? undefined;
    }
  }
  return candidates;
}
