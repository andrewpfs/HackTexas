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

// The trip's update bar, shown at the bottom of every trip page. It lists what
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

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto w-full max-w-xl">
        {open ? (
          <section aria-label="Trip updates" className="mb-2 max-h-[60dvh] overflow-y-auto rounded-3xl border border-[#173f50]/15 bg-white p-4 shadow-[0_18px_50px_rgba(23,63,80,0.25)]">
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
            <p className="mt-3 text-xs leading-5 text-[#879196]">Updates show here while the trip is open. Text alerts aren&apos;t available yet.</p>
          </section>
        ) : null}

        {latest && !open ? (
          <div className="flex items-center gap-3 rounded-full bg-[#173f50] py-2 pl-4 pr-2 text-sm text-white shadow-[0_14px_40px_rgba(23,63,80,0.35)]" role="status">
            <span aria-hidden="true">🔔</span>
            <Link className="min-w-0 flex-1 truncate hover:underline" href={latest.path} onClick={markSeen}>{latest.text}</Link>
            {unseen.length > 1 ? <button className="shrink-0 rounded-full bg-[#f3c969] px-2.5 py-1 text-xs font-bold text-[#173f50]" onClick={() => setOpen(true)} type="button">+{unseen.length - 1} more</button> : null}
            <button aria-label="Dismiss updates" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10" onClick={markSeen} type="button">✕</button>
          </div>
        ) : !open ? (
          <div className="flex justify-end">
            <button aria-label="Show trip updates" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#173f50]/15 bg-white text-lg shadow-[0_10px_30px_rgba(23,63,80,0.18)] hover:bg-[#f3f8fa]" onClick={() => setOpen(true)} title="Trip updates" type="button">🔔</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
