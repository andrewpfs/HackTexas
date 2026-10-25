"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { activityEmoji, groupCandidateDays } from "@/lib/candidate-display";
import { formatCalendarDate } from "@/lib/date-utils";
import type { CandidateDay } from "@/lib/trip-types";

function DayDetails({ day, fallbackImage }: { day: CandidateDay; fallbackImage?: string }) {
  const photo = day.imageUrl || fallbackImage;
  return <details className="group overflow-hidden rounded-2xl border border-[#172733]/10 bg-white">
    <summary className="relative isolate flex min-h-24 cursor-pointer list-none items-end justify-between gap-3 bg-[#173f50] p-4 text-white">
      {photo ? <Image alt="" className="-z-20 object-cover" fill sizes="(min-width: 1280px) 30vw, 100vw" src={photo} unoptimized /> : null}
      <span className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b2230]/90 to-[#0b2230]/30" />
      <span><span className="block text-xs font-bold uppercase text-[#f3c969]">Day {day.dayNumber} · {formatCalendarDate(day.date, false)}</span><span className="mt-1 block text-lg font-bold">{day.title}</span></span>
      <span aria-hidden="true" className="transition group-open:rotate-180">⌄</span>
    </summary>
    <ul className="divide-y divide-[#172733]/8">{day.activities.map((activity, index) => <li className="flex gap-3 p-4" key={index}><span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf5f2] text-2xl">{activityEmoji(activity)}</span><div className="min-w-0"><p className="text-xs font-bold text-[#397bb3]">{activity.timeOfDay}</p><p className="mt-1 font-bold text-[#173f50]">{activity.title}</p><p className="mt-1 text-sm leading-6 text-[#718087]">{activity.description}</p></div></li>)}</ul>
  </details>;
}

export function CandidateDays({ days, imageUrl, title }: { days: CandidateDay[]; imageUrl?: string; title: string }) {
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const blocks = groupCandidateDays(days);
  useEffect(() => {
    if (activeBlock !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [activeBlock]);
  function close() { setActiveBlock(null); }
  if (days.length <= 7) return <div className="mt-3 space-y-2">{days.map((day) => <DayDetails day={day} fallbackImage={imageUrl} key={day.dayNumber} />)}</div>;
  return <>
    <div className="mt-3 grid gap-2">{blocks.map((block, index) => <button className="rounded-2xl border border-[#397bb3]/20 bg-[#eef6ff] p-4 text-left font-bold text-[#173f50]" key={index} onClick={() => setActiveBlock(index)} type="button" aria-haspopup="dialog">Block {index + 1} · {block.length === 1 ? `Day ${block[0].dayNumber}` : `Days ${block[0].dayNumber}–${block[block.length - 1].dayNumber}`} <span aria-hidden="true">↗</span></button>)}</div>
    <dialog aria-label={`${title}: Day Details`} className="fixed inset-0 m-auto max-h-[90dvh] w-[42rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl bg-white p-5 text-[#172733] shadow-2xl backdrop:bg-[#0b2230]/60" onCancel={close} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close(); }} ref={dialog}>
      <div className="sticky -top-5 z-10 flex items-center justify-between gap-4 bg-white py-4"><h4 className="text-lg font-bold">{title} · Block {(activeBlock ?? 0) + 1}</h4><button autoFocus aria-label="Close Day Details" className="rounded-full border px-3 py-2 font-bold" onClick={close} type="button">✕</button></div>
      <div className="space-y-3">{activeBlock !== null ? blocks[activeBlock].map((day) => <DayDetails day={day} fallbackImage={imageUrl} key={day.dayNumber} />) : null}</div>
    </dialog>
  </>;
}
