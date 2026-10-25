import test from "node:test";
import assert from "node:assert/strict";
import { addPlacesToItinerary, addSerpPhotosToCandidates, getPlaceSearchQuery, lookupPlace } from "../src/lib/serpapi-places";
import type { GroupItinerary } from "../src/lib/trip-types";

type Handler = (params: URLSearchParams) => unknown;

function fakeSerpApi(handler: Handler) {
  const calls: URLSearchParams[] = [];
  const impl = (async (input: URL) => {
    const params = new URL(input).searchParams;
    calls.push(params);
    return new Response(JSON.stringify(handler(params)), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const ichiran = {
  title: "Ichiran Shinjuku",
  place_id: "place-1",
  data_id: "0x1:0x2",
  rating: 4.4,
  reviews: 12345,
  price: "¥1,000–2,000",
  type: "Ramen restaurant",
  address: "3-34-11 Shinjuku, Tokyo",
  thumbnail: "https://example.com/ichiran.jpg",
};

function makeItinerary(): GroupItinerary {
  return {
    id: "itinerary-1",
    basedOnCandidateId: "b",
    title: "Tokyo",
    destination: "Tokyo, Japan",
    startDate: "2026-12-17",
    endDate: "2026-12-17",
    summary: "Summary",
    compromiseExplanation: "Explanation",
    compromises: [],
    days: [
      {
        dayNumber: 1,
        date: "2026-12-17",
        title: "Day one",
        activities: [
          { time: "10:00 AM", title: "Arrive", type: "Travel", location: "Narita", description: "Fly in", placeSearchQuery: "" },
          { time: "1:00 PM", title: "Ramen lunch", type: "Food", location: "Shinjuku", description: "Eat", placeSearchQuery: "ramen Shinjuku Tokyo" },
          { time: "7:00 PM", title: "Ramen dinner", type: "Food", location: "Shinjuku", description: "Again", placeSearchQuery: "Ramen Shinjuku Tokyo" },
        ],
      },
    ],
    source: "mock",
    generatedAt: "2026-10-24T00:00:00.000Z",
  };
}

test("lookupPlace maps the top result and attaches review snippets", async () => {
  const { impl, calls } = fakeSerpApi((params) =>
    params.get("engine") === "google_maps"
      ? { local_results: [ichiran, { title: "Second place" }] }
      : { reviews: [{ rating: 5, date: "a week ago", snippet: "Best tonkotsu.", user: { name: "Aiko" } }, { snippet: "" }] },
  );

  const place = await lookupPlace({ apiKey: "k", includeReviews: true, fetchImpl: impl }, "ramen Shinjuku");
  assert.ok(place);
  assert.equal(place.name, "Ichiran Shinjuku");
  assert.equal(place.reviewCount, 12345);
  assert.deepEqual(place.reviews, [{ author: "Aiko", rating: 5, snippet: "Best tonkotsu.", date: "a week ago" }]);
  assert.ok(place.mapsUrl.includes("query_place_id=place-1"));
  assert.equal(calls[1].get("data_id"), "0x1:0x2");
});

test("lookupPlace uses place_results and returns null when nothing matches", async () => {
  const single = fakeSerpApi(() => ({ place_results: ichiran }));
  const place = await lookupPlace({ apiKey: "k", fetchImpl: single.impl }, "Ichiran Shinjuku");
  assert.equal(place?.name, "Ichiran Shinjuku");
  assert.equal(single.calls.length, 1);

  const listType = fakeSerpApi(() => ({ local_results: [{ ...ichiran, type: ["Shinto shrine", "Tourist attraction"] }] }));
  assert.equal((await lookupPlace({ apiKey: "k", fetchImpl: listType.impl }, "shrine"))?.category, "Shinto shrine");

  const empty = fakeSerpApi(() => ({ local_results: [] }));
  assert.equal(await lookupPlace({ apiKey: "k", fetchImpl: empty.impl }, "nothing"), null);
});

test("travel and free-time activities are not searched", () => {
  const [travel, food] = makeItinerary().days[0].activities;
  assert.equal(getPlaceSearchQuery(travel, "Tokyo"), null);
  assert.equal(getPlaceSearchQuery(food, "Tokyo"), "ramen Shinjuku Tokyo");
  assert.equal(getPlaceSearchQuery({ ...food, placeSearchQuery: undefined }, "Tokyo"), "Ramen lunch Shinjuku");
});

test("addPlacesToItinerary skips travel, reuses repeated searches, and leaves the input unchanged", async () => {
  const { impl, calls } = fakeSerpApi(() => ({ local_results: [ichiran] }));
  const itinerary = makeItinerary();
  const result = await addPlacesToItinerary(itinerary, { apiKey: "k", fetchImpl: impl });

  assert.equal(result.foundCount, 2);
  assert.equal(calls.length, 1);
  assert.equal(result.days[0].activities[0].place, undefined);
  assert.equal(result.days[0].activities[1].place?.name, "Ichiran Shinjuku");
  assert.equal(itinerary.days[0].activities[1].place, undefined);
});

test("addPlacesToItinerary counts failures without throwing", async () => {
  const impl = (async () => new Response(JSON.stringify({ error: "Invalid API key." }), { status: 200 })) as unknown as typeof fetch;
  const result = await addPlacesToItinerary(makeItinerary(), { apiKey: "bad", fetchImpl: impl });

  assert.equal(result.foundCount, 0);
  assert.equal(result.failedCount, 2);
});

test("Google Maps photos fill one day header without looking up individual stops", async () => {
  const { impl, calls } = fakeSerpApi(() => ({ local_results: [{ ...ichiran, thumbnail: "https://img.example/shop.jpg" }] }));
  const candidate = {
    destination: "Tokyo",
    imageUrl: "https://img.example/hero.jpg",
    days: [
      { imageUrl: undefined as string | undefined, activities: [
        { title: "Ramen lunch", placeName: "Ichiran Shinjuku", imageUrl: undefined as string | undefined },
        { title: "Ramen dinner", placeName: "Ichiran Shinjuku", imageUrl: undefined as string | undefined },
        { title: "Temple", placeName: "Senso-ji", imageUrl: "https://img.example/temple.jpg" as string | undefined },
      ] },
    ],
  };

  const result = await addSerpPhotosToCandidates([candidate], { apiKey: "k", fetchImpl: impl });
  const stops = result.candidates[0].days[0].activities;
  assert.equal(result.candidates[0].days[0].imageUrl, "https://img.example/shop.jpg");
  assert.equal(stops[0].imageUrl, undefined);
  assert.equal(stops[1].imageUrl, undefined);
  assert.equal(stops[2].imageUrl, "https://img.example/temple.jpg");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].get("engine"), "google_maps");
});
