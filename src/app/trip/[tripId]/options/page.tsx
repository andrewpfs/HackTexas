import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/header";
import { formatCalendarDate } from "@/lib/date-utils";
import { validateCandidateOptions } from "@/lib/candidate-validation";
import { getTripById } from "@/lib/trip-repository";
import type { PlannerSource } from "@/lib/trip-types";
import { getVotingSummary } from "@/lib/voting";
import { CandidateVoting } from "./candidate-voting";
import { OptionPhotosLoader } from "./option-photos-loader";
import { LiveRefresh } from "../live-refresh";
import { ProgressNav } from "../progress-nav";

export const instant = false;

const plannerLabels: Record<PlannerSource, string> = {
  muse: "Planned by Muse Spark",
  mock: "Demo planner",
  "mock-fallback": "Demo planner (Muse was unavailable)",
};

export async function generateMetadata(
  props: PageProps<"/trip/[tripId]/options">,
): Promise<Metadata> {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return { title: "Trip not found" };
  }

  return { title: `Trip Options | ${trip.name || trip.destination || "Group Trip"}` };
}

export default async function TripOptionsPage(
  props: PageProps<"/trip/[tripId]/options">,
) {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    notFound();
  }

  const candidates = trip.candidateOptions || [];
  const candidateValidation = validateCandidateOptions(candidates);

  if (!candidateValidation.valid) {
    return (
      <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
        <Header />
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
          <div className="rounded-[2rem] border border-[#172733]/8 bg-white p-8 shadow-[0_18px_45px_rgba(23,63,80,0.08)] sm:p-12">
            <p className="eyebrow">Trip options</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">No options have been generated yet</h1>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-[#718087]">
              Once every traveler completes preferences and availability, return to the trip dashboard to generate three shared options.
            </p>
            <Link className="button-primary mt-7" href={`/trip/${trip.id}`}>
              Return to Trip Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const votingSummary = getVotingSummary(trip);
  const votesByTraveler = new Map((trip.votes || []).map((vote) => [vote.travelerId, vote]));
  const plannerLabel = plannerLabels[trip.candidatesSource || "mock"];

  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <LiveRefresh tripId={trip.id} />
      <div className="mx-auto max-w-[1500px] px-5 py-9 sm:px-8 lg:px-10 lg:py-12">
        <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href={`/trip/${trip.id}`}>
          ← Back to trip dashboard
        </Link>

        <div className="mt-5 rounded-3xl border border-[#172733]/8 bg-white px-6 py-4">
          <ProgressNav currentStep={trip.itinerary ? 3 : votingSummary.votedCount > 0 ? 2 : 1} itineraryReady={Boolean(trip.itinerary)} optionsReady tripId={trip.id} />
        </div>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#173f50] p-7 text-white shadow-[0_20px_50px_rgba(23,63,80,0.14)] sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#f3c969] px-3 py-1 text-xs font-bold text-[#173f50]">3 options ready</span>
                <span className="text-sm text-white/60">{plannerLabel}</span>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{trip.name || (trip.destination ? `${trip.destination} Trip` : "Group Trip")}</h1>
              <p className="mt-2 text-xl font-semibold text-[#f3c969]">Compare your group&apos;s trip options</p>
              <p className="mt-4 text-lg leading-7 text-white/70">
                Each concept uses the same shared dates and group preferences, with a different pace and focus.
              </p>
            </div>
            <p className="max-w-md rounded-2xl bg-white/8 p-4 text-sm leading-6 text-white/70">
              These are conceptual plans without live flight, hotel, availability, or pricing data.
            </p>
          </div>
        </section>

        <OptionPhotosLoader done={trip.optionPhotosStatus === "added"} tripId={trip.id} />

        <CandidateVoting
          itineraryReady={Boolean(trip.itinerary)}
          options={candidates.map((candidate, index) => ({
            id: candidate.id,
            title: candidate.title,
            destination: candidate.destination,
            optionNumber: index + 1,
          }))}
          travelers={trip.travelers.map((traveler) => {
            const vote = votesByTraveler.get(traveler.id);
            const voteIsCurrent = vote && candidates.some((candidate) => candidate.id === vote.candidateId);
            return {
              id: traveler.id,
              name: traveler.name,
              isHost: traveler.isHost,
              votedCandidateId: voteIsCurrent ? vote.candidateId : null,
              feedback: voteIsCurrent ? vote.feedback || "" : "",
            };
          })}
          tripId={trip.id}
        />

        <section className="mt-7 grid items-start gap-6 xl:grid-cols-3" aria-label="Candidate trip options">
          {candidates.map((candidate, candidateIndex) => {
            const tally = votingSummary.tallies[candidateIndex];
            const leading = votingSummary.leadingCandidateIds.includes(candidate.id);
            return (
            <article className="overflow-hidden rounded-3xl border border-[#172733]/8 bg-white shadow-[0_14px_38px_rgba(23,63,80,0.07)]" key={candidate.id}>
              <div className="relative isolate overflow-hidden bg-[#173f50] p-6 sm:p-7">
                {candidate.imageUrl ? (
                  <Image alt="" className="-z-20 object-cover" fill sizes="(min-width: 1280px) 33vw, 100vw" src={candidate.imageUrl} unoptimized />
                ) : null}
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b2230]/90 via-[#0b2230]/55 to-[#0b2230]/30" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f3c969]">Option {candidateIndex + 1}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${leading ? "bg-[#173f50] text-white" : "bg-white text-[#607179]"}`}>
                    {tally.voteCount} {tally.voteCount === 1 ? "vote" : "votes"}{leading ? " · Leading" : ""}
                  </span>
                </div>
                <h2 className="mt-16 text-2xl font-bold tracking-tight text-white drop-shadow">{candidate.title}</h2>
                <p className="mt-2 text-lg font-semibold text-white/85">{candidate.destination}{candidate.heroPlace ? ` · ${candidate.heroPlace}` : ""}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#879196]">Dates</p>
                    <p className="mt-1 font-bold text-[#173f50]">
                      {formatCalendarDate(candidate.suggestedStartDate, false)} – {formatCalendarDate(candidate.suggestedEndDate)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#879196]">Duration</p>
                    <p className="mt-1 font-bold text-[#173f50]">{candidate.estimatedDurationDays} days</p>
                  </div>
                </div>
              </div>

              <div className="space-y-7 p-6 sm:p-7">
                <div>
                  <p className="text-base leading-7 text-[#53666f]">{candidate.summary}</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#173f50]">Why it fits the group</h3>
                  <p className="mt-2 text-sm leading-6 text-[#718087]">{candidate.rationale}</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#173f50]">Highlights</h3>
                  <ul className="mt-3 space-y-2">
                    {candidate.highlights.map((highlight) => (
                      <li className="flex gap-2 text-sm leading-6 text-[#53666f]" key={highlight}>
                        <span className="text-[#e4664f]" aria-hidden="true">●</span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl bg-[#fff8dc] p-4">
                  <h3 className="text-sm font-bold text-[#6f5a16]">Tradeoffs to consider</h3>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-[#796823]">
                    {candidate.considerations.map((consideration) => (
                      <li key={consideration}>{consideration}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#173f50]">Day by day</h3>
                  <p className="mt-1 text-xs text-[#879196]">Tap a day to see what is planned.</p>
                  <div className="mt-3 space-y-2">
                    {candidate.days.map((day) => {
                      const dayPhoto = day.activities.find((activity) => activity.imageUrl)?.imageUrl ?? candidate.imageUrl;
                      return (
                        <details className="group overflow-hidden rounded-2xl border border-[#172733]/10 bg-white" key={`${candidate.id}-${day.dayNumber}`}>
                          <summary className="relative isolate flex min-h-24 cursor-pointer list-none items-end justify-between gap-3 bg-[#173f50] p-4 text-white">
                            {dayPhoto ? <Image alt="" className="-z-20 object-cover" fill sizes="(min-width: 1280px) 30vw, 100vw" src={dayPhoto} unoptimized /> : null}
                            <span className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b2230]/90 via-[#0b2230]/50 to-[#0b2230]/20" />
                            <span>
                              <span className="block text-xs font-bold uppercase tracking-wide text-[#f3c969]">
                                Day {day.dayNumber} · {formatCalendarDate(day.date, false)}
                              </span>
                              <span className="mt-1 block text-lg font-bold leading-tight drop-shadow">{day.title}</span>
                              <span className="mt-0.5 block text-xs text-white/75">{day.activities.length} stops</span>
                            </span>
                            <span className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition group-open:rotate-180" aria-hidden="true">⌄</span>
                          </summary>
                          <ul className="divide-y divide-[#172733]/8">
                            {day.activities.map((activity) => (
                              <li className="flex gap-4 p-4" key={`${activity.timeOfDay}-${activity.title}`}>
                                {activity.imageUrl ? (
                                  <Image alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" height={80} src={activity.imageUrl} unoptimized width={80} />
                                ) : trip.optionPhotosStatus !== "added" && activity.placeName ? (
                                  <span aria-hidden="true" className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-[#e8e6df]" />
                                ) : (
                                  <span className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl text-xs font-extrabold uppercase tracking-wide ${activity.timeOfDay === "Morning" ? "bg-[#fff1c7] text-[#8a6410]" : activity.timeOfDay === "Afternoon" ? "bg-[#fbe4d9] text-[#a34532]" : "bg-[#e7e2f5] text-[#4b3d8a]"}`}>
                                    <svg aria-hidden="true" className="mb-1 h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                                      {activity.timeOfDay === "Evening" ? <path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
                                    </svg>
                                    {activity.timeOfDay}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-bold uppercase tracking-wide text-[#e4664f]">{activity.timeOfDay}</p>
                                  <p className="mt-0.5 font-bold leading-snug text-[#173f50]">{activity.title}</p>
                                  <p className="mt-1 text-sm leading-6 text-[#718087]">{activity.description}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </details>
                      );
                    })}
                  </div>
                </div>

                {tally.voterNames.length > 0 ? (
                  <p className="rounded-2xl bg-[#f7f7f3] p-4 text-sm font-semibold text-[#53666f]">
                    Voted by {tally.voterNames.join(", ")}
                  </p>
                ) : null}
              </div>
            </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
