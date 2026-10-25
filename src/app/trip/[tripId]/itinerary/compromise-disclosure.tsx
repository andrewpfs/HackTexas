"use client";
import { useId, useState } from "react";

export function CompromiseDisclosure({ explanation, compromises }: { explanation: string; compromises: string[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="mt-6 rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8">
    <button aria-controls={id} aria-expanded={open} className="flex w-full items-center justify-between gap-4 rounded-xl p-2 text-left transition hover:bg-[#edf5fb] focus-visible:outline-2 focus-visible:outline-[#397bb3]" onClick={() => setOpen(!open)} type="button">
      <span><span className="eyebrow block">How The Group Got Here</span><span className="mt-2 block text-xl font-bold">Compromise</span></span>
      <span aria-hidden="true" className="rounded-full bg-[#edf5fb] px-3 py-1 text-xl">{open ? "▴" : "▾"}</span>
    </button>
    <div hidden={!open} id={id}><p className="mt-4 leading-7 text-[#53666f]">{explanation}</p><ul className="mt-5 space-y-2">{compromises.map((item) => <li className="rounded-2xl bg-[#fff8dc] p-4 text-sm leading-6 text-[#6f5a16]" key={item}>✓ {item}</li>)}</ul></div>
  </section>;
}
