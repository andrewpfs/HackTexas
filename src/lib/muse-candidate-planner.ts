import { randomUUID } from "node:crypto";
import { addDays, getDatesInRange, isValidISODate } from "./date-utils";
import type { CandidatePlanner } from "./candidate-planner";
import type { PlanningContext } from "./planning-context";
import type { CandidateTripOption } from "./trip-types";
import { MusePlannerError, requestMuseJson, type MuseConfig } from "./muse-client";
import { tripStylePromptRule } from "./trip-style";

export { MusePlannerError } from "./muse-client";

export type MuseCandidate = {
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
  "- Follow the host's trip description in trip.prompt. If it names places (for example \"Tokyo and Osaka\"), every option should include them unless the dates or budgets make that impossible, and say so in considerations. Let the three options differ in pace and emphasis.",
  "- Use only dates listed in groupAvailability.sharedDates. A candidate's whole date range must be consecutive shared dates.",
  "- Each traveler departs from their own departureLocation. Consider all of them when choosing destinations.",
  "- Stay within the group's budgets. The lowest maximum budget is the binding constraint.",
  "- Balance different interests and lodging preferences, and explain the tradeoffs in rationale and considerations.",
  "- If planningMode is known_destination, all three options use that destination and differ in approach. When the destination is a region or the trip style is multi-stop, the three options are different routes through it.",
  tripStylePromptRule,
  "- Many places have no airport of their own (Niagara Falls, Yosemite, Banff, Cinque Terre, small towns). Then the group flies into the nearest major airport (for example Buffalo, BUF, for Niagara Falls) and drives or takes a shuttle or train the rest of the way. Name that airport, and plan the transfer as a Travel activity on Day 1 and before the flight home on the last day.",
  "- If trip.confirmedDates is present, the group agreed on exactly those dates: every option starts on its startDate and ends on its endDate. Some travelers in travelersNotFreeOnEveryDay may arrive late or leave early; mention it in considerations.",
  "- trip.feasibilityWarnings lists problems the group was warned about (too short for the flights, tight budgets, too many places). Plan around them and say in considerations how each option handles them.",
  "- If planningMode is unknown_destination, recommend three different destinations that fit the group.",
  "- Count travel days. Estimate each traveler's flight time from their departureLocation; trip.flightTimes gives estimates when the destination is known. Day 1 is the arrival day and the last day is the flight home. Long flights (over about 9 hours, like the US to Japan) leave little of those days, and flying from the Americas to Asia lands a calendar day later. Keep Day 1 light (arrive, check in, a nearby dinner) and plan the last day around getting to the airport.",
  "- Never suggest a trip so short that flying takes most of it. Treat trip.flightTimes.recommendedMinimumDays as the shortest sensible length whenever the shared dates allow it. If the shared dates are shorter than that, still use them but say plainly in considerations how much time the flights eat.",
  "- If planningMode is unknown_destination, only recommend destinations whose flight time fits the available days: for about 2-4 days stay within roughly 5 hours of the group; save long-haul destinations like Japan or Europe for about a week or more.",
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

// With more travelers there are fewer shared days, and Muse sometimes slips a day
// outside them (or misreads the agreed dates). Instead of failing the whole request,
// move the option into the best shared window and re-date its days.
export function fitCandidateToSharedDates(candidate: MuseCandidate, context: PlanningContext): MuseCandidate | null {
  const shared = new Set(context.groupAvailability.sharedDates);
  if (isValidISODate(candidate.suggestedStartDate) && isValidISODate(candidate.suggestedEndDate) && candidate.suggestedStartDate <= candidate.suggestedEndDate && isShared(candidate, shared)) {
    return candidate;
  }
  const windows = context.groupAvailability.sharedWindows;
  if (windows.length === 0) return null;

  const wantedDays = Math.max(1, candidate.days.length || candidate.estimatedDurationDays || 1);
  const start = isValidISODate(candidate.suggestedStartDate) ? candidate.suggestedStartDate : "";
  // Prefer the window that contains Muse's start date, then one long enough, then the longest.
  const window =
    windows.find((item) => start >= item.startDate && start <= item.endDate) ??
    windows.find((item) => item.dayCount >= wantedDays) ??
    [...windows].sort((a, b) => b.dayCount - a.dayCount)[0];
  const length = Math.min(wantedDays, window.dayCount);
  const firstDay = start >= window.startDate && addDays(start, length - 1) <= window.endDate ? start : window.startDate;
  const days = candidate.days.slice(0, length).map((day, index) => ({ ...day, dayNumber: index + 1, date: addDays(firstDay, index) }));
  const finalLength = Math.max(1, days.length);
  return {
    ...candidate,
    suggestedStartDate: firstDay,
    suggestedEndDate: addDays(firstDay, finalLength - 1),
    estimatedDurationDays: finalLength,
    days,
  };
}

export function parseMuseCandidates(
  output: unknown,
  context: PlanningContext,
  generatedAt = new Date().toISOString(),
): CandidateTripOption[] {
  const parsed = (output ?? {}) as { candidates?: MuseCandidate[] };

  // Extra options are dropped; too few is retried by the planner.
  if (!Array.isArray(parsed.candidates) || parsed.candidates.length < 3) {
    throw new MusePlannerError(`Muse returned ${Array.isArray(parsed.candidates) ? parsed.candidates.length : "no"} options instead of 3.`);
  }

  return parsed.candidates.slice(0, 3).map((candidate, index) => {
    if (
      !candidate ||
      typeof candidate.suggestedStartDate !== "string" ||
      typeof candidate.suggestedEndDate !== "string" ||
      !Array.isArray(candidate.days)
    ) {
      throw new MusePlannerError(`Muse candidate ${index + 1} was malformed.`);
    }

    const fitted = fitCandidateToSharedDates(candidate, context);
    if (!fitted || fitted.days.length === 0) {
      throw new MusePlannerError(
        `Muse candidate ${index + 1} used dates outside the group's shared availability (${candidate.suggestedStartDate} to ${candidate.suggestedEndDate}; allowed ${context.groupAvailability.sharedDates[0] ?? "none"} to ${context.groupAvailability.sharedDates.at(-1) ?? "none"}).`,
      );
    }
    candidate = fitted;

    if (context.planningMode === "known_destination" && context.trip.destination) {
      candidate = { ...candidate, destination: context.trip.destination };
    }

    return { id: randomUUID(), ...candidate, generatedAt };
  });
}

export class MuseCandidatePlanner implements CandidatePlanner {
  constructor(private config: MuseConfig) {}

  // If Muse's answer can't be used, ask once more and say what was wrong.
  async generateCandidates(context: PlanningContext): Promise<CandidateTripOption[]> {
    let problem = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const output = await requestMuseJson(this.config, {
        systemPrompt,
        userPrompt: buildUserPrompt(context) + (problem ? `\n\nYour previous answer could not be used: ${problem} Return exactly 3 complete options using only groupAvailability.sharedDates.` : ""),
        schemaName: "trip_candidates",
        schema: responseSchema,
      });
      try {
        return parseMuseCandidates(output, context);
      } catch (error) {
        if (!(error instanceof MusePlannerError) || attempt === 1) throw error;
        problem = error.message;
        console.warn(`Muse options were unusable (${problem}); asking again.`);
      }
    }
    throw new MusePlannerError("Muse could not plan usable options.");
  }
}
