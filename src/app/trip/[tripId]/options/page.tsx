import { CandidateDays } from "./candidate-days";
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
            <p className="eyebrow">Trip Options</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">No Options Have Been Generated Yet</h1>
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
          <ProgressNav currentStep={trip.itinerary ? 2 : 1} itineraryReady={Boolean(trip.itinerary)} optionsReady tripId={trip.id} />
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
                  <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#173f50]">Why It Fits The Group</h3>
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
                  <h3 className="text-sm font-bold text-[#6f5a16]">Tradeoffs To Consider</h3>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-[#796823]">
                    {candidate.considerations.map((consideration) => (
                      <li key={consideration}>{consideration}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#173f50]">Day By Day</h3>
                  <p className="mt-1 text-xs text-[#879196]">Tap a day to see what is planned.</p>
                  <CandidateDays days={candidate.days} imageUrl={candidate.imageUrl} title={candidate.title} />
                </div>
                {tally.voterNames.length > 0 ? <p className="rounded-2xl bg-[#f7f7f3] p-4 text-sm font-semibold text-[#53666f]">Voted by {tally.voterNames.join(", ")}</p> : null}
              </div>
            </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
