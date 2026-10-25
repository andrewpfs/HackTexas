import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { adjacentTravelWarnings, applyManualEdit, clockMinutes, isLongTravel, prepareManualEdit, type ManualStopEdit } from "../src/lib/manual-itinerary";
import { readManualPreview, signManualPreview } from "../src/lib/manual-edit-preview";
import { discoverHotels, expediaHotelOptions, normalizeExpediaUrl } from "../src/lib/hotel-discovery";
import { hotelPage, hotelProviderLabel, hotelPriceTotal } from "../src/lib/hotel-display";
import { inviteCopyText } from "../src/lib/invite-copy";
import { activityIcon } from "../src/lib/activity-icons";
import { readSelectedPlace } from "../src/lib/selected-place";
import { validateRevisedDays } from "../src/lib/itinerary-revision";
import { buildBooking } from "../src/lib/travel-planning";
import { hotelShareForTraveler } from "../src/lib/travel-display";
import type { ItineraryActivity, PlaceSuggestion, Trip } from "../src/lib/trip-types";

function place(latitude: number, longitude: number): PlaceSuggestion {
  return { name: "Matched Place", latitude, longitude, rating: null, reviewCount: null, price: null, category: null, address: null, thumbnail: null, mapsUrl: "https://www.google.com/maps", reviews: [] };
}

function makeTrip(id = "manual"): Trip {
  return {
    id, inviteCode: "ABC123", hostName: "Jay", origin: "Austin", destination: "Tokyo", prompt: "Winter break",
    earliestPossibleDate: "2026-12-17", latestPossibleDate: "2026-12-18", status: "collecting_preferences", createdAt: "2026-10-25T00:00:00Z",
    travelers: [{ id: "jay", name: "Jay", isHost: true, preferencesComplete: false }, { id: "tin", name: "Tin", isHost: false, preferencesComplete: false }],
    itinerary: {
      id: "plan", basedOnCandidateId: "candidate", revision: 3, title: "Tokyo", destination: "Tokyo", startDate: "2026-12-17", endDate: "2026-12-18",
      summary: "Group plan", compromiseExplanation: "A balanced trip", compromises: [], source: "mock", generatedAt: "2026-10-25T00:00:00Z", placesStatus: "added",
      days: [1, 2].map((dayNumber) => ({ dayNumber, date: `2026-12-${16 + dayNumber}`, title: "Explore", activities: [
        { title: "Museum", time: "10:00 AM", location: "Tokyo", type: "Museums & Culture", description: "Art", placeSearchQuery: "old museum", place: place(35.68, 139.7) },
        { title: "Lunch", time: "1:00 PM", location: "Tokyo", type: "Food", description: "Eat together", place: place(35.69, 139.71) },
        { title: "Park", time: "4:00 PM", location: "Tokyo", type: "Outdoors", description: "Walk", place: place(35.7, 139.72) },
      ] })),
      overrides: [{ id: "personal", travelerId: "tin", dayNumber: 1, stopTime: "10:00 AM", stopTitle: "Museum", title: "Shop", location: "Tokyo", note: "", joinedBy: [], createdAt: "2026-10-25T00:00:00Z" }],
    },
    travel: { flights: {}, bookings: {} },
  };
}

function edit(trip: Trip, action: ManualStopEdit["action"] = "replace"): ManualStopEdit {
  return { travelerId: "jay", itineraryId: trip.itinerary!.id, expectedRevision: trip.itinerary!.revision ?? 0, dayNumber: 1, stopIndex: 0, action,
    activity: { title: "Shibuya Sky", time: "10:00 AM", location: "Shibuya", type: "Sightseeing", description: "See the skyline", placeSearchQuery: "" } };
}

test("manual shared edits persist atomically without network or Muse", async (suite) => {
  const previousDirectory = process.cwd();
  const directory = await mkdtemp(path.join(tmpdir(), "hacktx-manual-"));
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error("No provider calls in manual mutations"); };
  process.chdir(directory);
  try {
    const repository = await import("../src/lib/trip-repository");
    await suite.test("replace preserves other days, travel, and unrelated stops; clears stale place and override", async () => {
      const trip = makeTrip("replace");
      await repository.saveTrip(trip);
      const result = await repository.editSharedStop(trip.id, edit(trip), false);
      assert.equal(result?.saved, true);
      const saved = (await repository.getTripById(trip.id))!;
      assert.equal(saved.itinerary!.days[0].activities[0].title, "Shibuya Sky");
      assert.equal(saved.itinerary!.days[0].activities[0].place, undefined);
      assert.equal(saved.itinerary!.days[0].activities[0].placeSearchQuery, "");
      assert.deepEqual(saved.itinerary!.days[0].activities.slice(1), trip.itinerary!.days[0].activities.slice(1));
      assert.deepEqual(saved.itinerary!.days[1], trip.itinerary!.days[1]);
      assert.deepEqual(saved.travel, trip.travel);
      assert.equal(saved.itinerary!.revision, 4);
      assert.ok(saved.itinerary!.updatedAt);
      assert.equal(saved.itinerary!.overrides!.length, 0);
      assert.equal(saved.chat![0].role, "system");
      assert.equal(saved.chat![0].text, "Jay manually replaced Museum with Shibuya Sky.");
      assert.equal(networkCalls, 0);
      await assert.rejects(repository.editSharedStop(trip.id, edit(trip), false), /changed/);
      assert.equal((await repository.getTripById(trip.id))!.chat!.length, 1);
    });
    for (const action of ["before", "after"] as const) {
      await suite.test(`untimed add ${action} persists at requested position`, async () => {
        const trip = makeTrip(action);
        await repository.saveTrip(trip);
        const change = edit(trip, action);
        change.activity.time = "";
        await repository.editSharedStop(trip.id, change, false);
        const saved = (await repository.getTripById(trip.id))!;
        const stops = saved.itinerary!.days[0].activities;
        assert.equal(stops[action === "before" ? 0 : 1].title, "Shibuya Sky");
        assert.equal(stops[action === "before" ? 0 : 1].time, "");
        assert.equal(stops.length, 4);
        assert.deepEqual(stops.filter((stop) => stop.title !== "Shibuya Sky"), trip.itinerary!.days[0].activities);
        assert.deepEqual(saved.itinerary!.overrides, trip.itinerary!.overrides);
        assert.equal(saved.itinerary!.revision, 4);
        assert.match(saved.chat![0].text, /manually added/);
      });
    }
    await suite.test("long travel requires explicit confirmation; old place responses cannot undo it", async () => {
      const trip = makeTrip("distant");
      await repository.saveTrip(trip);
      const change = edit(trip);
      change.activity.place = place(34.69, 135.5);
      assert.equal((await repository.editSharedStop(trip.id, change, false))?.saved, false);
      assert.equal((await repository.getTripById(trip.id))!.itinerary!.revision, 3);
      await repository.editSharedStop(trip.id, change, true);
      assert.equal((await repository.finishPlacesLookup(trip.id, "plan", trip.itinerary!.days, 3)).status, "stale");
      assert.equal((await repository.getTripById(trip.id))!.itinerary!.days[0].activities[0].title, "Shibuya Sky");
    });
  } finally {
    process.chdir(previousDirectory);
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(directory, { recursive: true, force: true });
  }
});

test("timed edits sort chronologically, validate clocks, and reject collisions and whole-trip requests", () => {
  const trip = makeTrip();
  const change = edit(trip, "before");
  change.activity.time = "14:30";
  assert.deepEqual(prepareManualEdit(trip, change).activities.map((stop) => stop.title), ["Museum", "Lunch", "Shibuya Sky", "Park"]);
  assert.equal(prepareManualEdit(trip, change).activities[2].time, "2:30 PM");
  for (const time of ["25:00", "12:60 PM", "0:15 PM", "morning", "1:00 PM"]) {
    change.activity.time = time;
    assert.throws(() => prepareManualEdit(trip, change));
  }
  assert.equal(clockMinutes("12:00 AM"), 0);
  assert.equal(clockMinutes("12:00 PM"), 720);
  change.activity.time = "";
  change.activity.title = "Change destination to Kyoto";
  assert.throws(() => prepareManualEdit(trip, change), /@muse/);
  change.activity.title = "Coffee";
  change.travelerId = "stranger";
  assert.throws(() => prepareManualEdit(trip, change), /Join/);
});

test("later Muse revisions can retain untimed manual stops without creating new untimed stops", () => {
  const trip = makeTrip();
  const change = edit(trip, "after");
  change.activity.time = "";
  applyManualEdit(trip, change, false);
  const itinerary = trip.itinerary!;
  const days = structuredClone(itinerary.days);
  days[1].activities[0].title = "Gallery";
  assert.equal(validateRevisedDays(itinerary, days, ["2026-12-17", "2026-12-18"], "candidate").valid, true);
  days[1].activities.push({ ...change.activity, title: "New Untimed Stop" });
  assert.equal(validateRevisedDays(itinerary, days, ["2026-12-17", "2026-12-18"], "candidate").valid, false);
});

test("travel warnings use 120-minute inclusive threshold and never invent missing coordinates", () => {
  assert.equal(isLongTravel(119), false);
  assert.equal(isLongTravel(120), true);
  assert.equal(isLongTravel(121), true);
  for (const value of [null, undefined, NaN]) assert.equal(isLongTravel(value), false);
  const base: ItineraryActivity = { title: "Stop", time: "", location: "", type: "Sightseeing", description: "" };
  assert.deepEqual(adjacentTravelWarnings([base, base, base], 1), []);
  for (const minutes of [119, 120, 121]) {
    const longitude = ((minutes - 4) * 24 / 60) / 1.3 / (6371 * Math.PI / 180);
    const nearby = { ...base, place: place(0, 0) };
    const added = { ...base, place: place(0, longitude) };
    const warnings = adjacentTravelWarnings([nearby, added, nearby], 1);
    assert.equal(warnings.length, minutes < 120 ? 0 : 2);
    if (warnings.length) assert.equal(warnings[0].minutes, minutes);
  }
  assert.deepEqual(adjacentTravelWarnings([{ ...base, place: place(NaN, 0) }, base], 0), []);
});

test("signed previews bind to trip and exact edit and reject tampering", () => {
  const trip = makeTrip();
  const change = edit(trip);
  const token = signManualPreview(trip.id, change);
  assert.deepEqual(readManualPreview(trip.id, token), change);
  assert.throws(() => readManualPreview("other", token));
  assert.throws(() => readManualPreview(trip.id, token + "x"));
});

test("selected place keeps its address and coordinates through a manual edit", () => {
  const trip = makeTrip();
  const change = edit(trip);
  const selected = { ...place(35.66, 139.7), name: "Shibuya Sky", address: "2 Chome-24-12 Shibuya, Tokyo", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Shibuya+Sky" };
  change.activity.place = readSelectedPlace(selected)!;
  const token = signManualPreview(trip.id, change);
  const savedEdit = readManualPreview(trip.id, token);
  assert.equal(applyManualEdit(trip, savedEdit, false).saved, true);
  assert.deepEqual(trip.itinerary!.days[0].activities[0].place, selected);
  assert.equal(readSelectedPlace({ name: "Fake", mapsUrl: "javascript:bad" }), null);
  const legacy = makeTrip().itinerary!.overrides![0];
  assert.equal(legacy.place, undefined);
});

test("invite copy distinguishes code and absolute link", () => {
  assert.equal(inviteCopyText("/join?code=ABC123", "https://trip.example", "code"), "ABC123");
  assert.equal(inviteCopyText("/join?code=ABC123", "https://trip.example", "link"), "https://trip.example/join?code=ABC123");
});

test("activity icons classify logistics without providers", () => {
  for (const title of ["Hotel", "Lodging", "Check-in", "Check out"]) assert.equal(activityIcon({ title }), "🏨");
  assert.equal(activityIcon({ title: "Land in Tokyo" }), "🛬");
  assert.equal(activityIcon({ title: "Land in Tokyo", description: "Then go to the hotel" }), "🛬");
  assert.equal(activityIcon({ title: "Flight departure" }), "🛫");
  assert.equal(activityIcon({ title: "Train to Kyoto" }), "🚆");
  assert.equal(activityIcon({ title: "Restaurant lunch" }), "🍽️");
  assert.equal(activityIcon({ title: "Explore" }), "📍");
});

function result(number: number) {
  return { title: `Hotel ${number} - Expedia`, link: `https://www.expedia.com/Tokyo-Hotels-Hotel.h${number}.Hotel-Information?utm_source=test` };
}

test("Expedia filtering accepts controlled HTTPS domains and deduplicates hotel IDs", () => {
  for (const url of ["https://expedia.com.evil.test/a", "https://evil-expedia.com/a", "http://expedia.com/a", "javascript:alert(1)", "https://user:pass@expedia.com/a"]) assert.equal(normalizeExpediaUrl(url), null);
  const direct = "https://www.expedia.com/Tokyo.h123.Hotel-Information";
  assert.equal(normalizeExpediaUrl(`https://www.google.com/url?q=${encodeURIComponent(direct)}`), direct);
  const hotels = expediaHotelOptions([result(1), result(1), { title: "duplicate", link: "https://expedia.com/Different.h1.Hotel-Information" }, result(2), { title: "Guide", link: "https://expedia.com/Tokyo-Hotels" }, { title: "Fake", link: "https://evil.test/Tokyo.h5.Hotel-Information" }]);
  assert.equal(hotels.length, 2);
  assert.equal(hotels[0].link.includes("utm_source"), false);
  assert.equal(hotelProviderLabel(hotels[0]), "Expedia Result");
  assert.equal(hotels[0].pricePerNight, null);
  assert.equal(hotels[0].totalPrice, null);
  assert.equal(hotels[0].rating, null);
  assert.equal(hotels[0].hotelClass, null);
});

test("hotels use nine per page and at most three pages", () => {
  const results = [];
  for (let i = 1; i <= 40; i += 1) results.push(result(i));
  const hotels = expediaHotelOptions(results);
  assert.equal(hotels.length, 27);
  assert.equal(hotelPage(hotels, 1).options.length, 9);
  assert.equal(hotelPage(hotels, 2).options[0].token, "expedia-10");
  assert.equal(hotelPage(hotels, 3).options[8].token, "expedia-27");
  assert.equal(hotelPage(hotels, 4).page, 3);
  assert.equal(hotelPage(hotels.slice(0, 10), 2).options.length, 1);
  assert.equal(hotelPage([], 3).totalPages, 0);
});

test("discovery queries three date-aware SerpApi Google pages with no per-hotel requests", async () => {
  const starts: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("engine"), "google");
    assert.match(url.searchParams.get("q")!, /site:expedia.com Tokyo hotels 2026-12-17 to 2026-12-20/);
    starts.push(url.searchParams.get("start")!);
    return Response.json({ organic_results: [result(Number(url.searchParams.get("start")) + 1)] });
  };
  const found = await discoverHotels({ apiKey: "test", fetchImpl }, { destination: "Tokyo", checkIn: "2026-12-17", checkOut: "2026-12-20", adults: 2 });
  assert.deepEqual(starts, ["0", "10", "20"]);
  assert.equal(found.options.length, 3);
  assert.equal(found.expediaSearchUrl, "https://www.expedia.com/Hotels");
});

test("failed Expedia pages retain partial results; no Expedia results falls back honestly", async () => {
  const search = { destination: "Tokyo", checkIn: "2026-12-17", checkOut: "2026-12-20", adults: 2 };
  const partial: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get("start") === "0") return Response.json({ organic_results: [result(1)] });
    throw new Error("Provider unavailable");
  };
  assert.equal((await discoverHotels({ apiKey: "test", fetchImpl: partial }, search)).options.length, 1);
  let calls = 0;
  const fallback: typeof fetch = async (input) => {
    calls += 1;
    const url = new URL(String(input));
    if (url.searchParams.get("engine") === "google") return Response.json({ error: "Unavailable" });
    return Response.json({ properties: [{ name: "Google Hotel", property_token: "google", rate_per_night: { extracted_lowest: 100 } }] });
  };
  const found = await discoverHotels({ apiKey: "test", fetchImpl: fallback }, search);
  assert.equal(calls, 4);
  assert.equal(found.options[0].provider, "google_hotels");
  assert.equal(hotelProviderLabel(found.options[0]), "Google Hotels Result");
  assert.equal(found.options[0].pricePerNight, 100);
  assert.match(found.providerNote, /instead/);
});

test("unpriced Expedia hotels never become a zero-dollar booking or owed share", () => {
  const trip = makeTrip();
  const hotel = expediaHotelOptions([result(1)])[0];
  trip.travel!.hotels = { status: "done", checkIn: "2026-12-17", checkOut: "2026-12-20", options: [hotel], selectedToken: hotel.token, selectedByTravelerId: "jay" };
  assert.equal(hotelPriceTotal(hotel, 3), null);
  assert.ok("error" in buildBooking(trip, "jay"));
  assert.equal(hotelShareForTraveler(trip, "tin"), undefined);
  // No mutation has to contact an AI or travel provider.
  assert.equal(applyManualEdit(trip, edit(trip), false).saved, true);
});
