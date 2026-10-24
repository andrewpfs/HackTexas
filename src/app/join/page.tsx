import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";

export const metadata: Metadata = {
  title: "Join a Trip",
};

export default function JoinTripPage() {
  return (
    <PageShell
      eyebrow="You’ve been invited"
      title="Join the plan. Bring your preferences."
      description="Enter the invite your host shared, then add your availability and travel style to the group."
    >
      <div className="mb-8 flex items-center gap-4 rounded-2xl bg-[#edf5f2] p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#daf0ea] text-lg" aria-hidden="true">↗</span>
        <div>
          <p className="font-bold text-[#27483f]">One invite. One shared trip.</p>
          <p className="mt-0.5 text-sm text-[#60746e]">You won’t need an account or password.</p>
        </div>
      </div>

      <form action="/trip/demo">
        <div>
          <label className="form-label" htmlFor="invite">Invite code or trip link</label>
          <input className="form-control" id="invite" name="invite" placeholder="TOKYO-24 or paste a trip link" type="text" />
        </div>
        <div className="mt-6">
          <label className="form-label" htmlFor="name">Your name</label>
          <input className="form-control" id="name" name="name" placeholder="How the group knows you" type="text" />
        </div>
        <button className="button-primary mt-8 w-full sm:w-auto" type="submit">
          Join Trip <span aria-hidden="true">→</span>
        </button>
        <p className="mt-3 text-xs text-[#889398]">Demo mode: any details will open the sample trip.</p>
      </form>

      <div className="mt-10 border-t border-[#172733]/10 pt-7">
        <p className="text-sm text-[#66757d]">
          Hosting instead? <Link className="font-bold text-[#e4664f] hover:underline" href="/create">Start a new trip</Link>
        </p>
      </div>
    </PageShell>
  );
}
