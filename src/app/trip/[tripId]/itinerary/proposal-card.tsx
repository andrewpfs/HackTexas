"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChatMessage, GroupItinerary, ItineraryProposal } from "@/lib/trip-types";

export type ChatState = {
  itinerary: GroupItinerary;
  messages: ChatMessage[];
  proposal?: ItineraryProposal | null;
  approvedProposal?: ItineraryProposal | null;
};

export function ProposalCard({ tripId, proposal, travelerId, travelers, onUpdate }: {
  tripId: string;
  proposal: ItineraryProposal;
  travelerId: string | null;
  travelers: { id: string; name: string }[];
  onUpdate: (state: ChatState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const myVote = proposal.votes.find((vote) => vote.travelerId === travelerId);

  async function vote(choice: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary/proposal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelerId, proposalId: proposal.id, choice }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Could not save your vote.");
      else onUpdate(data);
    } catch { setError("Could not reach the server. Try again."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border-2 border-[#397bb3]/40 bg-[#eef6ff] p-4" aria-label="Major itinerary proposal">
    <h3 className="font-bold text-[#173f50]">Major Change · {proposal.status === "pending" ? "Group Vote" : proposal.status}</h3>
    <p className="mt-1 text-xs text-[#53666f]">Requested by {proposal.requestedByName}</p>
    <p className="mt-3 text-sm leading-6">{proposal.summary}</p>
    {proposal.proposedDestination !== proposal.previousDestination ? <p className="mt-2 text-sm font-bold">{proposal.previousDestination} → {proposal.proposedDestination}</p> : null}
    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{proposal.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
    <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">Preview Proposed Days</summary><ol className="mt-2 space-y-3">{proposal.proposedDays.map((day) => <li key={day.dayNumber}><b>Day {day.dayNumber}: {day.title}</b><ul>{day.activities.map((stop) => <li key={`${stop.time}-${stop.title}`}>{stop.time} · {stop.title} · {stop.location}</li>)}</ul></li>)}</ol></details>
    <ul className="mt-3 space-y-1 text-xs">{travelers.map((traveler) => <li key={traveler.id}>{traveler.name}: <b>{proposal.votes.find((vote) => vote.travelerId === traveler.id)?.choice ?? "Waiting"}</b></li>)}</ul>
    {proposal.status === "pending" ? <>
      <p className="mt-3 text-xs leading-5 text-[#53666f]">Everyone who joined must vote. A majority approves; a tie keeps the current plan. You can change your vote until the last vote finalizes it.</p>
      {travelerId ? <div className="mt-3 flex flex-wrap gap-2">{(["approve", "reject"] as const).map((choice) => <button aria-pressed={myVote?.choice === choice} className={`rounded-full border px-4 py-2 text-sm font-bold capitalize ${myVote?.choice === choice ? "bg-[#173f50] text-white" : "bg-white text-[#173f50]"}`} disabled={busy} key={choice} onClick={() => vote(choice)} type="button">{choice}</button>)}</div> : null}
    </> : null}
    {error ? <p className="mt-3 text-sm text-[#a34532]" role="alert">{error} <Link className="underline" href="/my-trips">My Trips</Link></p> : null}
  </section>;
}
