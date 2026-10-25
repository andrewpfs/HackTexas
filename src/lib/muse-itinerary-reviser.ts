import type { ItineraryReviser, RevisionRequest, RevisionResult } from "./itinerary-revision";
import { MusePlannerError, requestMuseJson, type MuseConfig } from "./muse-client";
import { itineraryActivityTypes, type ItineraryDay } from "./trip-types";

const stringSchema = { type: "string" };

const revisionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "changed", "changes", "days"],
  properties: {
    reply: stringSchema,
    changed: { type: "boolean" },
    changes: { type: "array", items: stringSchema },
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
  "You are Muse, the planning assistant inside a GROUP trip planner. The group already has one shared itinerary and is chatting with you about it.",
  "A traveler just wrote a message. Decide how to respond:",
  "- If they dislike or want to change something and give a reason, update the itinerary and set changed to true.",
  "- If they ask a question, or the request is unclear, or it would clearly hurt another traveler's stated interests or an earlier message in the chat, set changed to false and reply with a short answer, question, or compromise. Do not silently overrule someone else.",
  "When you change the plan:",
  "- Return the COMPLETE list of days (every day, with every activity), not just the edited ones. Keep unchanged stops exactly as they were, including their title and placeSearchQuery.",
  "- Keep the same dates, the same number of days, and the same day numbers.",
  "- Only change what the message asks for, plus nearby stops if needed to keep the day sensible (geography, timing, meals).",
  "- Give each new or changed stop a clock time, a specific location, a short description, and a placeSearchQuery for Google Maps that includes the neighborhood and city. Use an empty string for Travel and Free time.",
  "- Respect the group's budgets and each traveler's departure city. Do not invent prices or bookings.",
  "reply is 1-3 friendly sentences addressed to the traveler. Say what you changed and why, or what you need to know. changes lists each concrete edit in a short phrase, such as \"Day 2: swapped Shibuya shopping for Meiji Jingu forest walk\". When changed is false, changes is [] and days is [].",
  "Respond with JSON only.",
].join("\n");

type MuseRevision = {
  reply?: unknown;
  changed?: unknown;
  changes?: unknown;
  days?: unknown;
};

export function parseMuseRevision(output: unknown): RevisionResult {
  const parsed = (output ?? {}) as MuseRevision;

  if (typeof parsed.reply !== "string" || parsed.reply.trim() === "") {
    throw new MusePlannerError("Muse did not reply.");
  }

  const changes = Array.isArray(parsed.changes) ? parsed.changes.map(String) : [];
  const days = Array.isArray(parsed.days) ? (parsed.days as ItineraryDay[]) : [];

  return {
    reply: parsed.reply.trim(),
    changes: parsed.changed === true ? changes : [],
    days: parsed.changed === true && days.length > 0 ? days : null,
  };
}

export class MuseItineraryReviser implements ItineraryReviser {
  constructor(private config: MuseConfig) {}

  async revise(request: RevisionRequest): Promise<RevisionResult> {
    const output = await requestMuseJson(this.config, {
      systemPrompt,
      userPrompt: `Current conversation and plan:\n${JSON.stringify(request, null, 2)}`,
      schemaName: "itinerary_revision",
      schema: revisionSchema,
    });

    return parseMuseRevision(output);
  }
}
