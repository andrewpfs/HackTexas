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
  const [showDetails, setShowDetails] = useState(false);
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
    <h3 className="font-bold text-[#173f50]">{pending ? "Proposed Change · Group Vote" : `Proposed Change · ${proposal.status}`}</h3>
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
    <button className="mt-3 text-sm font-bold text-[#173f50] underline decoration-[#397bb3]/40 underline-offset-4" onClick={() => setShowDetails(true)} type="button">See what changes →</button>
    {/* A full-screen sheet, so the details never get cut off inside the pinned vote box on phones. */}
    {showDetails ? (
      <div aria-label="What changes" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-[#102a38]/50 sm:items-center sm:p-6" onClick={() => setShowDetails(false)} role="dialog">
        <div className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-white sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 border-b border-[#172733]/8 p-5">
            <h3 className="text-lg font-bold text-[#173f50]">What Changes</h3>
            <button className="rounded-full bg-[#f2f0ea] px-4 py-2 text-sm font-bold text-[#173f50]" onClick={() => setShowDetails(false)} type="button">Close</button>
          </div>
          <div className="overflow-y-auto p-5 text-sm">
            <p className="leading-6">{proposal.summary}</p>
            <ul className="mt-3 list-disc space-y-1 pl-4">{proposal.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
            <ol className="mt-4 space-y-4">{proposal.proposedDays.map((day) => <li key={day.dayNumber}><b className="text-[#173f50]">Day {day.dayNumber}: {day.title}</b><ul className="mt-1 space-y-1 text-[#53666f]">{day.activities.map((stop) => <li key={`${stop.time}-${stop.title}`}>{stop.time || "Any time"} · {stop.title} · {stop.location}</li>)}</ul></li>)}</ol>
          </div>
        </div>
      </div>
    ) : null}
  </section>;
}
