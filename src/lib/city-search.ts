const photonUrl = "https://photon.komoot.io/api/";
const userAgent = "HackTXTripPlanner/1.0 (student hackathon project)";

type PhotonResponse = {
  features?: { properties?: { name?: string; state?: string; country?: string } }[];
};

function formatCity(name: string, state: string | undefined, country: string | undefined) {
  // "Austin, Texas" for the US, "Tokyo, Japan" or "Osaka, Osaka, Japan" elsewhere.
  if (country === "United States") {
    return state ? `${name}, ${state}` : name;
  }
  return [name, state && state !== name ? state : undefined, country].filter(Boolean).join(", ");
}

// Real cities and towns that match what the traveler has typed so far.
export async function searchCities(query: string, fetchImpl: typeof fetch = fetch) {
  const text = query.trim();
  if (text.length < 2) {
    return [];
  }

  const url = new URL(photonUrl);
  url.search = new URLSearchParams({ q: text, limit: "8", lang: "en", layer: "city" }).toString();

  const response = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) {
    throw new Error(`City search returned HTTP ${response.status}.`);
  }

  const body = (await response.json()) as PhotonResponse;
  const labels: string[] = [];
  for (const feature of body.features ?? []) {
    const properties = feature.properties;
    if (!properties?.name) {
      continue;
    }
    const label = formatCity(properties.name, properties.state, properties.country);
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels;
}

// "valid" when the city is in the list, "invalid" when it is not, and "unknown"
// when the lookup itself failed so a service outage never blocks someone.
export async function verifyCity(label: string, fetchImpl: typeof fetch = fetch) {
  try {
    const cityName = label.split(",")[0];
    const matches = await searchCities(cityName, fetchImpl);
    const wanted = label.trim().toLowerCase();
    return matches.some((match) => match.toLowerCase() === wanted) ? ("valid" as const) : ("invalid" as const);
  } catch {
    return "unknown" as const;
  }
}
