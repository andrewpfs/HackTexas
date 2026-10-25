import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { handleItineraryChat } from "../src/lib/itinerary-chat";
import { isMajorRevision } from "../src/lib/itinerary-proposals";
import { validateRevisedDays, type RevisionResult } from "../src/lib/itinerary-revision";
import { combinedPreferenceText } from "../src/lib/preference-text";
import { validateTravelerPreferences } from "../src/lib/trip-validation";
import { activityEmoji, groupCandidateDays } from "../src/lib/candidate-display";
import { estimateTravel } from "../src/lib/travel-time";
import { bookingConfirmationText, flightHighlights, hotelShareForTraveler } from "../src/lib/travel-display";
import { buildBooking } from "../src/lib/travel-planning";
import { getHotelStays } from "../src/lib/hotel-stays";
import { addImagesToCandidateDays } from "../src/lib/place-images";
import { canActAsTraveler, createTravelerProof } from "../src/lib/trip-browser-identity";
import type { CandidateDay, FlightOption, Trip } from "../src/lib/trip-types";

function makeTrip(id: string): Trip {
  return {
    id, inviteCode: id, name: "Tokyo Winter", hostName: "Jay", prompt: "Winter trip", origin: "Austin", destination: "Tokyo",
    earliestPossibleDate: "2026-12-17", latestPossibleDate: "2026-12-18", expectedTravelerCount: 12,
    status: "collecting_preferences", createdAt: "2026-10-25T00:00:00Z",
    travelers: ["Jay", "Tin", "Ryan"].map((name, index) => ({
      id: name, name, isHost: index === 0, departureLocation: "Austin", preferencesComplete: true,
      availabilityComplete: true, availableDates: ["2026-12-17", "2026-12-18"],
      preferences: { currency: "USD", maximumBudget: 1500, preferredDurationDays: 2, activityInterests: ["Food"], lodgingType: "Hotel", groupLodgingPreference: "Stay with the group", lodgingAmenities: [] },
    })),
    itinerary: {
      id: "itinerary", basedOnCandidateId: "candidate", title: "Tokyo Winter", destination: "Tokyo", revision: 0,
      startDate: "2026-12-17", endDate: "2026-12-18", summary: "A winter break", compromiseExplanation: "Space for everyone", compromises: [], source: "mock", generatedAt: "2026-10-25T00:00:00Z",
      days: [1, 2].map((number) => ({ dayNumber: number, date: `2026-12-${16 + number}`, title: `Explore Day ${number}`, activities: [
        { time: "10:00 AM", title: "Garden", type: "Outdoors", location: "Tokyo", description: "A walk", placeSearchQuery: "Tokyo garden" },
        { time: "1:00 PM", title: "Lunch", type: "Food", location: "Tokyo", description: "Eat together", placeSearchQuery: "Tokyo lunch" },
        { time: "4:00 PM", title: "Free time", type: "Free time", location: "Tokyo", description: "Rest or explore", placeSearchQuery: "" },
      ] })),
    },
    travel: { hotels: { status: "done", checkIn: "2026-12-17", checkOut: "2026-12-19", selectedToken: "hotel", selectedByTravelerId: "Jay", options: [{ token: "hotel", name: "Tokyo Hotel", kind: "hotel", totalPrice: 900, pricePerNight: 450, rating: null, reviewCount: null, hotelClass: null, thumbnail: null, amenities: [], link: "https://example.com" }] }, flights: {}, bookings: {} },
  };
}

function majorResult(trip: Trip): RevisionResult {
  const days = structuredClone(trip.itinerary!.days);
  for (const day of days) for (const stop of day.activities) stop.location = "Kyoto";
  return { kind: "shared_minor", proposedDestination: "Kyoto", proposedTripName: "Tokyo Winter", reply: "A quieter Kyoto trip", changes: ["Move the trip to Kyoto"], days };
}

test("chat, proposals and repository writes remain safe without provider calls", async (suite) => {
  const originalDirectory = process.cwd();
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "hacktx-proposal-tests-"));
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  globalThis.fetch = async () => { throw new Error("Network is forbidden in these tests"); };
  process.chdir(temporaryDirectory);
  try {
    const repository = await import("../src/lib/trip-repository");
    let number = 0;
    async function savedTrip() {
      number += 1;
      const trip = makeTrip(`test-${number}`);
      await repository.saveTrip(trip);
      return trip;
    }
    async function ask(trip: Trip, text: string, result: RevisionResult) {
      let calls = 0;
      const response = await handleItineraryChat(trip.id, { travelerId: "Jay", text }, { ...repository, async revise() { calls += 1; return result; } });
      return { ...response, calls };
    }
    async function propose() {
      const trip = await savedTrip();
      return (await ask(trip, "@muse move us to Kyoto", majorResult(trip))).trip;
    }
    async function vote(trip: Trip, travelerId: string, choice: "approve" | "reject") {
      return repository.voteOnItineraryProposal(trip.id, trip.pendingItineraryProposal!.id, travelerId, choice);
    }

    await suite.test("ordinary messages append once and never invoke the reviser", async () => {
      const trip = await savedTrip();
      const response = await ask(trip, "Should we eat earlier?", majorResult(trip));
      assert.equal(response.calls, 0);
      assert.equal(response.trip.chat?.length, 1);
      assert.deepEqual(response.trip.itinerary, trip.itinerary);
      assert.equal(response.trip.pendingItineraryProposal, undefined);
    });
    await suite.test("@muse is case insensitive, leading whitespace works, mid-message mentions do not invoke", async () => {
      for (const text of ["@muse help", "  @Muse help", "@MUSE", "@Muse, help"]) {
        const response = await ask(await savedTrip(), text, { reply: "Which day?", changes: [], days: null });
        assert.equal(response.calls, 1);
        assert.equal(response.trip.chat?.length, 2);
      }
      assert.equal((await ask(await savedTrip(), "Ask @muse later", majorResult(makeTrip("unused")))).calls, 0);
    });
    await suite.test("messy Muse times are repaired so a city change still becomes a group vote", async () => {
      const trip = await savedTrip();
      const result = majorResult(trip);
      result.days![0].activities.reverse();
      result.days![0].activities[0].time = "14:30";
      result.days![0].activities[result.days![0].activities.length - 1].time = "9am";
      const response = await ask(trip, "@muse move us to Kyoto", result);
      assert.equal(response.trip.pendingItineraryProposal?.status, "pending");
      const times = response.trip.pendingItineraryProposal!.proposedDays[0].activities.map((stop) => stop.time);
      assert.equal(times[0], "9:00 AM");
      assert.equal(response.trip.itinerary?.destination, trip.itinerary?.destination);
    });
    await suite.test("an invalid Muse answer is sent back once with the errors before giving up", async () => {
      const trip = await savedTrip();
      const good = majorResult(trip);
      const broken = { ...good, days: good.days!.slice(0, 1) };
      const texts: string[] = [];
      const response = await handleItineraryChat(trip.id, { travelerId: "Jay", text: "@muse move us to Kyoto" }, {
        ...repository,
        async revise(request) { texts.push(request.message.text); return texts.length === 1 ? broken : good; },
      });
      assert.equal(texts.length, 2);
      assert.match(texts[1], /previous answer was rejected/);
      assert.equal(response.trip.pendingItineraryProposal?.status, "pending");
    });
    await suite.test("even small Muse changes go to a vote, and a rejected one becomes the requester's personal plan", async () => {
      const trip = await savedTrip();
      const days = structuredClone(trip.itinerary!.days);
      const oldStop = days[0].activities[0];
      days[0].activities[0] = { ...oldStop, title: "Forest walk", location: "Meiji Jingu" };
      const minor = await ask(trip, "@muse swap one stop", { kind: "shared_minor", reply: "Proposing a forest walk.", changes: ["Garden to forest"], days });
      assert.equal(minor.trip.pendingItineraryProposal?.status, "pending");
      assert.equal(minor.trip.itinerary?.days[0].activities[0].title, oldStop.title);
      for (const name of ["Jay", "Tin", "Ryan"]) await vote(minor.trip, name, name === "Jay" ? "approve" : "reject");
      const after = await repository.getTripById(trip.id);
      assert.equal(after?.pendingItineraryProposal?.status, "rejected");
      assert.equal(after?.itinerary?.days[0].activities[0].title, oldStop.title);
      const plan = after?.itinerary?.overrides?.[0];
      assert.equal(plan?.travelerId, "Jay");
      assert.equal(plan?.title, "Forest walk");
      assert.equal(plan?.stopTitle, oldStop.title);
      assert.match(after?.chat?.at(-1)?.text ?? "", /personal plan/);

      const personal = await ask(after!, "@muse I will skip lunch", { kind: "personal", reply: "A personal coffee break.", changes: [], days: null, personal: { dayNumber: 1, stopTitle: "Lunch", title: "Coffee", location: "Nearby", note: "Meet back later" } });
      assert.ok(personal.trip.itinerary?.overrides?.some((item) => item.title === "Coffee"));
      assert.equal(personal.trip.itinerary?.days[0].activities[1].title, "Lunch");

      // "I'd rather..." is about the sender only: even if Muse rewrites the shared day,
      // it becomes a personal plan and no vote opens.
      const myDays = structuredClone(personal.trip.itinerary!.days);
      const firstStop = myDays[0].activities[0];
      myDays[0].activities[0] = { ...firstStop, title: "Arcade", location: "Akihabara", description: "Games" };
      const mine = await ask(personal.trip, "@muse I'd rather go to the arcade instead", { kind: "shared_minor", reply: "Swapping in the arcade.", changes: ["Arcade"], days: myDays });
      assert.equal(mine.trip.pendingItineraryProposal?.status === "pending", false);
      assert.equal(mine.trip.itinerary?.days[0].activities[0].title, firstStop.title);
      assert.ok(mine.trip.itinerary?.overrides?.some((item) => item.title === "Arcade" && item.stopTitle === firstStop.title));
      assert.match(mine.trip.chat?.at(-1)?.text ?? "", /personal plan/);
    });
    await suite.test("destination changes are proposals even when Muse labels them minor", async () => {
      const trip = await propose();
      assert.equal(trip.pendingItineraryProposal?.status, "pending");
      assert.equal(trip.destination, "Tokyo");
      assert.equal(trip.itinerary?.destination, "Tokyo");
      assert.equal(trip.name, "Tokyo Winter");
      assert.match(trip.chat?.at(-1)?.text ?? "", /group vote/);
      const again = await ask(trip, "@muse another change", majorResult(trip));
      assert.equal(again.calls, 0);
      assert.equal(again.trip.pendingItineraryProposal?.id, trip.pendingItineraryProposal?.id);
    });
    await suite.test("one vote per traveler persists; votes may change until finalization", async () => {
      const trip = await propose();
      await vote(trip, "Jay", "reject");
      await vote(trip, "Jay", "approve");
      const reloaded = await repository.getTripById(trip.id);
      assert.equal(reloaded?.pendingItineraryProposal?.votes.length, 1);
      assert.equal(reloaded?.pendingItineraryProposal?.votes[0].choice, "approve");
      assert.equal(reloaded?.pendingItineraryProposal?.status, "pending");
      assert.equal((await vote(trip, "stranger", "approve")).status, "not-allowed");
    });
    await suite.test("all actual travelers must vote; concurrent majority approvals apply once and clear travel", async () => {
      const trip = await propose();
      await Promise.all([vote(trip, "Jay", "approve"), vote(trip, "Tin", "approve")]);
      assert.equal((await repository.getTripById(trip.id))?.itinerary?.destination, "Tokyo");
      const final = await vote(trip, "Ryan", "reject");
      assert.equal(final.status, "approved");
      assert.ok("trip" in final);
      assert.equal(final.trip.destination, "Kyoto");
      assert.equal(final.trip.name, "Kyoto Trip");
      assert.equal(final.trip.itinerary?.title, "Kyoto Trip");
      assert.equal(final.trip.itinerary?.revision, 1);
      assert.equal(final.trip.travel, undefined);
      assert.equal(final.trip.itinerary?.placesStatus, undefined);
      assert.equal(final.trip.lastApprovedItineraryProposal?.status, "approved");
      assert.equal((await vote(trip, "Ryan", "approve")).status, "closed");
    });
    await suite.test("ties and rejections keep the original itinerary and travel", async () => {
      for (const tie of [false, true]) {
        let trip = await savedTrip();
        if (tie) { trip.travelers.pop(); await repository.saveTrip({ ...trip, id: `${trip.id}-tie`, inviteCode: `${trip.id}-tie` }); trip.id += "-tie"; }
        trip = (await ask(trip, "@muse move", majorResult(trip))).trip;
        await vote(trip, "Jay", "approve");
        await vote(trip, "Tin", "reject");
        if (!tie) await vote(trip, "Ryan", "reject");
        const final = await repository.getTripById(trip.id);
        assert.equal(final?.pendingItineraryProposal?.status, "rejected");
        assert.equal(final?.itinerary?.destination, "Tokyo");
        assert.ok(final?.travel?.hotels);
      }
    });
    await suite.test("a stale proposal cannot overwrite a newer revision", async () => {
      const trip = await propose();
      await repository.saveItineraryRevision(trip.id, trip.itinerary!.id, 0, trip.itinerary!.days, { id: "edit", role: "muse", authorName: "Muse", text: "New edit", createdAt: "now" });
      assert.equal((await vote(trip, "Jay", "approve")).status, "stale");
      const final = await repository.getTripById(trip.id);
      assert.equal(final?.itinerary?.revision, 1);
      assert.equal(final?.destination, "Tokyo");
    });
    await suite.test("approved moves remove old places/overrides and ignore in-flight old place lookups", async () => {
      const trip = await savedTrip();
      trip.itinerary!.days[0].activities[0].place = { name: "Old Garden", rating: 4, reviewCount: 1, price: null, category: null, address: "Tokyo", thumbnail: "https://example.com/old.jpg", mapsUrl: "https://example.com/maps", reviews: [] };
      trip.itinerary!.overrides = [{ id: "old-override", travelerId: "Jay", dayNumber: 1, stopTime: "10:00 AM", stopTitle: "Garden", title: "Coffee", location: "Tokyo", note: "", joinedBy: [], createdAt: "now" }];
      await repository.saveItineraryRevision(trip.id, "itinerary", 0, trip.itinerary!.days, { id: "setup", role: "muse", authorName: "Muse", text: "Setup", createdAt: "now" });
      // Preserve a personal plan on the revised stop before proposing the move.
      await repository.changePersonalOverride(trip.id, { action: "add", travelerId: "Jay", dayNumber: 1, stopTime: "10:00 AM", stopTitle: "Garden", title: "Coffee", location: "Tokyo", note: "" });
      const claim = await repository.claimPlacesLookup(trip.id);
      assert.equal(claim.status, "claimed");
      const proposed = (await ask(trip, "@muse move", majorResult(trip))).trip;
      await vote(proposed, "Jay", "approve"); await vote(proposed, "Tin", "approve"); await vote(proposed, "Ryan", "approve");
      assert.equal((await repository.finishPlacesLookup(trip.id, "itinerary", trip.itinerary!.days, 0)).status, "stale");
      const updated = (await repository.getTripById(trip.id))!;
      assert.equal(updated.itinerary?.destination, "Kyoto");
      assert.equal(updated.itinerary?.days[0].activities[0].place, undefined);
      assert.deepEqual(updated.itinerary?.overrides, []);
    });
    await suite.test("preference edits preserve old optional budgets and move legacy text into one field", async () => {
      const trip = await savedTrip();
      const old = { ...trip.travelers[0].preferences!, foodBudgetPerDay: 70, lodgingBudgetPerNight: 120, activitiesBudget: 300, destinationPreferences: "Kyoto", notes: "No seafood" };
      await repository.updateTravelerPreferences(trip.id, "Jay", old, "Austin");
      const next = { ...trip.travelers[0].preferences!, notes: combinedPreferenceText(old), destinationPreferences: undefined };
      await repository.updateTravelerPreferences(trip.id, "Jay", next, "Austin");
      const saved = (await repository.getTripById(trip.id))!.travelers[0].preferences!;
      assert.equal(saved.foodBudgetPerDay, 70);
      assert.equal(saved.lodgingBudgetPerNight, 120);
      assert.equal(saved.activitiesBudget, 300);
      assert.equal(saved.notes, "Kyoto\n\nNo seafood");
      assert.equal(saved.destinationPreferences, undefined);
      assert.equal(validateTravelerPreferences(saved).valid, true);
    });
    await suite.test("old hotel and flight responses cannot refill searches after an approved move", async () => {
      const original = await savedTrip();
      const oldHotels = await repository.claimHotelSearch(original.id, 0, true);
      const oldFlights = await repository.claimFlightSearch(original.id, "Jay", "Austin");
      assert.equal(oldHotels.status, "claimed"); assert.equal(oldFlights.status, "claimed");
      if (oldHotels.status !== "claimed" || oldFlights.status !== "claimed") return;
      const proposed = (await ask(original, "@muse move", majorResult(original))).trip;
      await vote(proposed, "Jay", "approve"); await vote(proposed, "Tin", "approve"); await vote(proposed, "Ryan", "approve");
      const oldStay = getHotelStays(oldHotels.trip)[0];
      await repository.finishHotelSearch(original.id, oldStay.plan, { status: "done", options: original.travel!.hotels!.options }, oldStay.result?.startedAt);
      await repository.finishFlightSearch(original.id, "Jay", { status: "done", options: [] }, oldFlights.trip.travel?.flights?.Jay.startedAt);
      assert.equal((await repository.getTripById(original.id))?.travel, undefined);
      assert.equal((await repository.saveBooking(original.id, { travelerId: "Jay", total: 900, items: [], bookedAt: "now" }, { id: "itinerary", revision: 0 })).status, "stale");
    });
    await suite.test("legacy phone saving still works but cannot create someone else's voting proof", async () => {
      const trip = await savedTrip();
      assert.equal((await repository.linkTravelerPhone(trip.id, "Tin", "new-phone", "1234")).status, "linked");
      let saved = (await repository.getTripById(trip.id))!;
      const session = { phoneHash: "new-phone", last4: "1234", expiresAt: Date.now() + 1000 };
      assert.equal(saved.travelers[1].phoneHash, "new-phone");
      assert.equal(canActAsTraveler(saved, "Tin", undefined, session), false);
      // Only an existing signed browser proof can upgrade the newly linked phone.
      const proof = createTravelerProof(trip.id, "Tin");
      assert.equal(canActAsTraveler(saved, "Tin", proof, session), true);
      await repository.linkTravelerPhone(trip.id, "Tin", "new-phone", "1234", true);
      saved = (await repository.getTripById(trip.id))!;
      assert.equal(canActAsTraveler(saved, "Tin", undefined, session), true);
    });
  } finally {
    process.chdir(originalDirectory);
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    assert.ok(path.resolve(temporaryDirectory).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("browser proof cannot vote as a different traveler, and phone restoration uses its own saved traveler", () => {
  const trip = makeTrip("proof");
  const proof = createTravelerProof(trip.id, "Jay");
  assert.equal(canActAsTraveler(trip, "Jay", proof, null), true);
  assert.equal(canActAsTraveler(trip, "Tin", proof, null), false);
  assert.equal(canActAsTraveler(trip, "Jay", `${proof}forged`, null), false);
  assert.equal(canActAsTraveler(trip, "Jay", undefined, null), false);
  trip.travelers[1].phoneHash = "verified-phone";
  const session = { phoneHash: "verified-phone", last4: "1234", expiresAt: Date.now() + 1000 };
  assert.equal(canActAsTraveler(trip, "Tin", undefined, session), true);
  assert.equal(canActAsTraveler(trip, "Jay", undefined, session), false);
});

test("multiple rewritten days require voting and invalid clocks cannot be saved", () => {
  const trip = makeTrip("classification");
  const result = majorResult(trip);
  result.proposedDestination = "Tokyo";
  assert.equal(isMajorRevision(trip.itinerary!, result), true);
  const oneDay = { ...trip.itinerary!, days: trip.itinerary!.days.slice(0, 1) };
  assert.equal(isMajorRevision(oneDay, { ...result, days: result.days!.slice(0, 1) }), true);
  result.days![0].activities[1].time = "9:00 AM";
  assert.equal(validateRevisedDays(trip.itinerary!, result.days!, ["2026-12-17", "2026-12-18"], "candidate").valid, false);
});

test("single preference question deduplicates legacy notes and one budget control is visible", async () => {
  assert.equal(combinedPreferenceText({ destinationPreferences: " Kyoto ", notes: "Kyoto" }), "Kyoto");
  assert.equal(combinedPreferenceText({ destinationPreferences: "Kyoto", notes: "Kyoto\n\nNo seafood" }), "Kyoto\n\nNo seafood");
  const form = await readFile(path.join(process.cwd(), "src/app/trip/[tripId]/preferences/preferences-form.tsx"), "utf8");
  assert.equal((form.match(/<MoneyInput /g) ?? []).length, 1);
  assert.ok(form.includes("Preferred Trip Length (In Days)"));
  assert.equal(form.includes('id="destination-preferences"'), false);
});

test("transit estimates, day blocks and activity icons are deterministic", () => {
  const estimate = estimateTravel({ latitude: 35.6, longitude: 139.7 }, { latitude: 35.7, longitude: 139.8 }, "transit");
  assert.ok(Number.isFinite(estimate.minutes) && estimate.minutes >= 8);
  const days: CandidateDay[] = [];
  for (let number = 1; number <= 15; number += 1) days.push({ dayNumber: number, date: "2026-12-17", title: "Day", activities: [] });
  assert.deepEqual(groupCandidateDays(days).map((block) => block.length), [7, 7, 1]);
  assert.deepEqual(groupCandidateDays(days.slice(0, 8)).map((block) => block.length), [7, 1]);
  assert.equal(activityEmoji({ title: "Lunch", description: "Eat", timeOfDay: "Afternoon" }), "🍽️");
});

test("day-photo pipeline uses one lookup per day and preserves old stop images", async () => {
  let calls = 0;
  const fakeFetch = (async () => { calls += 1; return new Response(JSON.stringify({ query: { pages: { 1: { thumbnail: { source: "https://example.com/day.jpg" } } } } })); }) as typeof fetch;
  const candidate = { destination: "Tokyo", days: [{ imageUrl: undefined as string | undefined, activities: [{ title: "Garden" }, { title: "Lunch" }, { title: "Dinner" }] }] };
  const result = await addImagesToCandidateDays([candidate], fakeFetch);
  assert.equal(calls, 1);
  assert.equal(result[0].days[0].imageUrl, "https://example.com/day.jpg");
  const old = { destination: "Tokyo", days: [{ imageUrl: undefined as string | undefined, activities: [{ title: "Garden", imageUrl: "https://example.com/old.jpg" }] }] };
  await addImagesToCandidateDays([old], fakeFetch);
  assert.equal(calls, 1);
  assert.equal(old.days[0].activities[0].imageUrl, "https://example.com/old.jpg");
});

test("flight badges include ties; hotel owed share stays separate from a traveler's charge", () => {
  const base: FlightOption = { id: "f1", airline: "Demo Air", airlineLogo: null, flightNumbers: [], departAirport: "AUS", departTime: "2026-12-17 09:00", arriveAirport: "NRT", arriveTime: "2026-12-18 09:00", durationMinutes: 900, stops: 0, price: 500 };
  const flights = [base, { ...base, id: "f2", price: 700, durationMinutes: 800 }, { ...base, id: "f3" }];
  assert.deepEqual(flightHighlights(flights), { cheapest: 500, shortest: 800 });
  assert.deepEqual(flightHighlights([]), { cheapest: null, shortest: null });
  const trip = makeTrip("travel");
  trip.travel!.flights = { Tin: { status: "done", from: "Austin", options: flights, selectedId: "f1" } };
  assert.equal(hotelShareForTraveler(trip, "Tin")?.amount, 300);
  const result = buildBooking(trip, "Tin");
  assert.ok("booking" in result);
  assert.equal(result.booking.total, 500);
  assert.equal(result.booking.hotelShare?.amount, 300);
  assert.equal(result.booking.items.length, 1);
  const confirmation = bookingConfirmationText("Tokyo Winter", result.booking);
  assert.ok(confirmation.includes("You owe Jay about $300.00"));
  assert.ok(confirmation.includes("Total: $500.00"));
  trip.travelers[1].preferences!.lodgingType = "No need";
  assert.equal(hotelShareForTraveler(trip, "Tin"), undefined);
});
