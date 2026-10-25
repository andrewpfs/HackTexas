import { activeConfirmedDates, travelersNotFreeOn } from "./date-suggestions";
import { getDatesInRange } from "./date-utils";
import type { GroupFlightTimes } from "./flight-time";
import { calculatePlanningReadiness, getTravelerDepartureLocation, getTripStyle } from "./planning-context";
import type { Trip } from "./trip-types";

// Plain checks run before Muse plans options, so the group is warned when the
// trip as described isn't realistic (and can change it) instead of finding out
// after waiting for options. These are rules of thumb, not live prices.

export type FeasibilityWarning = {
  code: "too_short_for_flights" | "too_many_places" | "budget_below_fare" | "tight_budget" | "not_everyone_free" | "wide_budget_gap";
  title: string;
  detail: string;
};

export type FeasibilityInput = {
  dayCount: number | null;
  destination: string | null;
  flightTimes: GroupFlightTimes | null;
  travelers: { name: string; budget: number | null; departure: string }[];
  // Cities or areas the trip is meant to cover (from the first draft).
  plannedPlaces: string[];
  multiStop: boolean;
  notFreeNames: string[];
  // Real lowest round-trip fares for the chosen dates, when the host checked them.
  fares: { from: string; lowestUsd: number | null }[] | null;
};

function money(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// A typical economy round trip for this flight length. Only used for a rough
// warning when the host hasn't checked real fares.
export function typicalRoundTripUsd(hoursEachWay: number) {
  if (hoursEachWay <= 3) return 300;
  if (hoursEachWay <= 6) return 500;
  if (hoursEachWay <= 9) return 800;
  return 1100;
}

// Leaves at least this much a day for lodging, food and activities.
const minimumDailySpendUsd = 60;

export function checkFeasibility(input: FeasibilityInput): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];
  const days = input.dayCount;

  if (days && input.flightTimes && days < input.flightTimes.recommendedMinimumDays) {
    warnings.push({
      code: "too_short_for_flights",
      title: "Short for the flights",
      detail: `${days} ${days === 1 ? "day" : "days"} is short when the longest flight is about ${input.flightTimes.longestHoursEachWay} hours each way. Most of the first and last days go to flying; at least ${input.flightTimes.recommendedMinimumDays} days is recommended.`,
    });
  }

  const places = input.plannedPlaces.length;
  const daysPerPlace = input.multiStop ? 2 : 1.5;
  if (days && places > 1 && days < places * daysPerPlace) {
    warnings.push({
      code: "too_many_places",
      title: "A lot of places for the time",
      detail: `${places} places (${input.plannedPlaces.join(", ")}) in ${days} days means moving almost every day. Muse may drop a stop or two.`,
    });
  }

  // Budgets against real fares first, then a rough rule of thumb.
  const fareByCity = new Map((input.fares ?? []).map((fare) => [fare.from.trim().toLowerCase(), fare.lowestUsd]));
  const fareShort: string[] = [];
  const roughShort: string[] = [];
  for (const traveler of input.travelers) {
    if (!traveler.budget) continue;
    const realFare = fareByCity.get(traveler.departure.trim().toLowerCase());
    if (typeof realFare === "number") {
      const leftPerDay = days ? (traveler.budget - realFare) / days : traveler.budget - realFare;
      if (realFare >= traveler.budget * 0.7 || (days && leftPerDay < minimumDailySpendUsd)) {
        fareShort.push(`${traveler.name} (${money(traveler.budget)} budget, flights from ${money(realFare)})`);
      }
      continue;
    }
    const estimate = input.flightTimes?.estimates.find((item) => item.from.trim().toLowerCase() === traveler.departure.trim().toLowerCase());
    if (!estimate || !days) continue;
    const flight = typicalRoundTripUsd(estimate.hoursEachWay);
    const leftPerDay = (traveler.budget - flight) / days;
    if (leftPerDay < minimumDailySpendUsd) {
      roughShort.push(`${traveler.name} (${money(traveler.budget)}: about ${money(Math.max(0, leftPerDay))} a day after a typical ${money(flight)} round trip)`);
    }
  }
  if (fareShort.length > 0) {
    warnings.push({ code: "budget_below_fare", title: "Budget may not cover the flight", detail: `Real fares for these dates leave little or nothing for the trip: ${fareShort.join("; ")}.` });
  }
  if (roughShort.length > 0) {
    warnings.push({ code: "tight_budget", title: "Tight budget", detail: `${roughShort.join("; ")}. Check fares or raise the budget.` });
  }

  if (input.notFreeNames.length > 0) {
    warnings.push({
      code: "not_everyone_free",
      title: "Not everyone is free every day",
      detail: `${listNames(input.notFreeNames)} didn't mark every trip day as free.`,
    });
  }

  const budgets = input.travelers.map((traveler) => traveler.budget).filter((budget): budget is number => typeof budget === "number" && budget > 0);
  if (budgets.length > 1) {
    const lowest = Math.min(...budgets);
    const highest = Math.max(...budgets);
    if (highest >= lowest * 3) {
      warnings.push({
        code: "wide_budget_gap",
        title: "Very different budgets",
        detail: `Budgets range from ${money(lowest)} to ${money(highest)}. Muse plans around ${money(lowest)}, so the trip may feel basic to some.`,
      });
    }
  }

  return warnings;
}

// The same checks, read straight from a trip.
export function getTripFeasibility(trip: Trip, flightTimes: GroupFlightTimes | null) {
  const readiness = calculatePlanningReadiness(trip);
  const confirmed = activeConfirmedDates(trip.confirmedDates, readiness.sharedDates);
  const dayCount = confirmed ? getDatesInRange(confirmed.startDate, confirmed.endDate).length : trip.preferredDurationDays ?? null;
  const style = getTripStyle(trip);
  const fares = confirmed
    ? trip.datePriceCheck?.windows.find((window) => window.startDate === confirmed.startDate && window.endDate === confirmed.endDate)?.fares ?? null
    : null;

  return checkFeasibility({
    dayCount,
    destination: trip.destination?.trim() || null,
    flightTimes,
    travelers: trip.travelers.map((traveler) => ({
      name: traveler.name,
      budget: traveler.preferences?.maximumBudget ?? null,
      departure: getTravelerDepartureLocation(trip, traveler),
    })),
    plannedPlaces: trip.sketch?.status === "done" ? trip.sketch.places.map((place) => place.name) : [],
    multiStop: style.styles.length > 0 || style.destinationIsRegion,
    notFreeNames: confirmed ? travelersNotFreeOn(trip, confirmed.startDate, confirmed.endDate).map((traveler) => traveler.name) : [],
    fares,
  });
}
