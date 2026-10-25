import {
  activityInterestOptions,
  lodgingTypeOptions,
  type ActivityInterest,
  type GroupLodgingPreference,
  type LodgingAmenity,
  type LodgingType,
  type Traveler,
  type TravelerPreferences,
  type Trip,
} from "./trip-types";
import {
  findSharedDates,
  getContiguousDateWindows,
  getDatesInRange,
  type DateWindow,
} from "./date-utils";
import { confirmedDatesStillShared } from "./date-suggestions";

export type PlanningMode = "known_destination" | "unknown_destination";

export type PlanningIssue = {
  code:
    | "no_travelers"
    | "preferences_incomplete"
    | "availability_incomplete"
    | "departure_location_missing"
    | "no_shared_dates"
    | "fewer_travelers_than_expected"
    | "shared_window_shorter_than_preferred"
    | "dates_not_confirmed";
  message: string;
  travelerName?: string;
};

export type PlanningReadiness = {
  planningMode: PlanningMode;
  readyForCandidateGeneration: boolean;
  blockers: PlanningIssue[];
  warnings: PlanningIssue[];
  travelerCount: number;
  preferencesCompleteCount: number;
  availabilityCompleteCount: number;
  expectedTravelerCount: number | null;
  sharedDates: string[];
  sharedWindows: DateWindow[];
  viableWindows: DateWindow[];
};

export type PlanningTraveler = {
  name: string;
  isHost: boolean;
  departureLocation: string;
  overallMaximumBudgetUsd: number;
  foodBudgetPerDayUsd: number | null;
  lodgingBudgetPerNightUsd: number | null;
  activitiesBudgetUsd: number | null;
  preferredDurationDays: number;
  activityInterests: ActivityInterest[];
  lodgingType: LodgingType;
  groupLodgingPreference: GroupLodgingPreference;
  lodgingPriceLevel: number | null;
  activityDetails: string;
  lodgingAmenities: LodgingAmenity[];
  destinationPreferences: string;
  notes: string;
  availableDates: string[];
};

export type LodgingTypeCount = {
  lodgingType: LodgingType;
  travelerCount: number;
};

export type PlanningGroupSummary = {
  lowestMaximumBudgetUsd: number;
  highestMaximumBudgetUsd: number;
  sharedActivityInterests: ActivityInterest[];
  allActivityInterests: ActivityInterest[];
  lodgingTypeCounts: LodgingTypeCount[];
};

export type PlanningContext = {
  planningMode: PlanningMode;
  trip: {
    prompt: string;
    name: string | null;
    destination: string | null;
    earliestPossibleDate: string;
    latestPossibleDate: string;
    hostPreferredDurationDays: number | null;
    expectedTravelerCount: number | null;
    joinedTravelerCount: number;
    // The first rough plan drawn from the host's description, when there is one.
    sketch?: { summary: string; places: string[]; days: string[] };
  };
  groupAvailability: {
    sharedDates: string[];
    sharedWindows: DateWindow[];
    viableWindows: DateWindow[];
    submittedTravelerCount: number;
    totalTravelerCount: number;
  };
  groupSummary: PlanningGroupSummary;
  travelers: PlanningTraveler[];
};

export type PlanningContextBuildResult =
  | {
      success: true;
      readiness: PlanningReadiness;
      context: PlanningContext;
    }
  | {
      success: false;
      readiness: PlanningReadiness;
    };

export function getPlanningMode(trip: Trip): PlanningMode {
  if (trip.destination && trip.destination.trim() !== "") {
    return "known_destination";
  }

  return "unknown_destination";
}

function hasCompletePreferences(traveler: Traveler) {
  return traveler.preferencesComplete === true && traveler.preferences !== undefined;
}

function hasCompleteAvailability(traveler: Traveler) {
  return traveler.availabilityComplete === true && Array.isArray(traveler.availableDates);
}

export function getTravelerDepartureLocation(trip: Trip, traveler: Traveler) {
  if (traveler.departureLocation && traveler.departureLocation.trim() !== "") {
    return traveler.departureLocation.trim();
  }

  if (traveler.isHost && trip.origin && trip.origin.trim() !== "") {
    return trip.origin.trim();
  }

  return "";
}

function getSortedUniqueDates(dates: string[]) {
  const uniqueDates: string[] = [];

  for (const date of dates) {
    if (!uniqueDates.includes(date)) {
      uniqueDates.push(date);
    }
  }

  uniqueDates.sort();
  return uniqueDates;
}

export function calculatePlanningReadiness(trip: Trip): PlanningReadiness {
  const blockers: PlanningIssue[] = [];
  const warnings: PlanningIssue[] = [];
  const submittedAvailability: string[][] = [];
  let preferencesCompleteCount = 0;
  let availabilityCompleteCount = 0;

  if (trip.travelers.length === 0) {
    blockers.push({
      code: "no_travelers",
      message: "At least one traveler needs to join before trip options can be generated.",
    });
  }

  for (const traveler of trip.travelers) {
    if (getTravelerDepartureLocation(trip, traveler) === "") {
      blockers.push({
        code: "departure_location_missing",
        message: `${traveler.name} still needs to add a departure city.`,
        travelerName: traveler.name,
      });
    }

    if (hasCompletePreferences(traveler)) {
      preferencesCompleteCount += 1;
    } else {
      blockers.push({
        code: "preferences_incomplete",
        message: `${traveler.name} still needs to complete preferences.`,
        travelerName: traveler.name,
      });
    }

    if (hasCompleteAvailability(traveler)) {
      availabilityCompleteCount += 1;
      submittedAvailability.push(getSortedUniqueDates(traveler.availableDates || []));
    } else {
      blockers.push({
        code: "availability_incomplete",
        message: `${traveler.name} still needs to submit availability.`,
        travelerName: traveler.name,
      });
    }
  }

  const sharedDates = findSharedDates(submittedAvailability);
  const sharedWindows = getContiguousDateWindows(sharedDates);
  const viableWindows: DateWindow[] = [];

  for (const window of sharedWindows) {
    if (
      trip.preferredDurationDays === undefined ||
      window.dayCount >= trip.preferredDurationDays
    ) {
      viableWindows.push({ ...window });
    }
  }

  const everyTravelerSubmittedAvailability =
    trip.travelers.length > 0 && availabilityCompleteCount === trip.travelers.length;

  if (everyTravelerSubmittedAvailability && sharedDates.length === 0) {
    blockers.push({
      code: "no_shared_dates",
      message: "Your group doesn't currently have any shared travel dates.",
    });
  }

  const expectedTravelerCount = trip.expectedTravelerCount || null;
  if (
    expectedTravelerCount !== null &&
    trip.travelers.length < expectedTravelerCount
  ) {
    warnings.push({
      code: "fewer_travelers_than_expected",
      message: `${trip.travelers.length} travelers have joined; the host originally expected ${expectedTravelerCount}.`,
    });
  }

  if (
    everyTravelerSubmittedAvailability &&
    trip.preferredDurationDays !== undefined &&
    sharedWindows.length > 0 &&
    viableWindows.length === 0
  ) {
    let longestWindow = sharedWindows[0];

    for (const window of sharedWindows) {
      if (window.dayCount > longestWindow.dayCount) {
        longestWindow = window;
      }
    }

    warnings.push({
      code: "shared_window_shorter_than_preferred",
      message: `The longest shared window is ${longestWindow.dayCount} ${longestWindow.dayCount === 1 ? "day" : "days"}, shorter than the host's preferred ${trip.preferredDurationDays}-day trip.`,
    });
  }

  // Before Muse plans options, the host reviews and confirms the exact dates.
  // Trips that already have options or an itinerary keep working without it.
  const plannedAlready = Boolean(trip.candidateOptions?.length || trip.itinerary);
  if (blockers.length === 0 && !plannedAlready && !confirmedDatesStillShared(trip.confirmedDates, sharedDates)) {
    blockers.push({
      code: "dates_not_confirmed",
      message: trip.confirmedDates
        ? "Availability changed, so the host needs to confirm the trip dates again."
        : "The host needs to review and confirm the trip dates.",
    });
  }

  return {
    planningMode: getPlanningMode(trip),
    readyForCandidateGeneration: blockers.length === 0,
    blockers,
    warnings,
    travelerCount: trip.travelers.length,
    preferencesCompleteCount,
    availabilityCompleteCount,
    expectedTravelerCount,
    sharedDates,
    sharedWindows,
    viableWindows,
  };
}

function getTravelersInPlanningOrder(travelers: Traveler[]) {
  const orderedTravelers: Traveler[] = [];

  for (const traveler of travelers) {
    if (traveler.isHost) {
      orderedTravelers.push(traveler);
    }
  }

  for (const traveler of travelers) {
    if (!traveler.isHost) {
      orderedTravelers.push(traveler);
    }
  }

  return orderedTravelers;
}

function normalizeSelectedOptions<T extends string>(
  selectedOptions: T[],
  supportedOptions: readonly T[],
) {
  const normalizedOptions: T[] = [];

  for (const option of supportedOptions) {
    if (selectedOptions.includes(option)) {
      normalizedOptions.push(option);
    }
  }

  return normalizedOptions;
}

function normalizeTraveler(
  trip: Trip,
  traveler: Traveler,
  preferences: TravelerPreferences,
): PlanningTraveler {
  return {
    name: traveler.name,
    isHost: traveler.isHost,
    departureLocation: getTravelerDepartureLocation(trip, traveler),
    overallMaximumBudgetUsd: preferences.maximumBudget,
    foodBudgetPerDayUsd: preferences.foodBudgetPerDay || null,
    lodgingBudgetPerNightUsd: preferences.lodgingBudgetPerNight || null,
    activitiesBudgetUsd: preferences.activitiesBudget || null,
    preferredDurationDays: preferences.preferredDurationDays,
    activityInterests: normalizeSelectedOptions(
      preferences.activityInterests,
      activityInterestOptions,
    ),
    lodgingType: preferences.lodgingType,
    groupLodgingPreference: preferences.groupLodgingPreference,
    lodgingPriceLevel: preferences.hotelStars ? Math.min(4, preferences.hotelStars) : null,
    activityDetails: preferences.activityDetails || "",
    lodgingAmenities: [...preferences.lodgingAmenities].sort(),
    destinationPreferences: preferences.destinationPreferences || "",
    notes: preferences.notes || "",
    availableDates: getSortedUniqueDates(traveler.availableDates || []),
  };
}

function buildGroupSummary(travelers: PlanningTraveler[]): PlanningGroupSummary {
  let lowestMaximumBudgetUsd = travelers[0].overallMaximumBudgetUsd;
  let highestMaximumBudgetUsd = travelers[0].overallMaximumBudgetUsd;
  const sharedActivityInterests: ActivityInterest[] = [];
  const allActivityInterests: ActivityInterest[] = [];
  const lodgingTypeCounts: LodgingTypeCount[] = [];

  for (const traveler of travelers) {
    if (traveler.overallMaximumBudgetUsd < lowestMaximumBudgetUsd) {
      lowestMaximumBudgetUsd = traveler.overallMaximumBudgetUsd;
    }

    if (traveler.overallMaximumBudgetUsd > highestMaximumBudgetUsd) {
      highestMaximumBudgetUsd = traveler.overallMaximumBudgetUsd;
    }
  }

  for (const interest of activityInterestOptions) {
    let selectedByEveryone = true;
    let selectedByAnyone = false;

    for (const traveler of travelers) {
      if (traveler.activityInterests.includes(interest)) {
        selectedByAnyone = true;
      } else {
        selectedByEveryone = false;
      }
    }

    if (selectedByEveryone) {
      sharedActivityInterests.push(interest);
    }

    if (selectedByAnyone) {
      allActivityInterests.push(interest);
    }
  }

  for (const lodgingType of lodgingTypeOptions) {
    let travelerCount = 0;

    for (const traveler of travelers) {
      if (traveler.lodgingType === lodgingType) {
        travelerCount += 1;
      }
    }

    if (travelerCount > 0) {
      lodgingTypeCounts.push({ lodgingType, travelerCount });
    }
  }

  return {
    lowestMaximumBudgetUsd,
    highestMaximumBudgetUsd,
    sharedActivityInterests,
    allActivityInterests,
    lodgingTypeCounts,
  };
}

export function buildPlanningContext(trip: Trip): PlanningContextBuildResult {
  const readiness = calculatePlanningReadiness(trip);

  if (!readiness.readyForCandidateGeneration) {
    return { success: false, readiness };
  }

  const orderedTravelers = getTravelersInPlanningOrder(trip.travelers);
  const planningTravelers: PlanningTraveler[] = [];

  for (const traveler of orderedTravelers) {
    if (!traveler.preferences || !Array.isArray(traveler.availableDates)) {
      return { success: false, readiness: calculatePlanningReadiness(trip) };
    }

    planningTravelers.push(normalizeTraveler(trip, traveler, traveler.preferences));
  }

  // Confirmed dates narrow the plan to exactly those days.
  const confirmed = confirmedDatesStillShared(trip.confirmedDates, readiness.sharedDates) ? trip.confirmedDates! : null;
  const confirmedWindow: DateWindow | null = confirmed
    ? { startDate: confirmed.startDate, endDate: confirmed.endDate, dayCount: getDatesInRange(confirmed.startDate, confirmed.endDate).length }
    : null;

  const destination = trip.destination && trip.destination.trim() !== ""
    ? trip.destination.trim()
    : null;

  return {
    success: true,
    readiness,
    context: {
      planningMode: readiness.planningMode,
      trip: {
        prompt: trip.prompt,
        name: trip.name || null,
        destination,
        earliestPossibleDate: trip.earliestPossibleDate,
        latestPossibleDate: trip.latestPossibleDate,
        hostPreferredDurationDays: confirmedWindow?.dayCount ?? (trip.preferredDurationDays || null),
        expectedTravelerCount: trip.expectedTravelerCount || null,
        joinedTravelerCount: trip.travelers.length,
        ...(trip.sketch?.status === "done"
          ? {
              sketch: {
                summary: trip.sketch.summary,
                places: trip.sketch.places.map((place) => place.name),
                days: trip.sketch.days.map((day) => `Day ${day.dayNumber}: ${day.title}`),
              },
            }
          : {}),
      },
      groupAvailability: {
        sharedDates: confirmedWindow ? getDatesInRange(confirmedWindow.startDate, confirmedWindow.endDate) : [...readiness.sharedDates],
        sharedWindows: confirmedWindow ? [{ ...confirmedWindow }] : readiness.sharedWindows.map((window) => ({ ...window })),
        viableWindows: confirmedWindow ? [{ ...confirmedWindow }] : readiness.viableWindows.map((window) => ({ ...window })),
        submittedTravelerCount: readiness.availabilityCompleteCount,
        totalTravelerCount: readiness.travelerCount,
      },
      groupSummary: buildGroupSummary(planningTravelers),
      travelers: planningTravelers,
    },
  };
}
