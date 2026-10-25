import { MusePlannerError, requestMuseJson, type MuseConfig } from "./muse-client";
import type { Trip, TripSketch } from "./trip-types";
import { findSharedDates, getContiguousDateWindows, getDatesInRange, isValidISODate } from "./date-utils";
import { detectTripStyle, hasTripStyle, type TripStyleSummary } from "./trip-style";

export type SketchDraft = Pick<TripSketch, "summary" | "places" | "days" | "suggestions">;

export type SketchGroupTraveler = {
  name: string;
  from: string;
  budgetUsd: number | null;
  preferredDays: number | null;
  interests: string[];
  activityDetails: string;
  notes: string;
  lodging: string;
};

export type SketchRequest = {
  description: string;
  destination: string | null;
  tripName: string | null;
  days: number;
  window: string;
  origin: string;
  tripStyle?: TripStyleSummary;
  // Present once everyone has shared preferences and dates.
  group?: {
    travelers: SketchGroupTraveler[];
    sharedDateWindows: string[];
    confirmedDates: string | null;
  };
};

export interface SketchPlanner {
  sketch(request: SketchRequest): Promise<SketchDraft>;
}

// Everyone has shared preferences and dates, so the draft can be fitted to the whole group.
export function isGroupInputComplete(trip: Trip) {
  return trip.travelers.length > 0 && trip.travelers.every((traveler) => traveler.preferencesComplete && traveler.availabilityComplete);
}

// Small, stable string hash (FNV-1a) so the key stays short.
function hashText(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// What the draft depends on. Until everyone has answered, only the host's trip
// details count, so the draft doesn't redraw every time someone joins or saves.
export function getSketchBasis(trip: Trip): { stage: "host" | "group"; key: string } {
  const hostPart = [trip.prompt, trip.name ?? "", trip.destination ?? "", trip.origin, trip.earliestPossibleDate, trip.latestPossibleDate, trip.preferredDurationDays ?? null];
  if (!isGroupInputComplete(trip)) {
    return { stage: "host", key: `host:${hashText(JSON.stringify(hostPart))}` };
  }
  const travelers = [...trip.travelers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((traveler) => [traveler.id, traveler.departureLocation ?? "", traveler.preferences ?? null, [...(traveler.availableDates ?? [])].sort()]);
  const dates = trip.confirmedDates ? [trip.confirmedDates.startDate, trip.confirmedDates.endDate] : null;
  return { stage: "group", key: `group:${hashText(JSON.stringify([hostPart, travelers, dates]))}` };
}

const redrawTimeoutMs = 3 * 60 * 1000;

function isFresh(startedAt: string | undefined, now: number) {
  return startedAt !== undefined && now - Date.parse(startedAt) < redrawTimeoutMs;
}

// The key a saved draft was drawn from. Drafts saved before keys existed count as
// up to date for the host's details, so old trips don't all redraw at once.
export function storedSketchKey(sketch: TripSketch, basis: { stage: "host" | "group"; key: string }) {
  return sketch.basisKey ?? (basis.stage === "host" ? basis.key : "legacy");
}

export function sketchHasContent(sketch: TripSketch | undefined) {
  return Boolean(sketch && sketch.status === "done" && sketch.summary.trim() !== "");
}

// Whether a viewer should ask for a (re)drawn draft right now.
export function sketchNeedsRedraw(trip: Trip, now = Date.now()) {
  const sketch = trip.sketch;
  if (!sketch) return true;
  if (sketch.status === "pending") return !isFresh(sketch.startedAt, now);
  if (sketch.refreshing && isFresh(sketch.refreshing.startedAt, now)) return false;
  const basis = getSketchBasis(trip);
  if (sketch.failedBasisKey === basis.key || sketch.status === "failed") return false;
  return storedSketchKey(sketch, basis) !== basis.key;
}

// Use the longest contiguous dates everyone has marked once all travelers have answered.
// Once the dates are set, the draft covers exactly those days.
export function getSketchDuration(trip: Trip) {
  const confirmed = trip.confirmedDates;
  if (confirmed && isValidISODate(confirmed.startDate) && isValidISODate(confirmed.endDate) && confirmed.startDate <= confirmed.endDate) {
    return Math.min(14, getDatesInRange(confirmed.startDate, confirmed.endDate).length);
  }
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
  const texts = [trip.prompt, trip.name, trip.destination];
  for (const traveler of trip.travelers) texts.push(traveler.preferences?.activityDetails, traveler.preferences?.notes, traveler.preferences?.destinationPreferences);
  const tripStyle = detectTripStyle(texts, trip.destination);
  const request: SketchRequest = {
    description: trip.prompt,
    destination: trip.destination?.trim() || null,
    tripName: trip.name?.trim() || null,
    days: getSketchDuration(trip),
    window: `${trip.earliestPossibleDate} to ${trip.latestPossibleDate}`,
    origin: trip.origin,
    ...(hasTripStyle(tripStyle) ? { tripStyle } : {}),
  };

  if (isGroupInputComplete(trip)) {
    const shared = findSharedDates(trip.travelers.map((traveler) => traveler.availableDates ?? []));
    request.group = {
      travelers: trip.travelers.map((traveler) => ({
        name: traveler.name,
        from: traveler.departureLocation || (traveler.isHost ? trip.origin : ""),
        budgetUsd: traveler.preferences?.maximumBudget ?? null,
        preferredDays: traveler.preferences?.preferredDurationDays ?? null,
        interests: traveler.preferences?.activityInterests ?? [],
        activityDetails: traveler.preferences?.activityDetails ?? "",
        notes: traveler.preferences?.notes ?? "",
        lodging: traveler.preferences?.lodgingType ?? "",
      })),
      sharedDateWindows: getContiguousDateWindows(shared).slice(0, 4).map((window) => `${window.startDate} to ${window.endDate} (${window.dayCount} days)`),
      confirmedDates: trip.confirmedDates ? `${trip.confirmedDates.startDate} to ${trip.confirmedDates.endDate}` : null,
    };
  }
  return request;
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
  "You help a group start planning a trip. The host wrote a short description.",
  "Draw a first rough sketch the whole group can react to:",
  "- summary: 1-2 friendly sentences on the shape of the trip.",
  "- places: the cities or areas the description asks for, in a sensible travel order, each with a short reason. Never drop a place the host named.",
  "- days: exactly the requested number of days, each with a short title and one sentence plan. Split time between the named places sensibly, including travel between them.",
  "- suggestions: 2-4 extra places or experiences the group might also like (the host may have invited ideas), each with a short reason. Do not repeat places already listed.",
  "- If no destination is given, suggest one that fits the description.",
  "- tripStyle, when present, says how the group wants to travel. If it describes backpacking, a road trip or several cities, or destinationIsRegion is true (for example \"Europe\"), plan a route through several cities, and several countries when the region spans them, about 2-4 days per stop, and list every stop in places.",
  "- group, when present, means everyone has now shared preferences and dates. Refine the draft for the whole group: fit their interests and activity details, keep to the lowest budget, and use confirmedDates when set. Keep the host's named places. Do not quote anyone's private notes.",
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
