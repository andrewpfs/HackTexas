// Spots how the group wants to travel from the words they used ("backpacking",
// "road trip", a whole region like "Europe"), so Muse plans a route through
// several places instead of defaulting to one city.

export type TripStyle = {
  name: string;
  guidance: string;
};

export type TripStyleSummary = {
  styles: TripStyle[];
  // True when the destination is a region (Europe, Southeast Asia, ...) rather than a city.
  destinationIsRegion: boolean;
};

const styleRules: { name: string; pattern: RegExp; guidance: string }[] = [
  {
    name: "Backpacking",
    pattern: /\bback\s?pack(?:ing|er|ers)?\b|\binterrail\b|\beurail\b|\bhostel[- ]hopping\b/i,
    guidance:
      "A backpacking route: several cities, and several countries when the region spans them, about 2-4 nights per stop. Move between stops by train, bus or budget flight and show those travel legs. Favor hostels, street food, free walking tours and cheap sights, and keep the total low.",
  },
  {
    name: "Road trip",
    pattern: /\broad\s?trip\b|\bdrive (?:down|up|across|along|through)\b|\bdriving (?:through|across|along)\b/i,
    guidance: "A road trip: a driving route with stops about 2-4 hours apart, scenic detours, and a different town most nights.",
  },
  {
    name: "Island hopping",
    pattern: /\bisland[- ]hopping\b|\bhop(?:ping)? (?:between|around) (?:the )?islands\b/i,
    guidance: "Island hopping: two or more islands with the ferries or short flights between them planned in.",
  },
  {
    name: "Multi-city",
    pattern: /\bmulti[- ]?(?:city|country|stop)\b|\b(?:several|multiple|many|a few|different) (?:cities|countries|places|stops)\b|\bcountries\b/i,
    guidance: "Several cities or countries, each with its own days. Plan the order to avoid backtracking and include the travel between them.",
  },
];

const regionPattern =
  /\b(?:europe|western europe|eastern europe|southern europe|northern europe|scandinavia|the balkans|balkans|mediterranean|asia|southeast asia|south east asia|east asia|central asia|south america|central america|latin america|north america|africa|east africa|southern africa|north africa|middle east|the caribbean|caribbean|oceania|australia and new zealand|patagonia|iberia|the alps|alps)\b/i;

export function detectTripStyle(texts: (string | null | undefined)[], destination: string | null | undefined): TripStyleSummary {
  const text = texts.filter(Boolean).join("\n");
  const styles = styleRules.filter((rule) => rule.pattern.test(text)).map(({ name, guidance }) => ({ name, guidance }));
  const destinationIsRegion = Boolean(destination && regionPattern.test(destination.trim()) && destination.trim().split(/\s+/).length <= 4);
  return { styles, destinationIsRegion };
}

export function hasTripStyle(summary: TripStyleSummary) {
  return summary.styles.length > 0 || summary.destinationIsRegion;
}

// One instruction line for Muse prompts.
export const tripStylePromptRule =
  "- trip.tripStyle, when present, says how the group wants to travel (for example backpacking across a region). Follow its guidance over the default one-city pattern: if it describes a multi-stop route, or destinationIsRegion is true, plan a route through several cities (and countries when the region spans them), name them in order in the destination or title (for example \"Paris → Amsterdam → Berlin → Prague\"), and include the travel between stops.";
