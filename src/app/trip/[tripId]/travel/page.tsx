import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/header";
import { formatCalendarDate } from "@/lib/date-utils";
import { getSerpApiKey } from "@/lib/serpapi-places";
import { getDepartureCity, getHotelSearchInputs, getNights, lowestLodgingBudgetPerNight, travelersNeedingLodging } from "@/lib/travel-planning";
import { getTripById } from "@/lib/trip-repository";
import { LiveRefresh } from "../live-refresh";
import { ProgressNav } from "../progress-nav";
import { TravelWorkspace } from "./travel-workspace";

export const instant = false;

export async function generateMetadata(props: PageProps<"/trip/[tripId]/travel">): Promise<Metadata> {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);
  return { title: trip ? `Flights And Hotel | ${trip.name || trip.destination || "Group Trip"}` : "Trip not found" };
}

export default async function TravelPage(props: PageProps<"/trip/[tripId]/travel">) {
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
          <div className="rounded-[2rem] border border-[#172733]/8 bg-white p-8 sm:p-12">
            <h1 className="text-3xl font-extrabold text-[#e4664f]">Flights And Hotel Come Next</h1>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-[#718087]">Once the group has a shared itinerary, this page finds real hotels and each traveler&apos;s flights.</p>
            <Link className="button-primary mt-7" href={`/trip/${trip.id}`}>Back To The Trip</Link>
          </div>
        </div>
      </main>
    );
  }

  const inputs = getHotelSearchInputs(trip)!;
  const bookings = trip.travel?.bookings ?? {};

  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <LiveRefresh tripId={trip.id} />
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href={`/trip/${trip.id}/itinerary`}>← Back to the itinerary</Link>

        <div className="mt-4 rounded-3xl border border-[#172733]/8 bg-white px-6 py-4">
          <ProgressNav currentStep={3} itineraryReady optionsReady tripId={trip.id} />
        </div>

        <div className="mt-6">
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] text-[#e4664f] sm:text-6xl">Book Flights And Hotel</h1>
          <p className="mt-3 max-w-2xl text-lg leading-7 text-[#66757d]">
            {itinerary.destination} · {formatCalendarDate(itinerary.startDate, false)} – {formatCalendarDate(itinerary.endDate)}. Real prices, simulated checkout.
          </p>
        </div>

        <TravelWorkspace
          key={`${itinerary.id}-${itinerary.revision ?? 0}`}
          bookings={bookings}
          tripName={trip.name || `${itinerary.destination} Trip`}
          destination={itinerary.destination}
          flights={trip.travel?.flights ?? {}}
          hotels={trip.travel?.hotels ?? null}
          lodgingCount={Math.max(1, travelersNeedingLodging(trip).length)}
          lowestBudgetPerNight={lowestLodgingBudgetPerNight(trip)}
          nights={getNights(inputs.checkIn, inputs.checkOut)}
          searchConfigured={getSerpApiKey() !== null}
          travelers={trip.travelers.map((traveler) => ({
            id: traveler.id,
            name: traveler.name,
            isHost: traveler.isHost,
            needsLodging: traveler.preferences?.lodgingType !== "No need",
            departure: getDepartureCity(trip, traveler.id) ?? "",
          }))}
          tripId={trip.id}
        />
      </div>
    </main>
  );
}
