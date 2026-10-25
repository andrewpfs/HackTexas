import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/header";
import { getTripById } from "@/lib/trip-repository";
import { EditTripForm } from "./edit-trip-form";

export const instant = false;
export const metadata: Metadata = { title: "Edit Trip Details" };

export default async function EditTripPage(props: PageProps<"/trip/[tripId]/edit">) {
  const { tripId } = await props.params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  return <main className="min-h-screen bg-[#f2f0ea] text-[#172733]"><Header /><div className="mx-auto max-w-4xl px-5 py-9 sm:px-8 lg:py-12"><Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href={`/trip/${tripId}`}>← Back to Trip</Link><div className="mt-7"><p className="eyebrow">Host controls</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Edit Trip Details</h1><p className="mt-4 max-w-2xl leading-7 text-[#66757d]">Planning changes clear existing trip options so the group never sees stale suggestions.</p></div><EditTripForm trip={trip} /></div></main>;
}
