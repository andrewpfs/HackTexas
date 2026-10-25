import { MusePlannerError, requestMuseJson, type MuseConfig } from "./muse-client";
import type { Trip, TripSketch } from "./trip-types";
import { findSharedDates, getContiguousDateWindows, getDatesInRange, isValidISODate } from "./date-utils";

export type SketchDraft = Pick<TripSketch, "summary" | "places" | "days" | "suggestions">;

export type SketchRequest = {
  description: string;
  destination: string | null;
  tripName: string | null;
  days: number;
  window: string;
  origin: string;
  // What the travelers who answered so far want. Missing until someone fills in preferences.
  group?: SketchGroupPreferences;
};

export type SketchGroupPreferences = {
  travelersWhoAnswered: number;
  interests: { interest: string; travelers: number }[];
  budgetRangeUsd: { lowest: number; highest: number };
  destinationIdeas: string[];
  activityIdeas: string[];
  lodging: string[];
};

// A summary of everyone's submitted preferences, so the first draft reflects the
// group and not only the host's description.
export function summarizeGroupPreferences(trip: Trip): SketchGroupPreferences | undefined {
  const answered = trip.travelers.filter((traveler) => traveler.preferencesComplete && traveler.preferences);
  if (answered.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const traveler of answered) {
    for (const interest of traveler.preferences!.activityInterests) counts.set(interest, (counts.get(interest) ?? 0) + 1);
  }
  const budgets = answered.map((traveler) => traveler.preferences!.maximumBudget);
  const text = (values: (string | undefined)[]) => [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].map((value) => value.slice(0, 200));
  return {
    travelersWhoAnswered: answered.length,
    interests: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([interest, travelers]) => ({ interest, travelers })),
    budgetRangeUsd: { lowest: Math.min(...budgets), highest: Math.max(...budgets) },
    destinationIdeas: text(answered.map((traveler) => traveler.preferences!.destinationPreferences)),
    activityIdeas: text(answered.map((traveler) => traveler.preferences!.activityDetails)),
    lodging: text(answered.map((traveler) => traveler.preferences!.lodgingType)),
  };
}

export interface SketchPlanner {
  sketch(request: SketchRequest): Promise<SketchDraft>;
}

// Use the longest contiguous dates everyone has marked once all travelers have answered.
export function getSketchDuration(trip: Trip) {
  if (!isValidISODate(trip.earliestPossibleDate) || !isValidISODate(trip.latestPossibleDate) || trip.earliestPossibleDate > trip.latestPossibleDate) return 1;
  const planningDays = getDatesInRange(trip.earliestPossibleDate, trip.latestPossibleDate).length;
  let usableDays = planningDays;
  if (trip.travelers.length > 0 && trip.travelers.every((traveler) => traveler.availabilityComplete)) {
    const dates = trip.travelers.map((traveler) => traveler.availableDates ?? []);
    const shared = findSharedDates(dates).filter((date) => date >= trip.earliestPossibleDate && date <= trip.latestPossibleDate);
    const windows = getContiguousDateWindows(shared);
    usableDays = 0;
    for (const window of windows) {
      if (window.dayCount > usableDays) usableDays = window.dayCount;
    }
  }
  const preferred = trip.preferredDurationDays;
  const requested = typeof preferred === "number" && Number.isFinite(preferred) && preferred > 0 ? Math.floor(preferred) : usableDays;
  return Math.min(14, Math.max(0, Math.min(requested, usableDays)));
}

export function getSketchRequest(trip: Trip): SketchRequest {
  return {
    description: trip.prompt,
    destination: trip.destination?.trim() || null,
    tripName: trip.name?.trim() || null,
    days: getSketchDuration(trip),
    window: `${trip.earliestPossibleDate} to ${trip.latestPossibleDate}`,
    origin: trip.origin,
    group: summarizeGroupPreferences(trip),
  };
}

const stringSchema = { type: "string" };
const namedItems = {
  type: "array",
  items: { type: "object", additionalProperties: false, required: ["name", "why"], properties: { name: stringSchema, why: stringSchema } },
};

const sketchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "places", "days", "suggestions"],
  properties: {
    summary: stringSchema,
    places: namedItems,
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dayNumber", "title", "plan"],
        properties: { dayNumber: { type: "integer" }, title: stringSchema, plan: stringSchema },
      },
    },
    suggestions: namedItems,
  },
};

const systemPrompt = [
  "You help a group start planning a trip. The host wrote a short description. When group is present, some travelers have also shared preferences.",
  "- If group is present, shape the whole sketch around it: lead with interests many travelers share, keep the plan realistic for the lowest budget, and work in their destination and activity ideas. Mention in summary that it reflects the group's preferences. Never quote what an individual wrote.",
  "Draw a first rough sketch the whole group can react to:",
  "- summary: 1-2 friendly sentences on the shape of the trip.",
  "- places: the cities or areas the description asks for, in a sensible travel order, each with a short reason. Never drop a place the host named.",
  "- days: exactly the requested number of days, each with a short title and one sentence plan. Split time between the named places sensibly, including travel between them.",
  "- suggestions: 2-4 extra places or experiences the group might also like (the host may have invited ideas), each with a short reason. Do not repeat places already listed.",
  "- If no destination is given, suggest one that fits the description.",
  "Do not mention prices, hotels, or flights. Respond with JSON only.",
].join("\n");

function cleanItems(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item) => item && typeof item.name === "string" && item.name.trim() !== "")
        .map((item) => ({ name: String(item.name).trim(), why: String(item.why ?? "").trim() }))
        .slice(0, 8)
    : [];
}

export function parseSketch(output: unknown, days: number): SketchDraft {
  const parsed = (output ?? {}) as Record<string, unknown>;
  if (typeof parsed.summary !== "string" || parsed.summary.trim() === "") {
    throw new MusePlannerError("Muse returned an empty trip sketch.");
  }

  const dayList = Array.isArray(parsed.days) ? parsed.days : [];
  return {
    summary: parsed.summary.trim(),
    places: cleanItems(parsed.places),
    days: dayList
      .filter((day) => day && typeof day.title === "string")
      .slice(0, days)
      .map((day, index) => ({ dayNumber: index + 1, title: String(day.title).trim(), plan: String(day.plan ?? "").trim() })),
    suggestions: cleanItems(parsed.suggestions).slice(0, 4),
  };
}

export class MuseSketchPlanner implements SketchPlanner {
  constructor(private config: MuseConfig) {}

  async sketch(request: SketchRequest): Promise<SketchDraft> {
    const output = await requestMuseJson(this.config, {
      systemPrompt,
      userPrompt: `Trip details:\n${JSON.stringify(request, null, 2)}`,
      schemaName: "trip_sketch",
      schema: sketchSchema,
    });
    return parseSketch(output, request.days);
  }
}

// Used without Muse: a plain outline built from the description so the page still has something to show.
export class MockSketchPlanner implements SketchPlanner {
  async sketch(request: SketchRequest): Promise<SketchDraft> {
    const where = request.destination ?? "your destination";
    return {
      summary: `A ${request.days}-day trip to ${where}. Muse isn't connected, so this is a simple outline from the host's description.`,
      places: [{ name: where, why: "From the host's trip details" }],
      days: Array.from({ length: request.days }, (_, index) => ({
        dayNumber: index + 1,
        title: index === 0 ? "Arrive and settle in" : index === request.days - 1 ? "Last day and travel home" : `Explore ${where}`,
        plan: index === 0 ? "Meet up, check in, and find dinner nearby." : index === request.days - 1 ? "A slow morning, last favorites, then head home." : "Mix of the group's interests once everyone has shared them.",
      })),
      suggestions: [],
    };
  }
}
