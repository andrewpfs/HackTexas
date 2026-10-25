"use client";

import { useEffect, useRef, useState } from "react";

// Starts the one-time photo lookup for day headers in the options. The page refreshes
// by itself once the photos are saved.
export function OptionPhotosLoader({ tripId, done }: { tripId: string; done: boolean }) {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (done || started.current) {
      return;
    }

    started.current = true;
    setFailed(false);
    fetch(`/api/trips/${tripId}/candidates/photos`, { method: "POST" })
      .then((response) => {
        if (!response.ok) {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true))
      .finally(() => {
        started.current = false;
      });
  }, [tripId, done, attempt]);

  if (done) {
    return null;
  }

  if (failed) {
    return (
      <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#8f3f30] sm:flex-row sm:items-center sm:justify-between" role="alert">
        <p>We couldn&apos;t load day photos.</p>
        <button className="button-secondary" onClick={() => setAttempt((value) => value + 1)} type="button">Try Again</button>
      </div>
    );
  }

  return (
    <p className="mt-5 flex items-center gap-3 rounded-2xl bg-[#daf0ea] p-4 text-sm font-semibold text-[#276655]" role="status">
      <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[#276655]/30 border-t-[#276655]" />
      Finding one photo for each day. The options are ready to read while this finishes.
    </p>
  );
}
