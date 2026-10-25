"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { rememberTravelerId } from "@/lib/traveler-identity";

type CreateTripResponse = {
  error?: string;
  trip?: { id: string; inviteCode: string; hostTravelerId: string };
};

export function CreateTripForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const requestBody = {
      hostName: formData.get("hostName"),
      name: formData.get("name"),
      prompt: formData.get("prompt"),
      origin: formData.get("origin"),
      destination: formData.get("destination"),
      earliestPossibleDate: formData.get("earliestPossibleDate"),
      latestPossibleDate: formData.get("latestPossibleDate"),
      preferredDurationDays: formData.get("preferredDurationDays"),
      expectedTravelerCount: formData.get("expectedTravelerCount"),
    };

    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseBody = (await response.json()) as CreateTripResponse;

      if (!response.ok || !responseBody.trip) {
        setErrorMessage(responseBody.error || "We could not create your trip. Please try again.");
        setIsSubmitting(false);
        return;
      }

      rememberTravelerId(responseBody.trip.id, responseBody.trip.hostTravelerId);
      router.push(`/trip/${responseBody.trip.id}`);
    } catch {
      setErrorMessage("We could not reach the server. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label className="form-label" htmlFor="host-name">Your name</label>
        <input className="form-control" id="host-name" name="hostName" placeholder="Jay" required type="text" />
      </div>
      <div className="mt-7">
        <label className="form-label" htmlFor="trip-name">Trip name <span className="font-normal text-[#879196]">(optional)</span></label>
        <input className="form-control" id="trip-name" name="name" placeholder="Tin&apos;tastic Tokyo Trip" type="text" />
        <p className="mt-2 text-sm text-[#7a878d]">Leave blank and we will use the destination or “Group Trip.”</p>
      </div>
      <div className="mt-7">
        <label className="form-label" htmlFor="trip-idea">Trip idea</label>
        <textarea className="form-control min-h-32 resize-y" id="trip-idea" name="prompt" placeholder="Four friends from Austin want to travel somewhere during winter break for about five days." required />
        <p className="mt-2 text-sm text-[#7a878d]">A sentence or two is plenty.</p>
      </div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="origin">Where are you traveling from?</label>
          <input className="form-control" id="origin" name="origin" placeholder="Austin, Texas" required type="text" />
        </div>
        <div>
          <label className="form-label" htmlFor="destination">Destination <span className="font-normal text-[#879196]">(optional)</span></label>
          <input className="form-control" id="destination" name="destination" placeholder="Tokyo, Japan" type="text" />
        </div>
      </div>
      <fieldset className="ticket-card mt-7 p-5 sm:p-6">
        <legend className="px-2 text-sm font-bold uppercase tracking-[0.14em] text-[#173f50]">📅 Trip Window</legend>
        <p className="mt-1 text-sm text-[#66757d]">Choose the earliest and latest dates the group could consider.</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div>
            <label className="form-label" htmlFor="earliest-date">Earliest date</label>
            <input className="form-control" id="earliest-date" name="earliestPossibleDate" required type="date" />
          </div>
          <span className="hidden pb-3 text-xl text-[#e4664f] sm:block" aria-hidden="true">→</span>
          <div>
            <label className="form-label" htmlFor="latest-date">Latest date</label>
            <input className="form-control" id="latest-date" name="latestPossibleDate" required type="date" />
          </div>
        </div>
      </fieldset>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="duration">Preferred duration <span className="font-normal text-[#879196]">(optional)</span></label>
          <input className="form-control" id="duration" max="365" min="1" name="preferredDurationDays" placeholder="5" type="number" />
        </div>
        <div>
          <label className="form-label" htmlFor="travelers">Expected travelers <span className="font-normal text-[#879196]">(optional)</span></label>
          <input className="form-control" id="travelers" max="100" min="1" name="expectedTravelerCount" placeholder="4" type="number" />
        </div>
      </div>
      <div className="mt-9 border-t border-[#172733]/10 pt-7">
        {errorMessage && <p className="mb-4 rounded-2xl bg-[#fbe4d9] p-4 text-sm font-semibold text-[#8f4d3c]" role="alert">{errorMessage}</p>}
        <button className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating trip..." : "Create Trip"}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
        <p className="mt-3 text-xs text-[#889398]">Your trip will be saved locally and you will receive a shareable invite code.</p>
      </div>
    </form>
  );
}
