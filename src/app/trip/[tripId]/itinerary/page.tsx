import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/header";
import { formatCalendarDate } from "@/lib/date-utils";
import { getTripById } from "@/lib/trip-repository";
import type { PlannerSource } from "@/lib/trip-types";
import { getSerpApiKey } from "@/lib/serpapi-places";
import { ProgressNav } from "../progress-nav";
import { ItineraryWorkspace } from "./itinerary-workspace";

export const instant = false;

const plannerLabels: Record<PlannerSource, string> = {
  muse: "Built by Muse Spark from your group's votes",
  mock: "Built by the demo planner",
  "mock-fallback": "Built by the demo planner (Muse was unavailable)",
};

export async function generateMetadata(
  props: PageProps<"/trip/[tripId]/itinerary">,
): Promise<Metadata> {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return { title: "Trip not found" };
  }

  return { title: `Shared Itinerary | ${trip.name || trip.destination || "Group Trip"}` };
}

export default async function ItineraryPage(props: PageProps<"/trip/[tripId]/itinerary">) {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    notFound();
  }

  const itinerary = trip.itinerary;

  if (!itinerary) {
    return (
      <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
        <Header />
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
          <div className="rounded-[2rem] border border-[#172733]/8 bg-white p-8 shadow-[0_18px_45px_rgba(23,63,80,0.08)] sm:p-12">
            <p className="eyebrow">Shared itinerary</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">No shared itinerary yet</h1>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-[#718087]">
              After everyone votes on the trip options, the host can create one shared plan for the group.
            </p>
            <Link className="button-primary mt-7" href={`/trip/${trip.id}/options`}>
              Go to Trip Options
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const baseIndex = (trip.candidateOptions || []).findIndex(
    (candidate) => candidate.id === itinerary.basedOnCandidateId,
  );

  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 lg:py-12">
        <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href={`/trip/${trip.id}`}>
          ← Back to trip dashboard
        </Link>

        <div className="mt-5 rounded-3xl border border-[#172733]/8 bg-white px-6 py-4">
          <ProgressNav currentStep={3} itineraryReady optionsReady tripId={trip.id} />
        </div>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#173f50] text-white shadow-[0_20px_50px_rgba(23,63,80,0.14)]">
          <div className="p-7 sm:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#f3c969] px-3 py-1 text-xs font-bold text-[#173f50]">Shared itinerary</span>
              <span className="text-sm text-white/60">{plannerLabels[itinerary.source]}</span>
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{itinerary.title}</h1>
            <p className="mt-2 text-xl font-semibold text-[#f3c969]">{itinerary.destination}</p>
            <p className="mt-4 max-w-3xl text-lg leading-7 text-white/70">{itinerary.summary}</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-dashed border-white/20 p-7 text-sm sm:grid-cols-3 sm:px-10">
            <div><dt className="text-white/50">Dates</dt><dd className="mt-1 font-bold">{formatCalendarDate(itinerary.startDate, false)} – {formatCalendarDate(itinerary.endDate)}</dd></div>
            <div><dt className="text-white/50">Travelers</dt><dd className="mt-1 font-bold">{trip.travelers.map((traveler) => traveler.name).join(", ")}</dd></div>
            <div><dt className="text-white/50">Started from</dt><dd className="mt-1 font-bold">{baseIndex >= 0 ? `Option ${baseIndex + 1}` : "Group vote"}</dd></div>
          </dl>
        </section>

        <details className="group mt-6 rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <span>
              <span className="eyebrow block">How the group got here</span>
              <span className="mt-2 block text-xl font-bold tracking-tight">The compromise</span>
            </span>
            <span className="text-[#879196] transition group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <p className="mt-4 leading-7 text-[#53666f]">{itinerary.compromiseExplanation}</p>
          {itinerary.compromises.length > 0 ? (
            <ul className="mt-5 space-y-2">
              {itinerary.compromises.map((compromise) => (
                <li className="flex gap-3 rounded-2xl bg-[#fff8dc] p-4 text-sm leading-6 text-[#6f5a16]" key={compromise}>
                  <span aria-hidden="true">✓</span>
                  <span>{compromise}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </details>

        <ItineraryWorkspace
          initialItinerary={itinerary}
          initialMessages={trip.chat || []}
          placesConfigured={getSerpApiKey() !== null}
          travelers={trip.travelers.map((traveler) => ({ id: traveler.id, name: traveler.name }))}
          tripId={trip.id}
        />

        <p className="mt-6 text-center text-xs font-semibold text-[#879196]">
          {itinerary.placesStatus === "added"
            ? "Places, ratings, and reviews come from Google Maps via SerpApi. Flights and hotels are not booked."
            : "This plan has no live flight, hotel, or pricing data yet."}
        </p>
      </div>
    </main>
  );
}
