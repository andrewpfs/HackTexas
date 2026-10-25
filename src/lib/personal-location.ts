import type { GroupItinerary, PlaceSuggestion } from "./trip-types";
import { estimateTravel } from "./travel-time";

export type DestinationArea = {
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  // Photon extent: west, north, east, south.
  extent?: number[];
};

function coordinates(place: DestinationArea | undefined): place is DestinationArea & { latitude: number; longitude: number } {
  return !!place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}

export function personalLocationError(itinerary: GroupItinerary, dayNumber: number, stopTime: string, stopTitle: string, place: PlaceSuggestion | undefined, destination?: DestinationArea): string | null {
  if (!place) return "Choose a real place from the suggestions before saving.";
  const day = itinerary.days.find((item) => item.dayNumber === dayNumber);
  const index = day?.activities.findIndex((item) => item.time === stopTime && item.title === stopTitle) ?? -1;
  if (!day || index < 0) return "That stop changed. Refresh and try again.";
  const country = destination?.countryCode;
  if (country && place.countryCode && country.toUpperCase() !== place.countryCode.toUpperCase()) {
    return `Choose a place that fits within your ${itinerary.destination} itinerary. This location is too far from your trip destination.`;
  }

  // Check the closest known shared stop on each side of the personal activity.
  const anchors: PlaceSuggestion[] = [];
  for (let i = index - 1; i >= 0; i -= 1) {
    if (coordinates(day.activities[i].place)) { anchors.push(day.activities[i].place!); break; }
  }
  for (let i = index + 1; i < day.activities.length; i += 1) {
    if (coordinates(day.activities[i].place)) { anchors.push(day.activities[i].place!); break; }
  }
  if (anchors.length === 0 && coordinates(day.activities[index].place)) anchors.push(day.activities[index].place!);
  for (const anchor of anchors) {
    if (anchor.countryCode && place.countryCode && anchor.countryCode.toUpperCase() !== place.countryCode.toUpperCase()) {
      return "This location is too far from your trip destination.";
    }
    if (coordinates(place) && coordinates(anchor) && estimateTravel(anchor, place, "car").minutes >= 120) {
      return "This place is too far from the rest of your itinerary to fit here. Choose somewhere closer to the current day's activities.";
    }
  }
  if (coordinates(place) && anchors.length === 0 && destination) {
    let reference = destination;
    if (destination.extent?.length === 4) {
      const [west, north, east, south] = destination.extent;
      reference = { latitude: Math.max(south, Math.min(north, place.latitude)), longitude: Math.max(west, Math.min(east, place.longitude)) };
    }
    if (coordinates(reference) && estimateTravel(reference, place, "car").minutes >= 120) {
      return "This location is too far from your trip destination.";
    }
  }
  // Incomplete metadata is not evidence of an impossible route.
  return null;
}
