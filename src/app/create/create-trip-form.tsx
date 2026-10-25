"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { rememberTravelerId } from "@/lib/traveler-identity";
import { CityInput } from "../components/city-input";
import { DateRangePicker } from "../components/date-range-picker";

type CreateTripResponse = {
  error?: string;
  trip?: { id: string; inviteCode: string; hostTravelerId: string };
};

export function CreateTripForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [origin, setOrigin] = useState("");

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
        <input className="form-control" id="host-name" name="hostName" placeholder="example: Jay" required type="text" />
      </div>
      <div className="mt-7">
        <label className="form-label" htmlFor="trip-name">Trip name <span className="font-normal text-[#879196]">(optional)</span></label>
        <input className="form-control" id="trip-name" name="name" placeholder="example: Tin&apos;tastic Tokyo Trip" type="text" />
        <p className="mt-2 text-sm text-[#7a878d]">Leave blank and we will use the destination or “Group Trip.”</p>
      </div>
      <div className="mt-7">
        <label className="form-label" htmlFor="trip-idea">Trip idea</label>
        <textarea className="form-control min-h-32 resize-y" id="trip-idea" name="prompt" placeholder="example: Four friends from Austin want to travel somewhere during winter break for about five days." required />
        <p className="mt-2 text-sm text-[#7a878d]">A sentence or two is plenty.</p>
      </div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="origin">Where are you traveling from?</label>
          <CityInput id="origin" name="origin" onChange={setOrigin} placeholder="example: Austin, Texas" required value={origin} />
        </div>
        <div>
          <label className="form-label" htmlFor="destination">Destination <span className="font-normal text-[#879196]">(optional)</span></label>
          <input className="form-control" id="destination" name="destination" placeholder="example: Tokyo, Japan" type="text" />
        </div>
      </div>
      <fieldset className="ticket-card mt-7 p-5 sm:p-6">
        <legend className="px-2 text-sm font-bold uppercase tracking-[0.14em] text-[#173f50]">Trip Window</legend>
        <p className="mt-1 mb-4 text-sm text-[#66757d]">Pick the earliest and latest days the group could travel.</p>
        <DateRangePicker endName="latestPossibleDate" startName="earliestPossibleDate" />
      </fieldset>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="duration">Preferred duration, in days <span className="font-normal text-[#879196]">(optional)</span></label>
          <div className="unit-control"><input id="duration" max="365" min="1" name="preferredDurationDays" placeholder="example: 4" type="number" /><span>days</span></div>
        </div>
        <div>
          <label className="form-label" htmlFor="travelers">Expected number of travelers <span className="font-normal text-[#879196]">(optional)</span></label>
          <div className="unit-control"><input id="travelers" max="100" min="1" name="expectedTravelerCount" placeholder="example: 4" type="number" /><span>people</span></div>
        </div>
      </div>
      <div className="mt-9 border-t border-[#172733]/10 pt-7">
        {errorMessage && <p className="mb-4 rounded-2xl bg-[#fbe4d9] p-4 text-sm font-semibold text-[#8f4d3c]" role="alert">{errorMessage}</p>}
        <button className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating trip..." : "Create Trip"}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
        <p className="mt-3 text-xs text-[#889398]">You will get a shareable invite code as soon as the trip is created.</p>
      </div>
    </form>
  );
}
