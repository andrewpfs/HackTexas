import type { CandidatePlanner } from "./candidate-planner";
import { MockCandidatePlanner } from "./mock-candidate-planner";
import type { ItineraryPlanner } from "./itinerary-planner";
import { MockItineraryReviser, type ItineraryReviser } from "./itinerary-revision";
import { MockItineraryPlanner } from "./mock-itinerary-planner";
import { MuseCandidatePlanner } from "./muse-candidate-planner";
import type { MuseConfig } from "./muse-client";
import { MuseItineraryPlanner } from "./muse-itinerary-planner";
import { MuseItineraryReviser } from "./muse-itinerary-reviser";
import { MockSketchPlanner, MuseSketchPlanner, type SketchPlanner } from "./trip-sketch";

export type PlannerSelection = {
  planner: CandidatePlanner;
  source: "muse" | "mock";
};

export type ItineraryPlannerSelection = {
  planner: ItineraryPlanner;
  source: "muse" | "mock";
};

function getMuseConfig(): MuseConfig | null {
  const apiKey = process.env.META_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: process.env.META_API_BASE_URL?.trim() || undefined,
    model: process.env.META_MODEL?.trim() || undefined,
  };
}

// Muse is used whenever META_API_KEY is set. Without a key the mock planner is
// used and the caller is told, so mock output is never presented as Muse output.
export function selectCandidatePlanner(): PlannerSelection {
  const config = getMuseConfig();

  if (!config) {
    return { planner: new MockCandidatePlanner(), source: "mock" };
  }

  return { planner: new MuseCandidatePlanner(config), source: "muse" };
}

export function selectItineraryPlanner(): ItineraryPlannerSelection {
  const config = getMuseConfig();

  if (!config) {
    return { planner: new MockItineraryPlanner(), source: "mock" };
  }

  return { planner: new MuseItineraryPlanner(config), source: "muse" };
}

export function selectItineraryReviser(): { reviser: ItineraryReviser; source: "muse" | "mock" } {
  const config = getMuseConfig();

  if (!config) {
    return { reviser: new MockItineraryReviser(), source: "mock" };
  }

  return { reviser: new MuseItineraryReviser(config), source: "muse" };
}

export function selectSketchPlanner(): { planner: SketchPlanner; source: "muse" | "mock" } {
  const config = getMuseConfig();
  return config ? { planner: new MuseSketchPlanner(config), source: "muse" } : { planner: new MockSketchPlanner(), source: "mock" };
}

export function isMockFallbackEnabled() {
  return process.env.MUSE_FALLBACK_TO_MOCK === "true";
}
