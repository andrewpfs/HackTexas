import { randomUUID } from "node:crypto";
import { addDays } from "./date-utils";
import type { CandidatePlanner } from "./candidate-planner";
import type { PlanningContext } from "./planning-context";
import type {
  ActivityInterest,
  CandidateActivity,
  CandidateDay,
  CandidateTripOption,
} from "./trip-types";

type CandidateStyle = {
  title: string;
  summary: string;
  destination: string;
  focus: string;
  highlights: string[];
  consideration: string;
};

type SelectedDates = {
  startDate: string;
  endDate: string;
  durationDays: number;
  usedShorterWindow: boolean;
};

function chooseDesiredDuration(context: PlanningContext) {
  if (context.trip.hostPreferredDurationDays !== null) {
    return context.trip.hostPreferredDurationDays;
  }

  let totalDuration = 0;
  for (const traveler of context.travelers) {
    totalDuration += traveler.preferredDurationDays;
  }

  return Math.max(1, Math.round(totalDuration / context.travelers.length));
}

function selectCandidateDates(context: PlanningContext): SelectedDates {
  const desiredDuration = chooseDesiredDuration(context);
  const windows = context.groupAvailability.sharedWindows;
  let selectedWindow = windows[0];

  for (const window of windows) {
    const currentFits = selectedWindow.dayCount >= desiredDuration;
    const newWindowFits = window.dayCount >= desiredDuration;

    if (newWindowFits && !currentFits) {
      selectedWindow = window;
    } else if (newWindowFits === currentFits && window.dayCount > selectedWindow.dayCount) {
      selectedWindow = window;
    }
  }

  let durationDays = desiredDuration;
  let usedShorterWindow = false;

  if (selectedWindow.dayCount < desiredDuration) {
    durationDays = selectedWindow.dayCount;
    usedShorterWindow = true;
  }

  return {
    startDate: selectedWindow.startDate,
    endDate: addDays(selectedWindow.startDate, durationDays - 1),
    durationDays,
    usedShorterWindow,
  };
}

function countInterest(context: PlanningContext, interest: ActivityInterest) {
  let count = 0;

  for (const traveler of context.travelers) {
    if (traveler.activityInterests.includes(interest)) {
      count += 1;
    }
  }

  return count;
}

function describeGroupInterest(context: PlanningContext) {
  if (context.groupSummary.sharedActivityInterests.length > 0) {
    const interests = context.groupSummary.sharedActivityInterests.slice(0, 2).join(" and ");
    return `${interests} are shared interests across the group.`;
  }

  let mostPopularInterest = context.groupSummary.allActivityInterests[0];
  let mostPopularCount = 0;

  for (const interest of context.groupSummary.allActivityInterests) {
    const count = countInterest(context, interest);
    if (count > mostPopularCount) {
      mostPopularInterest = interest;
      mostPopularCount = count;
    }
  }

  if (mostPopularInterest && mostPopularCount > 1) {
    return `${mostPopularInterest} was selected by multiple travelers.`;
  }

  if (mostPopularInterest) {
    return `${mostPopularInterest} is represented in the group's interests.`;
  }

  return "The plan keeps activities flexible because the group did not select a common activity interest.";
}

function describeLodging(context: PlanningContext) {
  const lodgingCounts = context.groupSummary.lodgingTypeCounts;
  if (lodgingCounts.length === 0) {
    return "Lodging can be chosen together after the group compares options.";
  }

  let mostPopular = lodgingCounts[0];
  for (const lodgingCount of lodgingCounts) {
    if (lodgingCount.travelerCount > mostPopular.travelerCount) {
      mostPopular = lodgingCount;
    }
  }

  return `${mostPopular.lodgingType} is the group's most common lodging preference.`;
}

function makeRationale(context: PlanningContext, dates: SelectedDates, focus: string) {
  const dateFact = `This option uses the ${dates.startDate} to ${dates.endDate} shared availability window.`;
  const durationFact = dates.usedShorterWindow
    ? ` Its ${dates.durationDays}-day length reflects the group's shorter shared window.`
    : "";
  const budgetFact = ` It keeps the group's lowest stated maximum budget of $${context.groupSummary.lowestMaximumBudgetUsd.toLocaleString("en-US")} in view without claiming live prices.`;

  return `${dateFact}${durationFact} ${describeGroupInterest(context)} ${focus} ${describeLodging(context)}${budgetFact}`;
}

function makeActivities(style: CandidateStyle, dayPosition: "arrival" | "middle" | "departure") {
  const activities: CandidateActivity[] = [];

  if (dayPosition === "arrival") {
    activities.push({
      timeOfDay: "Morning",
      title: "Arrive and settle in",
      description: `Travel to ${style.destination} and leave room for a comfortable group arrival.`,
    });
    activities.push({
      timeOfDay: "Afternoon",
      title: style.highlights[0],
      description: `Start with a low-pressure introduction to the ${style.focus.toLowerCase()} theme.`,
    });
    activities.push({
      timeOfDay: "Evening",
      title: "Group welcome dinner",
      description: "Reconnect over a flexible meal chosen by the group.",
    });
  } else if (dayPosition === "departure") {
    activities.push({
      timeOfDay: "Morning",
      title: style.highlights[1],
      description: "Enjoy one final shared activity before packing up.",
    });
    activities.push({
      timeOfDay: "Afternoon",
      title: "Free time and departure",
      description: "Keep the final hours open for individual interests and travel home.",
    });
  } else {
    activities.push({
      timeOfDay: "Morning",
      title: style.highlights[0],
      description: `Spend the morning on a signature ${style.focus.toLowerCase()} experience.`,
    });
    activities.push({
      timeOfDay: "Afternoon",
      title: style.highlights[1],
      description: "Choose a group activity connected to the travelers' stated interests.",
    });
    activities.push({
      timeOfDay: "Evening",
      title: style.highlights[2],
      description: "End the day with a flexible shared experience.",
    });
  }

  return activities;
}

function makeSampleDays(style: CandidateStyle, dates: SelectedDates) {
  const days: CandidateDay[] = [];

  for (let dayIndex = 0; dayIndex < dates.durationDays; dayIndex += 1) {
    let dayPosition: "arrival" | "middle" | "departure" = "middle";
    if (dayIndex === 0) {
      dayPosition = "arrival";
    } else if (dayIndex === dates.durationDays - 1) {
      dayPosition = "departure";
    }

    days.push({
      dayNumber: dayIndex + 1,
      date: addDays(dates.startDate, dayIndex),
      title: dayPosition === "arrival"
        ? `Welcome to ${style.destination}`
        : dayPosition === "departure"
          ? "A relaxed final day"
          : `${style.focus} day`,
      activities: makeActivities(style, dayPosition),
    });
  }

  return days;
}

function getKnownDestinationStyles(destination: string): CandidateStyle[] {
  return [
    {
      title: `Balanced ${destination} Explorer`,
      destination,
      summary: "A balanced mix of group highlights, local flavor, and flexible time.",
      focus: "Balanced exploration",
      highlights: ["Essential neighborhood walk", "Signature group attraction", "Flexible local evening"],
      consideration: "A varied schedule means the group will switch between several kinds of activities.",
    },
    {
      title: `${destination} Food & Culture Focus`,
      destination,
      summary: "A culture-forward option built around local food and shared discovery.",
      focus: "Food and culture",
      highlights: ["Local market or food district", "Museum or cultural landmark", "Neighborhood dining evening"],
      consideration: "This option gives less time to outdoor or purely relaxing activities.",
    },
    {
      title: `Relaxed ${destination} Getaway`,
      destination,
      summary: "A slower-paced stay with breathing room for the group to recharge.",
      focus: "Relaxation and flexibility",
      highlights: ["Leisurely neighborhood morning", "Optional interest-based activity", "Unhurried group evening"],
      consideration: "The lighter pace covers fewer major sights than the other options.",
    },
  ];
}

function getUnknownDestinationStyles(): CandidateStyle[] {
  return [
    {
      title: "Denver Outdoors & City Break",
      destination: "Denver",
      summary: "A city stay with easy room for outdoor scenery and relaxed group time.",
      focus: "Outdoors and city exploration",
      highlights: ["Scenic outdoor outing", "Walkable city neighborhood", "Relaxed group evening"],
      consideration: "Outdoor plans may need a weather-friendly backup.",
    },
    {
      title: "New Orleans Food & Music Escape",
      destination: "New Orleans",
      summary: "A lively option centered on distinctive food, culture, and evening energy.",
      focus: "Food, culture, and nightlife",
      highlights: ["Historic neighborhood walk", "Local food experience", "Live music evening"],
      consideration: "The lively evening focus may not suit travelers seeking an early schedule.",
    },
    {
      title: "Chicago Museums & Neighborhoods",
      destination: "Chicago",
      summary: "A flexible urban option combining museums, sightseeing, food, and neighborhoods.",
      focus: "Museums and sightseeing",
      highlights: ["Lakefront or architecture walk", "Museum visit", "Neighborhood dinner"],
      consideration: "Popular city attractions can make the itinerary feel busier.",
    },
  ];
}

export class MockCandidatePlanner implements CandidatePlanner {
  async generateCandidates(context: PlanningContext) {
    const dates = selectCandidateDates(context);
    const generatedAt = new Date().toISOString();
    const styles = context.planningMode === "known_destination"
      ? getKnownDestinationStyles(context.trip.destination || "Destination")
      : getUnknownDestinationStyles();
    const candidates: CandidateTripOption[] = [];

    for (const style of styles) {
      candidates.push({
        id: randomUUID(),
        title: style.title,
        destination: style.destination,
        summary: style.summary,
        rationale: makeRationale(context, dates, style.focus),
        estimatedDurationDays: dates.durationDays,
        suggestedStartDate: dates.startDate,
        suggestedEndDate: dates.endDate,
        highlights: [...style.highlights],
        considerations: [style.consideration],
        days: makeSampleDays(style, dates),
        generatedAt,
      });
    }

    return candidates;
  }
}
