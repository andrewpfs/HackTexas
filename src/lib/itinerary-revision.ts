import { randomUUID } from "node:crypto";
import type { ItineraryDraft } from "./itinerary-planner";
import { isPreservedUntimedStop, validateItineraryDraft } from "./itinerary-validation";
import type { PlanningContext } from "./planning-context";
import type { ChatMessage, GroupItinerary, ItineraryDay } from "./trip-types";

export const maximumChatMessageLength = 600;
const historyLength = 10;

export type RevisionRequest = {
  planning: PlanningContext;
  itinerary: Pick<GroupItinerary, "title" | "destination" | "startDate" | "endDate" | "summary" | "days">;
  history: { author: string; role: ChatMessage["role"]; text: string }[];
  message: { author: string; text: string; focus: string | null };
};

export type PersonalPlan = {
  dayNumber: number;
  stopTitle: string;
  title: string;
  location: string;
  note: string;
};

export type RevisionResult = {
  kind?: "reply_only" | "personal" | "shared_minor" | "shared_major";
  proposedDestination?: string;
  proposedTripName?: string;
  reply: string;
  changes: string[];
  // Set when only the sender wants something different: their own plan for one stop.
  personal?: PersonalPlan | null;
  // The complete revised days, or null when the plan stays as it is.
  days: ItineraryDay[] | null;
};

export function mentionsMuse(text: string) {
  return text.trim().toLowerCase().startsWith("@muse");
}

export interface ItineraryReviser {
  revise(request: RevisionRequest): Promise<RevisionResult>;
}

export function buildRevisionRequest(
  planning: PlanningContext,
  itinerary: GroupItinerary,
  messages: ChatMessage[],
  newMessage: ChatMessage,
): RevisionRequest {
  const previous = messages.filter((message) => message.id !== newMessage.id).slice(-historyLength);

  return {
    planning,
    itinerary: {
      title: itinerary.title,
      destination: itinerary.destination,
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      summary: itinerary.summary,
      // Place details are not sent: the model only needs what each stop is.
      days: itinerary.days.map((day) => ({
        ...day,
        activities: day.activities.map(({ place: _place, ...activity }) => {
          void _place;
          return activity;
        }),
      })),
    },
    history: previous.map((message) => ({
      author: message.authorName,
      role: message.role,
      text: message.text,
    })),
    message: {
      author: newMessage.authorName,
      text: newMessage.text,
      focus: newMessage.focus ? `Day ${newMessage.focus.dayNumber}: ${newMessage.focus.title}` : null,
    },
  };
}

function activityKey(title: string, query: string | undefined, location: string) {
  return `${title.trim().toLowerCase()}|${(query ?? "").trim().toLowerCase()}|${location.trim().toLowerCase()}`;
}

// Stops that are unchanged keep the real place that was already found for them.
export function carryOverPlaces(oldDays: ItineraryDay[], newDays: ItineraryDay[]) {
  const known = new Map<string, NonNullable<ItineraryDay["activities"][number]["place"]>>();
  for (const day of oldDays) {
    for (const activity of day.activities) {
      if (activity.place) {
        known.set(activityKey(activity.title, activity.placeSearchQuery, activity.location), activity.place);
      }
    }
  }

  return newDays.map((day) => ({
    ...day,
    activities: day.activities.map((activity) => {
      const place = known.get(activityKey(activity.title, activity.placeSearchQuery, activity.location));
      return place ? { ...activity, place } : { ...activity, place: undefined };
    }),
  }));
}

export function validateRevisedDays(
  itinerary: GroupItinerary,
  days: ItineraryDay[],
  sharedDates: string[],
  basedOnCandidateId: string,
) {
  if (!Array.isArray(days) || days.some((day) => !day || !Array.isArray(day.activities) || day.activities.some((activity) => !activity || typeof activity.title !== "string" || typeof activity.time !== "string"))) {
    return { valid: false, errors: ["Muse returned malformed itinerary days."] };
  }
  const draft: ItineraryDraft = {
    basedOnCandidateId,
    title: itinerary.title,
    destination: itinerary.destination,
    startDate: itinerary.startDate,
    endDate: itinerary.endDate,
    summary: itinerary.summary,
    compromiseExplanation: itinerary.compromiseExplanation,
    compromises: itinerary.compromises,
    days,
  };
  const validation = validateItineraryDraft(draft, sharedDates, [basedOnCandidateId], itinerary.days);
  const errors = [...validation.errors];

  // The trip keeps the same dates: one entry per original day.
  const originalDates = itinerary.days.map((day) => day.date).join(",");
  if (days.map((day) => day.date).join(",") !== originalDates) {
    errors.push("The revised plan must keep the same days.");
  }

  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    if (day.dayNumber !== itinerary.days[index]?.dayNumber || !day.title?.trim()) {
      errors.push("The revised plan must keep its day numbers and titles.");
    }
    let previousMinutes = -1;
    for (const activity of day.activities ?? []) {
      if (isPreservedUntimedStop(itinerary.days, day.dayNumber, activity)) continue;
      const clock = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(activity.time ?? "");
      if (!clock || Number(clock[1]) < 1 || Number(clock[1]) > 12 || Number(clock[2]) > 59) {
        errors.push("Use valid clock times for every stop.");
        continue;
      }
      let minutes = (Number(clock[1]) % 12) * 60 + Number(clock[2]);
      if (clock[3].toUpperCase() === "PM") minutes += 720;
      if (minutes <= previousMinutes) errors.push("Stops must be in chronological order.");
      previousMinutes = minutes;
      if (typeof activity.location !== "string" || typeof activity.description !== "string") {
        errors.push("Every stop needs a location and description.");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function makeChatMessage(
  fields: Pick<ChatMessage, "role" | "authorName" | "text"> & Partial<ChatMessage>,
): ChatMessage {
  return { id: randomUUID(), createdAt: new Date().toISOString(), ...fields };
}

export function validateChatInput(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false as const, error: "Write a message first." };
  }

  const values = body as Record<string, unknown>;
  const text = typeof values.text === "string" ? values.text.trim() : "";
  if (text === "") {
    return { valid: false as const, error: "Write a message first." };
  }
  if (text.length > maximumChatMessageLength) {
    return { valid: false as const, error: `Keep messages under ${maximumChatMessageLength} characters.` };
  }
  if (typeof values.travelerId !== "string" || values.travelerId === "") {
    return { valid: false as const, error: "Join this trip on this device to chat." };
  }

  let focus: { dayNumber: number; title: string } | undefined;
  const rawFocus = values.focus as { dayNumber?: unknown; title?: unknown } | null | undefined;
  if (rawFocus && typeof rawFocus.dayNumber === "number" && typeof rawFocus.title === "string") {
    focus = { dayNumber: rawFocus.dayNumber, title: rawFocus.title.slice(0, 120) };
  }

  return { valid: true as const, data: { travelerId: values.travelerId, text, focus } };
}

// Stand-in used when Muse is not configured: it can read the chat but not edit the plan.
export class MockItineraryReviser implements ItineraryReviser {
  async revise(): Promise<RevisionResult> {
    return {
      reply:
        "I can't rewrite the plan in demo mode, but I saved your feedback. Connect Muse Spark and I'll update the itinerary from messages like this.",
      changes: [],
      days: null,
    };
  }
}
