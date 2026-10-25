"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CityInput } from "../components/city-input";
import type { JoinTripPreview } from "@/lib/trip-types";
import { maximumTravelerNameLength } from "@/lib/trip-validation";
import { rememberTravelerId } from "@/lib/traveler-identity";

type JoinTripFormProps = {
  initialCode: string;
  initialError: string;
  initialPreview: JoinTripPreview | null;
};

type PreviewResponse = { error?: string; trip?: JoinTripPreview };
type JoinResponse = { error?: string; tripId?: string; travelerId?: string };

function formatDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function JoinTripForm(props: JoinTripFormProps) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState(props.initialCode);
  const [departureCity, setDepartureCity] = useState("");
  const [preview, setPreview] = useState<JoinTripPreview | null>(props.initialPreview);
  const [errorMessage, setErrorMessage] = useState(props.initialError);
  const [isFinding, setIsFinding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleCodeChange(newCode: string) {
    setInviteCode(newCode.toUpperCase());
    setPreview(null);
    setErrorMessage("");
  }

  async function findTrip() {
    const normalizedCode = inviteCode.trim().toUpperCase();
    if (normalizedCode === "") {
      setErrorMessage("Invite code is required.");
      return;
    }

    setIsFinding(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/trips/join?inviteCode=${encodeURIComponent(normalizedCode)}`);
      const responseData = (await response.json()) as PreviewResponse;

      if (!response.ok || !responseData.trip) {
        setPreview(null);
        setErrorMessage(responseData.error || "We couldn't find a trip with that invite code.");
        return;
      }

      setInviteCode(responseData.trip.inviteCode);
      setPreview(responseData.trip);
      window.history.replaceState(null, "", `/join?trip=${responseData.trip.inviteCode}`);
    } catch {
      setErrorMessage("We could not check that invite code. Please try again.");
    } finally {
      setIsFinding(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !preview) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData(event.currentTarget);
    const travelerName = formData.get("travelerName");
    const departureLocation = formData.get("departureLocation");

    try {
      const response = await fetch("/api/trips/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: preview.inviteCode, travelerName, departureLocation }),
      });
      const responseData = (await response.json()) as JoinResponse;

      if (!response.ok || !responseData.tripId || !responseData.travelerId) {
        setErrorMessage(responseData.error || "We could not join the trip. Please try again.");
        return;
      }

      rememberTravelerId(responseData.tripId, responseData.travelerId);
      router.push(`/trip/${responseData.tripId}`);
    } catch {
      setErrorMessage("We could not join the trip. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  let travelerCountText = "";
  if (preview) {
    travelerCountText = `${preview.travelerCount} travelers joined`;
    if (preview.expectedTravelerCount) {
      travelerCountText += ` · ${preview.expectedTravelerCount} expected`;
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label className="form-label" htmlFor="inviteCode">Invite Code</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className="form-control font-mono uppercase tracking-[0.12em]" id="inviteCode" maxLength={20} name="inviteCode" onChange={(event) => handleCodeChange(event.target.value)} placeholder="example: ABC123" type="text" value={inviteCode} />
          <button className="button-secondary shrink-0" disabled={isFinding || isSubmitting} onClick={findTrip} type="button">
            {isFinding ? "Checking..." : "Find trip"}
          </button>
        </div>
      </div>

      {preview ? (
        <section className="mt-6 rounded-2xl border border-[#173f50]/10 bg-[#f7f7f3] p-5" aria-labelledby="trip-preview-title">
          <p className="eyebrow">Your Invitation</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight" id="trip-preview-title">{preview.displayName}</h2>
          <p className="mt-2 text-sm leading-6 text-[#66757d]">{preview.prompt}</p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="font-bold text-[#3b505a]">Host</dt><dd className="mt-1 text-[#718087]">{preview.hostName}</dd></div>
            <div><dt className="font-bold text-[#3b505a]">Destination</dt><dd className="mt-1 text-[#718087]">{preview.destination || "Destination not chosen yet"}</dd></div>
            <div><dt className="font-bold text-[#3b505a]">Possible travel window</dt><dd className="mt-1 text-[#718087]">{formatDate(preview.earliestPossibleDate)} – {formatDate(preview.latestPossibleDate)}</dd></div>
            <div><dt className="font-bold text-[#3b505a]">Preferred duration</dt><dd className="mt-1 text-[#718087]">{preview.preferredDurationDays ? `${preview.preferredDurationDays} days` : "Not specified"}</dd></div>
            <div><dt className="font-bold text-[#3b505a]">Travelers</dt><dd className="mt-1 text-[#718087]">{travelerCountText}</dd></div>
          </dl>
        </section>
      ) : null}

      {preview ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="travelerName">Your Name</label>
            <input className="form-control" disabled={isSubmitting} id="travelerName" maxLength={maximumTravelerNameLength} name="travelerName" placeholder="example: How the group knows you" required type="text" />
          </div>
          <div>
            <label className="form-label" htmlFor="departureLocation">Where Are You Traveling From?</label>
            <CityInput id="departureLocation" name="departureLocation" onChange={setDepartureCity} placeholder="example: Houston, Texas" required value={departureCity} />
          </div>
        </div>
      ) : null}

      {errorMessage ? <p className="mt-4 rounded-xl bg-[#fff0ec] p-3 text-sm font-semibold text-[#a34532]" role="alert">{errorMessage}</p> : null}

      {preview ? (
        <button className="button-primary mt-8 w-full sm:w-auto" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Joining..." : "Join Trip"} <span aria-hidden="true">→</span>
        </button>
      ) : (
        <p className="mt-4 text-sm text-[#718087]">Enter the six-character code from your host to preview the trip.</p>
      )}
    </form>
  );
}
