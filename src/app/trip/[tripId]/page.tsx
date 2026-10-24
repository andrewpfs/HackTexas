import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/header";
import { getTripById } from "@/lib/trip-repository";

export const instant = false;

const progressSteps = ["Preferences", "AI Suggestions", "Vote", "Final Itinerary"];

function formatDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export async function generateMetadata(props: PageProps<"/trip/[tripId]">): Promise<Metadata> {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return { title: "Trip not found" };
  }

  return { title: trip.destination ? `${trip.destination} Trip` : "Group Trip" };
}

export default async function TripPage(props: PageProps<"/trip/[tripId]">) {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    notFound();
  }

  const displayName = trip.destination ? `${trip.destination} Trip` : "Group Trip";
  const travelWindow = `${formatDate(trip.earliestPossibleDate)} – ${formatDate(trip.latestPossibleDate)}`;
  const travelerCount = trip.expectedTravelerCount
    ? `${trip.travelers.length} of ${trip.expectedTravelerCount} expected`
    : `${trip.travelers.length} joined`;
  const joinPath = `/join?trip=${trip.inviteCode}`;

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
                <span className="text-sm text-white/60">Invite code {trip.inviteCode}</span>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{displayName}</h1>
              <p className="mt-3 max-w-2xl text-lg leading-7 text-white/70">{trip.prompt}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-9 gap-y-4 text-sm lg:text-right">
              <div><dt className="text-white/50">Host</dt><dd className="mt-1 font-bold">{trip.hostName}</dd></div>
              <div><dt className="text-white/50">From</dt><dd className="mt-1 font-bold">{trip.origin}</dd></div>
              <div><dt className="text-white/50">Travel window</dt><dd className="mt-1 font-bold">{travelWindow}</dd></div>
              <div><dt className="text-white/50">Destination</dt><dd className="mt-1 font-bold">{trip.destination || "Not chosen yet"}</dd></div>
              <div><dt className="text-white/50">Preferred duration</dt><dd className="mt-1 font-bold">{trip.preferredDurationDays ? `${trip.preferredDurationDays} days` : "Not specified"}</dd></div>
              <div><dt className="text-white/50">Travelers</dt><dd className="mt-1 font-bold">{travelerCount}</dd></div>
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
              <div className="flex items-center justify-between gap-4">
                <div><p className="eyebrow">The crew</p><h2 className="mt-2 text-2xl font-bold tracking-tight" id="group-progress">Group progress</h2></div>
                <p className="text-sm font-bold text-[#52766c]">{trip.travelers.length} joined</p>
              </div>
              <ul className="mt-6 divide-y divide-[#172733]/8">
                {trip.travelers.map((traveler) => (
                  <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={traveler.id}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173f50] text-sm font-bold text-white">{traveler.name.charAt(0).toUpperCase()}</span>
                    <span className="font-semibold">{traveler.name}{traveler.isHost ? " (Host)" : ""}</span>
                    <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${traveler.preferencesComplete ? "bg-[#daf0ea] text-[#276655]" : "bg-[#f0efeb] text-[#778388]"}`}>
                      {traveler.preferencesComplete ? "Completed" : "Preferences incomplete"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-2xl bg-[#f7f7f3] p-4 text-sm leading-6 text-[#718087]">Additional travelers have not joined yet. Joining and questionnaires are coming in the next phases.</p>
            </section>

            <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="availability">
              <p className="eyebrow">Possible dates</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight" id="availability">Availability overlap</h2>
              <p className="mt-5 rounded-2xl bg-[#f7f7f3] p-5 text-sm leading-6 text-[#718087]">Availability will appear after travelers complete their preferences.</p>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="trip-details">
              <p className="eyebrow">Trip details</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight" id="trip-details">What the host shared</h2>
              <dl className="mt-6 space-y-4 text-sm">
                <div><dt className="font-bold text-[#3b505a]">Destination</dt><dd className="mt-1 text-[#718087]">{trip.destination || "Destination not chosen yet"}</dd></div>
                <div><dt className="font-bold text-[#3b505a]">Possible travel window</dt><dd className="mt-1 text-[#718087]">{travelWindow}</dd></div>
                <div><dt className="font-bold text-[#3b505a]">Planning status</dt><dd className="mt-1 text-[#718087]">Collecting traveler preferences</dd></div>
              </dl>
            </section>

            <section className="overflow-hidden rounded-3xl border border-[#172733]/8 bg-white" aria-labelledby="invite-group">
              <div className="p-6 sm:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fbe4d9] text-[#e4664f]" aria-hidden="true">↗</div>
                <h2 className="mt-5 text-2xl font-bold tracking-tight" id="invite-group">Invite your group</h2>
                <p className="mt-2 text-sm leading-6 text-[#718087]">Share this code or join link with the rest of your travelers.</p>
                <div className="mt-5 rounded-2xl border border-dashed border-[#173f50]/30 bg-[#f7f7f3] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#889398]">Invite code</p>
                  <p className="mt-2 font-mono text-2xl font-bold tracking-[0.18em] text-[#173f50]">{trip.inviteCode}</p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#889398]">Join link</p>
                  <Link className="mt-2 block break-all font-mono text-sm font-bold text-[#173f50] underline decoration-[#e4664f]/40 underline-offset-4" href={joinPath}>{joinPath}</Link>
                </div>
                <p className="mt-3 text-xs text-[#8a9498]">The join page is still a shell; real joining arrives in Phase 3.</p>
              </div>
              <div className="border-t border-[#172733]/8 bg-[#173f50] p-6 text-white sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#f3c969]">Coming after preferences</p>
                <p className="mt-2 text-lg font-bold">Three options → one group vote → one shared itinerary</p>
                <p className="mt-2 text-sm leading-6 text-white/65">Suggestions, voting, and itinerary generation are intentionally deferred.</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
