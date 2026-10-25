# Manual itinerary editing and hotel discovery

October 25, 2026. Changes were made in the current working tree. No Git or GitHub operations were performed.

## Implemented behavior

1. A reusable activity icon helper classifies lodging/check-in/out, flight arrivals and departures, rail, food, and generic activities. The activity title takes precedence over description keywords. Shared itinerary times remain visible. Candidate options reuse the same logistics classification.
2. The existing TripSketchCard now emphasizes destination, origin-to-destination route, and the actual planning window. Day blocks cycle through soft blue, teal, and amber. Explicit morning/afternoon/evening prose is separated when present; existing unstructured prose remains intact. No image discovery pipeline was added.
3. Compromise is now a native button with a visible up/down caret, hover/focus styling, aria-expanded, and aria-controls. Its existing explanation and compromise data are unchanged.
4. Book Flights & Hotels is the main action immediately after the itinerary summary. The detailed travel explanation appears below the workspace and uses a secondary text link to the existing travel route.
5. Each shared stop has a subtle Edit control. Travelers can replace it or add before/after, enter a title and optional location/time/description, preview, save, or cancel. Place matching is optional, uses the existing server-side Google Maps lookup, and shows the returned place for review. Freeform saving works when matching is disabled, unavailable, or finds nothing.
6. Long adjacent driving estimates appear before saving, with Go Back and Add Anyway / Replace Anyway. Both segments are listed when both are long. Missing coordinates do not produce fabricated numbers.
7. The home example uses profile summaries with two interests for Ryan, three for Tin, and one for Jordan. Each has a different budget/date range and a specific request; Tin also has a hotel preference. Preference colors are consistent by interest.
8. The invite component offers Copy Code and Copy Link. The visible dashboard code is a keyboard-accessible copy button with cursor: copy and an accessible label/title. Successful copies show temporary feedback; failures expose a selectable input containing the exact value.
9. Group Chat no longer shows a message count. A small Muse identity appears beside it. Muse bubbles say Muse AI and carry the subtle @muse helper; traveler and system messages do not get that helper. The existing composer hint remains.
10. The scroll-story phone uses a CSS device frame at 9:19.5, up to 280px wide (about 607px tall), with rounded corners, a thin bezel, clipped screen, independent internal scrolling, a decorative speaker/home indicator, and the existing desktop sticky behavior. Mobile width can shrink without stretching the internal content.

## Manual-edit architecture and persistence

`manual-stop-editor.tsx` sends a preview request to the dedicated manual route. The route validates the traveler, itinerary id/revision, stop index, action, text lengths, and clock. It optionally makes one existing Maps place lookup. That result and the edit are signed into a preview valid for 15 minutes, so a save uses the same reviewed place and needs no second lookup.

Saving verifies the signed preview, then calls `editSharedStop()` in the existing trip repository. The repository runs `applyManualEdit()` inside `TripStore.update`, retaining both Supabase optimistic retries and the JSON store's write lock. The base revision is checked within the mutation. A successful change:

- Updates only the targeted day's activities and increments itinerary.revision once.
- Sets itinerary.updatedAt and adds a system Group Update message naming the traveler and change.
- Keeps unrelated stops, days, personal overrides, travel searches, and bookings.
- Uses a newly constructed stop rather than inheriting the replaced stop's matched place/search query. A newly reviewed match may be saved instead.
- Removes personal overrides attached to a replaced stop and marks an open major-change proposal stale.
- Releases an old place-lookup claim; the existing revision guard prevents in-flight old results from overwriting the edit.

No Muse planner/reviser is imported or invoked by this path. This editor cannot change the itinerary destination, region, trip dates, or day structure. Its guidance and explicit whole-trip/destination request checks direct those changes to @muse and the existing voting workflow.

Times accept 12- or 24-hour clocks and are normalized into the existing 12-hour display format. A timed stop is inserted chronologically; duplicate clock times are rejected. An untimed stop retains the requested position without an invented time. Later Muse revisions can preserve an unchanged untimed manual stop; newly generated untimed stops are still rejected. This is not a duration or scheduling solver.

Signed previews use the configured SESSION_SECRET, or a random process-local key if it is absent. With the local fallback, restarting the process expires open previews and requires another review.

## Travel warning calculation

The helper evaluates the previous and next stops after final time ordering. It requires finite, valid latitude/longitude coordinates on both ends. It reuses the existing car estimate: haversine straight-line kilometers × 1.3, divided by 24 km/h, plus four minutes, rounded to minutes. Estimates at or above 120 minutes warn; 119 minutes does not.

No external directions, routing, or map API calculates the warning. Optional Google Maps place matching supplies coordinates only. The warning explicitly calls the time approximate. An unavailable match does not prevent a freeform save.

## Expedia strategy and hotel behavior

`discoverHotels()` uses server-side SerpApi `engine=google` with `site:expedia.com <destination> hotels <check-in> to <check-out>` and offsets 0, 10, and 20. This follows SerpApi's documented [Google offset pagination](https://serpapi.com/blog/serpapi-pagination/). There is no invented Expedia engine, client-side scraping, crawling, or Extract API call.

Only HTTPS Expedia.com-controlled URLs survive. Google redirect wrappers are unwrapped only from Google's known redirect endpoint. Credentials, nonstandard ports, misleading lookalike domains, guides, and destination listing pages are rejected. Hotel property pages are identified by their Expedia property path and deduplicated by property id; query tracking and fragments are removed. Up to 27 hotels are stored.

Expedia results are explicitly labeled Expedia Result and have a real View On Expedia outbound action plus a compact Expedia text mark. No external logo or branding package is needed. Their price, rating, review count, hotel class, and availability are not inferred from titles/snippets. Missing prices remain null and display See Current Price On Expedia. Unpriced hotels are excluded from simulated charges and owed-share calculations, so they never appear as free reservations.

If at least one discovery page succeeds, usable partial results are retained. If no valid hotel results remain, the existing Google Hotels search runs once as fallback. Those results say Google Hotels Result, retain their actual structured provider fields, and do not get Expedia branding. No cross-provider enrichment is performed. If both providers fail, the existing error/retry state remains usable.

Existing cached hotel results are not automatically searched again or relabeled as Expedia. Refresh Hotels allows a new search when no group hotel is selected; selecting the already-picked hotel first releases that selection.

Pagination uses the already-fetched set, nine cards per page, capped at three pages. Only pages supported by the result count render; Previous/Next are disabled at the boundaries. Page changes make no provider request. The last available page has View More On Expedia with safe external-link attributes. It opens the real generic https://www.expedia.com/Hotels entry point; no undocumented destination/date deep link is fabricated. Destination and dates are included in the discovery query, but the generic continuation link does not prefill them.

## Files created

- src/lib/activity-icons.ts
- src/lib/manual-itinerary.ts
- src/lib/manual-edit-preview.ts
- src/lib/invite-copy.ts
- src/lib/hotel-discovery.ts
- src/lib/hotel-display.ts
- src/app/api/trips/[tripId]/itinerary/manual/route.ts
- src/app/trip/[tripId]/itinerary/manual-stop-editor.tsx
- src/app/trip/[tripId]/itinerary/compromise-disclosure.tsx
- tests/manual-hotel.test.ts
- MANUAL_EDIT_HOTEL_REPORT.md

## Files modified

- package.json
- tsconfig.tests.json
- HANDOFF.md
- src/lib/trip-types.ts
- src/lib/trip-repository.ts
- src/lib/candidate-display.ts
- src/lib/itinerary-validation.ts
- src/lib/itinerary-revision.ts
- src/lib/muse-itinerary-reviser.ts
- src/lib/travel-search.ts
- src/lib/travel-planning.ts
- src/lib/travel-display.ts
- src/app/page.tsx
- src/app/components/planning-story.tsx
- src/app/trip/[tripId]/page.tsx
- src/app/trip/[tripId]/copy-invite-link.tsx
- src/app/trip/[tripId]/trip-sketch-card.tsx
- src/app/trip/[tripId]/itinerary/page.tsx
- src/app/trip/[tripId]/itinerary/itinerary-workspace.tsx
- src/app/trip/[tripId]/travel/travel-workspace.tsx
- src/app/api/trips/[tripId]/travel/hotels/route.ts
- tests/improvements.test.ts

## Tests and validation

The new built-in Node suite has 16 passing tests including nested cases. It covers persisted replacement, add before/after, unrelated-data preservation, revision/history updates, stale metadata/override removal, stale revision rejection, no network/Muse calls during mutation, signed preview integrity, clock ordering/validation, untimed compatibility with later Muse revisions, 119/120/121-minute boundaries, both adjacent long segments, missing/invalid coordinates, invite copy values, icons, URL filtering/deduplication, provider labels, null pricing, three-page pagination, date-aware discovery, partial failures, Google Hotels fallback, and exclusion of unpriced hotels from booking/share calculations.

The existing candidate icon expectation was updated for the requested food icon. All existing regression suites remain in npm test. No Jest/Vitest or other dependency was installed. Automated provider responses are mocked; no live Muse or SerpApi requests were made in tests.

- Baseline: npm test, npm run lint, and npm run build passed before edits.
- Final npm test: passed, including all existing suites and the 16 new test cases.
- Final npm run lint: passed.
- Final npm run build: passed; the dedicated manual-edit route is included in the production output.
- Production HTTP smoke check: home returned 200 and rendered the three traveler profiles, all three requests, the phone aspect-ratio class, and Muse AI identity.

Commands use npm.cmd because this Windows PowerShell policy blocks npm.ps1. The npm scripts themselves are unchanged in meaning. Tests emit the existing dependency punycode deprecation warning.

## Existing behavior preserved and verification limits

The current repository already included @muse-only invocation, normal chat without paid AI calls, major-change proposals/voting and destination handling, personal overrides, approximate travel modes including transit, collapsed reviews, seven-day candidate grouping, reduced day-photo lookups, flight logos and cheapest/shortest badges, hotel-share accounting, email drafts, returning traveler flows, city autocomplete, avatar clipping fixes, the shared itinerary hero, and four-stage progress navigation. These systems were reused rather than rebuilt. No early availability flight-price hint implementation was found; none was added.

No connected browser or native UI surface was available: the computer-use inventory returned no apps and no browsers. Consequently the requested interactive desktop/mobile checklist, actual clipboard interactions, 390px phone layout, and live configured Expedia discovery were not manually verified. Persistence, ordering, warning confirmation, and fallback behavior were checked with isolated repository tests and mocked providers. Full browser QA and a live provider smoke check remain outstanding verification work; they are not claimed as completed here. All requested implementation areas are present; optional Extract enrichment and external logos were intentionally unnecessary.
