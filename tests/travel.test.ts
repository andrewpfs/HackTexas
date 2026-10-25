import test from "node:test";
import assert from "node:assert/strict";
import { parseMuseRevision } from "../src/lib/muse-itinerary-reviser";
import { buildBooking, getHotelSearchInputs, groupHotelClass, lowestLodgingBudgetPerNight } from "../src/lib/travel-planning";
import { findCityFlightId, searchFlights, searchHotels } from "../src/lib/travel-search";
import type { Traveler, Trip } from "../src/lib/trip-types";

function traveler(id: string, isHost: boolean, extra: Partial<NonNullable<Traveler["preferences"]>> = {}): Traveler {
  return {
    id,
    name: id,
    isHost,
    departureLocation: "Austin, Texas",
    preferencesComplete: true,
    preferences: {
      currency: "USD",
      maximumBudget: 2000,
      preferredDurationDays: 3,
      activityInterests: ["Food"],
      lodgingType: "Hotel",
      groupLodgingPreference: "Stay with the group",
      lodgingAmenities: [],
      ...extra,
    },
  };
}

function makeTrip(): Trip {
  return {
    id: "t", inviteCode: "ABC123", hostName: "jay", prompt: "Trip", origin: "Austin, Texas", destination: "Tokyo",
    earliestPossibleDate: "2026-12-15", latestPossibleDate: "2026-12-31", status: "collecting_preferences", createdAt: "2026-10-24T00:00:00.000Z",
    travelers: [
      traveler("jay", true, { hotelStars: 3, lodgingBudgetPerNight: 150 }),
      traveler("henry", false, { hotelStars: 1, lodgingBudgetPerNight: 90 }),
      traveler("maya", false, { lodgingType: "No need" }),
    ],
    itinerary: {
      id: "i", basedOnCandidateId: "c", title: "Tokyo", destination: "Tokyo, Japan", startDate: "2026-12-17", endDate: "2026-12-19",
      summary: "", compromiseExplanation: "", compromises: [], days: [], source: "mock", generatedAt: "2026-10-24T00:00:00.000Z",
    },
  };
}

test("hotel search uses the itinerary dates and only travelers who need a room", () => {
  const trip = makeTrip();
  const inputs = getHotelSearchInputs(trip)!;
  assert.equal(inputs.checkIn, "2026-12-17");
  assert.equal(inputs.checkOut, "2026-12-20");
  assert.equal(inputs.adults, 2);
  // $ and $$$ -> the lower middle choice ($) -> 2-star class
  assert.equal(groupHotelClass(trip), 2);
  assert.equal(lowestLodgingBudgetPerNight(trip), 90);
});

test("a booking holds your flight, plus the hotel only for the person booking it", () => {
  const trip = makeTrip();
  trip.travel = {
    flights: { henry: { status: "done", from: "Houston", selectedId: "f1", options: [{ id: "f1", airline: "Delta", airlineLogo: null, flightNumbers: ["DL 7"], departAirport: "IAH", departTime: "2026-12-17 07:00", arriveAirport: "HND", arriveTime: "2026-12-18 15:00", durationMinutes: 900, stops: 1, price: 1500 }] } },
    hotels: { status: "done", checkIn: "2026-12-17", checkOut: "2026-12-20", selectedToken: "h1", selectedByTravelerId: "jay", options: [{ token: "h1", name: "Hotel East", kind: "hotel", pricePerNight: 200, totalPrice: null, rating: 4.2, reviewCount: 10, hotelClass: null, thumbnail: null, amenities: [], link: "https://example.com" }] },
  };

  const henry = buildBooking(trip, "henry");
  assert.ok("booking" in henry);
  if (!("booking" in henry)) return;
  assert.deepEqual(henry.booking.items.map((item) => item.kind), ["flight"]);
  assert.match(henry.booking.items[0].confirmationCode, /^DEMO-FLT-[0-9A-F]{6}$/);

  const jay = buildBooking(trip, "jay");
  assert.ok("booking" in jay && jay.booking.items[0].kind === "hotel" && jay.booking.total === 600);

  assert.ok("error" in buildBooking(trip, "maya"));
});

test("hotel and flight results are mapped from SerpApi", async () => {
  const fetchImpl = (async (input: URL) => {
    const engine = new URL(input).searchParams.get("engine");
    const body = engine === "google_hotels"
      ? { properties: [{ name: "Hotel East", property_token: "h1", rate_per_night: { extracted_lowest: 160 }, total_rate: { extracted_lowest: 480 }, overall_rating: 4.04, reviews: 4314, images: [{ thumbnail: "https://img/1.jpg" }], amenities: ["Sauna"] }] }
      : { best_flights: [{ price: 2162, total_duration: 1030, airline_logo: "https://logo", departure_token: "tok", flights: [
          { airline: "Delta", flight_number: "DL 2438", departure_airport: { id: "AUS", time: "2026-12-17 07:10" }, arrival_airport: { id: "LAX" } },
          { airline: "Delta", flight_number: "DL 7", departure_airport: { id: "LAX" }, arrival_airport: { id: "HND", time: "2026-12-18 15:20" } },
        ] }] };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;

  const hotels = await searchHotels({ apiKey: "k", fetchImpl }, { destination: "Tokyo", checkIn: "2026-12-17", checkOut: "2026-12-20", adults: 2 });
  assert.equal(hotels[0].pricePerNight, 160);
  assert.equal(hotels[0].rating, 4);

  const flights = await searchFlights({ apiKey: "k", fetchImpl }, { fromId: "/m/0vzm", toId: "/m/07dfk", outboundDate: "2026-12-17", returnDate: "2026-12-20" });
  assert.equal(flights[0].stops, 1);
  assert.equal(flights[0].departAirport, "AUS");
  assert.equal(flights[0].arriveAirport, "HND");
  assert.equal(flights[0].airline, "Delta");
});

test("a city is turned into the id Google Flights uses", async () => {
  const fetchImpl = (async (input: URL) => {
    const action = new URL(input).searchParams.get("action");
    const body = action === "wbsearchentities"
      ? { search: [{ id: "Q1", description: "family name" }, { id: "Q16559", description: "capital city of the U.S. state of Texas" }] }
      : { entities: { Q16559: { claims: { P646: [{ mainsnak: { datavalue: { value: "/m/0vzm" } } }] } }, Q1: { claims: {} } } };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;

  assert.equal(await findCityFlightId("Austin, Texas", fetchImpl), "/m/0vzm");
});

test("Muse can give one traveler a personal plan instead of changing the group's", () => {
  const result = parseMuseRevision({
    reply: "Got it, you can hit the arcade while everyone shops.",
    changed: false,
    changes: [],
    days: [],
    personal: { applies: true, dayNumber: 2, stopTitle: "Shibuya shopping", title: "Arcade", location: "Akihabara", description: "Retro games" },
  });
  assert.equal(result.days, null);
  assert.deepEqual(result.personal, { dayNumber: 2, stopTitle: "Shibuya shopping", title: "Arcade", location: "Akihabara", note: "Retro games" });

  const none = parseMuseRevision({ reply: "Sure.", changed: false, changes: [], days: [], personal: { applies: false, dayNumber: 0, stopTitle: "", title: "", location: "", description: "" } });
  assert.equal(none.personal, null);
});

test("a multi-city trip gets one hotel stay per city, and solo lodgers book their own", async () => {
  const { planStays, getHotelStays } = await import("../src/lib/hotel-stays");
  const trip = makeTrip();
  trip.itinerary!.endDate = "2026-12-23";
  trip.itinerary!.days = [
    { dayNumber: 1, date: "2026-12-17", title: "Paris", city: "Paris, France", activities: [] },
    { dayNumber: 2, date: "2026-12-18", title: "Paris", city: "Paris, France", activities: [] },
    { dayNumber: 3, date: "2026-12-19", title: "Train", city: "Berlin, Germany", activities: [] },
    { dayNumber: 4, date: "2026-12-20", title: "Berlin", city: "Berlin, Germany", activities: [] },
    { dayNumber: 5, date: "2026-12-21", title: "Prague", city: "Prague, Czechia", activities: [] },
    { dayNumber: 6, date: "2026-12-22", title: "Prague", city: "Prague, Czechia", activities: [] },
    { dayNumber: 7, date: "2026-12-23", title: "Home", city: "Prague, Czechia", activities: [] },
  ];
  assert.deepEqual(planStays(trip.itinerary!), [
    { city: "Paris, France", checkIn: "2026-12-17", checkOut: "2026-12-19" },
    { city: "Berlin, Germany", checkIn: "2026-12-19", checkOut: "2026-12-21" },
    { city: "Prague, Czechia", checkIn: "2026-12-21", checkOut: "2026-12-24" },
  ]);
  assert.equal(getHotelSearchInputs(trip, 1)?.destination, "Berlin, Germany");

  // Henry prefers his own place: he isn't a group guest and must pick his own hotel per city.
  trip.travelers[1].preferences!.groupLodgingPreference = "Prefer separate lodging";
  assert.equal(getHotelSearchInputs(trip, 0)?.adults, 1);
  const option = { token: "h", name: "Hotel", kind: "hotel", pricePerNight: 100, totalPrice: null, rating: null, reviewCount: null, hotelClass: null, thumbnail: null, amenities: [], link: "https://x" };
  trip.travel = { hotelStays: planStays(trip.itinerary!).map((stay) => ({ ...stay, status: "done" as const, options: [option], selectedToken: "h", selectedByTravelerId: "jay" })) };
  const blocked = buildBooking(trip, "henry");
  assert.ok("error" in blocked && /Pick your own hotel/.test(blocked.error));
  trip.travel.hotelStays = trip.travel.hotelStays!.map((stay) => ({ ...stay, soloPicks: { henry: "h" } }));
  const henry = buildBooking(trip, "henry");
  assert.ok("booking" in henry && henry.booking.items.length === 3 && henry.booking.total === 700);
  assert.equal(getHotelStays(trip).length, 3);
});

test("travelers sharing the group hotel can't confirm until the host picks every city", () => {
  const trip = makeTrip();
  trip.travel = { hotelStays: [{ city: "Tokyo", checkIn: "2026-12-17", checkOut: "2026-12-20", status: "done", options: [] }] };
  const result = buildBooking(trip, "henry");
  assert.ok("error" in result && /host to pick the group hotel in Tokyo/.test(result.error));
});
