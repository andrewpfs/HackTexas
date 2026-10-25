import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "../../components/header";

export const metadata: Metadata = {
  title: "Japan Winter Trip",
};

const travelers = [
  { name: "Jay", origin: "Austin", initial: "J", complete: true, color: "bg-[#173f50]" },
  { name: "Henry", origin: "Houston", initial: "H", complete: true, color: "bg-[#476f80]" },
  { name: "Andrew", origin: "Dallas", initial: "A", complete: false, color: "bg-[#e79b68]" },
  { name: "Maya", origin: "San Antonio", initial: "M", complete: false, color: "bg-[#aa7f9c]" },
];

const interests = [
  { name: "Food", count: 4, color: "bg-[#fbe4d9] text-[#8f4d3c]" },
  { name: "Sightseeing", count: 4, color: "bg-[#daf0ea] text-[#276655]" },
  { name: "Nightlife", count: 3, color: "bg-[#e7e2f5] text-[#5f537e]" },
  { name: "Shopping", count: 2, color: "bg-[#f8edc9] text-[#76601f]" },
  { name: "Museums", count: 2, color: "bg-[#dcebf2] text-[#3a6476]" },
];

const progressSteps = ["Get Ready", "Compare Options", "Decide Together", "Shared Itinerary"];

export default function DemoTripPage() {
  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 lg:px-10 lg:py-12">
        <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href="/">← All trips</Link>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#173f50] text-white shadow-[0_20px_50px_rgba(23,63,80,0.14)]">
          <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end lg:p-11">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#f3c969] px-3 py-1 text-xs font-bold text-[#173f50]">Collecting preferences</span>
                <span className="text-sm text-white/60">Trip #TOKYO-24</span>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Japan Winter Trip</h1>
              <p className="mt-3 max-w-2xl text-lg leading-7 text-white/70">Food, city lights, and unforgettable winter days in Tokyo—planned around the whole group.</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-9 gap-y-4 text-sm lg:text-right">
              <div><dt className="text-white/50">Route</dt><dd className="mt-1 font-bold">4 cities → Tokyo</dd></div>
              <div><dt className="text-white/50">Travel window</dt><dd className="mt-1 font-bold">Dec 15–23</dd></div>
              <div><dt className="text-white/50">Travelers</dt><dd className="mt-1 font-bold">4 people</dd></div>
              <div><dt className="text-white/50">Destination</dt><dd className="mt-1 font-bold">Tokyo, Japan</dd></div>
            </dl>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="planning-progress">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="eyebrow">Planning progress</p><h2 className="mt-2 text-xl font-bold" id="planning-progress">First, hear from everyone.</h2></div>
            <p className="text-sm text-[#738087]">Step 1 of 4</p>
          </div>
          <ol className="mt-7 grid grid-cols-4 gap-2">
            {progressSteps.map((step, index) => (
              <li key={step}>
                <div className={`h-1.5 rounded-full ${index === 0 ? "bg-[#e4664f]" : "bg-[#dfe3e1]"}`} />
                <p className={`mt-2 text-xs font-bold sm:text-sm ${index === 0 ? "text-[#e4664f]" : "text-[#8a9599]"}`}>{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="group-progress">
              <div className="flex items-center justify-between">
                <div><p className="eyebrow">The crew</p><h2 className="mt-2 text-2xl font-bold tracking-tight" id="group-progress">Group progress</h2></div>
                <p className="text-sm font-bold text-[#52766c]">2 of 4 ready</p>
              </div>
              <ul className="mt-6 divide-y divide-[#172733]/8">
                {travelers.map((traveler) => (
                  <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={traveler.name}>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${traveler.color}`}>{traveler.initial}</span>
                    <span className="font-semibold">{traveler.name}<span className="block text-xs font-normal text-[#718087]">From {traveler.origin}</span></span>
                    <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${traveler.complete ? "bg-[#daf0ea] text-[#276655]" : "bg-[#f0efeb] text-[#778388]"}`}>
                      {traveler.complete ? "✓ Completed" : "Waiting"}
                    </span>
                  </li>
                ))}
              </ul>
              <button className="button-primary mt-7 w-full" type="button">Complete My Preferences <span aria-hidden="true">→</span></button>
              <p className="mt-3 text-center text-xs text-[#8a9498]">Add your route, budget, activities, lodging, and notes.</p>
            </section>

            <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="availability">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="eyebrow">Possible dates</p><h2 className="mt-2 text-2xl font-bold tracking-tight" id="availability">Availability overlap</h2></div>
                <div className="flex items-center gap-4 text-xs text-[#758288]">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#e8eceb]" /> Some</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#e4664f]" /> Everyone</span>
                </div>
              </div>
              <details className="mt-5 rounded-2xl bg-[#f7f7f3] p-4"><summary className="cursor-pointer font-bold text-[#173f50]">Traveler availability details</summary><ul className="mt-3 space-y-1 text-sm text-[#66757d]"><li>Jay · Dec 15–20</li><li>Henry · Dec 18–23</li><li>Andrew · Dec 19–21</li><li>Maya · Dec 19–20</li></ul></details>
              <div className="mt-7 grid grid-cols-9 gap-1.5 sm:gap-2">
                {[1, 2, 2, 3, 4, 4, 3, 2, 1].map((value, index) => (
                  <div className="text-center" key={index}>
                    <p className="mb-2 text-[10px] font-bold text-[#849095] sm:text-xs">DEC</p>
                    <div className={`flex h-12 items-center justify-center rounded-lg text-xs font-bold sm:h-14 sm:text-sm ${value === 4 ? "bg-[#e4664f] text-white" : value === 3 ? "bg-[#f3b5a4] text-[#704338]" : value === 2 ? "bg-[#dfe9e7] text-[#536b67]" : "bg-[#eef0ee] text-[#8a9599]"}`}>{15 + index}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#f8f0d4] p-4 text-sm text-[#695721]">
                <span aria-hidden="true">✦</span><p><strong>Dec 19–20</strong> currently has the strongest overlap.</p>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="interests">
              <p className="eyebrow">What the group likes</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight" id="interests">Shared interests</h2>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {interests.map((interest) => (
                  <div className={`rounded-full px-4 py-2 text-sm font-bold ${interest.color}`} key={interest.name}>
                    {interest.name} <span className="ml-1 opacity-60">{interest.count}/4</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm leading-6 text-[#718087]">These will help shape the three candidate trip options once everyone responds.</p>
            </section>

            <section className="overflow-hidden rounded-3xl border border-[#172733]/8 bg-white" aria-labelledby="invite-group">
              <div className="p-6 sm:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fbe4d9] text-[#e4664f]" aria-hidden="true">↗</div>
                <h2 className="mt-5 text-2xl font-bold tracking-tight" id="invite-group">Invite your group</h2>
                <p className="mt-2 text-sm leading-6 text-[#718087]">Send this demo link to anyone who still needs to add their preferences.</p>
                <div className="mt-5 rounded-2xl border border-dashed border-[#173f50]/30 bg-[#f7f7f3] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#889398]">Invite link</p>
                  <p className="mt-2 break-all font-mono text-sm font-bold text-[#173f50]">trip.local/join/TOKYO-24</p>
                </div>
                <button className="button-secondary mt-4 w-full" type="button">Copy invite link</button>
                <p className="mt-2 text-center text-xs text-[#8a9498]">Copy behavior is visual only for now.</p>
              </div>
              <div className="border-t border-[#172733]/8 bg-[#173f50] p-6 text-white sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#f3c969]">Coming after preferences</p>
                <p className="mt-2 text-lg font-bold">Get Ready → Compare Options → Decide Together → Shared Itinerary</p>
                <p className="mt-2 text-sm leading-6 text-white/65">Later, the group can adjust the shared plan while each traveler keeps room for personal alternatives.</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
