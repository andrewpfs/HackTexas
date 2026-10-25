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
import { maximumDestinationPreferencesLength, maximumNotesLength } from "@/lib/trip-validation";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type PreferencesFormProps = { tripId: string; inviteCode: string };
type TravelerResponse = {
  error?: string;
  errors?: string[];
  traveler?: { id: string; name: string; preferences?: TravelerPreferences; departureLocation?: string };
};
type FormValues = {
  departureLocation: string;
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

const steps = ["Your Route", "Your Budget", "Trip Length", "Activities", "Lodging", "Destination", "Final Notes"];
const activityIcons: Record<ActivityInterest, string> = {
  Food: "🍜", Sightseeing: "📸", Shopping: "🛍️", "Museums & Culture": "🏛️",
  Outdoors: "🥾", Nightlife: "🌙", Relaxation: "🌴", "Theme Parks": "🎢", Sports: "🏟️",
};
const emptyValues: FormValues = {
  departureLocation: "", maximumBudget: "", foodBudgetPerDay: "", lodgingBudgetPerNight: "",
  activitiesBudget: "", preferredDurationDays: "", activityInterests: [], lodgingType: "",
  groupLodgingPreference: "", hotelStars: "", lodgingAmenities: [], destinationPreferences: "", notes: "",
};

function makeValues(preferences: TravelerPreferences, departureLocation: string): FormValues {
  return {
    departureLocation,
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

function MoneyInput(props: { id: string; label: string; value: string; required?: boolean; onChange: (value: string) => void }) {
  return <div><label className="form-label" htmlFor={props.id}>{props.label}{props.required ? "" : " (optional)"}</label><div className="money-control"><span aria-hidden="true">$</span><input id={props.id} min="0.01" onChange={(event) => props.onChange(event.target.value)} required={props.required} step="0.01" type="number" value={props.value} /><span>USD</span></div></div>;
}

export function PreferencesForm({ tripId, inviteCode }: PreferencesFormProps) {
  const router = useRouter();
  const { browserReady, travelerId } = useTravelerIdentity(tripId);
  const [travelerName, setTravelerName] = useState("");
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [missingIdentity, setMissingIdentity] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!travelerId) return;
    async function loadPreferences() {
      try {
        const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(travelerId as string)}/preferences`);
        const data = (await response.json()) as TravelerResponse;
        if (!response.ok || !data.traveler) {
          if (response.status === 404) setMissingIdentity(true);
          else setLoadError(data.error || "We could not load your preferences.");
          return;
        }
        setTravelerName(data.traveler.name);
        if (data.traveler.preferences) setValues(makeValues(data.traveler.preferences, data.traveler.departureLocation || ""));
        else setValues({ ...emptyValues, departureLocation: data.traveler.departureLocation || "" });
      } catch {
        setLoadError("We could not load your preferences. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    loadPreferences();
  }, [travelerId, tripId]);

  function updateText(field: keyof FormValues, value: string) {
    setValues({ ...values, [field]: value });
    setSaveErrors([]);
  }
  function toggleActivity(activity: ActivityInterest) {
    const next = [...values.activityInterests];
    const index = next.indexOf(activity);
    if (index >= 0) next.splice(index, 1); else next.push(activity);
    setValues({ ...values, activityInterests: next });
  }
  function toggleAmenity(amenity: LodgingAmenity) {
    const next = [...values.lodgingAmenities];
    const index = next.indexOf(amenity);
    if (index >= 0) next.splice(index, 1); else next.push(amenity);
    setValues({ ...values, lodgingAmenities: next });
  }
  function nextStep() {
    let error = "";
    if (currentStep === 0 && values.departureLocation.trim() === "") error = "Where you are traveling from is required.";
    if (currentStep === 1 && values.maximumBudget === "") error = "Maximum trip budget is required.";
    if (currentStep === 2 && values.preferredDurationDays === "") error = "Preferred duration is required.";
    if (currentStep === 3 && values.activityInterests.length === 0) error = "Choose at least one activity interest.";
    if (currentStep === 4 && (values.lodgingType === "" || values.groupLodgingPreference === "")) error = "Choose both lodging preferences.";
    if (error) { setSaveErrors([error]); return; }
    setSaveErrors([]);
    setCurrentStep(currentStep + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep !== steps.length - 1 || isSaving || !travelerId) return;
    setIsSaving(true);
    setSaveErrors([]);
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(travelerId)}/preferences`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = (await response.json()) as TravelerResponse;
      if (!response.ok || !data.traveler) { setSaveErrors(data.errors || [data.error || "We could not save your preferences."]); return; }
      router.push(`/trip/${tripId}`);
      router.refresh();
    } catch {
      setSaveErrors(["We could not save your preferences. Please try again."]);
    } finally { setIsSaving(false); }
  }

  if (!browserReady || (travelerId && isLoading)) return <div className="mt-8 rounded-3xl bg-white p-7">Loading your preferences...</div>;
  if (!travelerId || missingIdentity) return <section className="mt-8 rounded-3xl bg-white p-7"><h2 className="text-2xl font-bold">Join this trip in this browser first.</h2><div className="mt-6 flex flex-wrap gap-3"><Link className="button-primary" href={`/join?trip=${inviteCode}`}>Open Invite</Link><Link className="button-secondary" href={`/trip/${tripId}`}>Back</Link></div></section>;
  if (loadError) return <p className="mt-8 rounded-2xl bg-[#fff0ec] p-4 font-semibold text-[#a34532]" role="alert">{loadError}</p>;

  return <form className="mt-8" onSubmit={handleSubmit}>
    <section className="rounded-3xl border border-[#172733]/8 bg-white p-5 sm:p-8"><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">{travelerName}&apos;s preferences</p><h2 className="mt-2 text-2xl font-bold">{steps[currentStep]}</h2></div><p className="text-sm font-bold text-[#66757d]">{currentStep + 1} / {steps.length}</p></div><ol className="mt-5 grid grid-cols-7 gap-1" aria-label="Questionnaire progress">{steps.map((step, index) => <li key={step}><div className={`h-2 rounded-full ${index <= currentStep ? "bg-[#e4664f]" : "bg-[#e3e5e2]"}`} /><span className="sr-only">{step}</span></li>)}</ol></section>
    <section className="mt-5 min-h-[25rem] rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-9">
      {currentStep === 0 ? <div><p className="eyebrow">Your route</p><h3 className="mt-2 text-2xl font-bold">Where are you traveling from?</h3><p className="mt-2 text-[#718087]">Everyone can start in a different city and meet at the destination.</p><div className="mt-7 max-w-lg"><label className="form-label" htmlFor="departure-location">Departure city</label><input className="form-control" id="departure-location" onChange={(event) => updateText("departureLocation", event.target.value)} placeholder="Austin, Texas" required value={values.departureLocation} /></div></div> : null}
      {currentStep === 1 ? <div><p className="eyebrow">USD budget</p><h3 className="mt-2 text-2xl font-bold">What feels comfortable?</h3><p className="mt-2 text-[#718087]">All amounts are per traveler and use US dollars.</p><div className="mt-7 grid gap-5 sm:grid-cols-2"><MoneyInput id="maximum-budget" label="Overall trip budget" onChange={(value) => updateText("maximumBudget", value)} required value={values.maximumBudget} /><MoneyInput id="food-budget" label="Food per day" onChange={(value) => updateText("foodBudgetPerDay", value)} value={values.foodBudgetPerDay} /><MoneyInput id="lodging-budget" label="Lodging per night" onChange={(value) => updateText("lodgingBudgetPerNight", value)} value={values.lodgingBudgetPerNight} /><MoneyInput id="activities-budget" label="Activities total" onChange={(value) => updateText("activitiesBudget", value)} value={values.activitiesBudget} /></div></div> : null}
      {currentStep === 2 ? <div><p className="eyebrow">Trip length</p><h3 className="mt-2 text-2xl font-bold">How many days would you prefer?</h3><div className="mt-7 max-w-xs"><label className="form-label" htmlFor="preferred-duration">Preferred number of days</label><input className="form-control" id="preferred-duration" max="365" min="1" onChange={(event) => updateText("preferredDurationDays", event.target.value)} required step="1" type="number" value={values.preferredDurationDays} /></div></div> : null}
      {currentStep === 3 ? <div><p className="eyebrow">Activities</p><h3 className="mt-2 text-2xl font-bold">What do you like doing?</h3><p className="mt-2 text-[#718087]">Choose at least one.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{activityInterestOptions.map((activity) => <label className={`activity-choice ${values.activityInterests.includes(activity) ? "activity-choice-selected" : ""}`} key={activity}><input className="sr-only" checked={values.activityInterests.includes(activity)} onChange={() => toggleActivity(activity)} type="checkbox" /><span aria-hidden="true">{activityIcons[activity]}</span><span>{activity}</span></label>)}</div></div> : null}
      {currentStep === 4 ? <div><p className="eyebrow">Lodging</p><h3 className="mt-2 text-2xl font-bold">Where do you want to stay?</h3><div className="mt-7 grid gap-5 sm:grid-cols-2"><div><label className="form-label" htmlFor="lodging-type">Preferred lodging type</label><select className="form-control" id="lodging-type" onChange={(event) => updateText("lodgingType", event.target.value)} required value={values.lodgingType}><option value="">Choose one</option>{lodgingTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></div><div><label className="form-label" htmlFor="group-lodging">Group lodging preference</label><select className="form-control" id="group-lodging" onChange={(event) => updateText("groupLodgingPreference", event.target.value)} required value={values.groupLodgingPreference}><option value="">Choose one</option>{groupLodgingPreferenceOptions.map((option) => <option key={option}>{option}</option>)}</select></div><div><label className="form-label" htmlFor="hotel-stars">Hotel quality (optional)</label><select className="form-control" id="hotel-stars" onChange={(event) => updateText("hotelStars", event.target.value)} value={values.hotelStars}><option value="">No preference</option>{[1, 2, 3, 4, 5].map((stars) => <option key={stars} value={stars}>{stars} star{stars === 1 ? "" : "s"}</option>)}</select></div></div><fieldset className="mt-7"><legend className="form-label">Amenities (optional)</legend><div className="grid gap-3 sm:grid-cols-2">{lodgingAmenityOptions.map((amenity) => <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#d5d9d7] p-4 text-sm font-semibold" key={amenity}><input checked={values.lodgingAmenities.includes(amenity)} className="h-4 w-4 accent-[#e4664f]" onChange={() => toggleAmenity(amenity)} type="checkbox" />{amenity}</label>)}</div></fieldset></div> : null}
      {currentStep === 5 ? <div><p className="eyebrow">Destination preferences</p><h3 className="mt-2 text-2xl font-bold">Any places or location details in mind?</h3><label className="form-label mt-7" htmlFor="destination-preferences">Cities, neighborhoods, or general preferences (optional)</label><textarea className="form-control min-h-40 resize-y" id="destination-preferences" maxLength={maximumDestinationPreferencesLength} onChange={(event) => updateText("destinationPreferences", event.target.value)} placeholder="Tokyo and Kyoto, somewhere warm, or prefer downtown..." value={values.destinationPreferences} /><p className="mt-2 text-right text-xs text-[#889398]">{values.destinationPreferences.length}/{maximumDestinationPreferencesLength}</p></div> : null}
      {currentStep === 6 ? <div><p className="eyebrow">Final notes</p><h3 className="mt-2 text-2xl font-bold">Anything else the group should know?</h3><label className="form-label mt-7" htmlFor="notes">Constraints or preferences (optional)</label><textarea className="form-control min-h-40 resize-y" id="notes" maxLength={maximumNotesLength} onChange={(event) => updateText("notes", event.target.value)} placeholder="I want one free afternoon, or I do not eat seafood..." value={values.notes} /><p className="mt-2 text-right text-xs text-[#889398]">{values.notes.length}/{maximumNotesLength}</p></div> : null}
      {saveErrors.length > 0 ? <div className="mt-6 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#a34532]" role="alert"><ul className="list-disc space-y-1 pl-5">{saveErrors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
    </section>
    <div className="sticky bottom-0 mt-5 flex flex-col-reverse gap-3 rounded-3xl border border-[#172733]/10 bg-[#f8f6f1]/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"><div>{currentStep > 0 ? <button className="button-secondary w-full sm:w-auto" onClick={() => { setCurrentStep(currentStep - 1); setSaveErrors([]); }} type="button">← Back</button> : <Link className="button-secondary w-full sm:w-auto" href={`/trip/${tripId}`}>Cancel</Link>}</div>{currentStep < steps.length - 1 ? <button className="button-primary w-full sm:w-auto" onClick={nextStep} type="button">Next →</button> : <button className="button-primary w-full sm:w-auto" disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Save & Finish"}</button>}</div>
  </form>;
}
