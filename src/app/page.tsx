import { PlanningStory } from "./components/planning-story";
import { ReturningTraveler } from "./components/returning-traveler";
import Image from "next/image";
import Link from "next/link";
import { Header } from "./components/header";

const groupNeeds = [
  { icon: "◷", label: "Schedules", detail: "Dec 15–23", color: "bg-[#daf0ea]" },
  { icon: "$", label: "Budgets", detail: "$1.5k–$2.4k", color: "bg-[#fbe4d9]" },
  { icon: "✦", label: "Interests", detail: "Food, art, nightlife", color: "bg-[#e7e2f5]" },
];

const exampleTravelers = [
  { name: "Ryan", icon: "🧑🏽", interests: ["Food", "Museums"], budget: "$1,200", available: "Dec 17–21", request: "I really want one free afternoon.", hotel: "" },
  { name: "Tin", icon: "👩🏻", interests: ["Shopping", "Nightlife", "Sightseeing"], budget: "$1,500", available: "Dec 18–23", request: "I want to stay near public transit.", hotel: "4★ hotel" },
  { name: "Jordan", icon: "👨🏼", interests: ["Outdoors"], budget: "$900", available: "Dec 17–19", request: "No super early mornings.", hotel: "" },
];

const interestColors: Record<string, string> = {
  Food: "bg-[#fff0db] text-[#805212]", Museums: "bg-[#e7e2f5] text-[#4b3d8a]",
  Shopping: "bg-[#fbe4d9] text-[#93432f]", Nightlife: "bg-[#e7e2f5] text-[#4b3d8a]",
  Sightseeing: "bg-[#deedff] text-[#2f6699]", Outdoors: "bg-[#daf0ea] text-[#276655]",
};

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[#f8f6f1] text-[#172733]">
      <Header />

      <section className="relative isolate border-b border-[#172733]/10">
        <Image alt="" className="-z-20 object-cover" fill priority sizes="100vw" src="/images/hero-mountains.jpg" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b2230]/85 via-[#0b2230]/55 to-[#0b2230]/20" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-28">
          <div className="max-w-3xl">
            <p className="eyebrow !text-[#f3c969]">Built For The Whole Group</p>
            <h1 className="mt-6 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Less Group Chat.
              <span className="block font-serif font-normal italic text-[#f3c969]">
                More Common Ground.
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
              Bring everyone’s schedules, budgets, and travel styles together.
              HackTX Trip Planner helps your group agree on one trip that
              actually works.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link className="button-primary" href="/create">
                Plan a Trip <span aria-hidden="true">→</span>
              </Link>
              <Link className="button-secondary" href="/join">Join a Trip</Link>
            </div>
            <p className="mt-5 text-sm text-white/70">No accounts needed for the demo · Everyone gets a say</p>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
            <div className="absolute -left-8 top-10 hidden h-24 w-24 rounded-full bg-[#f3c969] lg:block" />
            <div className="relative rotate-1 rounded-[2rem] border border-[#172733]/10 bg-white p-5 shadow-[0_28px_80px_rgba(29,50,61,0.14)] sm:p-7">
              <div className="flex items-start justify-between border-b border-[#172733]/10 pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e4664f]">Group trip preview</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Japan Winter Trip</h2>
                  <p className="mt-1 text-sm text-[#66757d]">Four departure cities · Meeting in Tokyo</p>
                </div>
                <div className="flex -space-x-2" aria-label="Four travelers">
                  {["J", "H", "A", "M"].map((initial, index) => (
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#173f50] text-xs font-bold text-white"
                      key={initial}
                      style={{ opacity: 1 - index * 0.12 }}
                    >
                      {initial}
                    </span>
                  ))}
                </div>
              </div>

              <div className="py-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Finding the overlap</span>
                  <span className="rounded-full bg-[#daf0ea] px-3 py-1 text-xs font-bold text-[#276655]">2 of 4 ready</span>
                </div>
                <div className="mt-5 grid grid-cols-9 gap-1.5" aria-label="Availability overlap preview">
                  {[1, 2, 3, 2, 4, 4, 3, 1, 1].map((value, index) => (
                    <div className="text-center" key={index}>
                      <div className={`mx-auto h-12 w-full rounded-md ${value === 4 ? "bg-[#276655]" : value === 3 ? "bg-[#9ed7b8]" : "bg-[#e8eceb]"}`} />
                      <span className="mt-1.5 block text-[10px] text-[#819097]">{15 + index}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[#f3f1eb] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#6b777c]">Best shared window</p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <p className="text-lg font-semibold">Dec 20–21</p>
                  <p className="text-sm text-[#53636c]">Everyone is available</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-4 -rotate-3 rounded-2xl bg-[#173f50] px-5 py-4 text-white shadow-xl sm:-right-8">
              <p className="text-xs uppercase tracking-[0.16em] text-white/65">Next up</p>
              <p className="mt-1 font-semibold">Build 3 great options ✦</p>
            </div>
          </div>
        </div>
      </section>

      <div className="px-5 sm:px-8"><ReturningTraveler /></div>

      <section className="px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center"><p className="eyebrow">Different Travelers, One Shared Plan</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">See The Common Ground Clearly.</h2></div>
          <div className="mx-auto mt-9 max-w-4xl space-y-4">
            {exampleTravelers.map((traveler) => <article className="ticket-card p-5 sm:p-6" key={traveler.name}>
              <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#edf5f2] text-2xl" aria-hidden="true">{traveler.icon}</span>
                <div className="min-w-0 flex-1"><h3 className="text-lg font-bold">{traveler.name}</h3><div className="mt-2 flex flex-wrap gap-1.5">{traveler.interests.map((interest) => <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${interestColors[interest]}`} key={interest}>{interest}</span>)}</div>
                  <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#53666f]"><li><b>{traveler.budget}</b> budget</li><li>Available {traveler.available}</li>{traveler.hotel ? <li>Hotel preference: {traveler.hotel}</li> : null}</ul>
                  <p className="mt-3 border-t border-dashed border-[#173f50]/15 pt-3 text-sm leading-6 text-[#173f50]"><span className="font-bold">Request:</span> &ldquo;{traveler.request}&rdquo;</p>
                </div>
              </div>
            </article>)}
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 text-center text-sm font-bold text-[#53666f] sm:flex-row sm:gap-4"><span>Different people</span><span className="text-[#e4664f]" aria-hidden="true">→</span><span>Different schedules &amp; preferences</span><span className="text-[#e4664f]" aria-hidden="true">→</span><span className="rounded-full bg-[#daf0ea] px-4 py-2 text-[#276655]">One trip everyone can enjoy</span></div>
        </div>
      </section>

      <section className="bg-[#173f50] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow text-[#f3c969]">One Group, Many Opinions</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Planning Gets Messy Before The Trip Even Starts.</h2>
            <p className="mt-4 max-w-lg leading-7 text-white/70">Stop stitching together polls, spreadsheets, and hundreds of messages. Put every traveler’s constraints in one place.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="space-y-3">
              {groupNeeds.map((need) => (
                <div className={`${need.color} rounded-2xl p-4 text-[#172733]`} key={need.label}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-60"><span aria-hidden="true" className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 text-base">{need.icon}</span>{need.label}</p>
                  <p className="mt-1 font-semibold">{need.detail}</p>
                </div>
              ))}
            </div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl"><span aria-hidden="true">→</span></div>
            <div className="rounded-[1.75rem] bg-white p-6 text-[#172733]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3c969] text-lg" aria-hidden="true">✦</span>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#e4664f]">Group Consensus</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">One Trip Everyone Helped Shape.</p>
              <p className="mt-3 text-sm leading-6 text-[#66757d]">Clear options, a focused vote, and one itinerary for the group.</p>
            </div>
          </div>
        </div>
      </section>

      <PlanningStory />

      <section className="border-t border-[#172733]/10 bg-white px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl"><p className="eyebrow">Quick Answers</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Frequently Asked Questions</h2><div className="mt-7 divide-y divide-[#172733]/10 rounded-3xl border border-[#172733]/10 px-5 sm:px-7">
          <details className="py-5"><summary className="cursor-pointer font-bold">What does this planner do?</summary><p className="mt-3 leading-7 text-[#66757d]">It gathers each traveler&apos;s timing, budget, interests, and lodging preferences so the group can compare practical trip options.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-bold">Does everyone need an account?</summary><p className="mt-3 leading-7 text-[#66757d]">No. For the current hackathon experience, travelers join from a shared link and this browser remembers their traveler identity.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-bold">How does the group choose a trip?</summary><p className="mt-3 leading-7 text-[#66757d]">Travelers share preferences and availability, compare generated options, decide together, and create one shared itinerary.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-bold">Does it book trips automatically?</summary><p className="mt-3 leading-7 text-[#66757d]">No. This demo does not make payments, reservations, or real bookings.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-bold">Can I connect my calendar?</summary><p className="mt-3 leading-7 text-[#66757d]">Manual availability is supported now. Calendar connection is a future stretch capability.</p></details>
        </div></div>
      </section>

      <footer className="border-t border-[#172733]/10 px-5 py-7 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm text-[#69777d] sm:flex-row sm:items-center sm:justify-between">
          <p>HackTX Trip Planner</p>
          <p>Plan together. Travel happier.</p>
        </div>
      </footer>
    </main>
  );
}
