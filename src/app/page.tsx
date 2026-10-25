import Link from "next/link";
import { Header } from "./components/header";

const planningSteps = [
  ["01", "Start a trip", "Share the rough idea, timing, and starting point."],
  ["02", "Invite your group", "Send one link. No accounts or passwords needed."],
  ["03", "Share preferences", "Everyone adds dates, budget, and must-do activities."],
  ["04", "Find common ground", "AI turns the group’s constraints into clear options."],
  ["05", "Vote and refine", "Compare the best fits and make one focused revision."],
  ["06", "Travel together", "Keep one shared itinerary everyone can follow."],
];

const groupNeeds = [
  { label: "Schedules", detail: "Dec 15–23", color: "bg-[#daf0ea]" },
  { label: "Budgets", detail: "$1.5k–$2.4k", color: "bg-[#fbe4d9]" },
  { label: "Interests", detail: "Food, art, nightlife", color: "bg-[#e7e2f5]" },
];

const exampleTravelers = [
  { name: "Ryan", icon: "🍜", interests: "Food · Museums", budget: "$1,200 USD" },
  { name: "Tin", icon: "🛍️", interests: "Shopping · Nightlife", budget: "$1,500 USD" },
  { name: "Jordan", icon: "🥾", interests: "Outdoors · Sightseeing", budget: "$1,000 USD" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f6f1] text-[#172733]">
      <Header />

      <section className="relative border-b border-[#172733]/10">
        <div className="decorative-grid absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-28">
          <div className="max-w-3xl">
            <p className="eyebrow">Built for the whole group</p>
            <h1 className="mt-6 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#102a38] sm:text-6xl lg:text-7xl">
              Less group chat.
              <span className="block font-serif font-normal italic text-[#e4664f]">
                More common ground.
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#53636c] sm:text-xl">
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
            <p className="mt-5 text-sm text-[#738087]">No accounts needed for the demo · Everyone gets a say</p>
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
                      <div className={`mx-auto h-12 w-full rounded-md ${value === 4 ? "bg-[#e4664f]" : value === 3 ? "bg-[#f1a690]" : "bg-[#e8eceb]"}`} />
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

      <section className="px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center"><p className="eyebrow">Different travelers, one shared plan</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">See the common ground clearly.</h2></div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {exampleTravelers.map((traveler) => <article className="ticket-card p-5" key={traveler.name}><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#edf5f2] text-xl" aria-hidden="true">{traveler.icon}</span><div><h3 className="font-bold">{traveler.name}</h3><p className="text-sm text-[#66757d]">{traveler.interests}</p></div></div><p className="mt-4 border-t border-dashed border-[#173f50]/20 pt-3 text-sm font-bold text-[#173f50]">Budget: {traveler.budget}</p></article>)}
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 text-center text-sm font-bold text-[#53666f] sm:flex-row sm:gap-4"><span>Different people</span><span className="text-[#e4664f]" aria-hidden="true">→</span><span>Different schedules &amp; preferences</span><span className="text-[#e4664f]" aria-hidden="true">→</span><span className="rounded-full bg-[#daf0ea] px-4 py-2 text-[#276655]">One trip everyone can enjoy</span></div>
        </div>
      </section>

      <section className="bg-[#173f50] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow text-[#f3c969]">One group, many opinions</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Planning gets messy before the trip even starts.</h2>
            <p className="mt-4 max-w-lg leading-7 text-white/70">Stop stitching together polls, spreadsheets, and hundreds of messages. Put every traveler’s constraints in one place.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="space-y-3">
              {groupNeeds.map((need) => (
                <div className={`${need.color} rounded-2xl p-4 text-[#172733]`} key={need.label}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-60">{need.label}</p>
                  <p className="mt-1 font-semibold">{need.detail}</p>
                </div>
              ))}
            </div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl"><span aria-hidden="true">→</span></div>
            <div className="rounded-[1.75rem] bg-white p-6 text-[#172733]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3c969] text-lg" aria-hidden="true">✦</span>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#e4664f]">Shared plan</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">One trip everyone helped shape.</p>
              <p className="mt-3 text-sm leading-6 text-[#66757d]">Clear options, a focused vote, and one itinerary for the group.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="eyebrow">From idea to takeoff</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#102a38] sm:text-5xl">A clear path through the chaos.</h2>
          </div>
          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {planningSteps.map((step) => (
              <li className="border-t border-[#172733]/20 pt-5" key={step[0]}>
                <div className="flex items-start gap-4">
                  <span className="font-mono text-xs font-bold text-[#e4664f]">{step[0]}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{step[1]}</h3>
                    <p className="mt-2 leading-6 text-[#66757d]">{step[2]}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-[#f2c968] p-7 sm:flex-row sm:items-center sm:p-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#173f50]/65">Your group chat will thank you</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#102a38]">Ready to get everyone on the same page?</h2>
            </div>
            <Link className="button-dark shrink-0" href="/create">Start planning <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="border-t border-[#172733]/10 bg-white px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl"><p className="eyebrow">Quick answers</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Frequently Asked Questions</h2><div className="mt-7 divide-y divide-[#172733]/10 rounded-3xl border border-[#172733]/10 px-5 sm:px-7">
          <details className="py-5"><summary className="cursor-pointer font-bold">What does this planner do?</summary><p className="mt-3 leading-7 text-[#66757d]">It gathers each traveler&apos;s timing, budget, interests, and lodging preferences so the group can compare practical trip options.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-bold">Does everyone need an account?</summary><p className="mt-3 leading-7 text-[#66757d]">No. For the current hackathon experience, travelers join from a shared link and this browser remembers their traveler identity.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-bold">How does the group choose a trip?</summary><p className="mt-3 leading-7 text-[#66757d]">Travelers share preferences and availability, compare generated options, decide together, and will eventually create one shared itinerary.</p></details>
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
