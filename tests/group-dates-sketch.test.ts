import test from "node:test";
import assert from "node:assert/strict";
import { activeConfirmedDates, travelersNotFreeOn, travelersYetToAgree } from "../src/lib/date-suggestions";
import { buildPlanningContext, calculatePlanningReadiness } from "../src/lib/planning-context";
import { checkFeasibility, getTripFeasibility } from "../src/lib/trip-feasibility";
import { getSketchBasis, getSketchRequest, sketchNeedsRedraw } from "../src/lib/trip-sketch";
import { detectTripStyle } from "../src/lib/trip-style";
import { applyTripDetailsUpdate, clearPlanningOutputs, isGeneratingCandidates } from "../src/lib/trip-updates";
import { fastestMode } from "../src/lib/travel-time";
import { detectRequestScope, personalPlansFromRevision } from "../src/lib/itinerary-revision";
import { findFlightsWithNearbyAirports } from "../src/lib/flight-routing";
import { findNearbyAirports } from "../src/lib/travel-search";
import type { FlightOption, ItineraryDay } from "../src/lib/trip-types";
import { maximumNotifications, pushNotification, tripPath } from "../src/lib/trip-notifications";
import type { Traveler, Trip } from "../src/lib/trip-types";

function traveler(id: string, name: string, isHost: boolean, dates: string[], budget = 2000): Traveler {
  return {
    id,
    name,
    isHost,
    departureLocation: "Austin, Texas",
    preferencesComplete: true,
    preferences: {
      currency: "USD",
      maximumBudget: budget,
      preferredDurationDays: 4,
      activityInterests: ["Food"],
      lodgingType: "Hostel",
      groupLodgingPreference: "Stay with the group",
      lodgingAmenities: [],
    },
    availabilityComplete: true,
    availableDates: dates,
  };
}

function makeTrip(): Trip {
  return {
    id: "trip",
    inviteCode: "ABC123",
    hostName: "Jay",
    prompt: "Backpacking through Europe, as many countries as we can",
    origin: "Austin, Texas",
    destination: "Europe",
    earliestPossibleDate: "2026-12-01",
    latestPossibleDate: "2026-12-20",
    preferredDurationDays: 10,
    status: "collecting_preferences",
    createdAt: "2026-10-24T00:00:00.000Z",
    travelers: [
      traveler("jay", "Jay", true, ["2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"]),
      traveler("ryan", "Ryan", false, ["2026-12-03", "2026-12-04", "2026-12-05"]),
    ],
  };
}

const done = { status: "done" as const, summary: "A plan", places: [], days: [], suggestions: [] };

test("the host can set dates outside the shared days, and everyone else must agree", () => {
  const trip = makeTrip();
  trip.confirmedDates = { startDate: "2026-12-03", endDate: "2026-12-06", confirmedAt: "", confirmedByName: "Jay", agreedTravelerIds: ["jay"], outsideSharedDates: true };
  const readiness = calculatePlanningReadiness(trip);
  // Ryan isn't free on the 6th, but the override still applies.
  assert.notEqual(activeConfirmedDates(trip.confirmedDates, readiness.sharedDates), null);
  assert.deepEqual(travelersNotFreeOn(trip, "2026-12-03", "2026-12-06").map((item) => item.name), ["Ryan"]);
  assert.deepEqual(readiness.blockers.map((item) => item.code), ["dates_not_agreed"]);
  assert.equal(readiness.blockers[0].travelerName, "Ryan");

  trip.confirmedDates.agreedTravelerIds = ["jay", "ryan"];
  assert.equal(calculatePlanningReadiness(trip).readyForCandidateGeneration, true);
  const context = buildPlanningContext(trip);
  assert.equal(context.success, true);
  if (!context.success) return;
  assert.deepEqual(context.context.groupAvailability.sharedDates, ["2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"]);
  assert.deepEqual(context.context.trip.confirmedDates?.travelersNotFreeOnEveryDay, ["Ryan"]);
});

test("dates confirmed before agreement existed count as agreed", () => {
  const trip = makeTrip();
  trip.confirmedDates = { startDate: "2026-12-03", endDate: "2026-12-05", confirmedAt: "", confirmedByName: "Jay" };
  assert.deepEqual(travelersYetToAgree(trip, trip.confirmedDates), []);
  assert.equal(calculatePlanningReadiness(trip).readyForCandidateGeneration, true);
});

test("no shared dates doesn't block once the host picked dates on purpose", () => {
  const trip = makeTrip();
  trip.travelers[1].availableDates = ["2026-12-10"];
  assert.equal(calculatePlanningReadiness(trip).blockers[0]?.code, "no_shared_dates");
  trip.confirmedDates = { startDate: "2026-12-03", endDate: "2026-12-06", confirmedAt: "", confirmedByName: "Jay", agreedTravelerIds: ["jay", "ryan"], outsideSharedDates: true };
  assert.equal(calculatePlanningReadiness(trip).readyForCandidateGeneration, true);
});

test("backpacking and region destinations are spotted for Muse", () => {
  const style = detectTripStyle(["Backpacking through Europe"], "Europe");
  assert.equal(style.destinationIsRegion, true);
  assert.equal(style.styles[0].name, "Backpacking");
  assert.equal(detectTripStyle(["A relaxing beach week"], "Cancun").styles.length, 0);
  assert.equal(detectTripStyle(["A relaxing beach week"], "Cancun").destinationIsRegion, false);

  const trip = makeTrip();
  trip.confirmedDates = { startDate: "2026-12-03", endDate: "2026-12-05", confirmedAt: "", confirmedByName: "Jay" };
  const context = buildPlanningContext(trip);
  assert.equal(context.success && context.context.trip.tripStyle?.destinationIsRegion, true);
  assert.equal(getSketchRequest(trip).tripStyle?.styles[0].name, "Backpacking");
});

test("the first draft stays put while people join, and redraws once everyone has answered", () => {
  const trip = makeTrip();
  trip.travelers[1].preferencesComplete = false;
  const hostBasis = getSketchBasis(trip);
  assert.equal(hostBasis.stage, "host");
  trip.sketch = { ...done, basisKey: hostBasis.key, stage: "host" };
  assert.equal(sketchNeedsRedraw(trip), false);

  // Saving availability or a new joiner doesn't change a host-stage draft.
  trip.travelers[1].availableDates = ["2026-12-04"];
  trip.travelers.push({ ...traveler("tin", "Tin", false, []), preferencesComplete: false, availabilityComplete: false });
  assert.equal(sketchNeedsRedraw(trip), false);

  // Everyone has answered: redraw for the group.
  trip.travelers[1].preferencesComplete = true;
  trip.travelers[2].preferencesComplete = true;
  trip.travelers[2].availabilityComplete = true;
  const groupBasis = getSketchBasis(trip);
  assert.equal(groupBasis.stage, "group");
  assert.equal(sketchNeedsRedraw(trip), true);
  assert.equal(getSketchRequest(trip).group?.travelers.length, 3);

  // Once drawn for the group, editing someone's preferences redraws it again.
  trip.sketch = { ...done, basisKey: groupBasis.key, stage: "group" };
  assert.equal(sketchNeedsRedraw(trip), false);
  trip.travelers[0].preferences!.maximumBudget = 900;
  assert.equal(sketchNeedsRedraw(trip), true);

  // While a redraw runs, or after it failed for these inputs, don't ask again.
  trip.sketch.refreshing = { startedAt: new Date().toISOString(), basisKey: getSketchBasis(trip).key };
  assert.equal(sketchNeedsRedraw(trip), false);
  trip.sketch.refreshing = undefined;
  trip.sketch.failedBasisKey = getSketchBasis(trip).key;
  assert.equal(sketchNeedsRedraw(trip), false);
});

test("editing trip details keeps the draft on screen and marks it for a redraw", () => {
  const trip = makeTrip();
  trip.sketch = { ...done, basisKey: getSketchBasis(trip).key };
  applyTripDetailsUpdate(trip, { prompt: "Japan instead", earliestPossibleDate: trip.earliestPossibleDate, latestPossibleDate: trip.latestPossibleDate, destination: "Japan" });
  assert.equal(trip.sketch?.summary, "A plan");
  assert.equal(sketchNeedsRedraw(trip), true);
});

test("the sketch covers exactly the confirmed days", () => {
  const trip = makeTrip();
  trip.confirmedDates = { startDate: "2026-12-03", endDate: "2026-12-09", confirmedAt: "", confirmedByName: "Jay" };
  assert.equal(getSketchRequest(trip).days, 7);
});

test("feasibility warns about short trips, crowded routes, budgets and busy travelers", () => {
  const flightTimes = {
    estimates: [{ from: "Austin, Texas", to: "Europe", distanceKm: 8000, hoursEachWay: 12.5 }],
    longestHoursEachWay: 12.5,
    recommendedMinimumDays: 7,
    note: "",
  };
  const warnings = checkFeasibility({
    dayCount: 4,
    destination: "Europe",
    flightTimes,
    travelers: [{ name: "Jay", budget: 1200, departure: "Austin, Texas" }, { name: "Ryan", budget: 5000, departure: "Austin, Texas" }],
    plannedPlaces: ["Paris", "Amsterdam", "Berlin"],
    multiStop: true,
    notFreeNames: ["Ryan"],
    fares: null,
  });
  assert.deepEqual(warnings.map((item) => item.code), ["too_short_for_flights", "too_many_places", "tight_budget", "not_everyone_free", "wide_budget_gap"]);

  const withFares = checkFeasibility({
    dayCount: 10, destination: "Europe", flightTimes, multiStop: false, notFreeNames: [], plannedPlaces: [],
    travelers: [{ name: "Jay", budget: 1000, departure: "Austin, Texas" }],
    fares: [{ from: "Austin, Texas", lowestUsd: 900 }],
  });
  assert.deepEqual(withFares.map((item) => item.code), ["budget_below_fare"]);

  const fine = checkFeasibility({
    dayCount: 10, destination: "Chicago", flightTimes: null, multiStop: false, notFreeNames: [], plannedPlaces: ["Chicago"],
    travelers: [{ name: "Jay", budget: 2000, departure: "Austin, Texas" }], fares: null,
  });
  assert.deepEqual(fine, []);

  const trip = makeTrip();
  trip.confirmedDates = { startDate: "2026-12-03", endDate: "2026-12-06", confirmedAt: "", confirmedByName: "Jay", outsideSharedDates: true };
  assert.equal(getTripFeasibility(trip, null).some((item) => item.code === "not_everyone_free"), true);
});

test("editing answers after options exist marks them for an automatic redo", () => {
  const trip = makeTrip();
  trip.candidateOptions = [{ id: "c" } as NonNullable<Trip["candidateOptions"]>[number]];
  clearPlanningOutputs(trip);
  assert.equal(trip.optionsNeedRefresh, true);
  assert.equal(trip.candidateOptions, undefined);
  assert.equal(isGeneratingCandidates({ candidatesGeneratingSince: new Date().toISOString() }), true);
  assert.equal(isGeneratingCandidates({ candidatesGeneratingSince: new Date(Date.now() - 10 * 60 * 1000).toISOString() }), false);
});

test("the default way between stops is the fastest of walking, transit and driving", () => {
  const start = { latitude: 35.6595, longitude: 139.7005 };
  assert.equal(fastestMode(start, { latitude: 35.6605, longitude: 139.7015 }), "walk");
  assert.equal(fastestMode(start, { latitude: 35.7148, longitude: 139.7967 }), "transit");
});

test("notifications keep only the newest updates", () => {
  const trip = makeTrip();
  for (let index = 0; index < maximumNotifications + 5; index += 1) pushNotification(trip, `Update ${index}`, tripPath(trip), "jay");
  assert.equal(trip.notifications?.length, maximumNotifications);
  assert.equal(trip.notifications?.at(-1)?.text, `Update ${maximumNotifications + 4}`);
  assert.equal(trip.notifications?.[0].path, "/trip/trip");
});

test("chat requests about yourself are personal, requests for everyone are group", () => {
  assert.equal(detectRequestScope("@muse I'd rather skip the museum and shop in Ginza"), "personal");
  assert.equal(detectRequestScope("@muse I’ll do my own thing for lunch"), "personal");
  assert.equal(detectRequestScope("@muse can we skip the museum"), "group");
  assert.equal(detectRequestScope("@muse I think everyone would like a later start"), "group");
  assert.equal(detectRequestScope("@muse make day 3 more relaxed"), "unclear");
});

test("a rewritten shared stop maps back to the stop it replaced", () => {
  const stop = (time: string, title: string) => ({ time, title, type: "Food" as const, location: "Tokyo", description: title });
  const oldDays: ItineraryDay[] = [{ dayNumber: 1, date: "2026-12-03", title: "Day", activities: [stop("10:00 AM", "Museum"), stop("1:00 PM", "Lunch")] }];
  const newDays: ItineraryDay[] = [{ dayNumber: 1, date: "2026-12-03", title: "Day", activities: [stop("10:00 AM", "Ginza shopping"), stop("1:00 PM", "Lunch")] }];
  assert.deepEqual(personalPlansFromRevision(oldDays, newDays), [{ dayNumber: 1, stopTitle: "Museum", title: "Ginza shopping", location: "Tokyo", note: "Ginza shopping" }]);
});

function flight(arriveAirport: string): FlightOption {
  return { id: arriveAirport, airline: "Air", airlineLogo: null, flightNumbers: [], departAirport: "AUS", departTime: "", arriveAirport, arriveTime: "", durationMinutes: 300, stops: 1, price: 300 };
}

test("a place without an airport gets flights to the nearest airport plus a drive", async () => {
  const searches: string[] = [];
  const result = await findFlightsWithNearbyAirports("Austin, Texas", "Niagara Falls, New York", { outboundDate: "2026-12-03", returnDate: "2026-12-06" }, {
    findCityFlightId: async (city) => (city.startsWith("Austin") ? "/m/0vzm" : "/m/niagara"),
    lookupPoint: async () => ({ latitude: 43.0962, longitude: -79.0377 }),
    findNearbyAirports: async () => [
      { code: "IAG", name: "Niagara Falls International Airport", latitude: 43.1073, longitude: -78.9462, distanceKm: 8 },
      { code: "BUF", name: "Buffalo Niagara International Airport", latitude: 42.9405, longitude: -78.7322, distanceKm: 30 },
    ],
    searchFlights: async (search) => {
      searches.push(search.toId);
      return search.toId === "/m/niagara" ? [] : [flight("BUF"), flight("IAG")];
    },
  });
  assert.deepEqual(searches, ["/m/niagara", "IAG,BUF"]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.groundNote ?? "", /Niagara Falls has no airport/);
  assert.equal(result.options[0].groundTransfer?.airport, "BUF");
  assert.ok((result.options[0].groundTransfer?.minutes ?? 0) > 15);
  // An airport right at the destination needs no drive.
  assert.equal(result.options[1].groundTransfer, undefined);
});

test("cities with their own flights don't look for other airports", async () => {
  let lookedNearby = false;
  const result = await findFlightsWithNearbyAirports("Austin, Texas", "Chicago", { outboundDate: "2026-12-03", returnDate: "2026-12-06" }, {
    findCityFlightId: async () => "/m/id",
    lookupPoint: async () => { lookedNearby = true; return null; },
    findNearbyAirports: async () => [],
    searchFlights: async () => [flight("ORD")],
  });
  assert.equal(result.ok && result.options.length, 1);
  assert.equal(lookedNearby, false);
});

test("nearby airports are read from Wikidata, nearest first, without duplicates", async () => {
  const body = { results: { bindings: [
    { iata: { value: "buf" }, airportLabel: { value: "Buffalo Niagara International Airport" }, coord: { value: "Point(-78.7322 42.9405)" }, dist: { value: "30.1" }, country: { value: "US" } },
    { iata: { value: "BUF" }, airportLabel: { value: "Duplicate" }, coord: { value: "Point(-78.7 42.9)" }, dist: { value: "30.2" } },
    { iata: { value: "X1" }, airportLabel: { value: "Bad code" }, coord: { value: "Point(0 0)" }, dist: { value: "1" } },
  ] } };
  const airports = await findNearbyAirports({ latitude: 43.09, longitude: -79.03 }, (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch);
  assert.deepEqual(airports.map((airport) => airport.code), ["BUF"]);
  assert.equal(airports[0].latitude, 42.9405);
  assert.equal(airports[0].countryCode, "US");
});
