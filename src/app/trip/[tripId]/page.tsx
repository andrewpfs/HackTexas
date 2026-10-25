import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "../../components/header";
import { getTripById } from "@/lib/trip-repository";
import { CopyInviteLink } from "./copy-invite-link";
import { formatCalendarDate, type DateWindow } from "@/lib/date-utils";
import { calculatePlanningReadiness } from "@/lib/planning-context";
import { validateCandidateOptions } from "@/lib/candidate-validation";
import { AvailabilityHeatmap } from "./availability-heatmap";
import { CrewCard } from "./crew-card";
import { TripTopBar } from "./trip-top-bar";
import { LiveRefresh } from "./live-refresh";
import { ProgressNav } from "./progress-nav";
import { TripSketchCard } from "./trip-sketch-card";
import { getVotingSummary } from "@/lib/voting";

export const instant = false;


function formatSharedWindow(window: DateWindow) {
  if (window.startDate === window.endDate) {
    return formatCalendarDate(window.startDate);
  }

  const startYear = window.startDate.slice(0, 4);
  const endYear = window.endDate.slice(0, 4);
  const includeStartYear = startYear !== endYear;
  return `${formatCalendarDate(window.startDate, includeStartYear)} – ${formatCalendarDate(window.endDate)}`;
}

function getLongestSharedWindow(windows: DateWindow[]) {
  if (windows.length === 0) {
    return null;
  }

  let longestWindow = windows[0];

  for (const window of windows) {
    if (window.dayCount > longestWindow.dayCount) {
      longestWindow = window;
    }
  }

  return longestWindow;
}

export async function generateMetadata(props: PageProps<"/trip/[tripId]">): Promise<Metadata> {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return { title: "Trip not found" };
  }

  return { title: trip.name || (trip.destination ? `${trip.destination} Trip` : "Group Trip") };
}

export default async function TripPage(props: PageProps<"/trip/[tripId]">) {
  const { tripId } = await props.params;
  const searchParams = await props.searchParams;
  const trip = await getTripById(tripId);

  if (!trip) {
    notFound();
  }

  const displayName = trip.name || (trip.destination ? `${trip.destination} Trip` : "Group Trip");
  const travelWindow = `${formatCalendarDate(trip.earliestPossibleDate)} – ${formatCalendarDate(trip.latestPossibleDate)}`;
  const travelerCount = trip.expectedTravelerCount
    ? `${trip.travelers.length} traveler(s) joined · ${trip.expectedTravelerCount} expected`
    : `${trip.travelers.length} traveler(s) joined`;
  const joinPath = `/join?trip=${trip.inviteCode}`;
  const planningReadiness = calculatePlanningReadiness(trip);
  const completedAvailabilityCount = planningReadiness.availabilityCompleteCount;
  const sharedWindows = planningReadiness.sharedWindows;
  const preferredDurationDays = trip.preferredDurationDays;
  const longestSharedWindow = getLongestSharedWindow(sharedWindows);
  const candidatesAvailable = trip.candidateOptions
    ? validateCandidateOptions(trip.candidateOptions).valid
    : false;

  const votingSummary = getVotingSummary(trip);
  const itineraryReady = Boolean(trip.itinerary);
  // 0 Get Ready, 1 Compare Options, 2 Decide Together, 3 Shared Itinerary
  const bookedCount = Object.keys(trip.travel?.bookings ?? {}).length;
  const currentStep = itineraryReady && bookedCount > 0
    ? 4
    : itineraryReady
    ? 3
    : candidatesAvailable && votingSummary.votedCount > 0
      ? 2
      : candidatesAvailable
        ? 1
        : 0;
  const stepHeadings = [
    "First, hear from everyone.",
    "Compare the three options.",
    `Vote together: ${votingSummary.votedCount} of ${votingSummary.travelerCount} have voted.`,
    "Your shared itinerary is ready. Next, book flights and the hotel.",
    `Booking: ${bookedCount} of ${trip.travelers.length} travelers have booked (demo).`,
  ];
  const statusLabels = ["Collecting preferences", "Comparing options", "Voting", "Itinerary ready", "Booking"];

  const completedAvailabilityLabel =
    completedAvailabilityCount === trip.travelers.length
      ? "Shared group availability."
      : `Provisional: ${completedAvailabilityCount} of ${trip.travelers.length} travelers have submitted dates.`;

  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <LiveRefresh tripId={trip.id} />
      <div className="mx-auto max-w-7xl space-y-4 px-5 py-5 sm:px-8 lg:px-10 lg:py-6">
        <TripTopBar
          joinPath={joinPath}
          travelers={trip.travelers.map((traveler) => ({
            id: traveler.id,
            isHost: traveler.isHost,
            departureLocation: traveler.departureLocation || (traveler.isHost ? trip.origin : ""),
            preferencesComplete: traveler.preferencesComplete,
            availabilityComplete: traveler.availabilityComplete === true,
            phoneLast4: traveler.phoneLast4,
          }))}
          tripId={trip.id}
        />

        <section className="relative overflow-hidden rounded-[2rem] border border-[#173f50]/15 bg-white shadow-[0_20px_50px_rgba(23,63,80,0.12)]" aria-label="Trip boarding pass">
          <div className="flex items-center justify-between gap-3 bg-[#173f50] px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white sm:px-9">
            <span>✦ Boarding pass · Group trip</span>
            <span className="rounded-full bg-[#f3c969] px-3 py-1 tracking-[0.12em] text-[#173f50]">{statusLabels[currentStep]}</span>
          </div>
          <div className="grid md:grid-cols-[1fr_15rem]">
            <div className="space-y-6 p-6 sm:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#879196]">Trip</p>
                <h1 className="mt-1 text-4xl font-semibold tracking-[-0.045em] text-[#102a38] sm:text-5xl">{displayName}</h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#879196]">From</p>
                  <p className="mt-1 truncate text-xl font-bold text-[#173f50]">{trip.origin}</p>
                </div>
                <div className="flex flex-1 items-center gap-2 text-[#e4664f]" aria-hidden="true">
                  <span className="h-px flex-1 border-t-2 border-dashed border-[#e4664f]/50" />
                  <svg className="h-10 w-10 shrink-0" fill="currentColor" viewBox="0 0 24 24"><g transform="rotate(90 12 12)"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></g></svg>
                  <span className="h-px flex-1 border-t-2 border-dashed border-[#e4664f]/50" />
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#879196]">To</p>
                  <p className="mt-1 truncate text-xl font-bold text-[#173f50]">{trip.destination || "To be decided"}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t-2 border-dashed border-[#173f50]/15 pt-5 text-sm sm:grid-cols-4">
                <div><dt className="text-xs font-bold uppercase tracking-wide text-[#879196]">Host</dt><dd className="mt-1 font-bold text-[#173f50]">{trip.hostName}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-[#879196]">Window</dt><dd className="mt-1 font-bold text-[#173f50]">{travelWindow}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-[#879196]">Length</dt><dd className="mt-1 font-bold text-[#173f50]">{trip.preferredDurationDays ? `${trip.preferredDurationDays} days` : "Not specified"}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-[#879196]">Travelers</dt><dd className="mt-1 font-bold text-[#173f50]">{travelerCount}</dd></div>
                <div className="col-span-full"><dt className="text-xs font-bold uppercase tracking-wide text-[#879196]">About This Trip</dt><dd className="mt-1 max-w-[70ch] leading-6 text-[#53666f]">{trip.prompt}</dd></div>
              </dl>
            </div>
            <div className="relative flex flex-col justify-center border-t-2 border-dashed border-[#173f50]/25 bg-[#fffaf1] p-6 md:border-l-2 md:border-t-0">
              <span className="absolute -top-3 left-1/2 hidden h-6 w-6 -translate-x-1/2 rounded-full bg-[#f2f0ea] md:block" aria-hidden="true" />
              <span className="absolute -bottom-3 left-1/2 hidden h-6 w-6 -translate-x-1/2 rounded-full bg-[#f2f0ea] md:block" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#879196]">Invite Code</p>
              <p className="mt-2 font-mono text-3xl font-bold tracking-[0.2em] text-[#173f50]">{trip.inviteCode}</p>
              <p className="mt-2 text-xs leading-5 text-[#718087]">Share this code so friends can board.</p>
              <CopyInviteLink className="button-secondary mt-4 !min-h-10 !px-4 !text-sm" joinPath={joinPath} />
            </div>
          </div>
        </section>

        {typeof searchParams.availabilityUpdated === "string" ? (
          <p className="rounded-2xl bg-[#fff8dc] p-4 text-sm font-semibold text-[#6f5a16]" role="status">
            The trip window changed. Dates outside the new window were removed for {searchParams.availabilityUpdated} {searchParams.availabilityUpdated === "1" ? "traveler" : "travelers"}; they will need to review and resubmit availability.
          </p>
        ) : null}
        {searchParams.tripUpdated === "1" ? (
          <p className="rounded-2xl bg-[#daf0ea] p-4 text-sm font-semibold text-[#276655]" role="status">
            Trip details updated. Any older options, votes, and itinerary were cleared.
          </p>
        ) : null}

        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_21rem] lg:grid-cols-[minmax(0,1fr)_23.5rem]">
          <div className="min-w-0 space-y-5">
            <section className="rounded-3xl border border-[#172733]/8 bg-white p-6" aria-labelledby="planning-progress">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="eyebrow">Planning Progress</p><h2 className="mt-1 text-xl font-bold" id="planning-progress">{stepHeadings[currentStep]}</h2></div>
                <p className="text-sm text-[#738087]">Step {currentStep + 1} of 5</p>
              </div>
              <div className="mt-5"><ProgressNav currentStep={currentStep} itineraryReady={itineraryReady} optionsReady={candidatesAvailable} tripId={trip.id} /></div>
            </section>

            {!candidatesAvailable && !itineraryReady ? (
              <TripSketchCard hostId={trip.travelers.find((traveler) => traveler.isHost)?.id ?? ""} sketch={trip.sketch ?? null} tripId={trip.id} />
            ) : null}

            <section className="rounded-3xl border border-[#172733]/8 bg-white p-6" aria-labelledby="availability">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="eyebrow">Possible Dates</p><h2 className="mt-1 text-xl font-bold" id="availability">Availability Overlap</h2></div>
                <p className="text-sm text-[#738087]">{completedAvailabilityLabel}</p>
              </div>
              <div className="mt-5">
                <AvailabilityHeatmap
                  earliestPossibleDate={trip.earliestPossibleDate}
                  latestPossibleDate={trip.latestPossibleDate}
                  travelers={trip.travelers.map((traveler) => ({
                    name: traveler.name,
                    availabilityComplete: traveler.availabilityComplete === true,
                    availableDates: traveler.availableDates || [],
                  }))}
                />
              </div>
              <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-[#f7f7f3] px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">Best Shared Window</span>
                <span className="font-bold text-[#173f50]">
                  {longestSharedWindow ? formatSharedWindow(longestSharedWindow) : "None yet"}
                  {longestSharedWindow && preferredDurationDays !== undefined && longestSharedWindow.dayCount < preferredDurationDays ? (
                    <span className="ml-2 text-sm font-normal text-[#718087]">shorter than the preferred {preferredDurationDays} days</span>
                  ) : null}
                </span>
              </div>
            </section>
          </div>

          <CrewCard
            candidatesAvailable={candidatesAvailable}
            itineraryReady={itineraryReady}
            longestSharedWindow={longestSharedWindow}
            readiness={planningReadiness}
            trip={trip}
            votedCount={votingSummary.votedCount}
          />
        </div>
      </div>
    </main>
  );
}
