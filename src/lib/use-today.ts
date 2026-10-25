"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Today's date in the browser (YYYY-MM-DD), or null while rendering on the server.
export function useToday() {
  return useSyncExternalStore(subscribe, getToday, () => null);
}
