import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/header";
import { getTripById } from "@/lib/trip-repository";
import { formatCalendarDate } from "@/lib/date-utils";
import { AvailabilityCalendar } from "./availability-calendar";

export const instant = false;

export const metadata: Metadata = {
  title: "My Availability",
};

export default async function AvailabilityPage(
  props: PageProps<"/trip/[tripId]/availability">,
) {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    notFound();
  }

  const tripName = trip.name || (trip.destination ? `${trip.destination} Trip` : "Group Trip");
  const formattedStart = formatCalendarDate(trip.earliestPossibleDate);
  const formattedEnd = formatCalendarDate(trip.latestPossibleDate);

  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <div className="mx-auto max-w-5xl px-5 py-9 sm:px-8 lg:py-12">
        <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href={`/trip/${tripId}`}>
          ← Back to {tripName}
        </Link>

        <div className="mt-7">
          <p className="eyebrow">My availability</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Which dates could you travel?
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#66757d]">
            Your group is considering travel between {formattedStart} and {formattedEnd}. Select every date that could work for you; the dates do not need to be consecutive.
          </p>
        </div>

        <AvailabilityCalendar
          earliestPossibleDate={trip.earliestPossibleDate}
          inviteCode={trip.inviteCode}
          latestPossibleDate={trip.latestPossibleDate}
          preferredDurationDays={trip.preferredDurationDays}
          tripId={tripId}
        />
      </div>
    </main>
  );
}
