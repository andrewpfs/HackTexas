"use client";

import { useState } from "react";
import type { ChatMessage, GroupItinerary, ItineraryActivity } from "@/lib/trip-types";
import type { TravelWarning } from "@/lib/manual-itinerary";
import { formatMinutes } from "@/lib/travel-time";

type Preview = { token: string; activity: ItineraryActivity; warnings: TravelWarning[]; placeNote: string };
type Props = {
  tripId: string; travelerId: string; itinerary: GroupItinerary; dayNumber: number; stopIndex: number;
  onClose: () => void; onSaved: (itinerary: GroupItinerary, messages: ChatMessage[]) => void;
};

export function ManualStopEditor(props: Props) {
  const [baseItinerary] = useState(props.itinerary);
  const old = baseItinerary.days.find((day) => day.dayNumber === props.dayNumber)!.activities[props.stopIndex];
  const [action, setAction] = useState<"replace" | "before" | "after" | "">("");
  const [draft, setDraft] = useState({ title: "", location: "", time: "", description: "" });
  const [matchPlace, setMatchPlace] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(save: boolean) {
    setBusy(true);
    setError("");
    try {
      let body: Record<string, unknown> = { ...draft, matchPlace, action, mode: "preview", travelerId: props.travelerId, itineraryId: baseItinerary.id, expectedRevision: baseItinerary.revision ?? 0, dayNumber: props.dayNumber, stopIndex: props.stopIndex };
      if (save && preview) body = { mode: "save", token: preview.token, allowLongTravel: preview.warnings.length > 0 };
      const response = await fetch(`/api/trips/${props.tripId}/itinerary/manual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Couldn't save this stop."); return; }
      if (save) { props.onSaved(data.itinerary, data.messages); props.onClose(); }
      else setPreview(data);
    } catch { setError("Couldn't reach the server. Try again."); }
    finally { setBusy(false); }
  }

  function choose(next: "replace" | "before" | "after") {
    setAction(next);
    if (next === "replace") setDraft({ title: old.title, location: old.location, time: old.time, description: old.description });
    else setDraft({ title: "", location: "", time: "", description: "" });
  }

  return <div aria-label={`Edit shared stop: ${old.title}`} className="mb-3 rounded-2xl border-2 border-[#397bb3]/40 bg-[#eef6fd] p-4">
    <h3 className="font-bold text-[#173f50]">Edit Shared Stop</h3>
    <p className="mt-1 text-xs leading-5 text-[#53666f]">Changes apply to everyone. For a destination or whole-trip change, use @muse and the group vote.</p>
    {!action ? <div className="mt-3 flex flex-wrap gap-2">
      <button className="button-secondary !min-h-9 !px-3 !text-xs" onClick={() => choose("replace")} type="button">Replace Stop</button>
      <button className="button-secondary !min-h-9 !px-3 !text-xs" onClick={() => choose("before")} type="button">Add Stop Before</button>
      <button className="button-secondary !min-h-9 !px-3 !text-xs" onClick={() => choose("after")} type="button">Add Stop After</button>
    </div> : preview ? <div className="mt-3 space-y-3">
      <p className="font-bold">{preview.activity.time || "Time not set"} · {preview.activity.title}</p>
      <p className="text-sm">{preview.activity.location}</p>
      <p className="text-sm">{preview.activity.description}</p>
      {preview.activity.place ? <div className="rounded-xl bg-white p-3 text-sm"><b>Matched place: {preview.activity.place.name}</b><p>{preview.activity.place.address}</p><a className="underline" href={preview.activity.place.mapsUrl} rel="noopener noreferrer" target="_blank">Check On Google Maps ↗</a></div> : null}
      <p className="text-xs text-[#53666f]">{preview.placeNote} Go back and turn off place matching to save without this match.</p>
      {preview.warnings.length ? <div className="rounded-xl border-2 border-[#c87325] bg-[#fff2da] p-4 text-[#71420f]" role="alert">
        <h4 className="font-bold">⚠ Long Travel Detected</h4>
        {preview.warnings.map((warning) => <p className="mt-2 text-sm" key={warning.segment}>About {formatMinutes(warning.minutes)} driving {warning.segment === "previous" ? "from the previous activity" : "to the next activity"}: {warning.title}.</p>)}
        <p className="mt-2 text-sm">Consider replacing a nearby stop, moving this activity to another day, or removing another activity to make room.</p>
        <p className="mt-2 text-xs">Approximate driving estimate from coordinates, not a routed journey.</p>
      </div> : null}
      <div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={busy} onClick={() => setPreview(null)} type="button">Go Back</button><button className="button-primary" disabled={busy} onClick={() => submit(true)} type="button">{busy ? "Saving…" : preview.warnings.length ? action === "replace" ? "Replace Anyway" : "Add Anyway" : "Save Shared Stop"}</button></div>
    </div> : <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); submit(false); }}>
      <p className="text-sm font-bold">{action === "replace" ? "Replace" : action === "before" ? "Add Before" : "Add After"}: {old.title}</p>
      <label className="block text-sm">Stop Title<input autoFocus className="form-control mt-1" maxLength={160} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} /></label>
      <label className="block text-sm">Location / Place (Optional)<input className="form-control mt-1" maxLength={200} onChange={(event) => setDraft({ ...draft, location: event.target.value })} value={draft.location} /></label>
      <label className="block text-sm">Time (Optional)<input className="form-control mt-1" maxLength={20} onChange={(event) => setDraft({ ...draft, time: event.target.value })} placeholder="2:30 PM or 14:30" value={draft.time} /></label>
      <label className="block text-sm">Description (Optional)<textarea className="form-control mt-1" maxLength={600} onChange={(event) => setDraft({ ...draft, description: event.target.value })} value={draft.description} /></label>
      <label className="flex gap-2 text-xs leading-5"><input checked={matchPlace} onChange={(event) => setMatchPlace(event.target.checked)} type="checkbox" />Find a real place to preview and estimate travel, when search is available.</label>
      <p className="text-xs text-[#53666f]">Timed stops are ordered by clock time. Untimed stops stay at your chosen before/after position.</p>
      <button className="button-primary" disabled={busy} type="submit">{busy ? "Checking…" : "Review Stop"}</button>
    </form>}
    <button className="mt-3 px-2 py-2 text-sm font-bold underline" disabled={busy} onClick={props.onClose} type="button">Cancel</button>
    {error ? <p className="mt-2 text-sm text-[#a34532]" role="alert">{error}</p> : null}
  </div>;
}
