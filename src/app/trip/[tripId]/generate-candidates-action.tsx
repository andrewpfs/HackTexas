"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type GenerateCandidatesActionProps = {
  tripId: string;
  ready: boolean;
  candidatesAvailable: boolean;
  itineraryReady: boolean;
};

export function GenerateCandidatesAction({
  tripId,
  ready,
  candidatesAvailable,
  itineraryReady,
}: GenerateCandidatesActionProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  return (
    <div className="lg:text-right">
      <button
        className={`button-primary ${!ready || isGenerating ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={!ready || isGenerating}
        onClick={handleGenerate}
        type="button"
      >
        {isGenerating ? "Generating Options..." : "Generate Trip Options"}
      </button>
      {errorMessage ? (
        <p className="mt-3 max-w-sm text-sm font-semibold text-[#a34532]" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
