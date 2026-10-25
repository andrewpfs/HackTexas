"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  activityInterestOptions,
  groupLodgingPreferenceOptions,
  lodgingAmenityOptions,
  lodgingTypeOptions,
  type ActivityInterest,
  type GroupLodgingPreference,
  type LodgingAmenity,
  type LodgingType,
  type TravelerPreferences,
} from "@/lib/trip-types";
import {
  maximumDestinationPreferencesLength,
  maximumNotesLength,
} from "@/lib/trip-validation";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type PreferencesFormProps = {
  tripId: string;
  inviteCode: string;
};

type TravelerResponse = {
  error?: string;
  errors?: string[];
  traveler?: {
    id: string;
    name: string;
    isHost: boolean;
    preferencesComplete: boolean;
    preferences?: TravelerPreferences;
  };
};

type FormValues = {
  maximumBudget: string;
  foodBudgetPerDay: string;
  lodgingBudgetPerNight: string;
  activitiesBudget: string;
  preferredDurationDays: string;
  activityInterests: ActivityInterest[];
  lodgingType: LodgingType | "";
  groupLodgingPreference: GroupLodgingPreference | "";
  hotelStars: string;
  lodgingAmenities: LodgingAmenity[];
  destinationPreferences: string;
  notes: string;
};

const emptyFormValues: FormValues = {
  maximumBudget: "",
  foodBudgetPerDay: "",
  lodgingBudgetPerNight: "",
  activitiesBudget: "",
  preferredDurationDays: "",
  activityInterests: [],
  lodgingType: "",
  groupLodgingPreference: "",
  hotelStars: "",
  lodgingAmenities: [],
  destinationPreferences: "",
  notes: "",
};

function formValuesFromPreferences(preferences: TravelerPreferences): FormValues {
  return {
    maximumBudget: String(preferences.maximumBudget),
    foodBudgetPerDay: preferences.foodBudgetPerDay ? String(preferences.foodBudgetPerDay) : "",
    lodgingBudgetPerNight: preferences.lodgingBudgetPerNight ? String(preferences.lodgingBudgetPerNight) : "",
    activitiesBudget: preferences.activitiesBudget ? String(preferences.activitiesBudget) : "",
    preferredDurationDays: String(preferences.preferredDurationDays),
    activityInterests: preferences.activityInterests,
    lodgingType: preferences.lodgingType,
    groupLodgingPreference: preferences.groupLodgingPreference,
    hotelStars: preferences.hotelStars ? String(preferences.hotelStars) : "",
    lodgingAmenities: preferences.lodgingAmenities,
    destinationPreferences: preferences.destinationPreferences || "",
    notes: preferences.notes || "",
  };
}

export function PreferencesForm({ tripId, inviteCode }: PreferencesFormProps) {
  const router = useRouter();
  const { browserReady, travelerId } = useTravelerIdentity(tripId);
  const [travelerName, setTravelerName] = useState("");
  const [formValues, setFormValues] = useState<FormValues>(emptyFormValues);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storedTravelerMissing, setStoredTravelerMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!travelerId) {
      return;
    }

    async function loadPreferences() {
      try {
        const response = await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(travelerId as string)}/preferences`,
        );
        const responseData = (await response.json()) as TravelerResponse;

        if (!response.ok || !responseData.traveler) {
          if (response.status === 404) {
            setStoredTravelerMissing(true);
          } else {
            setLoadError(responseData.error || "We could not load your preferences. Please try again.");
          }
          return;
        }

        setTravelerName(responseData.traveler.name);
        if (responseData.traveler.preferences) {
          setFormValues(formValuesFromPreferences(responseData.traveler.preferences));
        }
      } catch {
        setLoadError("We could not load your preferences. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [travelerId, tripId]);

  function updateTextValue(field: keyof FormValues, value: string) {
    setFormValues({ ...formValues, [field]: value });
  }

  function toggleActivity(activity: ActivityInterest) {
    const nextActivities = [...formValues.activityInterests];
    const activityIndex = nextActivities.indexOf(activity);

    if (activityIndex >= 0) {
      nextActivities.splice(activityIndex, 1);
    } else {
      nextActivities.push(activity);
    }

    setFormValues({ ...formValues, activityInterests: nextActivities });
  }

  function toggleAmenity(amenity: LodgingAmenity) {
    const nextAmenities = [...formValues.lodgingAmenities];
    const amenityIndex = nextAmenities.indexOf(amenity);

    if (amenityIndex >= 0) {
      nextAmenities.splice(amenityIndex, 1);
    } else {
      nextAmenities.push(amenity);
    }

    setFormValues({ ...formValues, lodgingAmenities: nextAmenities });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || !travelerId) {
      return;
    }

    setIsSaving(true);
    setSaveErrors([]);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(travelerId)}/preferences`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValues),
        },
      );
      const responseData = (await response.json()) as TravelerResponse;

      if (!response.ok || !responseData.traveler) {
        setSaveErrors(responseData.errors || [responseData.error || "We could not save your preferences. Please try again."]);
        return;
      }

      router.push(`/trip/${tripId}`);
      router.refresh();
    } catch {
      setSaveErrors(["We could not save your preferences. Please try again."]);
    } finally {
      setIsSaving(false);
    }
  }

  if (!browserReady || (travelerId && isLoading)) {
    return (
      <div className="mt-8 rounded-3xl border border-[#172733]/8 bg-white p-7 sm:p-9">
        <p className="font-semibold text-[#607179]">Loading your preferences...</p>
      </div>
    );
  }

  if (!travelerId || storedTravelerMissing) {
    return (
      <section className="mt-8 rounded-3xl border border-[#172733]/8 bg-white p-7 sm:p-9" aria-labelledby="identity-title">
        <p className="eyebrow">Browser traveler identity</p>
        <h2 className="mt-3 text-2xl font-bold" id="identity-title">This browser isn&apos;t associated with a traveler on this trip yet.</h2>
        <p className="mt-3 max-w-2xl leading-7 text-[#66757d]">
          This is only a lightweight browser reminder, not an account. Open the invite and join the trip in this browser to complete your own preferences.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link className="button-primary" href={`/join?trip=${inviteCode}`}>Open invite</Link>
          <Link className="button-secondary" href={`/trip/${tripId}`}>Back to trip</Link>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="mt-8 rounded-3xl border border-[#172733]/8 bg-white p-7 sm:p-9">
        <p className="rounded-2xl bg-[#fff0ec] p-4 font-semibold text-[#a34532]" role="alert">{loadError}</p>
        <Link className="button-secondary mt-6" href={`/trip/${tripId}`}>Back to trip</Link>
      </section>
    );
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="traveler-heading">
        <p className="eyebrow">Your questionnaire</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight" id="traveler-heading">Tell us what works for you, {travelerName}.</h2>
        <p className="mt-2 text-sm leading-6 text-[#718087]">Amounts below are per person and in USD.</p>
      </section>

      <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="budget-heading">
        <p className="eyebrow">1. Budget</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight" id="budget-heading">What feels comfortable?</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="maximum-budget">Maximum trip budget per person (USD)</label>
            <input className="form-control" id="maximum-budget" min="0.01" onChange={(event) => updateTextValue("maximumBudget", event.target.value)} required step="0.01" type="number" value={formValues.maximumBudget} />
          </div>
          <div>
            <label className="form-label" htmlFor="food-budget">Food per day <span className="font-normal text-[#879196]">(optional)</span></label>
            <input className="form-control" id="food-budget" min="0.01" onChange={(event) => updateTextValue("foodBudgetPerDay", event.target.value)} step="0.01" type="number" value={formValues.foodBudgetPerDay} />
          </div>
          <div>
            <label className="form-label" htmlFor="lodging-budget">Lodging per night <span className="font-normal text-[#879196]">(optional)</span></label>
            <input className="form-control" id="lodging-budget" min="0.01" onChange={(event) => updateTextValue("lodgingBudgetPerNight", event.target.value)} step="0.01" type="number" value={formValues.lodgingBudgetPerNight} />
          </div>
          <div>
            <label className="form-label" htmlFor="activities-budget">Activities total <span className="font-normal text-[#879196]">(optional)</span></label>
            <input className="form-control" id="activities-budget" min="0.01" onChange={(event) => updateTextValue("activitiesBudget", event.target.value)} step="0.01" type="number" value={formValues.activitiesBudget} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="duration-heading">
        <p className="eyebrow">2. Trip length</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight" id="duration-heading">How many days would you prefer?</h2>
        <div className="mt-6 max-w-xs">
          <label className="form-label" htmlFor="preferred-duration">Preferred number of days</label>
          <input className="form-control" id="preferred-duration" max="365" min="1" onChange={(event) => updateTextValue("preferredDurationDays", event.target.value)} required step="1" type="number" value={formValues.preferredDurationDays} />
        </div>
      </section>

      <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="activities-heading">
        <p className="eyebrow">3. Activities</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight" id="activities-heading">What do you like doing?</h2>
        <p className="mt-2 text-sm text-[#718087]">Choose at least one.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {activityInterestOptions.map((activity) => (
            <label className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm font-semibold transition ${formValues.activityInterests.includes(activity) ? "border-[#173f50] bg-[#173f50] text-white" : "border-[#d5d9d7] bg-white text-[#53666f] hover:border-[#e4664f]"}`} key={activity}>
              <input className="sr-only" checked={formValues.activityInterests.includes(activity)} onChange={() => toggleActivity(activity)} type="checkbox" />
              {activity}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="lodging-heading">
        <p className="eyebrow">4. Lodging</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight" id="lodging-heading">Where do you want to stay?</h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="lodging-type">Preferred lodging type</label>
            <select className="form-control" id="lodging-type" onChange={(event) => updateTextValue("lodgingType", event.target.value)} required value={formValues.lodgingType}>
              <option value="">Choose one</option>
              {lodgingTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="group-lodging">Group lodging preference</label>
            <select className="form-control" id="group-lodging" onChange={(event) => updateTextValue("groupLodgingPreference", event.target.value)} required value={formValues.groupLodgingPreference}>
              <option value="">Choose one</option>
              {groupLodgingPreferenceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="hotel-stars">Hotel quality <span className="font-normal text-[#879196]">(optional)</span></label>
            <select className="form-control" id="hotel-stars" onChange={(event) => updateTextValue("hotelStars", event.target.value)} value={formValues.hotelStars}>
              <option value="">No preference</option>
              <option value="1">1 star</option>
              <option value="2">2 stars</option>
              <option value="3">3 stars</option>
              <option value="4">4 stars</option>
              <option value="5">5 stars</option>
            </select>
          </div>
        </div>

        <fieldset className="mt-7">
          <legend className="form-label">Amenities <span className="font-normal text-[#879196]">(optional)</span></legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {lodgingAmenityOptions.map((amenity) => (
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#d5d9d7] p-4 text-sm font-semibold text-[#53666f]" key={amenity}>
                <input checked={formValues.lodgingAmenities.includes(amenity)} className="h-4 w-4 accent-[#e4664f]" onChange={() => toggleAmenity(amenity)} type="checkbox" />
                {amenity}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="destination-heading">
        <p className="eyebrow">5. Destination preferences</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight" id="destination-heading">Any places or location details in mind?</h2>
        <label className="form-label mt-6" htmlFor="destination-preferences">Cities, neighborhoods, destinations, or general preferences <span className="font-normal text-[#879196]">(optional)</span></label>
        <textarea className="form-control min-h-32 resize-y" id="destination-preferences" maxLength={maximumDestinationPreferencesLength} onChange={(event) => updateTextValue("destinationPreferences", event.target.value)} placeholder="Tokyo and Kyoto, somewhere warm, or prefer downtown..." value={formValues.destinationPreferences} />
        <p className="mt-2 text-right text-xs text-[#889398]">{formValues.destinationPreferences.length}/{maximumDestinationPreferencesLength}</p>
      </section>

      <section className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8" aria-labelledby="notes-heading">
        <p className="eyebrow">6. Anything else?</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight" id="notes-heading">Share any other constraints or preferences.</h2>
        <label className="form-label mt-6" htmlFor="notes">Notes <span className="font-normal text-[#879196]">(optional)</span></label>
        <textarea className="form-control min-h-32 resize-y" id="notes" maxLength={maximumNotesLength} onChange={(event) => updateTextValue("notes", event.target.value)} placeholder="I don't wake up early, I want one free afternoon, or I don't eat seafood..." value={formValues.notes} />
        <p className="mt-2 text-right text-xs text-[#889398]">{formValues.notes.length}/{maximumNotesLength}</p>
      </section>

      <section className="rounded-3xl bg-[#173f50] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#f3c969]">Next step</p>
        <p className="mt-2 text-lg font-bold">Availability will be completed separately.</p>
        <p className="mt-2 text-sm leading-6 text-white/65">This phase saves preferences only. The manual calendar is intentionally not included yet.</p>

        {saveErrors.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#a34532]" role="alert">
            <p>Please fix the following:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {saveErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button className="button-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">
            {isSaving ? "Saving preferences..." : "Save My Preferences"}
          </button>
          <Link className="text-center text-sm font-bold text-white/75 hover:text-white" href={`/trip/${tripId}`}>Cancel</Link>
        </div>
      </section>
    </form>
  );
}
