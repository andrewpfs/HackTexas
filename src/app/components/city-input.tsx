"use client";

import { useEffect, useId, useRef, useState } from "react";

type CityInputProps = {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onPick?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

// A city field that suggests real places as you type and only accepts one from the list.
// A city that was already saved counts as valid until the traveler edits it.
export function CityInput({ id, name, value, onChange, onPick, placeholder, required, className }: CityInputProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pickedValue, setPickedValue] = useState(value);
  const [unavailable, setUnavailable] = useState(false);
  const [touched, setTouched] = useState(false);
  const picked = value.trim() !== "" && value === pickedValue;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    // If the suggestion service is down, free text is accepted rather than blocking anyone.
    const invalid = value.trim() !== "" && !picked && !unavailable;
    input.setCustomValidity(invalid ? "Pick a city from the list." : "");
  }, [value, picked, unavailable]);

  useEffect(() => {
    if (picked || value.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const data = (await response.json()) as { cities: string[]; unavailable?: boolean };
        setUnavailable(Boolean(data.unavailable));
        setSuggestions(data.cities);
        setHighlight(-1);
      } catch {
        // A newer keystroke replaced this request.
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, picked]);

  function choose(city: string) {
    setPickedValue(city);
    onChange(city);
    onPick?.(city);
    setOpen(false);
    setSuggestions([]);
  }

  const showList = open && !picked && suggestions.length > 0;
  const showError = touched && value.trim() !== "" && !picked && !unavailable && !showList;

  return (
    <div className="relative">
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList}
        autoComplete="off"
        className={className ?? "form-control"}
        id={id}
        name={name}
        onBlur={() => { setTouched(true); setTimeout(() => setOpen(false), 120); }}
        onChange={(event) => { onChange(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!showList) return;
          if (event.key === "ArrowDown") { event.preventDefault(); setHighlight((current) => (current + 1) % suggestions.length); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setHighlight((current) => (current <= 0 ? suggestions.length - 1 : current - 1)); }
          else if (event.key === "Enter" && highlight >= 0) { event.preventDefault(); choose(suggestions[highlight]); }
          else if (event.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        ref={inputRef}
        required={required}
        role="combobox"
        value={value}
      />
      {picked ? <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#276655]">✓</span> : null}
      {showList ? (
        <ul className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-[#172733]/10 bg-white p-1.5 shadow-[0_18px_40px_rgba(23,63,80,0.16)]" id={listId} role="listbox">
          {suggestions.map((city, index) => (
            <li aria-selected={index === highlight} className={`cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-semibold ${index === highlight ? "bg-[#fbe4d9] text-[#173f50]" : "text-[#273b46] hover:bg-[#f7f7f3]"}`} key={city} onMouseDown={(event) => { event.preventDefault(); choose(city); }} role="option">
              {city}
            </li>
          ))}
        </ul>
      ) : null}
      {showError ? <p className="mt-2 text-sm font-semibold text-[#a34532]" role="alert">Pick a city from the list.</p> : null}
    </div>
  );
}
