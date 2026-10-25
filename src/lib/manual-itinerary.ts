import { randomUUID } from "node:crypto";
import { estimateTravel } from "./travel-time";
import type { ItineraryActivity, Trip } from "./trip-types";

export type ManualStopEdit = {
  travelerId: string;
  itineraryId: string;
  expectedRevision: number;
  dayNumber: number;
  stopIndex: number;
  action: "replace" | "before" | "after";
  activity: ItineraryActivity;
};
export type TravelWarning = { segment: "previous" | "next"; title: string; minutes: number };

// Accept either a 24-hour clock or the itinerary's usual 12-hour clock.
export function clockMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59) return null;
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12;
    if (match[3].toUpperCase() === "PM") hour += 12;
  } else if (hour > 23) return null;
  return hour * 60 + minute;
}

export function isLongTravel(minutes: number | null | undefined) {
  return typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 120;
}

function normalizeClock(value: string) {
  const minutes = clockMinutes(value);
  if (minutes === null) return value;
  const hour = Math.floor(minutes / 60);
  const minute = String(minutes % 60).padStart(2, "0");
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

function point(activity: ItineraryActivity | undefined) {
  const place = activity?.place;
  if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return null;
  if (Math.abs(place.latitude!) > 90 || Math.abs(place.longitude!) > 180) return null;
  return { latitude: place.latitude!, longitude: place.longitude! };
}

export function adjacentTravelWarnings(activities: ItineraryActivity[], index: number) {
  const warnings: TravelWarning[] = [];
  const here = point(activities[index]);
  if (!here) return warnings;
  for (const offset of [-1, 1]) {
    const neighbor = activities[index + offset];
    const there = point(neighbor);
    if (!there) continue;
    const estimate = estimateTravel(here, there, "car");
    if (isLongTravel(estimate.minutes)) {
      warnings.push({ segment: offset === -1 ? "previous" : "next", title: neighbor.title, minutes: estimate.minutes });
    }
  }
  return warnings;
}

export function prepareManualEdit(trip: Trip, edit: ManualStopEdit) {
  const itinerary = trip.itinerary;
  if (!trip.travelers.some((traveler) => traveler.id === edit.travelerId)) throw new Error("Join this trip before editing.");
  if (!itinerary || itinerary.id !== edit.itineraryId || (itinerary.revision ?? 0) !== edit.expectedRevision) {
    throw new Error("The itinerary changed. Close the editor and try again.");
  }
  const day = itinerary.days.find((item) => item.dayNumber === edit.dayNumber);
  const old = day?.activities[edit.stopIndex];
  if (!day || !old || !Number.isInteger(edit.stopIndex)) throw new Error("That stop no longer exists.");
  if (!["replace", "before", "after"].includes(edit.action)) throw new Error("Choose a stop action.");
  const activity = { ...edit.activity, time: normalizeClock(edit.activity.time) };
  if (!activity.title.trim() || activity.title.length > 160 || activity.location.length > 200 || activity.description.length > 600) {
    throw new Error("Enter a short stop title, location, and description.");
  }
  if (/\b(?:move|change|replace|rewrite)\b.{0,25}\b(?:destination|whole trip|entire trip|region)\b/i.test(`${activity.title} ${activity.description}`)) {
    throw new Error("Use @muse for destination or whole-trip changes so the group can vote.");
  }
  const minutes = activity.time ? clockMinutes(activity.time) : null;
  if (activity.time && minutes === null) throw new Error("Use a clock time such as 14:30 or 2:30 PM, or leave it blank.");
  const activities = day.activities.slice();
  let index = edit.stopIndex;
  if (edit.action === "after") index += 1;
  if (edit.action === "replace") activities.splice(index, 1);
  if (minutes !== null) {
    // Keep existing untimed stops in their relative order. Only the new stop moves.
    index = activities.length;
    for (let i = 0; i < activities.length; i += 1) {
      const other = clockMinutes(activities[i].time);
      if (other === minutes) throw new Error("Another stop already uses that time. Choose a different time.");
      if (other !== null && other > minutes) {
        index = i;
        break;
      }
    }
  }
  activities.splice(index, 0, activity);
  return { day, old, activities, warnings: adjacentTravelWarnings(activities, index) };
}

// Called inside the repository's atomic update. No AI or provider calls occur here.
export function applyManualEdit(trip: Trip, edit: ManualStopEdit, allowLongTravel: boolean) {
  const prepared = prepareManualEdit(trip, edit);
  if (prepared.warnings.length && !allowLongTravel) return { saved: false, warnings: prepared.warnings };
  const itinerary = trip.itinerary!;
  prepared.day.activities = prepared.activities;
  if (edit.action === "replace") {
    itinerary.overrides = (itinerary.overrides ?? []).filter((override) =>
      !(override.dayNumber === edit.dayNumber && override.stopTime === prepared.old.time && override.stopTitle === prepared.old.title));
  }
  itinerary.revision = (itinerary.revision ?? 0) + 1;
  itinerary.updatedAt = new Date().toISOString();
  // Cancel old in-flight place responses; manual freeform stops opt out of automatic lookup.
  itinerary.placesStartedAt = undefined;
  if (itinerary.placesStatus === "pending") itinerary.placesStatus = undefined;
  if (trip.pendingItineraryProposal?.status === "pending") trip.pendingItineraryProposal.status = "stale";
  const name = trip.travelers.find((traveler) => traveler.id === edit.travelerId)!.name;
  let text = `${name} manually added ${edit.activity.title} ${edit.action} ${prepared.old.title}.`;
  if (edit.action === "replace") text = `${name} manually replaced ${prepared.old.title} with ${edit.activity.title}.`;
  trip.chat = [...(trip.chat ?? []), { id: randomUUID(), role: "system" as const, authorName: "Group Update", text, createdAt: itinerary.updatedAt }].slice(-200);
  return { saved: true, warnings: prepared.warnings };
}
