"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// Keeps a page current: when anyone changes the trip, the page reloads its data.
export function LiveRefresh({ tripId, intervalMs = 4000 }: { tripId: string; intervalMs?: number }) {
  const router = useRouter();
  const lastStamp = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await fetch(`/api/trips/${tripId}/stamp`, { cache: "no-store" });
        if (!response.ok || cancelled) {
          return;
        }

        const { stamp } = (await response.json()) as { stamp: string };
        if (lastStamp.current !== null && lastStamp.current !== stamp) {
          router.refresh();
        }
        lastStamp.current = stamp;
      } catch {
        // The next check tries again.
      }
    }

    check();
    const timer = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tripId, intervalMs, router]);

  return null;
}
