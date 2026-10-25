import test from "node:test";
import assert from "node:assert/strict";
import { searchCities, verifyCity } from "../src/lib/city-search";
import { findActivityImage } from "../src/lib/place-images";
import {
  getEarliestAllowedDate,
  validateCreateTripInput,
  validateTravelerAvailability,
  validateTravelerPreferences,
} from "../src/lib/trip-validation";

const basePreferences = {
  maximumBudget: 1500,
  preferredDurationDays: 4,
  activityInterests: ["Food"],
  lodgingType: "Hotel",
  groupLodgingPreference: "Stay with the group",
};

function photon(features: { name: string; state?: string; country: string }[]) {
  return (async () => new Response(JSON.stringify({ features: features.map((properties) => ({ properties })) }), { status: 200 })) as unknown as typeof fetch;
}

test("people who need no lodging skip the follow-up lodging answers", () => {
  const result = validateTravelerPreferences({ ...basePreferences, lodgingType: "No need", groupLodgingPreference: "", hotelStars: 3, lodgingAmenities: ["Pool"] });
  assert.ok(result.valid);
  if (!result.valid) return;
  assert.equal(result.data.groupLodgingPreference, "No preference");
  assert.equal(result.data.hotelStars, undefined);
  assert.deepEqual(result.data.lodgingAmenities, []);
});

test("lodging price level runs from $ to $$$$ and activity details are length-limited", () => {
  assert.ok(validateTravelerPreferences({ ...basePreferences, hotelStars: 4 }).valid);
  assert.equal(validateTravelerPreferences({ ...basePreferences, hotelStars: 5 }).valid, false);
  assert.equal(validateTravelerPreferences({ ...basePreferences, activityDetails: "x".repeat(301) }).valid, false);

  const result = validateTravelerPreferences({ ...basePreferences, activityDetails: "  A cooking class  " });
  assert.ok(result.valid && result.data.activityDetails === "A cooking class");
});

test("a trip window that already started in the past is rejected", () => {
  const body = { hostName: "Jay", prompt: "Trip", origin: "Austin, Texas", earliestPossibleDate: "2020-01-01", latestPossibleDate: "2020-01-05" };
  const past = validateCreateTripInput(body);
  assert.equal(past.valid, false);

  const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const later = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  assert.ok(validateCreateTripInput({ ...body, earliestPossibleDate: tomorrow, latestPossibleDate: later }).valid);
  assert.equal(getEarliestAllowedDate(new Date("2026-10-24T12:00:00Z")), "2026-10-23");
});

test("availability cannot include days that have passed", () => {
  const result = validateTravelerAvailability({ availableDates: ["2020-01-02"] }, "2020-01-01", "2020-01-05");
  assert.equal(result.valid, false);
});

test("city search returns readable, de-duplicated places and checks typed cities", async () => {
  const fetchImpl = photon([
    { name: "Austin", state: "Texas", country: "United States" },
    { name: "Austin", state: "Texas", country: "United States" },
    { name: "Austin", state: "Quebec", country: "Canada" },
  ]);
  assert.deepEqual(await searchCities("austin", fetchImpl), ["Austin, Texas", "Austin, Quebec, Canada"]);
  assert.deepEqual(await searchCities("a", fetchImpl), []);

  assert.equal(await verifyCity("Austin, Texas", fetchImpl), "valid");
  assert.equal(await verifyCity("Austin, Narnia", fetchImpl), "invalid");
  const offline = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  assert.equal(await verifyCity("Austin, Texas", offline), "unknown");
});

test("stop photos are only used when the page matches the stop", async () => {
  const wikipedia = (title: string) =>
    (async () => new Response(JSON.stringify({ query: { pages: { 1: { title, thumbnail: { source: "https://img.example/x.jpg" } } } } }), { status: 200 })) as unknown as typeof fetch;

  assert.equal(await findActivityImage("Senso-ji Temple visit", "Tokyo", wikipedia("Sensō-ji Temple")), "https://img.example/x.jpg");
  assert.equal(await findActivityImage("Easy park unwind", "Austin", wikipedia("Austin, Texas")), null);
  assert.equal(await findActivityImage("Welcome food tour", "Tokyo", wikipedia("Sensō-ji"), "Senso-ji"), "https://img.example/x.jpg");
});
