"use client";

import { useSyncExternalStore } from "react";
import { getRememberedTravelerId } from "./traveler-identity";

function subscribeToBrowserStorage() {
  return () => {};
}

function getBrowserReadySnapshot() {
  return true;
}

function getServerReadySnapshot() {
  return false;
}

function getServerTravelerSnapshot() {
  return null;
}

export function useTravelerIdentity(tripId: string) {
  const browserReady = useSyncExternalStore(
    subscribeToBrowserStorage,
    getBrowserReadySnapshot,
    getServerReadySnapshot,
  );
  const travelerId = useSyncExternalStore(
    subscribeToBrowserStorage,
    () => getRememberedTravelerId(tripId),
    getServerTravelerSnapshot,
  );

  return { browserReady, travelerId };
}
