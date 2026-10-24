# Implementation Plan

Each phase should leave the application runnable. Later phases should not block a stable demonstration of earlier MVP work.

## Phase 0 - Repository Foundation

- Record permanent project guidance and product requirements.
- Add placeholder environment variable documentation.
- Replace starter content with a minimal project-ready screen.
- Confirm lint and production build pass.

## Phase 1 - Visual Shell and Navigation

- Create a simple responsive layout, visual style, and primary navigation.
- Add clear empty, loading, and error states only where needed.

## Phase 2 - Create Trip

- Build the host form for intent, origin, optional destination, date window, and duration.
- Validate required fields and date relationships.

## Phase 3 - Join and Share Flow

- Create a trip route and shareable link.
- Let travelers join by name without accounts or passwords.

## Phase 4 - Questionnaire

- Collect budget, duration, interests, lodging preferences, destination preferences, and notes.
- Keep the form easy to complete during the demo.

## Phase 5 - Manual Availability Calendar

- Let each traveler mark available dates inside the host's date window.
- Make selected and unavailable dates visually clear.

## Phase 6 - Persistence and Data Layer

- Define simple typed models for trips, travelers, responses, candidates, votes, itineraries, and overrides.
- Add the smallest reliable persistence approach needed for the demo.
- Keep provider and reasoning boundaries clear.

## Phase 7 - Mock Candidate Generation

- Generate three deterministic mock candidates from stored trip data.
- Support both known- and unknown-destination presentations.
- Use this phase as a fallback for the demo if AI is unavailable.

## Phase 8 - Real Muse Spark Integration

- Call Muse from server-side code only.
- Send structured group inputs and validate structured outputs.
- Fall back safely when the service fails or returns invalid data.

## Phase 9 - Voting and Candidate Feedback

- Allow one vote per traveler and optional written feedback.
- Show group voting progress and results without creating an endless loop.

## Phase 10 - Compromise and Canonical Itinerary

- Perform one compromise or revision pass using votes and feedback.
- Select one candidate and generate the shared canonical itinerary.

## Phase 11 - Global Itinerary Changes

- Let the group propose changes to canonical activities.
- Update the shared itinerary while preserving surrounding schedule constraints.

## Phase 12 - Personal Overrides

- Store only a traveler's changes on top of the canonical itinerary.
- Show group activities, personal activities, participants, and reconvening points clearly.

## Phase 13 - Real Travel and Place Data

- Add a server-side travel or search provider.
- Ground prices, places, schedules, and availability in provider data.
- Keep external data retrieval separate from Muse reasoning.

## Phase 14 - Simulated Booking

- Add review and approval steps for demo booking items.
- Clearly label every confirmation as simulated with no real payment or reservation.

## Phase 15 - Demo and Polish

- Test the complete host-to-itinerary flow with realistic sample data.
- Improve responsive behavior, accessibility, error handling, and loading states.
- Prepare a stable demo fallback and reset process.

## Phase 16 - Optional Stretch Features

- Google Calendar OAuth or Apple Calendar support
- Real booking integrations and payments
- Personal Muse connector or MCP capabilities
- Advanced real-time synchronization
- Full authentication and accounts

Stretch work begins only after the core demo is reliable.
