import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/header";
import { getTripById } from "@/lib/trip-repository";
import { ConnectPanel } from "./connect-panel";

export const instant = false;

export const metadata: Metadata = { title: "Connect Your Assistant" };

export default async function ConnectPage(props: PageProps<"/trip/[tripId]/connect">) {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href={`/trip/${trip.id}/travel`}>← Back to booking</Link>
        <h1 className="mt-4 text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] text-[#e4664f] sm:text-6xl">Connect Your Assistant</h1>
        <p className="mt-3 max-w-2xl text-lg leading-7 text-[#66757d]">
          Let your own AI assistant, like the Muse app or any app that supports MCP connectors, read your part of this trip and record what it books for you. It only ever sees your own plans and bookings.
        </p>
        <ConnectPanel
          connectedIds={trip.travelers.filter((traveler) => traveler.assistantTokenHash).map((traveler) => traveler.id)}
          tripId={trip.id}
        />
      </div>
    </main>
  );
}
