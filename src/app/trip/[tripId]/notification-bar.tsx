"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { TripNotification } from "@/lib/trip-types";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

const pollMs = 6000;

function seenKey(tripId: string) {
  return `hacktx-trip-planner:notifications-seen:${tripId}`;
}

function readSeen(tripId: string) {
  try {
    return window.localStorage.getItem(seenKey(tripId)) ?? "";
  } catch {
    return "";
  }
}

function writeSeen(tripId: string, value: string) {
  try {
    window.localStorage.setItem(seenKey(tripId), value);
  } catch {
    // Private windows can block storage; the bar still works for this visit.
  }
}

function timeAgo(iso: string, now: number) {
  const minutes = Math.round((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

// The trip's update bell, shown at the top right of every trip page. It lists what
// changed since you last looked (other people's changes only).
export function TripNotificationBar() {
  const params = useParams<{ tripId: string }>();
  const tripId = params?.tripId ?? "";
  const { travelerId } = useTravelerIdentity(tripId);
  const [notifications, setNotifications] = useState<TripNotification[]>([]);
  const [seenUntil, setSeenUntil] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!tripId || document.visibilityState !== "visible") return;
    try {
      const response = await fetch(`/api/trips/${tripId}/notifications`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { notifications: TripNotification[] };
      // First visit on this device: start from now so a newcomer isn't flooded with old updates.
      let seen = readSeen(tripId);
      if (seen === "") {
        seen = data.notifications[0]?.createdAt ?? new Date().toISOString();
        writeSeen(tripId, seen);
      }
      setSeenUntil(seen);
      setNotifications(data.notifications);
      setNow(Date.now());
    } catch {
      // The next check tries again.
    }
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    const first = setTimeout(load, 0);
    const timer = setInterval(load, pollMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [tripId, load]);

  if (!tripId || seenUntil === null) return null;

  const others = notifications.filter((item) => !travelerId || item.actorTravelerId !== travelerId);
  const unseen = others.filter((item) => item.createdAt > seenUntil);
  const latest = unseen[0];

  function markSeen() {
    const newest = notifications[0]?.createdAt ?? new Date().toISOString();
    writeSeen(tripId, newest);
    setSeenUntil(newest);
  }

  // The bell sits at the top right, just under the navigation bar (which is taller on phones).
  return (
    <div className="pointer-events-none fixed right-4 top-[7.25rem] z-40 flex w-[min(22rem,calc(100vw-2rem))] flex-col items-end sm:right-6 sm:top-[5.25rem] lg:right-8">
      <button
        aria-expanded={open}
        aria-label={unseen.length > 0 ? `Trip updates, ${unseen.length} new` : "Trip updates"}
        className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full border border-[#173f50]/15 bg-white text-lg shadow-[0_10px_30px_rgba(23,63,80,0.18)] transition hover:bg-[#f3f8fa]"
        onClick={() => {
          if (open) markSeen();
          setOpen(!open);
        }}
        title="Trip updates"
        type="button"
      >
        <span aria-hidden="true">🔔</span>
        {unseen.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e4664f] px-1 text-[0.7rem] font-extrabold text-white">{unseen.length > 9 ? "9+" : unseen.length}</span>
        ) : null}
      </button>

      {!open && latest ? (
        <Link className="pointer-events-auto mt-2 max-w-full truncate rounded-full bg-[#173f50] px-4 py-2 text-sm text-white shadow-[0_14px_40px_rgba(23,63,80,0.3)] hover:underline" href={latest.path} onClick={markSeen} role="status">
          {latest.text}
        </Link>
      ) : null}

      {open ? (
        <section aria-label="Trip updates" className="pointer-events-auto mt-2 max-h-[60dvh] w-full overflow-y-auto rounded-3xl border border-[#173f50]/15 bg-white p-4 shadow-[0_18px_50px_rgba(23,63,80,0.25)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#173f50]">Trip Updates</p>
            <button className="rounded-full px-3 py-1 text-xs font-bold text-[#53666f] hover:bg-[#f2f0ea]" onClick={() => { setOpen(false); markSeen(); }} type="button">Close</button>
          </div>
          {notifications.length === 0 ? (
            <p className="mt-3 text-sm text-[#718087]">No updates yet. When the group changes something, it shows up here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {notifications.slice(0, 20).map((item) => {
                const isNew = unseen.includes(item);
                return (
                  <li key={item.id}>
                    <Link className={`block rounded-2xl px-3 py-2.5 text-sm transition hover:bg-[#f3f8fa] ${isNew ? "bg-[#fff8dc]" : "bg-[#f7f7f3]"}`} href={item.path} onClick={() => { setOpen(false); markSeen(); }}>
                      <span className="text-[#273b46]">{item.text}</span>
                      <span className="mt-0.5 block text-xs text-[#879196]">{isNew ? "New · " : ""}{timeAgo(item.createdAt, now)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
