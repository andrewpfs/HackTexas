import test from "node:test";
import assert from "node:assert/strict";
import { getChangedStopKeys, needsPlaceLookup } from "../src/lib/itinerary-diff";
import { carryOverPlaces, validateChatInput, validateRevisedDays } from "../src/lib/itinerary-revision";
import { parseMuseRevision } from "../src/lib/muse-itinerary-reviser";
import { MusePlannerError } from "../src/lib/muse-client";
import { addImagesToCandidates, findPlaceImage } from "../src/lib/place-images";
import { estimateTravel, formatMinutes, getStraightLineKm } from "../src/lib/travel-time";
import type { GroupItinerary, ItineraryDay, PlaceSuggestion } from "../src/lib/trip-types";

const place: PlaceSuggestion = {
  name: "Meiji Jingu", rating: 4.7, reviewCount: 54000, price: null, category: "Shinto shrine",
  address: "Tokyo", thumbnail: null, latitude: 35.6764, longitude: 139.6993, mapsUrl: "https://maps.example/1", reviews: [],
};

function makeDays(): ItineraryDay[] {
  return [
    { dayNumber: 1, date: "2026-12-17", title: "Day one", activities: [
      { time: "10:00 AM", title: "Meiji Jingu walk", type: "Outdoors", location: "Shibuya", description: "Walk", placeSearchQuery: "Meiji Jingu Tokyo", place },
      { time: "7:00 PM", title: "Yakitori", type: "Food", location: "Shinjuku", description: "Dinner", placeSearchQuery: "yakitori Shinjuku" },
    ] },
    { dayNumber: 2, date: "2026-12-18", title: "Day two", activities: [
      { time: "9:00 AM", title: "Garden", type: "Outdoors", location: "Shinjuku", description: "Stroll", placeSearchQuery: "Shinjuku Gyoen" },
    ] },
  ];
}

function makeItinerary(): GroupItinerary {
  return {
    id: "i1", basedOnCandidateId: "c1", title: "Tokyo", destination: "Tokyo, Japan", startDate: "2026-12-17", endDate: "2026-12-18",
    summary: "Summary", compromiseExplanation: "Explanation", compromises: [], days: makeDays(), source: "muse", generatedAt: "2026-10-24T00:00:00.000Z",
  };
}

test("unchanged stops keep their real place and new stops need a lookup", () => {
  const revised = makeDays();
  revised[0].activities[1] = { time: "7:00 PM", title: "Teahouse", type: "Food", location: "Shibuya", description: "Tea", placeSearchQuery: "teahouse Shibuya" };

  const merged = carryOverPlaces(makeDays(), revised);
  assert.equal(merged[0].activities[0].place?.name, "Meiji Jingu");
  assert.equal(merged[0].activities[1].place, undefined);
  assert.equal(needsPlaceLookup(merged), true);
  assert.deepEqual(getChangedStopKeys(makeDays(), revised), ["1|7:00 PM|Teahouse"]);
});

test("travel and free-time stops never need a lookup", () => {
  const days = makeDays();
  days[0].activities[1] = { time: "7:00 PM", title: "Flight", type: "Travel", location: "Airport", description: "Fly", placeSearchQuery: "" };
  days[1].activities[0] = { ...days[1].activities[0], place };
  assert.equal(needsPlaceLookup(days), false);
});

test("revised days must keep the trip dates and stay valid", () => {
  const itinerary = makeItinerary();
  const shared = ["2026-12-17", "2026-12-18"];

  assert.equal(validateRevisedDays(itinerary, makeDays(), shared, "c1").valid, true);

  const wrongDates = makeDays();
  wrongDates[1].date = "2026-12-19";
  assert.equal(validateRevisedDays(itinerary, wrongDates, shared, "c1").valid, false);

  const missingDay = makeDays().slice(0, 1);
  assert.equal(validateRevisedDays(itinerary, missingDay, shared, "c1").valid, false);
});

test("chat input is trimmed, length-limited, and needs a traveler", () => {
  const ok = validateChatInput({ travelerId: "t1", text: "  swap this  ", focus: { dayNumber: 1, title: "Walk" } });
  assert.ok(ok.valid && ok.data.text === "swap this" && ok.data.focus?.dayNumber === 1);
  assert.equal(validateChatInput({ travelerId: "t1", text: "   " }).valid, false);
  assert.equal(validateChatInput({ travelerId: "t1", text: "x".repeat(601) }).valid, false);
  assert.equal(validateChatInput({ text: "hi" }).valid, false);
});

test("Muse revision output only changes the plan when it says so", () => {
  const days = makeDays();
  const changed = parseMuseRevision({ reply: "Done.", changed: true, changes: ["Day 1: swapped"], days });
  assert.equal(changed.days?.length, 2);

  const answered = parseMuseRevision({ reply: "Which day?", changed: false, changes: ["ignored"], days });
  assert.equal(answered.days, null);
  assert.deepEqual(answered.changes, []);

  assert.throws(() => parseMuseRevision({ reply: "", changed: false, changes: [], days: [] }), MusePlannerError);
});

test("travel estimates scale with the mode and distance", () => {
  const shrine = { latitude: 35.6764, longitude: 139.6993 };
  const shibuya = { latitude: 35.6595, longitude: 139.7005 };
  const km = getStraightLineKm(shrine, shibuya);
  assert.ok(km > 1.8 && km < 2.1);

  const walk = estimateTravel(shrine, shibuya, "walk").minutes;
  const bike = estimateTravel(shrine, shibuya, "bike").minutes;
  const car = estimateTravel(shrine, shibuya, "car").minutes;
  assert.ok(walk > bike && bike >= 1 && car >= 1);
  assert.equal(estimateTravel(shrine, shrine, "walk").minutes, 1);
  assert.equal(formatMinutes(75), "1 hr 15 min");
});

test("place images come from Wikipedia and failures fall back quietly", async () => {
  const found = (async () =>
    new Response(JSON.stringify({ query: { pages: { 1: { thumbnail: { source: "https://img.example/a.jpg" } } } } }), { status: 200 })) as unknown as typeof fetch;
  assert.equal(await findPlaceImage("Senso-ji", found), "https://img.example/a.jpg");

  const broken = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  assert.equal(await findPlaceImage("Senso-ji", broken), null);
  assert.equal(await findPlaceImage("   ", found), null);

  const withImages = await addImagesToCandidates([{ destination: "Tokyo", heroPlace: "Senso-ji" }], found);
  assert.equal(withImages[0].imageUrl, "https://img.example/a.jpg");
  const withoutImages = await addImagesToCandidates([{ destination: "Tokyo" }], broken);
  assert.equal(withoutImages[0].imageUrl, undefined);
});
