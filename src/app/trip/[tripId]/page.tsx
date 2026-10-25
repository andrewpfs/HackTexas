import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/header";
import { getTripById } from "@/lib/trip-repository";
import { CopyInviteLink } from "./copy-invite-link";
import { MyPreferencesAction } from "./my-preferences-action";
import {
  formatCalendarDate,
  getContiguousDateWindows,
  type DateWindow,
} from "@/lib/date-utils";
import { calculatePlanningReadiness } from "@/lib/planning-context";
import { validateCandidateOptions } from "@/lib/candidate-validation";
import { GenerateCandidatesAction } from "./generate-candidates-action";

export const instant = false;

const progressSteps = ["Get Ready", "Compare Options", "Decide Together", "Shared Itinerary"];

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
    ? `${trip.travelers.length} travelers joined · ${trip.expectedTravelerCount} expected`
    : `${trip.travelers.length} joined`;
  const joinPath = `/join?trip=${trip.inviteCode}`;
  const planningReadiness = calculatePlanningReadiness(trip);
  const completedPreferencesCount = planningReadiness.preferencesCompleteCount;
  const completedAvailabilityCount = planningReadiness.availabilityCompleteCount;
  const sharedWindows = planningReadiness.sharedWindows;
  const allTravelersSubmitted = completedAvailabilityCount === trip.travelers.length;
  const preferredDurationDays = trip.preferredDurationDays;
  const longestSharedWindow = getLongestSharedWindow(sharedWindows);
  const candidatesAvailable = trip.candidateOptions
    ? validateCandidateOptions(trip.candidateOptions).valid
    : false;

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

        <MyPreferencesAction
          tripId={trip.id}
          travelers={trip.travelers.map((traveler) => ({
            id: traveler.id,
            isHost: traveler.isHost,
            departureLocation: traveler.departureLocation || (traveler.isHost ? trip.origin : ""),
            preferencesComplete: traveler.preferencesComplete,
            availabilityComplete: traveler.availabilityComplete === true,
          }))}
        />

        {typeof searchParams.availabilityUpdated === "string" ? (
          <p className="mt-4 rounded-2xl bg-[#fff8dc] p-4 text-sm font-semibold text-[#6f5a16]" role="status">
            The trip window changed. Dates outside the new window were removed for {searchParams.availabilityUpdated} {searchParams.availabilityUpdated === "1" ? "traveler" : "travelers"}; they will need to review and resubmit availability.
          </p>
        ) : null}
        {searchParams.tripUpdated === "1" ? (
          <p className="mt-4 rounded-2xl bg-[#daf0ea] p-4 text-sm font-semibold text-[#276655]" role="status">
            Trip details updated. Any older candidate options were cleared.
          </p>
        ) : null}

        <section className="mt-6 rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="planning-readiness">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">Planning readiness</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight" id="planning-readiness">
                {planningReadiness.readyForCandidateGeneration
                  ? "Ready for trip suggestions"
                  : "Your group is still getting ready"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#718087]">
                {planningReadiness.readyForCandidateGeneration
                  ? "The current group has enough complete information for candidate generation."
                  : "Complete the items below before generating trip options."}
              </p>
            </div>
            <GenerateCandidatesAction
              tripId={trip.id}
              ready={planningReadiness.readyForCandidateGeneration}
              candidatesAvailable={candidatesAvailable}
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#f7f7f3] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#879196]" title="Completed preference and availability submissions from joined travelers.">Current group</p>
              <p className="mt-2 font-bold text-[#173f50]">
                {planningReadiness.preferencesCompleteCount} preferences, {planningReadiness.availabilityCompleteCount} availability
              </p>
            </div>
            <div className="rounded-2xl bg-[#f7f7f3] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#879196]" title="The longest consecutive date range currently shared by submitted travelers.">Shared window</p>
              <p className="mt-2 font-bold text-[#173f50]">
                {longestSharedWindow ? formatSharedWindow(longestSharedWindow) : "None yet"}
              </p>
            </div>
          </div>

          {planningReadiness.blockers.length > 0 ? (
            <div className="mt-5 rounded-2xl bg-[#fff0ec] p-5 text-sm text-[#8f3f30]">
              <p className="font-bold">📝 Still Needed</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {planningReadiness.blockers.map((blocker, index) => (
                  <li key={`${blocker.code}-${blocker.travelerName || index}`}>{blocker.message}</li>
                ))}
              </ul>
              {planningReadiness.blockers.some((blocker) => blocker.code === "no_shared_dates") ? (
                <p className="mt-3 font-semibold">Edit availability before generating trip options.</p>
              ) : null}
            </div>
          ) : null}

          {planningReadiness.warnings.length > 0 ? (
            <div className="mt-5 rounded-2xl bg-[#fff8dc] p-5 text-sm text-[#6f5a16]">
              <p className="font-bold">💡 Keep in Mind</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {planningReadiness.warnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-xs font-semibold text-[#879196]">
            {candidatesAvailable
              ? "Three shared trip options are ready for your group."
              : "Demo planner data is used for this hackathon phase."}
          </p>
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
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{traveler.name}{traveler.isHost ? " (Host)" : ""}</p>
                      <p className="mt-1 text-xs text-[#718087]">Departing from {traveler.departureLocation || (traveler.isHost ? trip.origin : "Not added yet")}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
                        <span className={traveler.preferencesComplete ? "text-[#276655]" : "text-[#778388]"}>
                          Preferences {traveler.preferencesComplete ? "✓" : "waiting"}
                        </span>
                        <span className={traveler.availabilityComplete ? "text-[#276655]" : "text-[#778388]"}>
                          Availability {traveler.availabilityComplete ? "✓" : "waiting"}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-2xl bg-[#f7f7f3] p-4 text-sm font-semibold leading-6 text-[#53666f]">
                {completedPreferencesCount} of {trip.travelers.length} travelers completed preferences
                <br />
                {completedAvailabilityCount} of {trip.travelers.length} travelers submitted availability
              </p>
            </section>

            <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="availability">
              <p className="eyebrow">Possible dates</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight" id="availability">Availability overlap</h2>
              {completedAvailabilityCount === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#f7f7f3] p-5 text-sm leading-6 text-[#718087]">Waiting for travelers to submit availability.</p>
              ) : (
                <div className="mt-5">
                  <div className="mb-5 space-y-2">
                    {trip.travelers.map((traveler) => {
                      const travelerWindows = getContiguousDateWindows(traveler.availableDates || []);
                      return <details className="rounded-2xl border border-[#172733]/8 bg-[#f7f7f3] p-4" key={traveler.id}><summary className="cursor-pointer font-bold text-[#173f50]">{traveler.name} <span className="font-normal text-[#718087]">· {traveler.availabilityComplete ? `${traveler.availableDates?.length || 0} dates` : "Not submitted"}</span></summary>{travelerWindows.length > 0 ? <ul className="mt-3 space-y-1 text-sm text-[#607179]">{travelerWindows.map((window) => <li key={`${traveler.id}-${window.startDate}`}>{formatSharedWindow(window)}</li>)}</ul> : <p className="mt-3 text-sm text-[#718087]">No availability saved yet.</p>}</details>;
                    })}
                  </div>
                  <p className="text-sm font-bold text-[#3b505a]">
                    {allTravelersSubmitted
                      ? "Shared group availability"
                      : `Current overlap among ${completedAvailabilityCount} of ${trip.travelers.length} submitted travelers`}
                  </p>
                  {!allTravelersSubmitted ? (
                    <p className="mt-1 text-sm leading-6 text-[#718087]">This overlap is provisional until every joined traveler submits availability.</p>
                  ) : null}

                  {sharedWindows.length === 0 ? (
                    <p className="mt-4 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#a34532]">No dates currently work for everyone who has submitted.</p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {sharedWindows.map((window) => {
                        const viable = preferredDurationDays !== undefined && window.dayCount >= preferredDurationDays;
                        return (
                          <li className="rounded-2xl bg-[#f7f7f3] p-4" key={`${window.startDate}-${window.endDate}`}>
                            <p className="font-bold text-[#173f50]">{formatSharedWindow(window)}</p>
                            <p className="mt-1 text-sm text-[#718087]">
                              {window.dayCount} {window.dayCount === 1 ? "day" : "consecutive days"}
                              {viable ? ` — viable for a ${preferredDurationDays}-day trip` : ""}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {preferredDurationDays !== undefined && sharedWindows.length > 0 && !sharedWindows.some((window) => window.dayCount >= preferredDurationDays) ? (
                    <p className="mt-4 text-sm leading-6 text-[#718087]">No current overlap window is long enough for the group&apos;s preferred {preferredDurationDays}-day trip yet.</p>
                  ) : null}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="trip-details">
              <p className="eyebrow">Trip details</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight" id="trip-details">Trip Brief</h2>
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
                <CopyInviteLink joinPath={joinPath} />
              </div>
              <div className="border-t border-[#172733]/8 bg-[#173f50] p-6 text-white sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#f3c969]">Coming after preferences</p>
                <p className="mt-2 text-lg font-bold">Get Ready → Compare Options → Decide Together → Shared Itinerary</p>
                <p className="mt-2 text-sm leading-6 text-white/65">Voting and final itinerary generation are intentionally deferred.</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
