# Focused invite and personal-location fixes

## Invite controls and circles

The invite helper previously read `code`, while the dashboard supplies `trip`.
It now supports both parameters. The dashboard visibly displays the actual code.
The native button copies only that code; Copy Link still copies the complete URL.
The code fades into a copy icon and Copy label on pointer hover, shows Copied!
after activation, and keeps its original layout dimensions. The hover effect is
limited to devices with a fine pointer and hover support, so touch users see a
tappable code. The accessible button name includes the code; Enter and Space
use normal button behavior. The existing manual-copy fallback remains available.

The two circles were empty, aria-hidden spans styled as boarding-pass cutouts
at the top and bottom of the invite panel. Both were removed. Traveler avatars,
availability, and progress navigation were left intact.

## Personal-override validation

`personal-location.ts` supplies one shared geographic validator. It first checks
structured country codes when both are available. Country codes come from the
existing Photon provider's destination result and provider place metadata where
available; validation does not depend on matching typed country names.

When country metadata is insufficient, the validator uses coordinates and the
existing `estimateTravel(..., "car")` helper. It checks the closest shared stop
with coordinates before and after the personal activity. If neither exists,
it uses the replaced stop, then structured destination bounds/location as a
fallback. Country-wide bounds avoid treating a country's center as every stop's
location. A country result without bounds does not use its center for this check.

An estimate of **120 minutes or more blocks saving**. These remain the existing
straight-line travel estimates, not live driving routes. No routing provider was
introduced. Missing coordinates or unavailable destination metadata do not create
a fabricated distance or erase a known country/geographic mismatch.

The existing Maps autocomplete remains in use. Personal selections carry a
30-minute server signature binding the provider result, trip, destination, and
available destination metadata. The override API accepts the signed place, not
browser-supplied replacement coordinates or an unselected text location. Tokens
use SESSION_SECRET when configured, with a process-local fallback like the
existing manual-preview approach. A restart without SESSION_SECRET requires a
new selection.

The client checks local geography and requests a non-saving server validation
when a place is selected. It shows an explanation beside the location field and
disables saving until the selection is checked and valid. Changing the location
clears previous errors; outdated validation responses cannot replace newer ones.
Search outages ask the traveler to retry selecting a real place.

The API repeats validation before saving and responds with HTTP 400 for invalid,
unsigned, or expired selections. Persistence checks geography again inside the
atomic update, including a changed destination. Provider errors are not exposed.
The API always requires a real selection; callers cannot disable that requirement
through request fields.

Legacy string-only overrides still load and render through the existing optional
place handling. Normal Muse text-only alternatives retain their existing internal
persistence path. No Muse, shared manual-edit, voting, booking, flight, hotel,
availability, preferences, or trip-creation behavior was changed.

## Files changed

- `src/app/globals.css`
- `src/app/trip/[tripId]/page.tsx`
- `src/app/trip/[tripId]/copy-invite-link.tsx`
- `src/app/trip/[tripId]/itinerary/itinerary-workspace.tsx`
- `src/app/trip/[tripId]/itinerary/place-autocomplete.tsx`
- `src/app/api/trips/[tripId]/itinerary/place-search/route.ts`
- `src/app/api/trips/[tripId]/itinerary/overrides/route.ts`
- `src/lib/invite-copy.ts`
- `src/lib/trip-types.ts`
- `src/lib/selected-place.ts`
- `src/lib/serpapi-places.ts`
- `src/lib/city-search.ts`
- `src/lib/trip-repository.ts`
- `src/lib/personal-location.ts` (new)
- `src/lib/personal-place-selection.ts` (new)
- `tests/manual-hotel.test.ts`
- `FOCUSED_FIX_REPORT.md` (this report)

## Tests and validation

Focused tests were added to the existing Node test setup for the dashboard's
actual invite parameter and separate full-link value; Tokyo and nearby Japanese
places; Houston with and without country metadata; the exact inclusive
120-minute boundary; the next shared stop; Osaka within Japan when local anchors
are absent; incomplete metadata; signed selection tampering and changed
destinations; Photon metadata and outages; server persistence rejecting distant
and unselected manual locations; valid-place persistence and reload; and legacy
text-only overrides. Provider responses are faked; no live SerpApi calls are used.
Server rejection is tested at the persistence boundary, not through a browser
or an HTTP integration test.

- `npm test`: passed, all 13 test commands / 107 tests.
- `npm run lint`: passed.
- `npm run build`: passed, one production build.

An initial full-suite run caught the shared persistence function blocking Muse's
text-only alternatives. That compatibility issue was fixed, and the complete
suite was rerun successfully.

## Remaining manual QA

Browser inventory returned no available browser surfaces. Desktop hover, pointer
leave, actual clipboard writes, keyboard activation, touch interaction, visual
circle removal, and the complete autocomplete/save/refresh flow could not be
manually exercised in this session. The requested interaction checklist remains
for a browser-enabled session. Automated persistence tests verify valid-place
reload and legacy data compatibility.

No Git operations were performed.
