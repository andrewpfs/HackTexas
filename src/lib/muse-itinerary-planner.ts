import type { CompromiseContext, ItineraryDraft, ItineraryPlanner } from "./itinerary-planner";
import { MusePlannerError, requestMuseJson, type MuseConfig } from "./muse-client";
import { itineraryActivityTypes, type CandidateTripOption, type ItineraryDay } from "./trip-types";

const stringSchema = { type: "string" };

const itinerarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "basedOnOptionNumber",
    "title",
    "destination",
    "startDate",
    "endDate",
    "summary",
    "compromiseExplanation",
    "compromises",
    "days",
  ],
  properties: {
    basedOnOptionNumber: { type: "integer" },
    title: stringSchema,
    destination: stringSchema,
    startDate: stringSchema,
    endDate: stringSchema,
    summary: stringSchema,
    compromiseExplanation: stringSchema,
    compromises: { type: "array", items: stringSchema },
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dayNumber", "date", "title", "city", "activities"],
        properties: {
          dayNumber: { type: "integer" },
          date: stringSchema,
          city: stringSchema,
          title: stringSchema,
          activities: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["time", "title", "type", "location", "description", "placeSearchQuery"],
              properties: {
                time: stringSchema,
                title: stringSchema,
                type: { type: "string", enum: [...itineraryActivityTypes] },
                location: stringSchema,
                description: stringSchema,
                placeSearchQuery: stringSchema,
              },
            },
          },
        },
      },
    },
  },
};

const systemPrompt = [
  "You are the consensus engine for a GROUP trip planner.",
  "The group compared 3 trip options and voted. Build ONE shared group itinerary.",
  "Rules:",
  "- Start from the strongest option (usually the most votes). If options tie, pick the one that best fits the whole group and say why.",
  "- Do not simply let the majority win. Read every traveler's feedback, especially from people who voted for other options, and adjust specific days or activities to address their concerns where it is practical.",
  "- Explain the major compromises in compromiseExplanation (2-4 sentences) and list each concrete change in compromises, naming whose concern it addresses.",
  "- Use only dates in planning.groupAvailability.sharedDates. Keep startDate..endDate consecutive shared dates, normally the chosen option's dates.",
  "- Include one entry in days for every date from startDate to endDate.",
  "- Set city on every day to the city where the group sleeps that night (for example \"Paris, France\"). On a multi-city trip the city changes on travel days, so the app can book a hotel in each city. The last day uses the city they leave from.",
  "- Use a flexible realistic schedule with chronological clock times, specific locations and short descriptions. Mix a few main activities with meals, transit, check-in/out, rest, free time, wandering and buffers. Avoid impossible back-to-back travel or major attractions every hour; do not force 3-5 attractions into each day.",
  "- Respect each traveler's departure city and the group's budgets. The lowest maximum budget is the binding constraint.",
  "- planning.trip.tripStyle, when present, says how the group wants to travel (for example backpacking across a region). Keep the chosen option's multi-stop route: give each city its own days, include the train, bus or flight legs between stops as Travel activities, and set placeSearchQuery for each stop in the right city.",
  "- Plan around the flights. Day 1 is the arrival day and the last day is the flight home. After a long flight (over about 9 hours, like the US to Japan), Day 1 should only be landing, getting to the hotel, check-in and a relaxed dinner nearby; the last day should be a light morning, then getting to the airport with time to spare. Title those days so the group sees it (for example \"Arrival and Shinjuku Dinner\").",
  "- Many places have no airport of their own (Niagara Falls, Yosemite, Banff, Cinque Terre, small towns). Then the group flies into the nearest major airport (for example Buffalo, BUF, for Niagara Falls) and drives or takes a shuttle or train the rest of the way. Name that airport, and plan the transfer as a Travel activity on Day 1 and before the flight home on the last day.",
  "- Do not invent current prices, flight numbers, or hotel availability.",
  "- previousAttemptProblems, when present, lists why your last itinerary was rejected. Fix every one of them.",
  "- For each activity, set placeSearchQuery to a short Google Maps search that finds one real, well-reviewed place for it, including the neighborhood and city (for example \"ramen Shinjuku Tokyo\"). Use an empty string for Travel and Free time.",
  "- Do not quote travelers' private questionnaire notes. Vote feedback may be referenced.",
  "Respond with JSON only.",
].join("\n");

type MuseItinerary = Omit<ItineraryDraft, "basedOnCandidateId"> & { basedOnOptionNumber: number };

export function parseMuseItinerary(output: unknown, candidates: CandidateTripOption[]): ItineraryDraft {
  const parsed = (output ?? {}) as Partial<MuseItinerary>;

  if (
    typeof parsed.basedOnOptionNumber !== "number" ||
    parsed.basedOnOptionNumber < 1 ||
    parsed.basedOnOptionNumber > candidates.length
  ) {
    throw new MusePlannerError("Muse did not say which option the itinerary is based on.");
  }
  if (!Array.isArray(parsed.days) || !Array.isArray(parsed.compromises)) {
    throw new MusePlannerError("Muse returned a malformed itinerary.");
  }

  return {
    basedOnCandidateId: candidates[parsed.basedOnOptionNumber - 1].id,
    title: String(parsed.title ?? ""),
    destination: String(parsed.destination ?? ""),
    startDate: String(parsed.startDate ?? ""),
    endDate: String(parsed.endDate ?? ""),
    summary: String(parsed.summary ?? ""),
    compromiseExplanation: String(parsed.compromiseExplanation ?? ""),
    compromises: parsed.compromises.map(String),
    days: parsed.days as ItineraryDay[],
  };
}

export class MuseItineraryPlanner implements ItineraryPlanner {
  constructor(private config: MuseConfig) {}

  async generateItinerary(
    context: CompromiseContext,
    candidates: CandidateTripOption[],
  ): Promise<ItineraryDraft> {
    const output = await requestMuseJson(this.config, {
      systemPrompt,
      userPrompt: `Group voting context:\n${JSON.stringify(context, null, 2)}`,
      schemaName: "group_itinerary",
      schema: itinerarySchema,
    });

    return parseMuseItinerary(output, candidates);
  }
}
