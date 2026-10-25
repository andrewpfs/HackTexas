import { addDays, getDatesInRange, type DateWindow } from "./date-utils";
import type { ConfirmedTripDates, Trip } from "./trip-types";

// Free, rough fare hints for picking trip dates. These are well-known US travel
// peaks and day-of-week patterns, not live prices (live fares come from SerpApi).

export type PeakPeriod = { name: string; startDate: string; endDate: string };

export type DateSuggestion = {
  startDate: string;
  endDate: string;
  dayCount: number;
  peaks: string[];
  notes: string[];
  score: number;
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function iso(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

// For example the 4th Thursday of November: nthWeekday(year, 10, 4, 4).
function nthWeekday(year: number, month: number, day: number, n: number) {
  const first = iso(year, month, 1);
  const offset = (day - weekday(first) + 7) % 7;
  return addDays(first, offset + (n - 1) * 7);
}

function lastWeekday(year: number, month: number, day: number) {
  const last = iso(year, month + 1, 0);
  return addDays(last, -((weekday(last) - day + 7) % 7));
}

export function peakPeriodsForYear(year: number): PeakPeriod[] {
  const thanksgiving = nthWeekday(year, 10, 4, 4);
  const memorialDay = lastWeekday(year, 4, 1);
  const laborDay = nthWeekday(year, 8, 1, 1);
  return [
    { name: "Christmas and New Year's", startDate: iso(year - 1, 11, 19), endDate: iso(year, 0, 3) },
    { name: "Spring break season", startDate: iso(year, 2, 7), endDate: iso(year, 2, 22) },
    { name: "Memorial Day weekend", startDate: addDays(memorialDay, -3), endDate: memorialDay },
    { name: "Fourth of July", startDate: iso(year, 6, 2), endDate: iso(year, 6, 6) },
    { name: "Labor Day weekend", startDate: addDays(laborDay, -3), endDate: laborDay },
    { name: "Thanksgiving week", startDate: addDays(thanksgiving, -3), endDate: addDays(thanksgiving, 4) },
    { name: "Christmas and New Year's", startDate: iso(year, 11, 19), endDate: iso(year + 1, 0, 3) },
  ];
}

function peaksOn(date: string) {
  const year = Number(date.slice(0, 4));
  return peakPeriodsForYear(year).filter((peak) => date >= peak.startDate && date <= peak.endDate).map((peak) => peak.name);
}

// Notes and a score for one choice of dates. Higher is better (cheaper to fly).
export function describeTripDates(startDate: string, endDate: string): Omit<DateSuggestion, "dayCount"> {
  const notes: string[] = [];
  let score = 0;
  const departPeaks = peaksOn(startDate);
  const returnPeaks = peaksOn(endDate);
  const peaks = [...new Set(getDatesInRange(startDate, endDate).flatMap(peaksOn))];

  if (departPeaks.length > 0 || returnPeaks.length > 0) {
    const names = [...new Set([...departPeaks, ...returnPeaks])].join(" and ");
    notes.push(`Flies during the ${names} rush. Fares are usually much higher.`);
    score -= 10 * ((departPeaks.length > 0 ? 1 : 0) + (returnPeaks.length > 0 ? 1 : 0));
  } else if (peaks.length > 0) {
    notes.push(`Overlaps ${peaks.join(" and ")}, but you fly before and after the rush.`);
    score -= 2;
  } else {
    notes.push("Avoids holiday travel peaks.");
  }

  const departDay = weekday(startDate);
  const returnDay = weekday(endDate);
  if (departDay === 2 || departDay === 3) {
    notes.push(`Leaves on a ${dayNames[departDay]}, usually one of the cheapest days to fly.`);
    score += 3;
  } else if (departDay === 5 || departDay === 0) {
    notes.push(`Leaves on a ${dayNames[departDay]}, usually a pricier day to fly.`);
    score -= 2;
  }
  if (returnDay === 0) {
    notes.push("Returns on a Sunday, the busiest day to fly home.");
    score -= 2;
  } else if (returnDay === 2 || returnDay === 3) {
    score += 1;
  }

  return { startDate, endDate, peaks, notes, score };
}

// The best few date choices inside the group's shared windows, at the preferred trip
// length, but never shorter than the flights need (minimumDays) when the window allows.
export function suggestTripDates(windows: DateWindow[], preferredDays: number | undefined, limit = 3, minimumDays = 1): DateSuggestion[] {
  const choices: DateSuggestion[] = [];
  for (const window of windows) {
    const length = Math.min(Math.max(preferredDays ?? window.dayCount, minimumDays), window.dayCount);
    if (length < 1) continue;
    for (let start = window.startDate; addDays(start, length - 1) <= window.endDate; start = addDays(start, 1)) {
      const end = addDays(start, length - 1);
      const choice = { ...describeTripDates(start, end), dayCount: length };
      if (length < minimumDays) {
        choice.notes.unshift(`Short for these flights: at least ${minimumDays} days is recommended.`);
        choice.score -= 20;
      }
      choices.push(choice);
    }
  }
  choices.sort((a, b) => b.score - a.score || a.startDate.localeCompare(b.startDate));

  // Keep the picks meaningfully different: starts at least 2 days apart.
  const picked: DateSuggestion[] = [];
  for (const choice of choices) {
    if (picked.every((other) => Math.abs(Date.parse(other.startDate) - Date.parse(choice.startDate)) >= 2 * 86400000)) {
      picked.push(choice);
    }
    if (picked.length === limit) break;
  }
  return picked;
}

// The confirmed dates still count only while every day is shared by the whole group.
export function confirmedDatesStillShared(confirmed: { startDate: string; endDate: string } | undefined, sharedDates: string[]) {
  if (!confirmed || confirmed.startDate > confirmed.endDate) return false;
  const shared = new Set(sharedDates);
  return getDatesInRange(confirmed.startDate, confirmed.endDate).every((date) => shared.has(date));
}

// The dates the host set, while they still apply. Dates the host picked from the
// shared days stop applying if availability changes; dates the host chose on
// purpose outside them (an override) stay until the host changes them.
export function activeConfirmedDates(confirmed: ConfirmedTripDates | undefined, sharedDates: string[]) {
  if (!confirmed || confirmed.startDate > confirmed.endDate) return null;
  if (confirmed.outsideSharedDates) return confirmed;
  return confirmedDatesStillShared(confirmed, sharedDates) ? confirmed : null;
}

// Everyone except the host has to say "I'm in" before Muse plans options.
export function travelersYetToAgree(trip: Pick<Trip, "travelers">, confirmed: ConfirmedTripDates) {
  if (!confirmed.agreedTravelerIds) return [];
  const agreed = new Set(confirmed.agreedTravelerIds);
  return trip.travelers.filter((traveler) => !traveler.isHost && !agreed.has(traveler.id));
}

// Travelers who did not mark every one of these days as free.
export function travelersNotFreeOn(trip: Pick<Trip, "travelers">, startDate: string, endDate: string) {
  const days = getDatesInRange(startDate, endDate);
  return trip.travelers.filter((traveler) => {
    const free = new Set(traveler.availableDates ?? []);
    return days.some((day) => !free.has(day));
  });
}
