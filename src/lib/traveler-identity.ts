const travelerIdentityKeyPrefix = "hacktx-trip-planner:traveler:";

function getTravelerIdentityKey(tripId: string) {
  return `${travelerIdentityKeyPrefix}${tripId}`;
}

export function rememberTravelerId(tripId: string, travelerId: string) {
  try {
    window.localStorage.setItem(getTravelerIdentityKey(tripId), travelerId);
  } catch {
    // The trip can still be used if browser storage is unavailable.
  }
}

export function forgetTravelerId(tripId: string) {
  try {
    window.localStorage.removeItem(getTravelerIdentityKey(tripId));
  } catch {
    // Nothing to forget if browser storage is unavailable.
  }
}

export function getRememberedTravelerId(tripId: string) {
  try {
    return window.localStorage.getItem(getTravelerIdentityKey(tripId));
  } catch {
    return null;
  }
}
