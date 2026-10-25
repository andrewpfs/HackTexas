# HackTX Trip Planner

**Existing AI can plan my vacation. This plans *our* vacation.**

Planning a group trip is hard because everyone has different schedules, budgets, home cities, and ideas of fun. This app collects what each traveler wants, finds the dates that work for everyone, and uses Muse Spark (Meta) as a consensus engine to turn the group's answers into one trip, with real places, hotels, and flights.

Built for HackTX 2026.

## What it does

1. **Start a trip.** The host shares a rough idea, a date window, and gets an invite code.
2. **Everyone joins.** No accounts. Each traveler picks their departure city (real cities only), budget, trip length, activities, lodging, and the dates they are free.
3. **See the overlap.** The dashboard shows a calendar shaded by how many people are free each day (hover a day to see who) and a crew card with who still has to finish.
4. **Compare three options.** Muse Spark reasons across every traveler and proposes three trips, each with photos of the stops.
5. **Vote.** Everyone picks a favorite and can say why.
6. **One shared itinerary.** Muse builds a single plan from the winning option and works in the losing voters' feedback, then explains every compromise.
7. **Real places.** Each stop gets a real Google Maps place with ratings, reviews, photos, a map, and walk/bike/car time to the next stop.
8. **Change it by chatting.** Tell Muse "I don't love this stop because…" and it updates the plan for everyone, or, if it's only you, gives you a personal plan for that stop that friends can join.
9. **Start from a sketch.** Right after the host describes the trip ("Japan, we want Tokyo and Osaka, recommend other stuff"), Muse draws a day-by-day first draft with suggestions. The three options later build on it.
10. **Keep your trips without an account.** Verify your phone with a texted code, then open **My Trips** on any device to pick up where you left off.
11. **Let your own AI assistant book.** Each traveler can connect an MCP-capable assistant (the Muse app if it supports custom connectors, or any MCP client) to their part of the trip. It can read the itinerary and booking checklist and record bookings you approve.
12. **Book it (demo).** Real hotels and each traveler's real flights from their own home city, a group hotel picked by the host, and a simulated checkout with confirmation codes. No money is spent.

## Tech

- **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS 4**
- **Muse Spark** through the Meta Model API: trip options, the compromise itinerary, and chat revisions, always with strict JSON schemas and server-side validation
- **SerpApi**: Google Maps places and reviews, Google Hotels, Google Flights
- **Supabase** (Postgres) for storage, with optimistic locking so simultaneous edits never overwrite each other; falls back to a local JSON file without credentials
- **Wikipedia / Wikidata** (free): stop photos and the city ids Google Flights uses
- **Photon** (OpenStreetMap, free): real-time city autocomplete

Every external call happens on the server. API keys never reach the browser.

## Setup

```bash
npm install
```

Create `.env.local` (see `.env.example`):

| Variable | What it's for |
| --- | --- |
| `META_API_KEY` | Muse Spark. Without it a labeled demo planner is used. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | The database. Use the **secret** key (`sb_secret_…`), not the publishable one. Without them, trips are kept in `data/trips.json`. |
| `SERPAPI_API_KEY` | Places, reviews, hotels, and flights. |
| `MUSE_FALLBACK_TO_MOCK` | `true` to use the demo planner if Muse fails during a live demo. |
| `SERPAPI_INCLUDE_REVIEWS` | `false` to skip review snippets and use fewer searches. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Real SMS codes through Twilio Verify. Without them, codes appear on screen in a labeled demo mode. |
| `SESSION_SECRET` | A long random string. Signs sessions and hashes phone numbers and assistant tokens. Required in production. |

For Supabase, run `supabase/schema.sql` once in the SQL Editor, then check the connection:

```bash
npm run db:check
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run seed:demo` | Create a ready-made "Demo: Tokyo Winter Trip" (add `-- --stage ready`, `options`, or `voted` to start earlier in the flow) |
| `npm test` | Run every test suite (no network, no API credits) |
| `npm run lint` / `npm run build` | Lint and production build |
| `npm run db:check` | Check the Supabase connection and table |

## Demo script

1. `npm run seed:demo -- --stage voted`, then open the printed dashboard link.
2. Paste the host's `localStorage` line from the script output into the browser console to act as Jay, and reload.
3. Show the boarding pass, the availability calendar, and the crew card. Click your own avatar to customize it.
4. Open **Compare Options**, then **Create Shared Itinerary**. Show the compromise and the real places.
5. In **Group chat**, try: "I'd rather skip the museum on day 3 and shop in Ginza." Muse gives you a personal plan.
6. Open **Book Travel**: pick a hotel for the group, choose your flight, and approve the demo booking.

## MCP connector

`POST /api/mcp` is a Model Context Protocol server (Streamable HTTP, JSON responses). Create a token on a trip's **Connect** page and send it as `Authorization: Bearer <token>`. Tools:

| Tool | What it does |
| --- | --- |
| `get_my_trip` | The traveler's itinerary, dates, and group, including their personal plans |
| `get_my_bookings` | Their flight, the group hotel, their share, and confirmations |
| `get_booking_details` | Everything needed to book one item |
| `mark_booked` | Records a booking the traveler approved, so the group sees it |

A token only reaches its own traveler's view and can't change the group plan or pay for anything.

## Honest limits

- Travelers are identified by their browser, plus an optional verified phone to reopen trips elsewhere. It's convenience, not full security: anyone with a trip link can act as an unsaved traveler.
- Booking is simulated: confirmation codes are demo codes and nothing is reserved or charged.
- Travel times between stops are straight-line estimates. Use the map link for real routing.
- Flight prices are the round-trip prices Google Flights shows for the outbound leg; the return flight would be chosen at a real checkout.
- Live updates check for changes every 4 seconds rather than streaming.

## Project docs

- `PROJECT_SPEC.md`: product rules
- `IMPLEMENTATION_PLAN.md`: the phase plan
- `AGENTS.md`: guidance for AI coding agents working in this repo
