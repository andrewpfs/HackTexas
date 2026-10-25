import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { PhoneGate } from "../components/phone-gate";
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
      displayName: trip.name || (trip.destination ? `${trip.destination} Trip` : "Group Trip"),
      hostName: trip.hostName,
      prompt: trip.prompt,
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
      title="Join The Plan. Bring Your Preferences."
      description="Enter the invite code your host shared, sign in with your phone, and add yourself to the group."
    >
      <section className="mb-8 rounded-3xl bg-[#173f50] p-5 text-white sm:p-6" aria-labelledby="how-it-works">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f3c969]">How It Works</p>
        <h2 className="mt-2 text-xl font-bold" id="how-it-works">One shared trip, planned around everyone.</h2>
        <p className="mt-2 text-sm leading-6 text-white/75">Your friend started a group trip. Instead of a messy group chat, everyone adds what works for them and Muse, our AI planner, finds the plan that fits the whole group.</p>
        <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ["Sign in with your phone", "We text you a code. No account or password."],
            ["Add your preferences", "Your budget, interests, where you fly from, and the days you're free."],
            ["Vote on 3 trip options", "Muse plans options inside the dates the whole group shares."],
            ["Get one shared itinerary", "Chat with the group, ask @muse for changes, then pick flights and a hotel."],
          ].map(([heading, detail], index) => (
            <li className="flex gap-3 rounded-2xl bg-white/8 p-3" key={heading}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3c969] text-sm font-extrabold text-[#173f50]">{index + 1}</span>
              <span><b className="block">{heading}</b><span className="text-white/70">{detail}</span></span>
            </li>
          ))}
        </ol>
      </section>

      <PhoneGate description="Your phone number is your login. We text you a code, and if you've already joined this trip it takes you right back to it." title="Sign In With Your Phone">
        <JoinTripForm initialCode={inviteCode} initialError={initialError} initialPreview={initialPreview} />
      </PhoneGate>

      <div className="mt-10 border-t border-[#172733]/10 pt-7">
        <p className="text-sm text-[#66757d]">
          Hosting instead? <Link className="font-bold text-[#e4664f] hover:underline" href="/create">Start a new trip</Link>
        </p>
      </div>
    </PageShell>
  );
}
