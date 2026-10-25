"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../../components/avatar";
import {
  backgroundColors,
  hairColors,
  hairStyleNames,
  randomLook,
  skinTones,
  type AvatarGender,
  type AvatarLook,
} from "@/lib/avatar-look";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type AvatarPickerProps = { tripId: string; travelerId: string; name: string; look: AvatarLook };

function Swatches({ label, colors, selected, onPick }: { label: string; colors: string[]; selected: number; onPick: (index: number) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-[#879196]">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {colors.map((color, index) => (
          <button
            aria-checked={selected === index}
            aria-label={`${label} ${index + 1}`}
            className={`h-7 w-7 rounded-full border-2 transition ${selected === index ? "scale-110 border-[#173f50]" : "border-white shadow-[0_0_0_1px_rgba(23,39,51,0.15)] hover:scale-105"}`}
            key={color}
            onClick={() => onPick(index)}
            role="radio"
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      aria-pressed={on}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${on ? "bg-[#173f50] text-white" : "bg-[#f2f0ea] text-[#53666f] hover:bg-[#e9e5da]"}`}
      onClick={() => onChange(!on)}
      type="button"
    >
      {label}
    </button>
  );
}

// A traveler's picture. On your own picture, click to open the editor and make it yours.
export function AvatarPicker({ tripId, travelerId, name, look: savedLook }: AvatarPickerProps) {
  const router = useRouter();
  const { travelerId: me } = useTravelerIdentity(tripId);
  const editable = me === travelerId;
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState<AvatarLook | null>(null);
  const [lastSaved, setLastSaved] = useState(JSON.stringify(savedLook));
  const [error, setError] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);

  // When the saved look changes (here or on another device), drop any unsaved override.
  if (lastSaved !== JSON.stringify(savedLook)) {
    setLastSaved(JSON.stringify(savedLook));
    setOverride(null);
  }

  const look = override ?? savedLook;
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Save a moment after the last edit, so a burst of clicks makes one request.
  useEffect(() => {
    if (!override || JSON.stringify(override) === lastSaved) return;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/trips/${tripId}/travelers/${travelerId}/avatar`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(override),
        });
        if (!response.ok) {
          setError("Couldn't save your avatar.");
          return;
        }
        router.refresh();
      } catch {
        setError("Couldn't save your avatar.");
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [override, lastSaved, tripId, travelerId, router]);

  function change(update: (current: AvatarLook) => AvatarLook) {
    setError("");
    setOverride((current) => update(current ?? savedLook));
  }

  function setGender(gender: AvatarGender) {
    change((current) => (current.gender === gender ? current : { ...current, gender, style: 0, beard: false, earrings: gender === "girl" }));
  }

  const picture = <Avatar idPrefix={`${travelerId}-${open ? "edit" : "show"}`} label={`${name}'s avatar`} look={look} size={52} />;

  if (!editable) {
    return <span className="block shrink-0">{picture}</span>;
  }

  return (
    <div className="relative shrink-0" ref={wrapper}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Change your avatar"
        className="group relative block rounded-full transition hover:scale-105"
        onClick={() => setOpen((value) => !value)}
        title="Click to change your avatar"
        type="button"
      >
        {picture}
        <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#173f50] text-white shadow ring-2 ring-white">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-3 w-[19rem] rounded-3xl border border-[#172733]/10 bg-white p-5 shadow-[0_22px_60px_rgba(23,63,80,0.22)]" role="dialog" aria-label="Customize your avatar">
          <div className="flex items-center gap-4">
            <Avatar idPrefix={`${travelerId}-preview`} look={look} size={72} />
            <div className="flex-1">
              <div className="flex rounded-full bg-[#f2f0ea] p-1" role="radiogroup" aria-label="Boy or girl">
                {(["boy", "girl"] as const).map((gender) => (
                  <button
                    aria-checked={look.gender === gender}
                    className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold capitalize transition ${look.gender === gender ? "bg-[#173f50] text-white" : "text-[#607179]"}`}
                    key={gender}
                    onClick={() => setGender(gender)}
                    role="radio"
                    type="button"
                  >
                    {gender}
                  </button>
                ))}
              </div>
              <button className="mt-2 w-full rounded-full border border-[#172733]/15 px-3 py-1.5 text-sm font-bold text-[#173f50] transition hover:bg-[#fbe4d9]" onClick={() => change((current) => randomLook(current.gender))} type="button">
                Shuffle
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-[#879196]">Hair Style</p>
              <div className="flex flex-wrap gap-1.5">
                {hairStyleNames[look.gender].map((styleName, index) => (
                  <button
                    aria-pressed={look.style === index}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${look.style === index ? "bg-[#e4664f] text-white" : "bg-[#f2f0ea] text-[#53666f] hover:bg-[#e9e5da]"}`}
                    key={styleName}
                    onClick={() => change((current) => ({ ...current, style: index }))}
                    type="button"
                  >
                    {styleName}
                  </button>
                ))}
              </div>
            </div>
            <Swatches colors={skinTones} label="Skin" onPick={(skin) => change((current) => ({ ...current, skin }))} selected={look.skin} />
            <Swatches colors={hairColors} label="Hair Color" onPick={(hair) => change((current) => ({ ...current, hair }))} selected={look.hair} />
            <Swatches colors={backgroundColors} label="Background" onPick={(background) => change((current) => ({ ...current, background }))} selected={look.background} />
            <div>
              <p className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-[#879196]">Extras</p>
              <div className="flex flex-wrap gap-1.5">
                <Toggle label="Glasses" on={look.glasses} onChange={(glasses) => change((current) => ({ ...current, glasses }))} />
                <Toggle label="Hat" on={look.hat} onChange={(hat) => change((current) => ({ ...current, hat }))} />
                <Toggle label="Freckles" on={look.freckles} onChange={(freckles) => change((current) => ({ ...current, freckles }))} />
                {look.gender === "boy" ? <Toggle label="Beard" on={look.beard} onChange={(beard) => change((current) => ({ ...current, beard }))} /> : <Toggle label="Earrings" on={look.earrings} onChange={(earrings) => change((current) => ({ ...current, earrings }))} />}
              </div>
            </div>
          </div>

          {error ? <p className="mt-3 text-xs font-semibold text-[#a34532]" role="alert">{error}</p> : null}
          <button className="button-dark mt-5 !min-h-10 w-full !text-sm" onClick={() => setOpen(false)} type="button">Done</button>
        </div>
      ) : null}
    </div>
  );
}
