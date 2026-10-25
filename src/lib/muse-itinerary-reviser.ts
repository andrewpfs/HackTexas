import type { ItineraryReviser, RevisionRequest, RevisionResult } from "./itinerary-revision";
import { MusePlannerError, requestMuseJson, type MuseConfig } from "./muse-client";
import { itineraryActivityTypes, type ItineraryDay } from "./trip-types";

const stringSchema = { type: "string" };

const revisionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "changed", "changes", "days", "personal", "kind", "proposedDestination", "proposedTripName"],
  properties: {
    kind: { type: "string", enum: ["reply_only", "personal", "shared_minor", "shared_major"] },
    proposedDestination: stringSchema,
    proposedTripName: stringSchema,
    reply: stringSchema,
    changed: { type: "boolean" },
    changes: { type: "array", items: stringSchema },
    personal: {
      type: "object",
      additionalProperties: false,
      required: ["applies", "dayNumber", "stopTitle", "title", "location", "description"],
      properties: {
        applies: { type: "boolean" },
        dayNumber: { type: "integer" },
        stopTitle: stringSchema,
        title: stringSchema,
        location: stringSchema,
        description: stringSchema,
      },
    },
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
  "- If only the sender wants something different and the rest of the group would likely keep the stop (for example \"I'd rather hit the arcade while everyone shops\"), do NOT change the shared plan. Set changed to false and fill personal: applies true, the dayNumber and the exact title of the group stop they are skipping, and what they will do instead (title, location, short description). Their friends can join that plan later.",
  "- Otherwise set personal.applies to false with empty strings and dayNumber 0.",
  "Classify kind as reply_only, personal, shared_minor, or shared_major. Destination/city/region changes, multiple rewritten days, or a fundamentally different trip concept are shared_major and require a group vote. Never claim a major proposal is already applied.",
  "The app runs the group vote for every shared_major change: it shows Approve and Reject buttons to every traveler and applies the change only after a majority approves. So never ask travelers to confirm or agree in chat. When anyone clearly asks for a major change (like moving the trip to another city), return shared_major with the full new plan right away, and say in reply that the group can now vote on it.",
  "For shared_major return changed true, complete days, proposedDestination and proposedTripName. Otherwise use empty strings for those two fields. A destination change must explicitly name the new city in proposedDestination.",
  "Use a flexible realistic schedule with meals, transit, check-in/out, rest, wandering, free time and buffers. Avoid hourly attractions and allow enough travel time. A free day can have one flexible Free time block. Keep clock times chronological.",
  "When you change the plan:",
  "- Return the COMPLETE list of days (every day, with every activity), not just the edited ones. Keep unchanged stops exactly as they were, including their title and placeSearchQuery.",
  "- Preserve unchanged user-added untimed stops with an empty time. Do not invent times for those stops.",
  "- Keep the same dates, the same number of days, and the same day numbers.",
  "- Only change what the message asks for, plus nearby stops if needed to keep the day sensible (geography, timing, meals).",
  "- Every stop you add or change needs a clock time like \"9:00 AM\", listed in time order within its day. Only stops copied unchanged from the current plan may keep an empty time.",
  "- Give each new or changed stop a clock time, a specific location, a short description, and a placeSearchQuery for Google Maps that includes the neighborhood and city. Use an empty string for Travel and Free time.",
  "- Respect the group's budgets and each traveler's departure city. Do not invent prices or bookings.",
  "reply is 1-3 friendly sentences addressed to the traveler. Say what you changed and why, or what you need to know. changes lists each concrete edit in a short phrase, such as \"Day 2: swapped Shibuya shopping for Meiji Jingu forest walk\". When changed is false, changes is [] and days is [].",
  "Respond with JSON only.",
].join("\n");

type MuseRevision = {
  kind?: unknown;
  proposedDestination?: unknown;
  proposedTripName?: unknown;
  reply?: unknown;
  changed?: unknown;
  changes?: unknown;
  days?: unknown;
  personal?: { applies?: unknown; dayNumber?: unknown; stopTitle?: unknown; title?: unknown; location?: unknown; description?: unknown };
};

export function parseMuseRevision(output: unknown): RevisionResult {
  const parsed = (output ?? {}) as MuseRevision;

  if (typeof parsed.reply !== "string" || parsed.reply.trim() === "") {
    throw new MusePlannerError("Muse did not reply.");
  }

  const changes = Array.isArray(parsed.changes) ? parsed.changes.map(String) : [];
  const days = Array.isArray(parsed.days) ? (parsed.days as ItineraryDay[]) : [];

  const personal = parsed.personal;
  const personalPlan =
    parsed.changed !== true &&
    personal?.applies === true &&
    typeof personal.dayNumber === "number" &&
    typeof personal.stopTitle === "string" &&
    typeof personal.title === "string" &&
    personal.title.trim() !== ""
      ? {
          dayNumber: personal.dayNumber,
          stopTitle: personal.stopTitle.trim(),
          title: personal.title.trim(),
          location: typeof personal.location === "string" ? personal.location.trim() : "",
          note: typeof personal.description === "string" ? personal.description.trim() : "",
        }
      : null;

  if (parsed.kind !== undefined && !["reply_only", "personal", "shared_minor", "shared_major"].includes(String(parsed.kind))) {
    throw new MusePlannerError("Muse returned an invalid revision kind.");
  }
  if (parsed.changed === true && days.length === 0) throw new MusePlannerError("Muse omitted the revised days.");
  return {
    kind: parsed.kind as RevisionResult["kind"],
    proposedDestination: typeof parsed.proposedDestination === "string" ? parsed.proposedDestination.trim() : undefined,
    proposedTripName: typeof parsed.proposedTripName === "string" ? parsed.proposedTripName.trim() : undefined,
    reply: parsed.reply.trim(),
    changes: parsed.changed === true ? changes : [],
    days: parsed.changed === true && days.length > 0 ? days : null,
    personal: personalPlan,
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
