import type { PlaceSuggestion } from "./trip-types";

// Keep the place details returned by Maps while rejecting incomplete input.
export function readSelectedPlace(value: unknown): PlaceSuggestion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const place = value as Record<string, unknown>;
  if (typeof place.name !== "string" || !place.name.trim()) return null;
  if (typeof place.mapsUrl !== "string" || !place.mapsUrl.startsWith("https://www.google.com/maps/")) return null;
  const latitude = typeof place.latitude === "number" && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90 ? place.latitude : undefined;
  const longitude = typeof place.longitude === "number" && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180 ? place.longitude : undefined;
  return {
    name: place.name.trim(),
    placeId: typeof place.placeId === "string" ? place.placeId : undefined,
    countryCode: typeof place.countryCode === "string" ? place.countryCode : undefined,
    region: typeof place.region === "string" ? place.region : undefined,
    address: typeof place.address === "string" ? place.address : null,
    mapsUrl: place.mapsUrl,
    latitude,
    longitude,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.reviewCount === "number" ? place.reviewCount : null,
    price: typeof place.price === "string" ? place.price : null,
    category: typeof place.category === "string" ? place.category : null,
    thumbnail: typeof place.thumbnail === "string" ? place.thumbnail : null,
    reviews: Array.isArray(place.reviews) ? place.reviews as PlaceSuggestion["reviews"] : [],
  };
}
