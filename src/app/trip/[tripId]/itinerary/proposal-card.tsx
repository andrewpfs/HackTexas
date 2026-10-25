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

  const pending = proposal.status === "pending";
  // The vote comes first so it fits in the pinned area above the chat on phones.
  return <section className="rounded-2xl border-2 border-[#397bb3]/40 bg-[#eef6ff] p-4" aria-label="Major itinerary proposal">
    <h3 className="font-bold text-[#173f50]">Major Change · {pending ? "Group Vote" : proposal.status}</h3>
    {proposal.proposedDestination !== proposal.previousDestination ? <p className="mt-1 text-base font-extrabold text-[#173f50]">{proposal.previousDestination} → {proposal.proposedDestination}</p> : null}
    <p className="mt-1 text-xs text-[#53666f]">Requested by {proposal.requestedByName}</p>
    <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">{travelers.map((traveler) => {
      const choice = proposal.votes.find((vote) => vote.travelerId === traveler.id)?.choice;
      return <li className={`rounded-full px-2.5 py-1 font-bold ${choice === "approve" ? "bg-[#daf0ea] text-[#276655]" : choice === "reject" ? "bg-[#fff0ec] text-[#a34532]" : "bg-white text-[#718087]"}`} key={traveler.id}>{traveler.name}: {choice === "approve" ? "Yes" : choice === "reject" ? "No" : "Waiting"}</li>;
    })}</ul>
    {pending && travelerId ? <div className="mt-3 grid grid-cols-2 gap-2">
      {(["approve", "reject"] as const).map((choice) => <button aria-pressed={myVote?.choice === choice} className={`min-h-11 rounded-full border-2 px-4 py-2 text-sm font-bold ${myVote?.choice === choice ? (choice === "approve" ? "border-[#276655] bg-[#276655] text-white" : "border-[#a34532] bg-[#a34532] text-white") : choice === "approve" ? "border-[#276655] bg-white text-[#276655]" : "border-[#a34532] bg-white text-[#a34532]"}`} disabled={busy} key={choice} onClick={() => vote(choice)} type="button">{choice === "approve" ? "✓ Approve" : "✕ Reject"}</button>)}
    </div> : null}
    {pending ? <p className="mt-2 text-xs leading-5 text-[#53666f]">Everyone who joined votes. A majority approves; a tie keeps the current plan. You can change your vote until the last vote is in.</p> : null}
    {error ? <p className="mt-3 text-sm text-[#a34532]" role="alert">{error} <Link className="underline" href="/my-trips">My Trips</Link></p> : null}
    <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold text-[#173f50]">What Changes</summary>
      <p className="mt-2 leading-6">{proposal.summary}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">{proposal.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
      <ol className="mt-3 space-y-3">{proposal.proposedDays.map((day) => <li key={day.dayNumber}><b>Day {day.dayNumber}: {day.title}</b><ul>{day.activities.map((stop) => <li key={`${stop.time}-${stop.title}`}>{stop.time} · {stop.title} · {stop.location}</li>)}</ul></li>)}</ol>
    </details>
  </section>;
}
