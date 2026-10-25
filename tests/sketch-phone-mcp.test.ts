import test from "node:test";
import assert from "node:assert/strict";
import { addAssistantBooking, describeMyBookings, describeMyTrip, findTravelerByToken, hashAssistantToken } from "../src/lib/assistant-connector";
import { checkCode, createSessionValue, normalizePhone, readSessionValue, sendCode } from "../src/lib/phone-auth";
import { getSketchRequest, parseSketch } from "../src/lib/trip-sketch";
import type { Trip } from "../src/lib/trip-types";

function makeTrip(): Trip {
  return {
    id: "t", inviteCode: "ABC123", hostName: "Jay", prompt: "Japan trip, we want Tokyo and Osaka", origin: "Austin, Texas", destination: "Japan",
    earliestPossibleDate: "2026-12-15", latestPossibleDate: "2026-12-31", preferredDurationDays: 4, status: "collecting_preferences", createdAt: "2026-10-24T00:00:00.000Z",
    travelers: [
      { id: "jay", name: "Jay", isHost: true, preferencesComplete: true, assistantTokenHash: hashAssistantToken("tp_jay") },
      { id: "henry", name: "Henry", isHost: false, preferencesComplete: true },
    ],
    itinerary: {
      id: "i", basedOnCandidateId: "c", title: "Japan", destination: "Tokyo, Japan", startDate: "2026-12-17", endDate: "2026-12-18",
      summary: "", compromiseExplanation: "", compromises: [], source: "mock", generatedAt: "2026-10-24T00:00:00.000Z",
      days: [{ dayNumber: 1, date: "2026-12-17", title: "Day", activities: [
        { time: "10:00 AM", title: "Museum", type: "Museums & Culture", location: "Ueno", description: "" },
        { time: "7:00 PM", title: "Dinner", type: "Food", location: "Shinjuku", description: "" },
      ] }],
      overrides: [{ id: "o", travelerId: "jay", dayNumber: 1, stopTime: "10:00 AM", stopTitle: "Museum", title: "Ginza shopping", location: "Ginza", note: "", joinedBy: [], createdAt: "" }],
    },
    travel: {
      hotels: { status: "done", checkIn: "2026-12-17", checkOut: "2026-12-19", selectedToken: "h", selectedByTravelerId: "henry", options: [{ token: "h", name: "Hotel East", kind: "hotel", pricePerNight: 100, totalPrice: 200, rating: 4, reviewCount: 1, hotelClass: null, thumbnail: null, amenities: [], link: "https://x" }] },
    },
  };
}

test("the sketch keeps the requested number of days and the places the host named", () => {
  const request = getSketchRequest(makeTrip());
  assert.equal(request.days, 4);
  assert.equal(request.description, "Japan trip, we want Tokyo and Osaka");

  const sketch = parseSketch({
    summary: " Tokyo then Osaka. ",
    places: [{ name: "Tokyo", why: "Named by the host" }, { name: "Osaka", why: "Named by the host" }, { name: "", why: "blank" }],
    days: Array.from({ length: 6 }, (_, index) => ({ dayNumber: index + 9, title: `Day ${index}`, plan: "Plan" })),
    suggestions: [{ name: "Kyoto", why: "Easy day trip" }],
  }, 4);
  assert.equal(sketch.summary, "Tokyo then Osaka.");
  assert.deepEqual(sketch.places.map((place) => place.name), ["Tokyo", "Osaka"]);
  assert.deepEqual(sketch.days.map((day) => day.dayNumber), [1, 2, 3, 4]);
  assert.throws(() => parseSketch({ summary: "" }, 4));
});

test("sketch duration follows preferred days and the usable shared window", () => {
  const trip = makeTrip();
  trip.preferredDurationDays = 2;
  assert.equal(getSketchRequest(trip).days, 2);
  trip.preferredDurationDays = 6;
  trip.travelers[0].availabilityComplete = true;
  trip.travelers[0].availableDates = ["2026-12-17", "2026-12-18", "2026-12-20"];
  trip.travelers[1].availabilityComplete = true;
  trip.travelers[1].availableDates = ["2026-12-17", "2026-12-18"];
  assert.equal(getSketchRequest(trip).days, 2);
  trip.preferredDurationDays = undefined;
  assert.equal(getSketchRequest(trip).days, 2);
  trip.travelers[1].availableDates = [];
  assert.equal(getSketchRequest(trip).days, 0);
  trip.travelers[0].availabilityComplete = false;
  trip.travelers[1].availabilityComplete = false;
  trip.earliestPossibleDate = "2026-12-17";
  trip.latestPossibleDate = "2026-12-18";
  trip.preferredDurationDays = 6;
  assert.equal(getSketchRequest(trip).days, 2);
  trip.latestPossibleDate = "2026-12-31";
  assert.equal(getSketchRequest(trip).days, 6);
});

test("phone numbers are normalized to international format", () => {
  assert.equal(normalizePhone("(512) 555-0134"), "+15125550134");
  assert.equal(normalizePhone("1 512 555 0134"), "+15125550134");
  assert.equal(normalizePhone("+81 90 1234 5678"), "+819012345678");
  assert.equal(normalizePhone("555-0134"), null);
  assert.equal(normalizePhone("+12"), null);
});

test("demo codes work once, and sessions can't be forged", async () => {
  const phone = "+15125550199";
  const sent = await sendCode(phone);
  assert.equal(sent.status, "sent");
  const code = sent.status === "sent" ? sent.demoCode! : "";
  assert.equal(await checkCode(phone, "000000" === code ? "111111" : "000000"), false);
  assert.equal(await checkCode(phone, code), true);
  assert.equal(await checkCode(phone, code), false);

  const value = createSessionValue(phone);
  assert.equal(readSessionValue(value)?.last4, "0199");
  const [payload] = value.split(".");
  assert.equal(readSessionValue(`${payload}.forged`), null);
  assert.equal(readSessionValue(undefined), null);
});

test("an assistant token reaches only its own traveler's view", () => {
  const trip = makeTrip();
  const match = findTravelerByToken([trip], hashAssistantToken("tp_jay"));
  assert.equal(match?.traveler.id, "jay");
  assert.equal(findTravelerByToken([trip], hashAssistantToken("tp_other")), null);

  const view = describeMyTrip(trip, "jay");
  assert.deepEqual(view.itinerary?.[0].stops[0], { time: "10:00 AM", yourPlan: "Ginza shopping", location: "Ginza", insteadOfGroupStop: "Museum" });

  const bookings = describeMyBookings(trip, "jay");
  const hotel = bookings.items.find((item) => item.item === "hotel")!;
  assert.equal(hotel.youBookThis, false);
  assert.equal(hotel.bookedBy, "Henry");
  assert.equal(hotel.chosen?.yourShareUsd, 100);
});

test("bookings recorded by an assistant replace the earlier record of the same kind", () => {
  const trip = makeTrip();
  trip.travel = { ...trip.travel, bookings: { jay: { travelerId: "jay", total: 900, bookedAt: "", items: [{ kind: "flight", label: "Old", detail: "", amount: 900, confirmationCode: "DEMO-FLT-1" }] } } };
  const booking = addAssistantBooking(trip, "jay", { kind: "flight", confirmationCode: "DL7XQ2", amount: 1450 });
  assert.equal(booking.items.length, 1);
  assert.equal(booking.items[0].confirmationCode, "DL7XQ2");
  assert.equal(booking.items[0].source, "assistant");
  assert.equal(booking.total, 1450);
});
