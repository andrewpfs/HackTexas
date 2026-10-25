import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/header";
import { formatCalendarDate } from "@/lib/date-utils";
import { validateCandidateOptions } from "@/lib/candidate-validation";
import { getTripById } from "@/lib/trip-repository";

export const instant = false;

export async function generateMetadata(
  props: PageProps<"/trip/[tripId]/options">,
): Promise<Metadata> {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return { title: "Trip not found" };
  }

  return { title: `Trip Options | ${trip.destination || "Group Trip"}` };
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

  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <div className="mx-auto max-w-[1500px] px-5 py-9 sm:px-8 lg:px-10 lg:py-12">
        <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href={`/trip/${trip.id}`}>
          ← Back to trip dashboard
        </Link>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#173f50] p-7 text-white shadow-[0_20px_50px_rgba(23,63,80,0.14)] sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#f3c969] px-3 py-1 text-xs font-bold text-[#173f50]">3 options ready</span>
                <span className="text-sm text-white/60">Demo planner</span>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Compare your group&apos;s trip options</h1>
              <p className="mt-4 text-lg leading-7 text-white/70">
                Each concept uses the same shared dates and group preferences, with a different pace and focus.
              </p>
            </div>
            <p className="max-w-md rounded-2xl bg-white/8 p-4 text-sm leading-6 text-white/70">
              These are conceptual plans without live flight, hotel, availability, or pricing data.
            </p>
          </div>
        </section>

        <section className="mt-7 grid items-start gap-6 xl:grid-cols-3" aria-label="Candidate trip options">
          {candidates.map((candidate, candidateIndex) => (
            <article className="overflow-hidden rounded-3xl border border-[#172733]/8 bg-white shadow-[0_14px_38px_rgba(23,63,80,0.07)]" key={candidate.id}>
              <div className="border-b border-[#172733]/8 bg-[#fffaf1] p-6 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e4664f]">Option {candidateIndex + 1}</p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#173f50]">{candidate.title}</h2>
                <p className="mt-2 text-lg font-semibold text-[#52766c]">{candidate.destination}</p>
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
                  <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#173f50]">Sample itinerary</h3>
                  <div className="mt-4 space-y-5">
                    {candidate.days.map((day) => (
                      <div className="border-l-2 border-[#f0c664] pl-4" key={`${candidate.id}-${day.dayNumber}`}>
                        <p className="text-xs font-bold uppercase tracking-wide text-[#e4664f]">
                          Day {day.dayNumber} · {formatCalendarDate(day.date, false)}
                        </p>
                        <p className="mt-1 font-bold text-[#173f50]">{day.title}</p>
                        <ul className="mt-2 space-y-2">
                          {day.activities.map((activity) => (
                            <li className="text-sm leading-5 text-[#718087]" key={`${activity.timeOfDay}-${activity.title}`}>
                              <span className="font-bold text-[#53666f]">{activity.timeOfDay}:</span> {activity.title} — {activity.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="button-secondary w-full cursor-not-allowed opacity-60" disabled type="button">
                  Voting comes next
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
