import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/header";
import { getTripById } from "@/lib/trip-repository";
import { PreferencesForm } from "./preferences-form";

export const instant = false;

export const metadata: Metadata = {
  title: "My Preferences",
};

export default async function PreferencesPage(
  props: PageProps<"/trip/[tripId]/preferences">,
) {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    notFound();
  }

  const tripName = trip.name || (trip.destination ? `${trip.destination} Trip` : "Group Trip");

  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <div className="mx-auto max-w-4xl px-5 py-9 sm:px-8 lg:py-12">
        <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href={`/trip/${tripId}`}>
          ← Back to {tripName}
        </Link>

        <div className="mt-7">
          <p className="eyebrow">My preferences</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Tell the group what works for you.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#66757d]">
            Your answers will help the group compare options later. Availability is saved separately and can be completed in either order.
          </p>
        </div>

        <PreferencesForm inviteCode={trip.inviteCode} tripId={tripId} />
      </div>
    </main>
  );
}
