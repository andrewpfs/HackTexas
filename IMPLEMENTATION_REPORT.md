# Implementation Report

Implemented the requested planner changes in the current working tree. No Git operations, dependency installations, real bookings or paid provider calls were performed. No secrets were printed or added to source. The seed script was edited and syntax-checked; it was not run.

## Features and behavior

| Area | Implemented |
| --- | --- |
| Preferences | Only Overall Trip Budget is visible. Optional stored sub-budgets remain supported and survive edits. Preferred Trip Length (In Days) uses a Days suffix. One combined question replaces the final two textareas. Loading trims/deduplicates legacy destinationPreferences and notes; saving uses notes and clears the old destination field. The notes limit is 1,502 characters so the two historical limits plus a paragraph break fit. PlanningContext still receives the notes. |
| Home | Green strongest overlap; traveler avatars, colored interest chips, budgets and available dates; schedule/budget/interests/consensus cues; returning-traveler CTA near the top with signed-in Resume My Trips; six distinct phone screens in an IntersectionObserver scroll story. Desktop uses a sticky phone; mobile shows compact previews beside their respective steps. Reduced-motion CSS disables animation and smooth scrolling. |
| Availability | Mouse/pen pointer-down chooses add/remove mode, entered dates are painted once per gesture, and window pointer-up/cancel/blur ends painting. Keyboard/click and touch taps remain available. Touch scrolling is left alone. Disabled/out-of-window/past dates cannot be painted. |
| Group chat | Ordinary messages validate membership, append the traveler message and return without selecting/calling the reviser. Only a trimmed, case-insensitive @muse prefix invokes it. Chat shows participants plus Muse, helper copy and a clear placeholder. Sending ordinary chat does not display a Muse-thinking response. |
| Major proposals | One open proposal at a time. Strict Muse JSON adds reply_only, personal, shared_minor and shared_major classifications, proposed destination and trip title. Server-side comparison forces destination changes, whole-trip replacement and substantial multi-day rewrites into voting regardless of the model label. Proposal cards include requester, summary, edits, destination, full day preview and traveler votes. |
| Voting | One mutable vote per current traveler. Wait for every actual joined traveler, ignoring expectedTravelerCount. Approvals must exceed rejections; ties reject. Final vote and application run in the repository transaction. Supabase keeps its optimistic locking; the JSON fallback serializes writes so concurrent votes do not overwrite one another. Stale itinerary id/revision marks the proposal stale. Rejection leaves itinerary/travel intact and posts a Muse message. |
| Approved changes | Destination approval updates trip.destination, trip.name, itinerary.destination/title/days/revision/updatedAt. Missing/stale old titles fall back to New Destination Trip. Old places, old-city personal plans, sketch, hotel/flight searches and bookings are cleared. Same-city major revisions retain only unchanged personal stops. All major approvals clear travel. Stored approval data drives the prominent banner. Old in-flight place/travel results and stale booking writes cannot restore the previous plan. |
| Voter identity | Create/join issues a signed per-trip browser cookie. Voting accepts that proof for its own traveler or the existing saved-phone session for its own traveler. Submitted travelerId alone is insufficient. Phone saving/restoration is preserved; a new phone link only grants voting access if existing voter proof was present. The seed script supplies signed proof in its existing demo console commands. See the legacy limitation below. |
| Shared itinerary | Selected day uses an inset blue ring plus scroller padding; transit joins Walk/Bike/Car with a metro icon, approximate 28 km/h plus eight-minute overhead, and the existing map URL transit flag. Selected mode is pale blue with dark text. Reviews collapse by default while ratings/Maps link remain visible. Hero reuses the matching base candidate image, otherwise a saved place image, otherwise navy. Generation/revision prompts and mock output include realistic meals, transit, rest/free blocks and buffers. |
| Dashboard | Availability appears before First Draft. Trip Sketch has stronger hierarchy, route chips, day cards and icons without another photo lookup. |
| Options | Current photo pipeline uses candidate headers plus at most one day photo. Wikipedia runs first and SerpApi fills missing headers. Individual stops use deterministic local emojis. Legacy stop image data is retained, can supply an existing day header, and is not required by the UI. Trips over seven days show seven-day block buttons with native dialogs; smaller trips retain compact day disclosures. Dialogs support backdrop/X/Escape closing, native focus handling and viewport limits. Candidate voting logic is preserved. |
| Navigation and mobile | Four blue progress stages: Get Ready, Itinerary Options & Vote, Shared Itinerary, Book Travel. Plane marker follows the selected stage. All callers and the static demo use the four-stage model. Destination uses existing CityInput on create/edit and stays optional; free-text fallback works when suggestions fail. Avatar uses a native viewport-bounded dialog with internal scrolling and existing autosave. Static headings/labels received a title-case audit. |
| Travel | Existing airline-logo/provider logic remains, with stable logo space and airline-name fallback. Cheapest/Shortest badges compare loaded results and allow ties. Non-bookers see their hotel amount owed near the hotel, checkout and confirmation; it is separate from their own simulated charge and saved on new bookings. Email Confirmation opens an honest prefilled mailto draft or copies text, including trip, items, codes, paid amount and hotel share. No email provider and no Email sent claim. Google Flights/Hotels attribution names SerpApi. |

## Type/schema additions

- CandidateDay.imageUrl?: string.
- ItineraryProposal with base id/revision, requester, old/new destinations, proposed name/days, changes, per-traveler votes, pending/approved/rejected/stale status and decision time.
- Trip.pendingItineraryProposal and Trip.lastApprovedItineraryProposal; planning invalidation clears both.
- RevisionResult.kind/proposedDestination/proposedTripName and matching required strict Muse schema fields. Legacy parser inputs remain supported.
- TravelMode includes transit.
- Traveler.phoneVotingVerified distinguishes a new unsigned phone save from a phone with voter proof; previously saved legacy phones remain compatible.
- Booking.hotelShare stores the hotel/booker/owed amount and optional group confirmation for confirmation summaries.
- Place/travel/booking finish operations accept version/claim checks to discard stale work.

## Tests and validation

- Baseline npm test, npm run lint and npm run build passed before edits. Windows execution policy blocks npm.ps1; npm.cmd was used.
- Added tests/improvements.test.ts using built-in Node tests, injected Muse responses, real repository operations against a temporary JSON store, and a fetch guard that forbids network access.
- Covers ordinary chat/no reviser, case-insensitive mentions, personal/minor changes, major proposal persistence, one open proposal, unique/changeable votes, all-current-travelers rule, concurrent votes, majority approval, tie/rejection, stale base, destination/name/travel invalidation, stale provider results/bookings, place/override clearing, proof ownership, preference compatibility, transit, day grouping, reduced image requests, badge ties, and hotel share/confirmation math.
- Updated tests/serpapi-places.test.ts for day-header photos and retained legacy stop-image data. All previous suites still run.
- Final npm test: PASS, 84 tests across all 12 test commands, 0 failures (65 existing tests plus 19 new tests).
- Final npm run lint: PASS, no warnings or errors.
- Final npm run build: PASS, production build and generated route types succeed.
- The new focused suite also passes independently.
- Local HTTP smoke checks: /, /create, /my-trips and /trip/demo returned HTTP 200 without server-error pages, with paid providers disabled for the temporary dev process.
- scripts/seed-demo.mjs passed node --check.
- Desktop/390px visual inspection and the interactive manual checklist remain unverified: this session exposed no browser surfaces, and opening the in-app browser returned Browser is not available. Source/build checks are not a substitute for those interactions. Live Muse/SerpApi and email-client launching were not exercised.

## Preserved, deferred and limitations

- Preserved existing Next.js/Cache Components, Supabase JSON documents, repository abstraction, candidate generation/voting, Muse generation/revisions, personal plans, real places/reviews, Google Hotels/Flights, phone verification/My Trips, avatars, live refresh, assistant/MCP and simulated bookings. Airline logos and provider integrations already existed; this pass adds layout/badges and does not rebuild them.
- Early flight-price hints are intentionally deferred. A safe implementation needs another cached/rate-limited paid-search claim path to enforce the three-window cap across repeated clicks and viewers, plus browser QA of date selection. The current work does not introduce that extra paid-search surface. No automatic calendar-date searches were added.
- Expedia, new email providers, calendar OAuth, real payments and real bookings were intentionally not added, as requested.
- Legacy identity limitation: an old traveler represented only by a public/localStorage id, with neither signed browser proof nor a previously saved phone, cannot be authenticated retrospectively. Secure voting rejects that identity instead of allowing impersonation. Existing phone saving/restoration, preferences, availability and chat still work. A new phone link from an unsigned old identity can restore the trip but cannot mint voting proof. Newly created/joined travelers and newly seeded demo identities have proof. A separate trusted recovery/upgrade is needed for those older unsigned, unsaved travelers; that recovery UI is not implemented.
- JSON write serialization protects this process's local fallback; Supabase remains the intended storage for multiple server instances.

## Files created

- src/app/components/planning-story.tsx
- src/app/components/returning-traveler.tsx
- src/app/api/trips/[tripId]/itinerary/proposal/route.ts
- src/app/trip/[tripId]/itinerary/proposal-card.tsx
- src/app/trip/[tripId]/options/candidate-days.tsx
- src/app/trip/[tripId]/travel/email-confirmation.tsx
- src/lib/candidate-display.ts
- src/lib/itinerary-chat.ts
- src/lib/itinerary-proposals.ts
- src/lib/preference-text.ts
- src/lib/travel-display.ts
- src/lib/trip-browser-identity.ts
- tests/improvements.test.ts
- IMPLEMENTATION_REPORT.md

## Files modified

- HANDOFF.md
- package.json
- scripts/seed-demo.mjs
- src/app/about/page.tsx
- src/app/api/auth/phone/verify/route.ts
- src/app/api/trips/[tripId]/candidates/photos/route.ts
- src/app/api/trips/[tripId]/itinerary/chat/route.ts
- src/app/api/trips/[tripId]/itinerary/places/route.ts
- src/app/api/trips/[tripId]/itinerary/route.ts
- src/app/api/trips/[tripId]/travel/book/route.ts
- src/app/api/trips/[tripId]/travel/flights/route.ts
- src/app/api/trips/[tripId]/travel/hotels/route.ts
- src/app/api/trips/join/route.ts
- src/app/api/trips/route.ts
- src/app/components/city-input.tsx
- src/app/create/create-trip-form.tsx
- src/app/globals.css
- src/app/join/join-trip-form.tsx
- src/app/page.tsx
- src/app/trip/[tripId]/availability/availability-calendar.tsx
- src/app/trip/[tripId]/avatar-picker.tsx
- src/app/trip/[tripId]/edit/edit-trip-form.tsx
- src/app/trip/[tripId]/itinerary/itinerary-workspace.tsx
- src/app/trip/[tripId]/itinerary/page.tsx
- src/app/trip/[tripId]/not-found.tsx
- src/app/trip/[tripId]/options/candidate-voting.tsx
- src/app/trip/[tripId]/options/option-photos-loader.tsx
- src/app/trip/[tripId]/options/page.tsx
- src/app/trip/[tripId]/page.tsx
- src/app/trip/[tripId]/preferences/preferences-form.tsx
- src/app/trip/[tripId]/progress-nav.tsx
- src/app/trip/[tripId]/travel/page.tsx
- src/app/trip/[tripId]/travel/travel-workspace.tsx
- src/app/trip/[tripId]/trip-sketch-card.tsx
- src/app/trip/demo/page.tsx
- src/lib/itinerary-revision.ts
- src/lib/itinerary-validation.ts
- src/lib/mock-itinerary-planner.ts
- src/lib/muse-itinerary-planner.ts
- src/lib/muse-itinerary-reviser.ts
- src/lib/place-images.ts
- src/lib/serpapi-places.ts
- src/lib/travel-planning.ts
- src/lib/travel-time.ts
- src/lib/trip-repository.ts
- src/lib/trip-store.ts
- src/lib/trip-types.ts
- src/lib/trip-updates.ts
- src/lib/trip-validation.ts
- tests/serpapi-places.test.ts
- tsconfig.tests.json

The additional about/join/not-found/static-demo heading edits are part of the title-case audit. No existing trip records were seeded, reset or migrated during validation.
