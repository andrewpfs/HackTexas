"use client";

import { useEffect, useId, useState } from "react";
import type { PlaceSuggestion } from "@/lib/trip-types";

type Props = {
  tripId: string;
  value: string;
  place: PlaceSuggestion | null;
  onChange: (value: string, place: PlaceSuggestion | null) => void;
  onUnavailable?: (unavailable: boolean) => void;
  label: string;
  placeholder: string;
  maxLength?: number;
  personal?: boolean;
};

export function PlaceAutocomplete({ tripId, value, place, onChange, onUnavailable, label, placeholder, maxLength = 200, personal = false }: Props) {
  const listId = useId();
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (place || value.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/trips/${tripId}/itinerary/place-search?q=${encodeURIComponent(value.trim())}&personal=${personal ? "1" : "0"}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error("Search unavailable");
        setPlaces(data.places ?? []);
        setUnavailable(data.available === false);
        onUnavailable?.(data.available === false);
        setActive(0);
      } catch {
        if (!controller.signal.aborted) { setUnavailable(true); onUnavailable?.(true); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tripId, value, place, onUnavailable, personal]);

  function update(text: string) {
    setPlaces([]);
    setUnavailable(false);
    onUnavailable?.(false);
    onChange(text, null);
  }

  function select(selected: PlaceSuggestion) {
    setPlaces([]);
    onChange(selected.name, selected);
  }

  return <div className="relative text-sm">
    <label className="block font-semibold">{label}
      <input autoComplete="off" className="form-control mt-1" maxLength={maxLength} onChange={(event) => update(event.target.value)} onKeyDown={(event) => {
        if (event.key === "ArrowDown" && places.length > 0) { event.preventDefault(); setActive((active + 1) % places.length); }
        if (event.key === "ArrowUp" && places.length > 0) { event.preventDefault(); setActive((active + places.length - 1) % places.length); }
        if (event.key === "Enter" && places.length > 0) { event.preventDefault(); select(places[active]); }
        if (event.key === "Escape") setPlaces([]);
      }} placeholder={placeholder} role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={places.length > 0} value={value} />
    </label>
    {loading ? <p className="mt-1 text-xs text-[#53666f]">Searching real places…</p> : null}
    {place ? <p className="mt-1 text-xs font-semibold text-[#276655]">Selected real place: {place.address || place.name}</p> : null}
    {unavailable ? <p className="mt-1 text-xs text-[#53666f]">{personal ? "Place search is unavailable. Try again to select a real location before saving." : "Place search is unavailable. You can enter a freeform location; travel time will not be estimated."}</p> : null}
    {!place && !unavailable && !loading && value.trim().length >= 3 && places.length === 0 ? <p className="mt-1 text-xs text-[#53666f]">Choose a real place from suggestions to continue.</p> : null}
    {places.length > 0 ? <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#173f50]/20 bg-white p-1 shadow-lg" id={listId} role="listbox">
      {places.map((suggestion, index) => <li key={`${suggestion.mapsUrl}-${index}`} role="option" aria-selected={index === active}><button className={`w-full rounded-lg px-3 py-2 text-left ${index === active ? "bg-[#edf5fd]" : "hover:bg-[#edf5fd]"}`} onClick={() => select(suggestion)} type="button"><b>{suggestion.name}</b><span className="block text-xs text-[#53666f]">{suggestion.address}</span></button></li>)}
    </ul> : null}
  </div>;
}
