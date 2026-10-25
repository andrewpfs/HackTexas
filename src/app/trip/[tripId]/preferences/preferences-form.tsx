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
import { maximumActivityDetailsLength, maximumNotesLength } from "@/lib/trip-validation";
import { combinedPreferenceText } from "@/lib/preference-text";
import { CityInput } from "../../../components/city-input";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type PreferencesFormProps = { tripId: string; inviteCode: string };
type TravelerResponse = {
  error?: string;
  errors?: string[];
  traveler?: { id: string; name: string; availabilityComplete?: boolean; preferences?: TravelerPreferences; departureLocation?: string };
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
  activityDetails: string;
  lodgingAmenities: LodgingAmenity[];
  destinationPreferences: string;
  notes: string;
};

const steps = ["Your Route", "Your Budget", "Trip Length", "Activities", "Lodging", "Anything Else"];
const priceLevels = [{ value: "1", label: "$", hint: "Budget" }, { value: "2", label: "$$", hint: "Moderate" }, { value: "3", label: "$$$", hint: "Upscale" }, { value: "4", label: "$$$$", hint: "Luxury" }];
const lodgingTypeHints: Record<string, string> = { Hotel: "Front desk, daily cleaning", "Airbnb / vacation rental": "A whole place to share", Hostel: "Social and low cost", Resort: "Everything on site", "No preference": "Happy with any of these", "No need": "I already have a place to stay" };
const activityIcons: Record<ActivityInterest, string> = {
  Food: "🍜", Sightseeing: "📸", Shopping: "🛍️", "Museums & Culture": "🏛️",
  Outdoors: "🥾", Nightlife: "🌙", Relaxation: "🌴", "Theme Parks": "🎢", Sports: "🏟️",
};
const emptyValues: FormValues = {
  departureLocation: "", maximumBudget: "", foodBudgetPerDay: "", lodgingBudgetPerNight: "",
  activitiesBudget: "", preferredDurationDays: "", activityInterests: [], lodgingType: "",
  groupLodgingPreference: "", hotelStars: "", activityDetails: "", lodgingAmenities: [], destinationPreferences: "", notes: "",
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
    hotelStars: preferences.hotelStars ? String(Math.min(4, preferences.hotelStars)) : "",
    activityDetails: preferences.activityDetails || "",
    lodgingAmenities: preferences.lodgingAmenities,
    destinationPreferences: "",
    notes: combinedPreferenceText(preferences),
  };
}

function MoneyInput(props: {
  example?: string; id: string; label: string; value: string; required?: boolean; onChange: (value: string) => void }) {
  return <div><label className="form-label" htmlFor={props.id}>{props.label}</label><div className="money-control"><span aria-hidden="true">$</span><input id={props.id} min="0.01" placeholder={props.example ? `example: ${props.example}` : undefined} onChange={(event) => props.onChange(event.target.value)} required={props.required} step="0.01" type="number" value={props.value} /><span>USD</span></div></div>;
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
  const [cityPicked, setCityPicked] = useState(true);

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
  function validateStep(step: number) {
    if (step === 0 && values.departureLocation.trim() === "") return "Where you are traveling from is required.";
    if (step === 0 && !cityPicked) return "Pick a city from the list.";
    if (step === 1 && values.maximumBudget === "") return "Overall trip budget is required.";
    if (step === 2 && values.preferredDurationDays === "") return "Preferred trip length is required.";
    if (step === 3 && values.activityInterests.length === 0) return "Choose at least one activity.";
    if (step === 4 && values.lodgingType === "") return "Choose a lodging option.";
    if (step === 4 && values.lodgingType !== "No need" && values.groupLodgingPreference === "") return "Choose how you want to stay with the group.";
    return "";
  }
  function goToStep(target: number) {
    if (target <= currentStep) { setCurrentStep(target); setSaveErrors([]); return; }
    for (let step = currentStep; step < target; step += 1) {
      const problem = validateStep(step);
      if (problem) { setCurrentStep(step); setSaveErrors([problem]); return; }
    }
    setSaveErrors([]);
    setCurrentStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function nextStep() {
    const error = validateStep(currentStep);
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
      // Go straight on to availability when it is still missing.
      router.push(data.traveler.availabilityComplete ? `/trip/${tripId}` : `/trip/${tripId}/availability`);
      router.refresh();
    } catch {
      setSaveErrors(["We could not save your preferences. Please try again."]);
    } finally { setIsSaving(false); }
  }

  if (!browserReady || (travelerId && isLoading)) return <div className="mt-8 rounded-3xl bg-white p-7">Loading your preferences...</div>;
  if (!travelerId || missingIdentity) return <section className="mt-8 rounded-3xl bg-white p-7"><h2 className="text-2xl font-bold">Join This Trip In This Browser First.</h2><div className="mt-6 flex flex-wrap gap-3"><Link className="button-primary" href={`/join?trip=${inviteCode}`}>Open Invite</Link><Link className="button-secondary" href={`/trip/${tripId}`}>Back</Link></div></section>;
  if (loadError) return <p className="mt-8 rounded-2xl bg-[#fff0ec] p-4 font-semibold text-[#a34532]" role="alert">{loadError}</p>;

  return <form className="mt-8" onSubmit={handleSubmit}>
    <section className="rounded-3xl border border-[#172733]/8 bg-white p-5 sm:p-8"><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">{travelerName}&apos;s preferences</p><h2 className="mt-2 text-2xl font-bold">{steps[currentStep]}</h2></div><p className="text-sm font-bold text-[#66757d]">{currentStep + 1} / {steps.length}</p></div><ol className="mt-5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Questionnaire progress">{steps.map((step, index) => <li key={step}><button aria-current={index === currentStep ? "step" : undefined} className="group block w-full text-left" onClick={() => goToStep(index)} type="button"><div className={`h-2 rounded-full transition ${index <= currentStep ? "bg-[#e4664f]" : "bg-[#e3e5e2] group-hover:bg-[#f1a690]"}`} /><span className={`mt-2 hidden text-xs font-bold sm:block ${index === currentStep ? "text-[#e4664f]" : "text-[#8a9599]"}`}>{step}</span><span className="sr-only sm:hidden">{step}</span></button></li>)}</ol></section>
    <section className="mt-5 min-h-[25rem] rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-9">
      {currentStep === 0 ? <div><p className="eyebrow">Your Route</p><h3 className="mt-2 text-2xl font-bold">Where Are You Traveling From?</h3><p className="mt-2 text-[#718087]">Everyone can start in a different city and meet at the destination.</p><div className="mt-7 max-w-lg"><label className="form-label" htmlFor="departure-location">Departure City</label><CityInput id="departure-location" onChange={(value) => { updateText("departureLocation", value); setCityPicked(false); }} onPick={() => setCityPicked(true)} placeholder="example: Austin, Texas" required value={values.departureLocation} /><p className="mt-2 text-sm text-[#7a878d]">Start typing, then choose your city from the list.</p></div></div> : null}
      {currentStep === 1 ? <div><p className="eyebrow">USD Budget</p><h3 className="mt-2 text-2xl font-bold">What Feels Comfortable?</h3><p className="mt-2 text-[#718087]">All amounts are per traveler and use US dollars.</p><div className="mt-7 grid gap-5 sm:grid-cols-2"><MoneyInput example="1500" id="maximum-budget" label="Overall Trip Budget" onChange={(value) => updateText("maximumBudget", value)} required value={values.maximumBudget} /></div></div> : null}
      {currentStep === 2 ? <div><p className="eyebrow">Trip Length</p><h3 className="mt-2 text-2xl font-bold">How Many Days Would You Prefer?</h3><div className="mt-7 max-w-xs"><label className="form-label" htmlFor="preferred-duration">Preferred Trip Length (In Days)</label><div className="unit-control"><input id="preferred-duration" max="365" min="1" onChange={(event) => updateText("preferredDurationDays", event.target.value)} placeholder="example: 4" required step="1" type="number" value={values.preferredDurationDays} /><span>Days</span></div></div></div> : null}
      {currentStep === 3 ? <div><p className="eyebrow">Activities</p><h3 className="mt-2 text-2xl font-bold">Which Activities Interest You?</h3><p className="mt-2 text-[#718087]">Pick everything you&apos;d enjoy on this trip. Choose at least one.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{activityInterestOptions.map((activity) => <label className={`activity-choice ${values.activityInterests.includes(activity) ? "activity-choice-selected" : ""}`} key={activity}><input className="sr-only" checked={values.activityInterests.includes(activity)} onChange={() => toggleActivity(activity)} type="checkbox" /><span aria-hidden="true">{activityIcons[activity]}</span><span>{activity}</span></label>)}</div><div className="mt-7"><label className="form-label" htmlFor="activity-details">Any Details? (Specify)</label><textarea className="form-control min-h-24 resize-y" id="activity-details" maxLength={maximumActivityDetailsLength} onChange={(event) => updateText("activityDetails", event.target.value)} placeholder="example: A cooking class would be amazing, and I'd skip anything with long lines" value={values.activityDetails} /><p className="mt-2 text-right text-xs text-[#889398]">{values.activityDetails.length}/{maximumActivityDetailsLength}</p></div></div> : null}
      {currentStep === 4 ? <div><p className="eyebrow">Lodging</p><h3 className="mt-2 text-2xl font-bold">Where Do You Want To Stay?</h3><p className="mt-2 text-[#718087]">Pick one. If you need a place to stay, we&apos;ll ask a few more questions.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Lodging type">{lodgingTypeOptions.map((option) => <label className={`cursor-pointer rounded-2xl border-2 p-4 transition ${values.lodgingType === option ? "border-[#173f50] bg-[#173f50] text-white" : "border-[#d5d9d7] hover:border-[#173f50]/40"}`} key={option}><input checked={values.lodgingType === option} className="sr-only" name="lodging-type" onChange={() => updateText("lodgingType", option)} type="radio" /><span className="block font-bold">{option}</span><span className={`mt-1 block text-sm ${values.lodgingType === option ? "text-white/75" : "text-[#718087]"}`}>{lodgingTypeHints[option]}</span></label>)}</div>
        {values.lodgingType !== "" && values.lodgingType !== "No need" ? <div className="mt-8 space-y-7 border-t border-dashed border-[#173f50]/20 pt-7"><div><label className="form-label" htmlFor="group-lodging">Group Lodging Preference</label><select className="form-control max-w-md" id="group-lodging" onChange={(event) => updateText("groupLodgingPreference", event.target.value)} required value={values.groupLodgingPreference}><option value="">Choose one</option>{groupLodgingPreferenceOptions.map((option) => <option key={option}>{option}</option>)}</select></div><fieldset><legend className="form-label">Price Level</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{priceLevels.map((level) => <label className={`cursor-pointer rounded-2xl border-2 p-3 text-center transition ${values.hotelStars === level.value ? "border-[#e4664f] bg-[#fff4ef]" : "border-[#d5d9d7] hover:border-[#e4664f]/40"}`} key={level.value}><input checked={values.hotelStars === level.value} className="sr-only" name="price-level" onChange={() => updateText("hotelStars", values.hotelStars === level.value ? "" : level.value)} type="radio" /><span className="block text-lg font-extrabold text-[#173f50]">{level.label}</span><span className="block text-xs text-[#718087]">{level.hint}</span></label>)}</div></fieldset><fieldset><legend className="form-label">Amenities</legend><div className="grid gap-3 sm:grid-cols-2">{lodgingAmenityOptions.map((amenity) => <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#d5d9d7] p-4 text-sm font-semibold" key={amenity}><input checked={values.lodgingAmenities.includes(amenity)} className="h-4 w-4 accent-[#e4664f]" onChange={() => toggleAmenity(amenity)} type="checkbox" />{amenity}</label>)}</div></fieldset></div> : null}</div> : null}
      {currentStep === 5 ? <div><p className="eyebrow">Almost Done</p><h3 className="mt-2 text-2xl font-bold"><label htmlFor="notes">Any Places, Preferences, Or Constraints We Should Know About?</label></h3><p className="mt-2 text-[#718087]">Tell us about neighborhoods, cities, must-do places, things to avoid, dietary needs, pacing requests, or anything else.</p><textarea className="form-control mt-7 min-h-40 resize-y" id="notes" maxLength={maximumNotesLength} onChange={(event) => updateText("notes", event.target.value)} placeholder="A quiet neighborhood, one free afternoon, or a place you cannot miss?" value={values.notes} /><p className="mt-2 text-right text-xs text-[#889398]">{values.notes.length}/{maximumNotesLength}</p></div> : null}
      {saveErrors.length > 0 ? <div className="mt-6 rounded-2xl bg-[#fff0ec] p-4 text-sm font-semibold text-[#a34532]" role="alert"><ul className="list-disc space-y-1 pl-5">{saveErrors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
    </section>
    <div className="sticky bottom-0 mt-5 flex flex-col-reverse gap-3 rounded-3xl border border-[#172733]/10 bg-[#f8f6f1]/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"><div>{currentStep > 0 ? <button className="button-secondary w-full sm:w-auto" onClick={() => { setCurrentStep(currentStep - 1); setSaveErrors([]); }} type="button">← Back</button> : <Link className="button-secondary w-full sm:w-auto" href={`/trip/${tripId}`}>Cancel</Link>}</div>{currentStep < steps.length - 1 ? <button className="button-primary w-full sm:w-auto" key="next" onClick={nextStep} type="button">Next →</button> : <button className="button-primary w-full sm:w-auto" disabled={isSaving} key="save" type="submit">{isSaving ? "Saving..." : "Save & Finish"}</button>}</div>
  </form>;
}
