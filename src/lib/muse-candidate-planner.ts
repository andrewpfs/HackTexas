import { randomUUID } from "node:crypto";
import { getDatesInRange } from "./date-utils";
import type { CandidatePlanner } from "./candidate-planner";
import type { PlanningContext } from "./planning-context";
import type { CandidateTripOption } from "./trip-types";
import { MusePlannerError, requestMuseJson, type MuseConfig } from "./muse-client";

export { MusePlannerError } from "./muse-client";

type MuseCandidate = {
  title: string;
  destination: string;
  summary: string;
  rationale: string;
  estimatedDurationDays: number;
  suggestedStartDate: string;
  suggestedEndDate: string;
  highlights: string[];
  considerations: string[];
  heroPlace: string;
  days: {
    dayNumber: number;
    date: string;
    title: string;
    activities: {
      timeOfDay: "Morning" | "Afternoon" | "Evening";
      title: string;
      description: string;
      placeName: string;
    }[];
  }[];
};

const stringSchema = { type: "string" };

const candidateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "destination",
    "summary",
    "rationale",
    "estimatedDurationDays",
    "suggestedStartDate",
    "suggestedEndDate",
    "highlights",
    "considerations",
    "heroPlace",
    "days",
  ],
  properties: {
    title: stringSchema,
    destination: stringSchema,
    summary: stringSchema,
    rationale: stringSchema,
    estimatedDurationDays: { type: "integer" },
    suggestedStartDate: stringSchema,
    suggestedEndDate: stringSchema,
    highlights: { type: "array", items: stringSchema },
    considerations: { type: "array", items: stringSchema },
    heroPlace: stringSchema,
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dayNumber", "date", "title", "activities"],
        properties: {
          dayNumber: { type: "integer" },
          date: stringSchema,
          title: stringSchema,
          activities: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["timeOfDay", "title", "description", "placeName"],
              properties: {
                timeOfDay: { type: "string", enum: ["Morning", "Afternoon", "Evening"] },
                title: stringSchema,
                description: stringSchema,
                placeName: stringSchema,
              },
            },
          },
        },
      },
    },
  },
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: { type: "array", items: candidateSchema },
  },
};

const systemPrompt = [
  "You are the consensus engine for a GROUP trip planner.",
  "Create exactly 3 candidate trip options for the whole group, not for one person.",
  "Rules:",
  "- Follow the host's trip description in trip.prompt. If it names places (for example \"Tokyo and Osaka\"), every option should include them unless the dates or budgets make that impossible, and say so in considerations. trip.sketch, when present, is the first rough plan the group already saw: build on it, and let the three options differ in pace and emphasis.",
  "- Use only dates listed in groupAvailability.sharedDates. A candidate's whole date range must be consecutive shared dates.",
  "- Each traveler departs from their own departureLocation. Consider all of them when choosing destinations.",
  "- Stay within the group's budgets. The lowest maximum budget is the binding constraint.",
  "- Balance different interests and lodging preferences, and explain the tradeoffs in rationale and considerations.",
  "- If planningMode is known_destination, all three options use that destination and differ in approach.",
  "- If planningMode is unknown_destination, recommend three different destinations that fit the group.",
  "- This is a conceptual plan. Do not invent current flight, hotel, or ticket prices or availability.",
  "- Set heroPlace to the single best-known attraction or landmark of the option (for example \"Senso-ji\"), as it would be titled on Wikipedia.",
  "- For every activity, set placeName to the one specific landmark, venue, or neighborhood it happens at, as it would be titled on Wikipedia (for example \"Senso-ji\" or \"Tsukiji fish market\"). Use an empty string when there is no specific place.",
  "- Each day has Morning, Afternoon, and Evening activities at most. Keep descriptions short.",
  "- Do not quote travelers' private notes in visible text. Use them only to shape the plan.",
  "Respond with JSON only.",
].join("\n");

function buildUserPrompt(context: PlanningContext) {
  return `Planning context:\n${JSON.stringify(context, null, 2)}`;
}

function isShared(candidate: MuseCandidate, sharedDates: Set<string>) {
  const range = getDatesInRange(candidate.suggestedStartDate, candidate.suggestedEndDate);
  return range.length > 0 && range.every((date) => sharedDates.has(date));
}

export function parseMuseCandidates(
  output: unknown,
  context: PlanningContext,
  generatedAt = new Date().toISOString(),
): CandidateTripOption[] {
  const parsed = (output ?? {}) as { candidates?: MuseCandidate[] };

  if (!Array.isArray(parsed.candidates) || parsed.candidates.length !== 3) {
    throw new MusePlannerError("Muse did not return exactly 3 candidate options.");
  }

  const sharedDates = new Set(context.groupAvailability.sharedDates);

  return parsed.candidates.map((candidate, index) => {
    if (
      !candidate ||
      typeof candidate.suggestedStartDate !== "string" ||
      typeof candidate.suggestedEndDate !== "string" ||
      !Array.isArray(candidate.days)
    ) {
      throw new MusePlannerError(`Muse candidate ${index + 1} was malformed.`);
    }

    if (!isShared(candidate, sharedDates)) {
      throw new MusePlannerError(
        `Muse candidate ${index + 1} used dates outside the group's shared availability.`,
      );
    }

    if (context.planningMode === "known_destination" && context.trip.destination) {
      candidate = { ...candidate, destination: context.trip.destination };
    }

    return { id: randomUUID(), ...candidate, generatedAt };
  });
}

export class MuseCandidatePlanner implements CandidatePlanner {
  constructor(private config: MuseConfig) {}

  async generateCandidates(context: PlanningContext): Promise<CandidateTripOption[]> {
    const output = await requestMuseJson(this.config, {
      systemPrompt,
      userPrompt: buildUserPrompt(context),
      schemaName: "trip_candidates",
      schema: responseSchema,
    });

    return parseMuseCandidates(output, context);
  }
}
