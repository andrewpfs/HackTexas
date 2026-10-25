import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { getTripByInviteCode } from "@/lib/trip-repository";
import type { JoinTripPreview } from "@/lib/trip-types";
import { normalizeInviteCode } from "@/lib/trip-validation";
import { JoinTripForm } from "./join-trip-form";

export const instant = false;

export const metadata: Metadata = { title: "Join a Trip" };

export default async function JoinTripPage(props: PageProps<"/join">) {
  const searchParams = await props.searchParams;
  const tripParameter = searchParams.trip;
  const providedCode = typeof tripParameter === "string" ? tripParameter : "";
  const inviteCode = normalizeInviteCode(providedCode);
  const trip = inviteCode ? await getTripByInviteCode(inviteCode) : null;
  let initialPreview: JoinTripPreview | null = null;

  if (trip) {
    initialPreview = {
      inviteCode: trip.inviteCode,
      displayName: trip.destination ? `${trip.destination} Trip` : "Group Trip",
      hostName: trip.hostName,
      prompt: trip.prompt,
      origin: trip.origin,
      destination: trip.destination,
      earliestPossibleDate: trip.earliestPossibleDate,
      latestPossibleDate: trip.latestPossibleDate,
      preferredDurationDays: trip.preferredDurationDays,
      travelerCount: trip.travelers.length,
      expectedTravelerCount: trip.expectedTravelerCount,
    };
  }

  const initialError = inviteCode && !trip
    ? "We couldn't find a trip with that invite code."
    : "";

  return (
    <PageShell
      eyebrow="You've been invited"
      title="Join the plan. Bring your preferences."
      description="Enter the invite your host shared, then add your name to the group."
    >
      <div className="mb-8 flex items-center gap-4 rounded-2xl bg-[#edf5f2] p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#daf0ea] text-lg" aria-hidden="true">↗</span>
        <div>
          <p className="font-bold text-[#27483f]">One invite. One shared trip.</p>
          <p className="mt-0.5 text-sm text-[#60746e]">You won&apos;t need an account or password.</p>
        </div>
      </div>

      <JoinTripForm initialCode={inviteCode} initialError={initialError} initialPreview={initialPreview} />

      <div className="mt-10 border-t border-[#172733]/10 pt-7">
        <p className="text-sm text-[#66757d]">
          Hosting instead? <Link className="font-bold text-[#e4664f] hover:underline" href="/create">Start a new trip</Link>
        </p>
      </div>
    </PageShell>
  );
}
