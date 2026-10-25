// Creates (or resets) a ready-made demo trip so you can show the app without
// clicking through every step.
//
//   npm run seed:demo                  full trip with a finished itinerary (default)
//   npm run seed:demo -- --stage ready     everyone filled in, no options yet
//   npm run seed:demo -- --stage options   3 options, nobody has voted
//   npm run seed:demo -- --stage voted     everyone voted, host can create the itinerary
//
// No Muse or SerpApi credits are used. In the itinerary stage the real Google
// Maps places load the first time someone opens the itinerary page.
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const stages = ["ready", "options", "voted", "itinerary"];
const stageArg = process.argv.indexOf("--stage");
const stage = stageArg === -1 ? "itinerary" : process.argv[stageArg + 1];
if (!stages.includes(stage)) {
  console.error(`Unknown stage "${stage}". Use one of: ${stages.join(", ")}.`);
  process.exit(1);
}

function readEnvFile(path) {
  try {
    const values = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
    return values;
  } catch {
    return {};
  }
}

const env = { ...readEnvFile(".env.local"), ...process.env };
const inviteCode = "DEMO01";
const now = new Date().toISOString();
const dates = ["2026-12-17", "2026-12-18", "2026-12-19", "2026-12-20"];

function traveler(name, isHost, city, budget, interests, extra = {}) {
  return {
    id: randomUUID(),
    name,
    isHost,
    departureLocation: city,
    preferencesComplete: true,
    preferences: {
      currency: "USD",
      maximumBudget: budget,
      preferredDurationDays: 4,
      activityInterests: interests,
      lodgingType: "Hotel",
      groupLodgingPreference: "Stay with the group",
      lodgingAmenities: ["Near public transit"],
      ...extra,
    },
    availabilityComplete: true,
    availableDates: dates,
  };
}

const jay = traveler("Jay", true, "Austin, Texas", 3000, ["Food", "Museums & Culture", "Shopping"]);
const henry = traveler("Henry", false, "Houston, Texas", 2400, ["Food", "Nightlife", "Sightseeing"]);
const maya = traveler("Maya", false, "Dallas, Texas", 2800, ["Outdoors", "Relaxation", "Food"], {
  notes: "I would like one slower day.",
});

function option(id, title, summary, rationale, days) {
  return {
    id,
    title,
    destination: "Tokyo, Japan",
    summary,
    rationale,
    estimatedDurationDays: days.length,
    suggestedStartDate: days[0].date,
    suggestedEndDate: days[days.length - 1].date,
    highlights: days.map((day) => day.title),
    considerations: ["Winter days are short, so plan outdoor stops for the morning."],
    days,
    generatedAt: now,
  };
}

function day(dayNumber, title, activities) {
  return {
    dayNumber,
    date: dates[dayNumber - 1],
    title,
    activities: activities.map(([timeOfDay, activityTitle, description]) => ({
      timeOfDay,
      title: activityTitle,
      description,
    })),
  };
}

const candidates = [
  option(
    randomUUID(),
    "Tokyo Classic: Food and Heritage",
    "Four days of temples, markets and museums from one Tokyo hotel base.",
    "Centers the food interest everyone shares, with Ueno museums for Jay and a relaxed pace for Maya.",
    [
      day(1, "Asakusa and Ueno", [["Morning", "Senso-ji Temple", "Walk the temple grounds and Nakamise street."], ["Afternoon", "Tokyo National Museum", "Highlights of Japanese art and history."], ["Evening", "Ameyoko street food", "Casual dinner under the rail arches."]]),
      day(2, "Tsukiji and Ginza", [["Morning", "Tsukiji Outer Market", "Sushi breakfast and market snacks."], ["Afternoon", "Ginza shopping", "Department stores and stationery shops."], ["Evening", "Izakaya dinner", "Small plates near Yurakucho."]]),
      day(3, "Shibuya and Harajuku", [["Morning", "Meiji Jingu", "A quiet forest walk to the shrine."], ["Afternoon", "Harajuku shopping", "Takeshita and Omotesando streets."], ["Evening", "Shibuya Crossing", "Night views and ramen."]]),
    ],
  ),
  option(
    randomUUID(),
    "Neon Tokyo: Shopping, Views and Nights",
    "A high-energy city trip built around Shinjuku, Shibuya and Odaiba.",
    "Strong on shopping and nightlife for Jay and Henry, with a garden morning to balance the pace.",
    [
      day(1, "Shinjuku Arrival", [["Afternoon", "Shinjuku Gyoen", "Easy winter garden walk."], ["Evening", "Omoide Yokocho", "Tiny yakitori bars under the tracks."]]),
      day(2, "Shibuya and Harajuku", [["Morning", "Shibuya Sky", "City views from the rooftop."], ["Afternoon", "Shibuya department stores", "Fashion floors and depachika food halls."], ["Evening", "Shibuya nightlife", "Bars and karaoke."]]),
      day(3, "Akihabara and Odaiba", [["Morning", "Akihabara arcades", "Games, electronics and anime shops."], ["Afternoon", "Odaiba waterfront", "Bay views and shopping malls."], ["Evening", "teamLab Planets", "Immersive digital art museum."]]),
    ],
  ),
  option(
    randomUUID(),
    "Slow Winter Tokyo: Nature and Comfort Food",
    "A calmer trip with parks, an onsen day and warming food.",
    "Built for the outdoor and relaxation interests, with comfort food the whole group can enjoy.",
    [
      day(1, "Yanaka Old Town", [["Morning", "Yanaka Ginza", "Old-town shopping street snacks."], ["Afternoon", "Ueno Park", "Slow stroll past the ponds."], ["Evening", "Nabe hot pot dinner", "Shared hot pot to warm up."]]),
      day(2, "Hakone Day Trip", [["Morning", "Hakone Ropeway", "Mountain views on a clear day."], ["Afternoon", "Lake Ashi cruise", "Relaxed sightseeing by water."], ["Evening", "Onsen soak", "Hot spring bath and dinner."]]),
      day(3, "Gardens and Cafes", [["Morning", "Hamarikyu Gardens", "Tea house in a waterfront garden."], ["Afternoon", "Cafe hopping", "Coffee and sweets in Kiyosumi."], ["Evening", "Tempura dinner", "Farewell meal."]]),
    ],
  ),
];

// Photos for the option cards come from Wikipedia, same as the real app.
async function findImage(query) {
  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query", generator: "search", gsrsearch: query, gsrlimit: "1",
      prop: "pageimages", piprop: "thumbnail", pithumbsize: "1200", format: "json",
    }).toString();
    const response = await fetch(url, { headers: { "User-Agent": "HackTXTripPlanner/1.0 (student hackathon project)" } });
    const body = await response.json();
    return Object.values(body.query?.pages ?? {})[0]?.thumbnail?.source;
  } catch {
    return undefined;
  }
}

const heroPlaces = ["Senso-ji", "Shibuya Crossing", "Hakone"];
await Promise.all(
  candidates.map(async (candidate, index) => {
    candidate.heroPlace = heroPlaces[index];
    candidate.imageUrl = await findImage(heroPlaces[index]);
  }),
);

function buildTrip() {
  const trip = {
    id: randomUUID(),
    inviteCode,
    hostName: "Jay",
    name: "Demo: Tokyo Winter Trip",
    prompt: "A winter trip to Tokyo with food, museums, shopping and one relaxed day.",
    origin: "Austin, Texas",
    destination: "Tokyo, Japan",
    earliestPossibleDate: "2026-12-15",
    latestPossibleDate: "2026-12-31",
    preferredDurationDays: 4,
    expectedTravelerCount: 3,
    status: "collecting_preferences",
    createdAt: now,
    travelers: [jay, henry, maya],
  };

  if (stage === "ready") return trip;

  trip.candidateOptions = candidates;
  trip.candidatesGeneratedAt = now;
  trip.candidatesSource = "mock";
  if (stage === "options") return trip;

  trip.votes = [
    { travelerId: jay.id, candidateId: candidates[1].id, feedback: "Love the mix, but keep one big museum day.", votedAt: now },
    { travelerId: henry.id, candidateId: candidates[1].id, votedAt: now },
    { travelerId: maya.id, candidateId: candidates[2].id, feedback: "I really want one outdoor or onsen day, and a slower pace.", votedAt: now },
  ];
  if (stage === "voted") return trip;

  const activity = (time, title, type, location, description, placeSearchQuery) => ({
    time, title, type, location, description, placeSearchQuery,
  });
  trip.itinerary = {
    id: randomUUID(),
    basedOnCandidateId: candidates[1].id,
    title: "Neon Tokyo with a Garden and Onsen Day",
    destination: "Tokyo, Japan",
    startDate: "2026-12-17",
    endDate: "2026-12-19",
    summary: "Modern Tokyo shopping, views and nightlife, softened with a garden morning and an onsen evening.",
    compromiseExplanation:
      "Option 2 won 2 of 3 votes, so it anchors the plan. To honor Maya's vote and her request for an outdoor day and a slower pace, Day 2 adds a garden morning and an onsen soak, and late-night plans are optional.",
    compromises: [
      "Added a Shinjuku Gyoen garden morning on Day 2 for Maya's outdoor day.",
      "Made late-night bars and karaoke optional so Maya can rest while Henry keeps his nightlife.",
      "Added a Tokyo National Museum afternoon on Day 3 for Jay's big museum day.",
    ],
    days: [
      { dayNumber: 1, date: "2026-12-17", title: "Shinjuku Arrival", activities: [
        activity("10:30 AM", "Check in near Shinjuku Station", "Travel", "Shinjuku, Tokyo", "Meet at one shared, transit-friendly hotel.", ""),
        activity("2:00 PM", "Meiji Jingu forest walk", "Outdoors", "Shibuya, Tokyo", "A calm walk after the flights.", "Meiji Jingu Tokyo"),
        activity("7:00 PM", "Yakitori dinner", "Food", "Omoide Yokocho, Shinjuku", "Tiny grill bars under the rail tracks.", "yakitori Omoide Yokocho Shinjuku Tokyo"),
      ] },
      { dayNumber: 2, date: "2026-12-18", title: "Gardens, Views and Onsen", activities: [
        activity("9:30 AM", "Shinjuku Gyoen winter garden", "Outdoors", "Shinjuku, Tokyo", "A quiet start in the park.", "Shinjuku Gyoen National Garden Tokyo"),
        activity("1:00 PM", "Shibuya Sky and department store food halls", "Sightseeing", "Shibuya, Tokyo", "Rooftop views, then depachika snacks.", "Shibuya Sky Tokyo"),
        activity("6:00 PM", "Group onsen soak", "Relaxation", "Tokyo", "A hot spring bath before dinner.", "onsen near Shibuya Tokyo"),
      ] },
      { dayNumber: 3, date: "2026-12-19", title: "Museums and Farewell", activities: [
        activity("10:00 AM", "Tokyo National Museum", "Museums & Culture", "Ueno, Tokyo", "The big museum day.", "Tokyo National Museum"),
        activity("1:30 PM", "Ameyoko street food", "Food", "Ueno, Tokyo", "Lunch and snacks at the market street.", "Ameyoko Market Ueno Tokyo"),
        activity("6:30 PM", "Farewell ramen dinner", "Food", "Shinjuku, Tokyo", "A last meal together.", "ramen Shinjuku Tokyo"),
      ] },
    ],
    source: "mock",
    generatedAt: now,
  };
  return trip;
}

async function saveWithSupabase() {
  const client = createClient(env.SUPABASE_URL.trim(), env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
    auth: { persistSession: false },
  });
  const removed = await client.from("trips").delete().eq("invite_code", inviteCode);
  if (removed.error) throw new Error(removed.error.message);

  const trip = buildTrip();
  const inserted = await client.from("trips").insert({ id: trip.id, invite_code: inviteCode, data: trip });
  if (inserted.error) throw new Error(inserted.error.message);
  return trip;
}

function saveWithLocalFile() {
  let trips = [];
  try {
    trips = JSON.parse(readFileSync("data/trips.json", "utf8")).trips ?? [];
  } catch {}
  const trip = buildTrip();
  trips = [...trips.filter((item) => item.inviteCode !== inviteCode), trip];
  mkdirSync("data", { recursive: true });
  writeFileSync("data/trips.json", JSON.stringify({ trips }, null, 2));
  return trip;
}

const usingSupabase = Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
const trip = usingSupabase ? await saveWithSupabase() : saveWithLocalFile();
const base = "http://localhost:3000";

console.log(`Demo trip ready (stage: ${stage}, stored in ${usingSupabase ? "Supabase" : "data/trips.json"}).\n`);
console.log(`  Dashboard:  ${base}/trip/${trip.id}`);
console.log(`  Options:    ${base}/trip/${trip.id}/options`);
console.log(`  Itinerary:  ${base}/trip/${trip.id}/itinerary`);
console.log(`  Join link:  ${base}/join?trip=${inviteCode}\n`);
console.log("The app remembers who you are per browser. To act as a traveler, open the dashboard,");
console.log("then paste one of these into the browser console (Cmd+Option+J) and reload:\n");
for (const person of trip.travelers) {
  console.log(`  ${person.name}${person.isHost ? " (host)" : ""}:`);
  console.log(`  localStorage.setItem("hacktx-trip-planner:traveler:${trip.id}", "${person.id}")\n`);
}
