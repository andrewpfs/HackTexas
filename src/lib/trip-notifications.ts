import type { Trip, TripNotification } from "./trip-types";

// In-app updates shown in the notification bar on every trip page. Texting the
// group isn't available (carrier A2P registration), so this is how people hear
// about changes. Only the newest few are kept on the trip.

export const maximumNotifications = 40;

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function tripPath(trip: Pick<Trip, "id">, page = "") {
  return `/trip/${trip.id}${page ? `/${page}` : ""}`;
}

// Adds an update to the trip (call inside a store update so it saves with the change).
export function pushNotification(trip: Trip, text: string, path: string, actorTravelerId?: string) {
  const notification: TripNotification = { id: newId(), text, path, createdAt: new Date().toISOString(), ...(actorTravelerId ? { actorTravelerId } : {}) };
  trip.notifications = [...(trip.notifications ?? []), notification].slice(-maximumNotifications);
  return notification;
}
