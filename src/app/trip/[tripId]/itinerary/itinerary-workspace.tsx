"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatCalendarDate } from "@/lib/date-utils";
import { getChangedStopKeys, getStopKey, needsPlaceLookup } from "@/lib/itinerary-diff";
import { estimateTravel, formatDistance, formatMinutes, travelModes, type TravelMode } from "@/lib/travel-time";
import type { ChatMessage, GroupItinerary, ItineraryActivity, PlaceSuggestion } from "@/lib/trip-types";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type WorkspaceProps = {
  tripId: string;
  initialItinerary: GroupItinerary;
  initialMessages: ChatMessage[];
  travelers: { id: string; name: string }[];
  placesConfigured: boolean;
};

type Panel = "map" | "chat";

const directionFlags: Record<TravelMode, string> = { walk: "w", bike: "b", car: "d" };

function hasCoordinates(place: PlaceSuggestion | undefined): place is PlaceSuggestion & { latitude: number; longitude: number } {
  return place !== undefined && typeof place.latitude === "number" && typeof place.longitude === "number";
}

function getMapSource(
  activity: ItineraryActivity | null,
  leg: { from: ItineraryActivity; to: ItineraryActivity; mode: TravelMode } | null,
  destination: string,
) {
  const base = "https://maps.google.com/maps";

  if (leg && hasCoordinates(leg.from.place) && hasCoordinates(leg.to.place)) {
    const from = `${leg.from.place.latitude},${leg.from.place.longitude}`;
    const to = `${leg.to.place.latitude},${leg.to.place.longitude}`;
    return `${base}?saddr=${from}&daddr=${to}&dirflg=${directionFlags[leg.mode]}&output=embed`;
  }

  if (!activity) {
    return `${base}?q=${encodeURIComponent(destination)}&z=12&output=embed`;
  }

  const place = activity.place;
  const query = place
    ? [place.name, place.address].filter(Boolean).join(" ")
    : `${activity.title} ${activity.location}`;
  return `${base}?q=${encodeURIComponent(query)}&z=15&output=embed`;
}

export function ItineraryWorkspace({ tripId, initialItinerary, initialMessages, travelers, placesConfigured }: WorkspaceProps) {
  const { browserReady, travelerId } = useTravelerIdentity(tripId);
  const currentTraveler = travelers.find((traveler) => traveler.id === travelerId);

  const [itinerary, setItinerary] = useState(initialItinerary);
  const [messages, setMessages] = useState(initialMessages);
  const [dayIndex, setDayIndex] = useState(0);
  const [stopIndex, setStopIndex] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>("map");
  const [modes, setModes] = useState<Record<string, TravelMode>>({});
  const [legKey, setLegKey] = useState<string | null>(null);
  const [changedKeys, setChangedKeys] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [aboutStop, setAboutStop] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [placesError, setPlacesError] = useState(false);
  const [placesAttempt, setPlacesAttempt] = useState(0);
  const sendingRef = useRef(false);
  const lookingUpRef = useRef(false);
  const itineraryRef = useRef(itinerary);
  const messagesCountRef = useRef(messages.length);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    itineraryRef.current = itinerary;
  }, [itinerary]);

  const applyState = useCallback((next: GroupItinerary, nextMessages: ChatMessage[], highlight?: string[]) => {
    const previous = itineraryRef.current;
    const changed = highlight ?? (
      (next.revision ?? 0) > (previous.revision ?? 0) ? getChangedStopKeys(previous.days, next.days) : []
    );

    setItinerary(next);
    setMessages(nextMessages);
    if (changed.length > 0) {
      setChangedKeys(changed);
    }
  }, []);

  // Everyone sees plan changes and new messages without refreshing.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible" || sendingRef.current) {
        return;
      }

      try {
        const response = await fetch(`/api/trips/${tripId}/itinerary`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { itinerary: GroupItinerary; messages: ChatMessage[] };
        const current = itineraryRef.current;
        const same =
          data.itinerary.revision === current.revision &&
          data.itinerary.placesStatus === current.placesStatus &&
          data.messages.length === messagesCountRef.current;

        if (!same) {
          applyState(data.itinerary, data.messages);
        }
      } catch {
        // The next poll tries again.
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [tripId, applyState]);

  useEffect(() => {
    messagesCountRef.current = messages.length;
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight });
  }, [messages.length, isSending, panel]);

  // Real places load once after the plan is created, and again for stops Muse adds.
  useEffect(() => {
    if (!placesConfigured || itinerary.placesStatus === "added" || lookingUpRef.current) {
      return;
    }

    lookingUpRef.current = true;
    setPlacesError(false);

    (async () => {
      try {
        const response = await fetch(`/api/trips/${tripId}/itinerary/places`, { method: "POST" });
        if (!response.ok) {
          setPlacesError(true);
          return;
        }

        const stateResponse = await fetch(`/api/trips/${tripId}/itinerary`, { cache: "no-store" });
        if (stateResponse.ok) {
          const data = (await stateResponse.json()) as { itinerary: GroupItinerary; messages: ChatMessage[] };
          setItinerary(data.itinerary);
          setMessages(data.messages);
        }
      } catch {
        setPlacesError(true);
      } finally {
        lookingUpRef.current = false;
      }
    })();
  }, [placesConfigured, itinerary.placesStatus, itinerary.revision, tripId, placesAttempt]);

  useEffect(() => {
    if (changedKeys.length === 0) {
      return;
    }
    const timer = setTimeout(() => setChangedKeys([]), 25000);
    return () => clearTimeout(timer);
  }, [changedKeys]);

  const day = itinerary.days[Math.min(dayIndex, itinerary.days.length - 1)];
  const activity = stopIndex !== null ? day.activities[stopIndex] ?? null : null;
  const placesLoading = placesConfigured && itinerary.placesStatus !== "added" && needsPlaceLookup(itinerary.days) && !placesError;

  let activeLeg: { from: ItineraryActivity; to: ItineraryActivity; mode: TravelMode } | null = null;
  if (legKey) {
    const [legDay, legIndex] = legKey.split("-").map(Number);
    const legActivities = itinerary.days[legDay]?.activities;
    if (legActivities?.[legIndex] && legActivities[legIndex + 1]) {
      activeLeg = { from: legActivities[legIndex], to: legActivities[legIndex + 1], mode: modes[legKey] ?? "walk" };
    }
  }

  function selectStop(index: number) {
    setStopIndex(index);
    setLegKey(null);
    setPanel("map");
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !currentTraveler || sendingRef.current) {
      return;
    }

    sendingRef.current = true;
    setIsSending(true);
    setChatError("");
    setDraft("");

    const focus = aboutStop && activity ? { dayNumber: day.dayNumber, title: activity.title } : undefined;
    const optimistic: ChatMessage = {
      id: `sending-${Date.now()}`,
      role: "traveler",
      travelerId: currentTraveler.id,
      authorName: currentTraveler.name,
      text,
      createdAt: new Date().toISOString(),
      focus,
    };
    setMessages((existing) => [...existing, optimistic]);

    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelerId: currentTraveler.id, text, focus }),
      });
      const data = (await response.json()) as {
        error?: string;
        itinerary?: GroupItinerary;
        messages?: ChatMessage[];
        changedStops?: string[];
      };

      if (!response.ok || !data.itinerary || !data.messages) {
        setChatError(data.error || "We couldn't send that message.");
        setMessages((existing) => existing.filter((message) => message.id !== optimistic.id));
        setDraft(text);
        return;
      }

      applyState(data.itinerary, data.messages, data.changedStops);
    } catch {
      setChatError("We couldn't reach the server. Please try again.");
      setMessages((existing) => existing.filter((message) => message.id !== optimistic.id));
      setDraft(text);
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }

  function renderPlaceDetails(place: PlaceSuggestion) {
    return (
      <div className="mt-4">
        <p className="text-lg font-bold text-[#173f50]">{place.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-[#607179]">
          {place.rating !== null ? (
            <span className="font-bold text-[#b0661c]">
              ★ {place.rating.toFixed(1)}
              {place.reviewCount !== null ? <span className="font-normal text-[#718087]"> ({place.reviewCount.toLocaleString()} reviews)</span> : null}
            </span>
          ) : null}
          {place.price ? <span>· {place.price}</span> : null}
          {place.category ? <span>· {Array.isArray(place.category) ? place.category[0] : place.category}</span> : null}
        </p>
        {place.address ? <p className="mt-1 text-xs text-[#879196]">{place.address}</p> : null}

        {place.reviews.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {place.reviews.map((review) => (
              <li className="rounded-2xl bg-[#f7f7f3] p-4 text-sm leading-6 text-[#53666f]" key={`${review.author}-${review.date}`}>
                <p>&ldquo;{review.snippet}&rdquo;</p>
                <p className="mt-2 text-xs text-[#879196]">
                  {review.author}
                  {review.rating !== null ? ` · ${review.rating}★` : ""}
                  {review.date ? ` · ${review.date}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        <a className="mt-4 inline-block text-sm font-bold text-[#173f50] underline decoration-[#e4664f]/40 underline-offset-4 hover:text-[#e4664f]" href={place.mapsUrl} rel="noopener noreferrer" target="_blank">
          Read all reviews on Google Maps ↗
        </a>
      </div>
    );
  }

  const dayPhoto = (dayItem: GroupItinerary["days"][number]) =>
    dayItem.activities.find((item) => item.place?.thumbnail)?.place?.thumbnail ?? null;

  return (
    <div className="mt-6">
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Days">
        {itinerary.days.map((dayItem, index) => {
          const photo = dayPhoto(dayItem);
          const selected = index === dayIndex;
          return (
            <button
              aria-selected={selected}
              className={`relative isolate h-32 w-52 shrink-0 overflow-hidden rounded-2xl bg-[#173f50] p-4 text-left text-white transition sm:w-60 ${selected ? "ring-4 ring-[#e4664f]" : "opacity-80 hover:opacity-100"}`}
              key={dayItem.date}
              onClick={() => {
                setDayIndex(index);
                setStopIndex(null);
                setLegKey(null);
              }}
              role="tab"
              type="button"
            >
              {photo ? <Image alt="" className="-z-20 object-cover" fill sizes="240px" src={photo} unoptimized /> : null}
              <span className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b2230]/90 via-[#0b2230]/45 to-[#0b2230]/20" />
              <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[#f3c969]">Day {dayItem.dayNumber} · {formatCalendarDate(dayItem.date, false)}</span>
              <span className="mt-9 block text-base font-bold leading-5 drop-shadow">{dayItem.title}</span>
            </button>
          );
        })}
      </div>

      {placesLoading ? (
        <p className="mt-3 rounded-2xl bg-[#daf0ea] p-4 text-sm font-semibold text-[#276655]" role="status">
          Finding real places, photos, and reviews for each stop…
        </p>
      ) : null}
      {placesError ? (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#8f3f30] sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p>We couldn&apos;t load real places and reviews.</p>
          <button className="button-secondary" onClick={() => { setPlacesError(false); setPlacesAttempt((value) => value + 1); }} type="button">Try Again</button>
        </div>
      ) : null}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <section aria-label={`Day ${day.dayNumber} stops`}>
          <h2 className="text-2xl font-bold tracking-tight text-[#173f50]">{day.title}</h2>
          <ol className="mt-4">
            {day.activities.map((item, index) => {
              const key = getStopKey(day, item);
              const isChanged = changedKeys.includes(key);
              const selected = stopIndex === index;
              const next = day.activities[index + 1];
              const connectorKey = `${dayIndex}-${index}`;
              const mode = modes[connectorKey] ?? "walk";
              const fromPlace = item.place;
              const toPlace = next?.place;
              const estimate =
                hasCoordinates(fromPlace) && hasCoordinates(toPlace) ? estimateTravel(fromPlace, toPlace, mode) : null;

              return (
                <li key={key}>
                  <button
                    className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-[#e4664f] bg-[#fff4ef] shadow-[0_8px_24px_rgba(228,102,79,0.14)]" : "border-[#172733]/8 bg-white hover:border-[#e4664f]/40"}`}
                    onClick={() => selectStop(index)}
                    type="button"
                  >
                    <div className="flex items-start gap-4">
                      {item.place?.thumbnail ? (
                        <Image alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" height={64} src={item.place.thumbnail} unoptimized width={64} />
                      ) : (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#f2f0ea] text-xs font-bold text-[#607179]">{item.time}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#879196]">
                          {item.time}
                          <span className="rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[#607179]">{item.type}</span>
                          {isChanged ? <span className="rounded-full bg-[#f3c969] px-2 py-0.5 text-[#173f50]">Updated by Muse</span> : null}
                        </p>
                        <p className="mt-1 font-bold text-[#173f50]">{item.place?.name ?? item.title}</p>
                        {item.place ? <p className="text-sm text-[#52766c]">{item.title}</p> : <p className="text-sm text-[#52766c]">{item.location}</p>}
                        {item.place?.rating != null ? (
                          <p className="mt-1 text-sm font-bold text-[#b0661c]">
                            ★ {item.place.rating.toFixed(1)}
                            {item.place.reviewCount !== null ? <span className="font-normal text-[#718087]"> · {item.place.reviewCount.toLocaleString()} reviews</span> : null}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  {next ? (
                    <div className="ml-8 flex min-h-12 items-center gap-3 border-l-2 border-dashed border-[#173f50]/20 py-2 pl-6">
                      {estimate ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <button
                            className={`font-bold ${legKey === connectorKey ? "text-[#e4664f]" : "text-[#173f50]"} hover:text-[#e4664f]`}
                            onClick={() => { setLegKey(legKey === connectorKey ? null : connectorKey); setPanel("map"); }}
                            title="Show this trip on the map"
                            type="button"
                          >
                            {travelModes.find((option) => option.mode === mode)?.icon} {formatMinutes(estimate.minutes)} {mode === "walk" ? "walk" : mode === "bike" ? "by bike" : "by car"}
                          </button>
                          <span className="text-xs text-[#879196]">{formatDistance(estimate.distanceKm)} · estimate</span>
                          <span className="flex gap-1" role="group" aria-label="Change how you get there">
                            {travelModes.map((option) => (
                              <button
                                aria-label={option.label}
                                aria-pressed={mode === option.mode}
                                className={`h-8 rounded-full px-2.5 text-sm transition ${mode === option.mode ? "bg-[#173f50] text-white" : "bg-[#f2f0ea] hover:bg-[#e9e5da]"}`}
                                key={option.mode}
                                onClick={() => setModes((existing) => ({ ...existing, [connectorKey]: option.mode }))}
                                title={option.label}
                                type="button"
                              >
                                {option.icon}
                              </button>
                            ))}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#9aa4a7]">Travel time appears once both stops have a real place.</span>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-[#172733]/8 bg-white shadow-[0_14px_38px_rgba(23,63,80,0.07)]">
            <div className="flex border-b border-[#172733]/8" role="tablist">
              {([["map", "Map and reviews"], ["chat", `Group chat${messages.length ? ` (${messages.length})` : ""}`]] as [Panel, string][]).map(([id, label]) => (
                <button
                  aria-selected={panel === id}
                  className={`flex-1 px-4 py-3 text-sm font-bold transition ${panel === id ? "bg-white text-[#173f50] shadow-[inset_0_-3px_0_#e4664f]" : "bg-[#f7f7f3] text-[#879196] hover:text-[#173f50]"}`}
                  key={id}
                  onClick={() => setPanel(id)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            {panel === "map" ? (
              <div>
                <iframe
                  className="h-72 w-full border-0 bg-[#f2f0ea]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={getMapSource(activity, activeLeg, itinerary.destination)}
                  title="Map"
                />
                <div className="p-5">
                  {activeLeg ? (
                    <p className="text-sm font-semibold text-[#53666f]">
                      Route from {activeLeg.from.place?.name ?? activeLeg.from.title} to {activeLeg.to.place?.name ?? activeLeg.to.title}.
                    </p>
                  ) : activity ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#e4664f]">{activity.time} · {activity.type}</p>
                      <p className="mt-1 text-xl font-bold text-[#173f50]">{activity.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#718087]">{activity.description}</p>
                      {activity.place ? renderPlaceDetails(activity.place) : (
                        <p className="mt-4 rounded-2xl bg-[#f7f7f3] p-4 text-sm text-[#718087]">
                          {placesLoading ? "Looking up the real place…" : "No real place was matched to this stop."}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm leading-6 text-[#718087]">Tap a stop to see it on the map with ratings and reviews.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-[34rem] flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto p-5" ref={messageListRef}>
                  {messages.length === 0 ? (
                    <p className="rounded-2xl bg-[#f7f7f3] p-4 text-sm leading-6 text-[#718087]">
                      Not feeling a stop? Tell Muse what you would change and why, for example &ldquo;I&apos;d rather skip shopping, it&apos;s not really my thing.&rdquo; Muse updates the shared plan for everyone.
                    </p>
                  ) : null}
                  {messages.map((message) => {
                    const mine = message.role === "traveler" && message.travelerId === travelerId;
                    const fromMuse = message.role === "muse";
                    return (
                      <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`} key={message.id}>
                        <p className="mb-1 px-1 text-xs font-bold text-[#879196]">{fromMuse ? "✦ Muse" : message.authorName}</p>
                        <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${mine ? "bg-[#173f50] text-white" : fromMuse ? "bg-[#fff8dc] text-[#5a4a12]" : "bg-[#f2f0ea] text-[#273b46]"}`}>
                          {message.focus ? <p className={`mb-1 text-xs font-bold ${mine ? "text-[#f3c969]" : "text-[#879196]"}`}>Re: Day {message.focus.dayNumber}, {message.focus.title}</p> : null}
                          <p>{message.text}</p>
                          {message.changes && message.changes.length > 0 ? (
                            <ul className="mt-2 space-y-1 border-t border-[#5a4a12]/15 pt-2 text-xs">
                              {message.changes.map((change) => <li key={change}>✓ {change}</li>)}
                            </ul>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {isSending ? (
                    <div className="flex flex-col items-start">
                      <p className="mb-1 px-1 text-xs font-bold text-[#879196]">✦ Muse</p>
                      <div className="rounded-2xl bg-[#fff8dc] px-4 py-3 text-sm text-[#5a4a12]" role="status">Reading your message and updating the plan…</div>
                    </div>
                  ) : null}
                </div>

                <form className="border-t border-[#172733]/8 p-4" onSubmit={handleSend}>
                  {!browserReady ? null : !currentTraveler ? (
                    <p className="text-sm text-[#718087]">Open this trip from your invite link on this device to join the chat.</p>
                  ) : (
                    <>
                      {activity ? (
                        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#607179]">
                          <input checked={aboutStop} className="h-4 w-4 accent-[#e4664f]" onChange={(event) => setAboutStop(event.target.checked)} type="checkbox" />
                          About &ldquo;{activity.title}&rdquo;
                        </label>
                      ) : null}
                      <div className="flex gap-2">
                        <textarea
                          aria-label="Message to the group and Muse"
                          className="form-control min-h-12 flex-1 resize-none !py-3"
                          maxLength={600}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              event.currentTarget.form?.requestSubmit();
                            }
                          }}
                          placeholder="example: I don't like this, I'd rather do something outdoors"
                          rows={2}
                          value={draft}
                        />
                        <button className={`button-primary !min-h-12 !px-5 ${isSending || draft.trim() === "" ? "cursor-not-allowed opacity-60" : ""}`} disabled={isSending || draft.trim() === ""} type="submit">Send</button>
                      </div>
                      {chatError ? <p className="mt-2 text-sm font-semibold text-[#a34532]" role="alert">{chatError}</p> : null}
                    </>
                  )}
                </form>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
