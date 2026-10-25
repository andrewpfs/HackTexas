"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  { title: "Start A Trip", text: "A rough idea is enough. Pick your planning window and leave room for the group.", icon: "✈️" },
  { title: "Invite Your Group", text: "One link brings everyone together, even when you leave from different cities.", icon: "🔗" },
  { title: "Share Preferences", text: "Your budget, interests and free dates make the plan personal.", icon: "✦" },
  { title: "Find Common Ground", text: "Muse puts shared dates and different travel styles into three clear options.", icon: "🗓️" },
  { title: "Vote And Refine", text: "Everyone gets a say. Compare options and ask @muse for help with the plan.", icon: "✓" },
  { title: "Travel Together", text: "Follow one shared itinerary, with space to do your own thing and meet back up.", icon: "🧭" },
];

function PhoneScreen({ stage }: { stage: number }) {
  return <div className="mx-auto w-full max-w-[19rem] rounded-[2.5rem] border-[7px] border-[#173f50] bg-[#f8f6f1] p-4 shadow-xl">
    <div aria-hidden="true" className="mx-auto mb-4 h-3 w-20 rounded-full bg-[#173f50]" />
    <p className="text-xs font-bold uppercase tracking-widest text-[#397bb3]">Trip Planner · Demo</p>
    <h3 className="mb-5 mt-2 text-xl font-bold text-[#173f50]">{steps[stage].title}</h3>
    <div className="min-h-64 space-y-3 text-sm">
      {stage === 0 ? <><div className="rounded-2xl bg-[#173f50] p-5 text-white"><span className="text-3xl">🏔️</span><p className="mt-4 text-xl font-bold">A Winter Escape</p><p className="mt-2 text-white/70">Austin → Somewhere New</p></div><p className="rounded-xl bg-white p-3">Dec 15–23 · 5 Days</p><p className="rounded-full bg-[#f3c969] p-3 text-center font-bold">Create Your Trip →</p></> : null}
      {stage === 1 ? <><div className="rounded-2xl bg-[#daf0ea] p-4"><p className="font-bold">You&apos;re Invited</p><p className="mt-2 font-mono">trip.link/winter</p></div>{["Ryan · Austin", "Tin · Houston", "Jay · Dallas"].map((person) => <p className="rounded-xl bg-white p-3" key={person}>👤 {person} <span className="float-right text-[#276655]">✓</span></p>)}</> : null}
      {stage === 2 ? <><p className="rounded-2xl bg-white p-4">Your Budget <b className="mt-1 block text-2xl">$1,200</b></p><div className="flex flex-wrap gap-2">{["🍜 Food", "🏛️ Museums", "🌳 Outdoors"].map((tag) => <span className="rounded-full bg-[#e7e2f5] px-3 py-2 font-bold text-[#4b3d8a]" key={tag}>{tag}</span>)}</div><p className="rounded-xl bg-[#daf0ea] p-4">Available Dec 17–21 ✓</p></> : null}
      {stage === 3 ? <><p className="rounded-xl bg-[#daf0ea] p-4 font-bold text-[#276655]">Everyone Is Free Dec 19–21</p>{["Tokyo · Food & Culture", "Kyoto · A Slower Pace", "Osaka · Explore Together"].map((option, index) => <p className="rounded-2xl border border-[#397bb3]/20 bg-white p-4" key={option}><span className="mr-2 text-[#397bb3]">0{index + 1}</span>{option}</p>)}</> : null}
      {stage === 4 ? <><div className="rounded-2xl bg-white p-4"><p className="font-bold">Kyoto · A Slower Pace</p><p className="mt-3 text-[#276655]">✓ Ryan · ✓ Tin · ✓ Jay</p></div><p className="rounded-2xl bg-[#173f50] p-3 text-white">@muse leave a free afternoon?</p><p className="rounded-2xl bg-[#fff8dc] p-4 text-[#6f5a16]">✦ Muse<br />A little room to wander. Afternoon kept flexible.</p></> : null}
      {stage === 5 ? <><p className="rounded-2xl bg-[#173f50] p-4 text-white">Day 2 · Explore At Your Pace</p>{["9:00 AM · Breakfast Together", "10:30 AM · Garden Walk", "1:00 PM · Lunch & Free Time", "7:00 PM · Meet For Dinner"].map((stop) => <p className="border-l-2 border-[#397bb3] bg-white p-3" key={stop}>{stop}</p>)}</> : null}
    </div>
    <div aria-hidden="true" className="mx-auto mt-5 h-1 w-20 rounded-full bg-[#173f50]/30" />
  </div>;
}

export function PlanningStory() {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.stage));
      }
    }, { rootMargin: "-25% 0px -40% 0px", threshold: 0 });
    const items = list.current?.querySelectorAll("[data-stage]") ?? [];
    for (const item of items) observer.observe(item);
    return () => observer.disconnect();
  }, []);
  return <section className="px-5 py-20 sm:px-8 lg:px-10" aria-labelledby="story-title">
    <div className="mx-auto max-w-6xl"><p className="eyebrow">From Idea To Takeoff</p><h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-[#102a38] sm:text-5xl" id="story-title">A Clear Path To Your Next Trip</h2>
      <div className="relative mt-12 grid gap-12 lg:grid-cols-2">
        <div className="hidden self-start lg:sticky lg:top-28 lg:block"><PhoneScreen stage={active} /><p className="mt-5 text-center text-xs text-[#718087]">An illustrative preview · Scroll to explore</p></div>
        <ol className="space-y-12 lg:space-y-0" ref={list}>{steps.map((step, index) => <li className="flex flex-col justify-center gap-6 border-t border-[#173f50]/15 pt-6 lg:min-h-[60vh] lg:py-12" data-stage={index} key={step.title}>
          <button aria-current={active === index ? "step" : undefined} className="rounded-xl text-left focus-visible:outline-2 focus-visible:outline-[#397bb3]" onClick={() => setActive(index)} onFocus={() => setActive(index)} type="button"><span className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${active === index ? "bg-[#daf0ea] text-[#276655]" : "bg-white text-[#173f50]"}`} aria-hidden="true">{step.icon}</span><span className="block text-xs font-bold text-[#397bb3]">0{index + 1}</span><span className="mt-2 block text-2xl font-bold">{step.title}</span><span className="mt-3 block max-w-md text-lg leading-8 text-[#66757d]">{step.text}</span></button>
          <div className="lg:hidden"><PhoneScreen stage={index} /></div>
        </li>)}</ol>
      </div>
    </div>
  </section>;
}
