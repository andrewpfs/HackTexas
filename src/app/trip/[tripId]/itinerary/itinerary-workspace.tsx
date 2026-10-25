"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ProposalCard, type ChatState } from "./proposal-card";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatCalendarDate } from "@/lib/date-utils";
import { getChangedStopKeys, getStopKey, needsPlaceLookup } from "@/lib/itinerary-diff";
import { estimateTravel, formatDistance, formatMinutes, travelModes, type TravelMode } from "@/lib/travel-time";
import type { ChatMessage, GroupItinerary, ItineraryProposal, ItineraryActivity, PersonalOverride, PlaceSuggestion } from "@/lib/trip-types";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type WorkspaceProps = {
  tripId: string;
  initialItinerary: GroupItinerary;
  initialMessages: ChatMessage[];
  initialProposal: ItineraryProposal | null;
  initialApprovedProposal: ItineraryProposal | null;
  travelers: { id: string; name: string }[];
  placesConfigured: boolean;
};

type Panel = "map" | "chat";

const directionFlags: Record<TravelMode, string> = { walk: "w", bike: "b", car: "d", transit: "r" };

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

export function ItineraryWorkspace({ tripId, initialItinerary, initialMessages, initialProposal, initialApprovedProposal, travelers, placesConfigured }: WorkspaceProps) {
  const router = useRouter();
  const [proposal, setProposal] = useState(initialProposal);
  const [approvedProposal, setApprovedProposal] = useState(initialApprovedProposal);
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
  const [view, setView] = useState<"group" | "mine">("group");
  const [planDraft, setPlanDraft] = useState({ title: "", location: "", note: "" });
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState("");
  const [draft, setDraft] = useState("");
  const [aboutStop, setAboutStop] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [askingMuse, setAskingMuse] = useState(false);
  const [chatError, setChatError] = useState("");
  const [placesError, setPlacesError] = useState(false);
  const [placesAttempt, setPlacesAttempt] = useState(0);
  const sendingRef = useRef(false);
  const lookingUpRef = useRef(false);
  const itineraryRef = useRef(itinerary);
  const messagesCountRef = useRef(messages.length);
  const lastMessageIdRef = useRef(messages.at(-1)?.id);
  const sendCounter = useRef(0);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    itineraryRef.current = itinerary;
  }, [itinerary]);

  const applyState = useCallback((next: GroupItinerary, nextMessages: ChatMessage[], highlight?: string[]) => {
    const previous = itineraryRef.current;
    const changed = highlight ?? (
      (next.revision ?? 0) > (previous.revision ?? 0) ? getChangedStopKeys(previous.days, next.days) : []
    );

    if (next.destination !== previous.destination) router.refresh();
    setItinerary(next);
    setMessages(nextMessages);
    if (changed.length > 0) {
      setChangedKeys(changed);
    }
  }, [router]);

  function applyProposalState(data: ChatState) {
    setProposal(data.proposal ?? null);
    setApprovedProposal(data.approvedProposal ?? null);
    applyState(data.itinerary, data.messages);
  }

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

        const data = (await response.json()) as ChatState;
        setProposal(data.proposal ?? null);
        setApprovedProposal(data.approvedProposal ?? null);
        const current = itineraryRef.current;
        const same =
          data.itinerary.revision === current.revision &&
          data.itinerary.placesStatus === current.placesStatus &&
          data.messages.length === messagesCountRef.current &&
          data.messages.at(-1)?.id === lastMessageIdRef.current;

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
    lastMessageIdRef.current = messages.at(-1)?.id;
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight });
  }, [messages, isSending, panel]);

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
          const data = (await stateResponse.json()) as ChatState;
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

  const nameOf = (id: string) => travelers.find((traveler) => traveler.id === id)?.name ?? "Someone";
  const overridesFor = (dayNumber: number, stop: ItineraryActivity) =>
    (itinerary.overrides ?? []).filter((item) => item.dayNumber === dayNumber && item.stopTime === stop.time && item.stopTitle === stop.title);
  // The plan this traveler follows instead of a group stop: their own, or one they joined.
  const myPlanFor = (dayNumber: number, stop: ItineraryActivity) =>
    overridesFor(dayNumber, stop).find((item) => item.travelerId === travelerId || (travelerId !== null && item.joinedBy.includes(travelerId)));

  async function changePlan(body: Record<string, unknown>) {
    if (!currentTraveler) return;
    setPlanBusy(true);
    setPlanError("");
    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelerId: currentTraveler.id, ...body }),
      });
      const data = (await response.json()) as { error?: string; itinerary?: GroupItinerary; messages?: ChatMessage[] };
      if (!response.ok || !data.itinerary) {
        setPlanError(data.error || "We couldn't save that plan.");
        return;
      }
      applyState(data.itinerary, data.messages ?? messages);
      setPlanDraft({ title: "", location: "", note: "" });
    } catch {
      setPlanError("We couldn't reach the server. Please try again.");
    } finally {
      setPlanBusy(false);
    }
  }

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
    setAskingMuse(text.toLowerCase().startsWith("@muse"));
    setChatError("");
    setDraft("");

    const focus = aboutStop && activity ? { dayNumber: day.dayNumber, title: activity.title } : undefined;
    const optimistic: ChatMessage = {
      id: `sending-${(sendCounter.current += 1)}`,
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
        proposal?: ItineraryProposal | null;
        approvedProposal?: ItineraryProposal | null;
      };

      if (!response.ok || !data.itinerary || !data.messages) {
        setChatError(data.error || "We couldn't send that message.");
        setMessages((existing) => existing.filter((message) => message.id !== optimistic.id));
        setDraft(text);
        return;
      }

      setProposal(data.proposal ?? null);
      setApprovedProposal(data.approvedProposal ?? null);
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
          <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Reviews ({place.reviews.length})</summary><ul className="mt-3 space-y-3">
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
          </ul></details>
        ) : null}

        <a className="mt-4 inline-block text-sm font-bold text-[#173f50] underline decoration-[#e4664f]/40 underline-offset-4 hover:text-[#e4664f]" href={place.mapsUrl} rel="noopener noreferrer" target="_blank">
          Read all reviews on Google Maps ↗
        </a>
      </div>
    );
  }

  function renderPersonalPlans(dayNumber: number, stop: ItineraryActivity) {
    const plans: PersonalOverride[] = overridesFor(dayNumber, stop);
    const mine = plans.find((plan) => plan.travelerId === travelerId);

    return (
      <div className="mt-6 border-t border-dashed border-[#173f50]/15 pt-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a5ea8]">Doing Your Own Thing</p>
        {plans.length === 0 ? <p className="mt-2 text-sm text-[#718087]">Everyone is doing this stop together.</p> : null}
        <ul className="mt-3 space-y-2">
          {plans.map((plan) => {
            const joined = travelerId !== null && plan.joinedBy.includes(travelerId);
            const own = plan.travelerId === travelerId;
            return (
              <li className="rounded-2xl bg-[#f4f1fb] p-3 text-sm" key={plan.id}>
                <p className="font-bold text-[#4b3d8a]">{nameOf(plan.travelerId)}: {plan.title}</p>
                {plan.location ? <p className="text-[#607179]">{plan.location}</p> : null}
                {plan.note ? <p className="mt-1 text-[#718087]">{plan.note}</p> : null}
                {plan.joinedBy.length > 0 ? <p className="mt-1 text-xs text-[#7a5ea8]">With {plan.joinedBy.map(nameOf).join(", ")}</p> : null}
                {currentTraveler ? (
                  <button
                    className="mt-2 rounded-full border border-[#7a5ea8]/30 bg-white px-3 py-1 text-xs font-bold text-[#4b3d8a] hover:bg-[#ece7f8]"
                    disabled={planBusy}
                    onClick={() => changePlan(own ? { action: "remove", overrideId: plan.id } : { action: joined ? "leave" : "join", overrideId: plan.id })}
                    type="button"
                  >
                    {own ? "Back To The Group Plan" : joined ? "Leave" : `Join ${nameOf(plan.travelerId)}`}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {currentTraveler && !mine ? (
          <form
            className="mt-4 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (planDraft.title.trim() === "") {
                setPlanError("Say what you'd rather do.");
                return;
              }
              changePlan({ action: "add", dayNumber, stopTime: stop.time, stopTitle: stop.title, ...planDraft });
            }}
          >
            <input aria-label="What you'd rather do" className="form-control !py-2.5 text-sm" maxLength={120} onChange={(event) => setPlanDraft({ ...planDraft, title: event.target.value })} placeholder="example: Arcade in Akihabara" value={planDraft.title} />
            <input aria-label="Where" className="form-control !py-2.5 text-sm" maxLength={160} onChange={(event) => setPlanDraft({ ...planDraft, location: event.target.value })} placeholder="example: Akihabara, Tokyo" value={planDraft.location} />
            <button className="w-full rounded-full bg-[#7a5ea8] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60" disabled={planBusy} type="submit">
              {planBusy ? "Saving…" : "Do My Own Thing Here"}
            </button>
            <p className="text-xs text-[#879196]">The group plan stays the same for everyone else. You can rejoin anytime.</p>
          </form>
        ) : null}
        {planError ? <p className="mt-2 text-sm font-semibold text-[#a34532]" role="alert">{planError}</p> : null}
      </div>
    );
  }

  const dayPhoto = (dayItem: GroupItinerary["days"][number]) =>
    dayItem.activities.find((item) => item.place?.thumbnail)?.place?.thumbnail ?? null;

  return (
    <div className="mt-6">
      {approvedProposal ? <section className="mb-5 rounded-2xl border-2 border-[#276655]/30 bg-[#daf0ea] p-5" role="status"><h2 className="text-xl font-bold text-[#276655]">Major Trip Change Approved</h2><p className="mt-2 text-sm leading-6">{approvedProposal.previousDestination !== approvedProposal.proposedDestination ? `The group voted to move the trip from ${approvedProposal.previousDestination} to ${approvedProposal.proposedDestination}. ` : "The group approved a major rewrite. "}The shared itinerary was updated. Old travel searches and simulated bookings were cleared; find travel again for the new plan.</p></section> : null}
      {currentTraveler ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-[#172733]/10 bg-white p-1" role="radiogroup" aria-label="Whose plan to show">
            {([["group", "Group Plan"], ["mine", "My Plan"]] as const).map(([id, label]) => (
              <button aria-checked={view === id} className={`rounded-full px-4 py-2 text-sm font-bold transition ${view === id ? "bg-[#173f50] text-white" : "text-[#607179]"}`} key={id} onClick={() => setView(id)} role="radio" type="button">
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-[#718087]">{view === "mine" ? "Your day, including any stops where you do your own thing." : "Everyone's shared plan. Pick a stop to do your own thing instead."}</p>
        </div>
      ) : null}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 py-2" role="tablist" aria-label="Days">
        {itinerary.days.map((dayItem, index) => {
          const photo = dayPhoto(dayItem);
          const selected = index === dayIndex;
          return (
            <button
              aria-selected={selected}
              className={`relative isolate h-32 w-52 shrink-0 overflow-hidden rounded-2xl bg-[#173f50] p-4 text-left text-white transition sm:w-60 ${selected ? "ring-4 ring-inset ring-[#397bb3]" : "opacity-80 hover:opacity-100"}`}
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
              const stopPlans = overridesFor(day.dayNumber, item);
              const myPlan = myPlanFor(day.dayNumber, item);
              const previous = day.activities[index - 1];
              // In "My Plan", the first group stop after doing your own thing is where you meet back up.
              const rejoinHere = view === "mine" && !myPlan && previous !== undefined && myPlanFor(day.dayNumber, previous) !== undefined;
              const awayIds = new Set(stopPlans.flatMap((plan) => [plan.travelerId, ...plan.joinedBy]));
              const awayNames = travelers.filter((traveler) => awayIds.has(traveler.id)).map((traveler) => traveler.name);
              const showingMyPlan = view === "mine" && myPlan !== undefined;
              // Around your own plan the group's places don't apply, so no estimate is shown.
              const nextIsMine = view === "mine" && next !== undefined && myPlanFor(day.dayNumber, next) !== undefined;
              const estimate =
                !showingMyPlan && !nextIsMine && hasCoordinates(fromPlace) && hasCoordinates(toPlace) ? estimateTravel(fromPlace, toPlace, mode) : null;

              return (
                <li key={key}>
                  <button
                    className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-[#e4664f] bg-[#fff4ef] shadow-[0_8px_24px_rgba(228,102,79,0.14)]" : "border-[#172733]/8 bg-white hover:border-[#e4664f]/40"}`}
                    onClick={() => selectStop(index)}
                    type="button"
                  >
                    <div className="flex items-start gap-4">
                      {showingMyPlan ? (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#e7e2f5] text-xs font-bold text-[#4b3d8a]">{item.time}</span>
                      ) : item.place?.thumbnail ? (
                        <Image alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" height={64} src={item.place.thumbnail} unoptimized width={64} />
                      ) : (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#f2f0ea] text-xs font-bold text-[#607179]">{item.time}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#879196]">
                          {item.time}
                          <span className="rounded-full bg-[#f2f0ea] px-2 py-0.5 text-[#607179]">{item.type}</span>
                          {isChanged ? <span className="rounded-full bg-[#f3c969] px-2 py-0.5 text-[#173f50]">Updated by Muse</span> : null}
                          {rejoinHere ? <span className="rounded-full bg-[#daf0ea] px-2 py-0.5 text-[#276655]">Rejoin the group here</span> : null}
                        </p>
                        {view === "mine" && myPlan ? (
                          <>
                            <p className="mt-1 font-bold text-[#7a5ea8]">{myPlan.title} <span className="ml-1 rounded-full bg-[#e7e2f5] px-2 py-0.5 text-xs text-[#4b3d8a]">Your Plan</span></p>
                            <p className="text-sm text-[#52766c]">{myPlan.location || "On your own"} · instead of {item.place?.name ?? item.title}</p>
                          </>
                        ) : (
                          <>
                            <p className="mt-1 font-bold text-[#173f50]">{item.place?.name ?? item.title}</p>
                            {item.place ? <p className="text-sm text-[#52766c]">{item.title}</p> : <p className="text-sm text-[#52766c]">{item.location}</p>}
                          </>
                        )}
                        {stopPlans.length > 0 && !(view === "mine" && myPlan) ? (
                          <span className="mt-1 block text-xs text-[#718087]">
                            {awayNames.length >= travelers.length ? "Everyone has other plans" : `With the group: everyone except ${awayNames.join(", ")}`}
                          </span>
                        ) : null}
                        {stopPlans.length > 0 ? (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {stopPlans.map((plan) => (
                              <span className="rounded-full bg-[#e7e2f5] px-2.5 py-0.5 text-xs font-bold text-[#4b3d8a]" key={plan.id}>
                                {nameOf(plan.travelerId)}{plan.joinedBy.length ? ` +${plan.joinedBy.length}` : ""} → {plan.title}
                              </span>
                            ))}
                          </span>
                        ) : null}
                        {item.place?.rating != null && !showingMyPlan ? (
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
                            {travelModes.find((option) => option.mode === mode)?.icon} {formatMinutes(estimate.minutes)} {mode === "walk" ? "walk" : mode === "bike" ? "by bike" : mode === "transit" ? "by transit" : "by car"}
                          </button>
                          <span className="text-xs text-[#879196]">{formatDistance(estimate.distanceKm)} · estimate</span>
                          <span className="flex gap-1" role="group" aria-label="Change how you get there">
                            {travelModes.map((option) => (
                              <button
                                aria-label={option.label}
                                aria-pressed={mode === option.mode}
                                className={`h-8 rounded-full px-2.5 text-sm transition ${mode === option.mode ? "bg-[#deedff] text-[#173f50] ring-2 ring-[#397bb3]" : "bg-[#f2f0ea] hover:bg-[#e9e5da]"}`}
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
                        <span className="text-xs text-[#9aa4a7]">{showingMyPlan || nextIsMine ? "Travel time depends on your own plan." : "Travel time appears once both stops have a real place."}</span>
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
              {([["map", "Map And Reviews"], ["chat", `Group Chat${messages.length ? ` (${messages.length})` : ""}`]] as [Panel, string][]).map(([id, label]) => (
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
                      {renderPersonalPlans(day.dayNumber, activity)}
                    </>
                  ) : (
                    <p className="text-sm leading-6 text-[#718087]">Tap a stop to see it on the map with ratings and reviews.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-[40rem] max-h-[85dvh] flex-col"><p className="border-b border-[#172733]/8 p-4 text-xs font-semibold text-[#53666f]">{travelers.map((traveler) => traveler.name).join(" ? ")} ? <span className="rounded-full bg-[#fff8dc] px-2 py-1 text-[#6f5a16]">✦ Muse</span></p>
                <div className="flex-1 space-y-3 overflow-y-auto p-5" ref={messageListRef}>
                  {proposal ? <ProposalCard onUpdate={applyProposalState} proposal={proposal} travelerId={travelerId} travelers={travelers} tripId={tripId} /> : null}
                  {messages.length === 0 ? (
                    <p className="rounded-2xl bg-[#f7f7f3] p-4 text-sm leading-6 text-[#718087]">
                      Message your group here. For help with the plan, try &ldquo;@muse make day 3 more relaxed.&rdquo; Major changes go to a group vote.
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
                      <div className="rounded-2xl bg-[#f7f7f3] px-4 py-3 text-sm text-[#53666f]" role="status">{askingMuse ? "Muse is considering your request…" : "Sending your message…"}</div>
                    </div>
                  ) : null}
                </div>

                <form className="border-t border-[#172733]/8 p-4" onSubmit={handleSend}>
                  {!browserReady ? null : !currentTraveler ? (
                    <p className="text-sm text-[#718087]">Open this trip from your invite link on this device to join the chat.</p>
                  ) : (
                    <>
                      <p className="mb-2 text-xs leading-5 text-[#607179]">Message the group normally. Start with @muse to ask Muse to help change the plan.</p>
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
                          placeholder="Message the group… or type @muse"
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
