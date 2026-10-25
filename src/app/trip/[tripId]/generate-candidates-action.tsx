"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeasibilityWarning } from "@/lib/trip-feasibility";

type GenerateCandidatesActionProps = {
  tripId: string;
  ready: boolean;
  candidatesAvailable: boolean;
  itineraryReady: boolean;
  // Shown before generating so the group can fix an unrealistic plan first.
  warnings?: FeasibilityWarning[];
};

export function GenerateCandidatesAction({
  tripId,
  ready,
  candidatesAvailable,
  itineraryReady,
  warnings = [],
}: GenerateCandidatesActionProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showWarnings, setShowWarnings] = useState(false);

  function handleClick() {
    if (warnings.length > 0 && !showWarnings) {
      setShowWarnings(true);
      return;
    }
    setShowWarnings(false);
    handleGenerate();
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/trips/${tripId}/candidates/generate`, {
        method: "POST",
      });
      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(responseData.error || "We could not generate trip options.");
        return;
      }

      router.push(responseData.optionsPath || `/trip/${tripId}/options`);
      router.refresh();
    } catch {
      setErrorMessage("We could not reach the planner. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (itineraryReady) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link className="button-primary" href={`/trip/${tripId}/itinerary`}>
          View Shared Itinerary
        </Link>
        <Link className="button-secondary" href={`/trip/${tripId}/options`}>
          See Options and Votes
        </Link>
      </div>
    );
  }

  if (candidatesAvailable) {
    return (
      <Link className="button-primary" href={`/trip/${tripId}/options`}>
        View Options and Vote
      </Link>
    );
  }

  if (showWarnings) {
    return (
      <div className="rounded-2xl border-2 border-[#e4a23a]/50 bg-[#fff8e6] p-4" role="alertdialog" aria-labelledby="feasibility-heading">
        <p className="font-bold text-[#7a5b12]" id="feasibility-heading">⚠ Heads up before Muse plans</p>
        <p className="mt-1 text-sm text-[#7a5b12]">This trip may not be realistic as set up:</p>
        <ul className="mt-3 space-y-2.5">
          {warnings.map((warning) => (
            <li className="text-sm leading-6 text-[#53470f]" key={warning.code}>
              <b className="block text-[#173f50]">{warning.title}</b>
              {warning.detail}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-[#7a6a3a]">You can change the dates, budgets or trip details first, or go ahead and Muse will plan around these.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button className="button-primary" disabled={isGenerating} onClick={handleClick} type="button">Generate Anyway</button>
          <button className="button-secondary" onClick={() => setShowWarnings(false)} type="button">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:text-right">
      <button
        className={`button-primary ${!ready || isGenerating ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={!ready || isGenerating}
        onClick={handleClick}
        type="button"
      >
        {isGenerating ? "Generating Options..." : "Generate Trip Options"}
      </button>
      {ready && warnings.length > 0 && !isGenerating ? (
        <p className="mt-2 text-xs font-semibold text-[#9a6a10]">⚠ {warnings.length} {warnings.length === 1 ? "thing" : "things"} to check before planning</p>
      ) : null}
      {errorMessage ? (
        <p className="mt-3 max-w-sm text-sm font-semibold text-[#a34532]" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
