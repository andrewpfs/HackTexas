"use client";
import { CityInput } from "../../../components/city-input";


import { DateRangePicker } from "../../../components/date-range-picker";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Trip } from "@/lib/trip-types";
import { forgetTravelerId } from "@/lib/traveler-identity";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

export function EditTripForm({ trip }: { trip: Trip }) {
  const [destination, setDestination] = useState(trip.destination || "");
  const router = useRouter();
  const { browserReady, travelerId } = useTravelerIdentity(trip.id);
  const host = trip.travelers.find((traveler) => traveler.isHost);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    if (!travelerId || isDeleting) return;
    const tripName = trip.name || (trip.destination ? `${trip.destination} Trip` : "this trip");
    if (!window.confirm(`Delete "${tripName}" for everyone? Every traveler loses access, and this can't be undone.`)) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/trips/${trip.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostTravelerId: travelerId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setDeleteError(data.error || "We could not delete the trip."); return; }
      forgetTravelerId(trip.id);
      router.push("/");
    } catch { setDeleteError("We could not delete the trip. Please try again."); }
    finally { setIsDeleting(false); }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!travelerId || isSaving) return;
    setIsSaving(true);
    setErrors([]);
    const formData = new FormData(event.currentTarget);
    const body = {
      hostTravelerId: travelerId,
      name: formData.get("name"),
      prompt: formData.get("prompt"),
      destination: formData.get("destination"),
      earliestPossibleDate: formData.get("earliestPossibleDate"),
      latestPossibleDate: formData.get("latestPossibleDate"),
      preferredDurationDays: formData.get("preferredDurationDays"),
      expectedTravelerCount: formData.get("expectedTravelerCount"),
    };
    try {
      const response = await fetch(`/api/trips/${trip.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { setErrors(data.errors || [data.error || "We could not update the trip."]); return; }
      const query = data.affectedTravelerCount > 0 ? `?availabilityUpdated=${data.affectedTravelerCount}` : "?tripUpdated=1";
      router.push(`/trip/${trip.id}${query}`);
      router.refresh();
    } catch { setErrors(["We could not update the trip. Please try again."]); }
    finally { setIsSaving(false); }
  }

  if (!browserReady) return <div className="mt-8 rounded-3xl bg-white p-7">Checking host access...</div>;
  if (!host || travelerId !== host.id) return <section className="mt-8 rounded-3xl bg-white p-7"><h2 className="text-2xl font-bold">Host Access Only</h2><p className="mt-3 text-[#66757d]">This browser is not associated with the host traveler.</p><Link className="button-secondary mt-6" href={`/trip/${trip.id}`}>Back to Trip</Link></section>;

  return <><form className="mt-8 rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-9" onSubmit={handleSubmit}>
    <div><label className="form-label" htmlFor="name">Trip Name (optional)</label><input className="form-control" defaultValue={trip.name || ""} id="name" name="name" placeholder="example: Our Tokyo Adventure" /></div>
    <div className="mt-6"><label className="form-label" htmlFor="prompt">Trip Idea / Brief</label><textarea className="form-control min-h-32" defaultValue={trip.prompt} id="prompt" name="prompt" required /></div>
    <div className="mt-6"><label className="form-label" htmlFor="destination">Destination (optional)</label><CityInput id="destination" name="destination" onChange={setDestination} placeholder="example: Tokyo, Japan" value={destination} /></div>
    <fieldset className="ticket-card mt-7 p-5 sm:p-6"><legend className="px-2 text-sm font-bold uppercase tracking-[0.14em]">Trip Window</legend><p className="mt-1 text-sm text-[#66757d]">Dates outside a new window will be removed from traveler availability and affected travelers will need to resubmit.</p><div className="mt-4"><DateRangePicker endName="latestPossibleDate" initialEnd={trip.latestPossibleDate} initialStart={trip.earliestPossibleDate} startName="earliestPossibleDate" /></div></fieldset>
    <div className="mt-6 grid gap-5 sm:grid-cols-2"><div><label className="form-label" htmlFor="duration">Preferred Duration, In Days (optional)</label><div className="unit-control"><input defaultValue={trip.preferredDurationDays} id="duration" max="365" min="1" name="preferredDurationDays" placeholder="example: 4" type="number" /><span>days</span></div></div><div><label className="form-label" htmlFor="travelers">Expected Number Of Travelers (optional)</label><div className="unit-control"><input defaultValue={trip.expectedTravelerCount} id="travelers" max="100" min="1" name="expectedTravelerCount" placeholder="example: 4" type="number" /><span>people</span></div></div></div>
    {errors.length > 0 ? <div className="mt-6 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#a34532]" role="alert"><ul className="list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
    <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button className="button-primary" disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Save Trip Details"}</button><Link className="button-secondary" href={`/trip/${trip.id}`}>Cancel</Link></div>
  </form>
  <section className="mt-6 rounded-3xl border border-[#e4664f]/30 bg-white p-6 sm:p-9">
    <h2 className="text-xl font-bold text-[#a34532]">Delete Trip</h2>
    <p className="mt-2 text-sm leading-6 text-[#66757d]">Removes the trip, its itinerary, chat, and bookings for every traveler. This can&apos;t be undone.</p>
    {deleteError ? <p className="mt-3 text-sm font-semibold text-[#a34532]" role="alert">{deleteError}</p> : null}
    <button className="mt-5 rounded-full border border-[#a34532] px-5 py-3 font-bold text-[#a34532] transition hover:bg-[#fff0ec] disabled:opacity-50" disabled={isDeleting} onClick={handleDelete} type="button">{isDeleting ? "Deleting..." : "Delete This Trip"}</button>
  </section></>;
}
