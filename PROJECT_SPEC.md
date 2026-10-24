# Project Specification

## Problem

Planning a group trip is difficult because travelers have different schedules, budgets, interests, lodging preferences, and opinions. Existing itinerary tools often focus on generating a plan for one person instead of helping a group reach a practical compromise.

## Core Product Idea

The application is an AI-powered group trip planner. It gathers each traveler's constraints and preferences, helps the group compare a small number of candidate plans, and produces one shared itinerary. Muse Spark is the eventual reasoning and compromise engine across the entire group.

Before consensus, the app may show up to three candidate plans. After consensus, it maintains one canonical group itinerary plus small personal overrides where needed.

## Roles

### Host

The host creates the trip, describes the initial idea, defines the possible travel window, and shares the trip link.

### Traveler

A traveler joins through the shared link using a name and completes an individual questionnaire. The hackathon MVP has no accounts, passwords, or authentication system.

## Host Workflow

The host provides:

- A freeform description of the trip idea
- A home or origin location
- An optional destination
- The earliest possible travel date
- The latest possible travel date
- An approximate desired trip duration, when known

The system then creates the trip and gives the host a shareable link.

## Traveler Workflow

Each traveler opens the shared link, joins with their name, and completes their own questionnaire. Once the group has submitted enough information, the application can prepare candidate plans for group review.

## Questionnaire

The traveler questionnaire includes:

- Maximum personal budget
- Manually selected available dates
- Preferred trip duration
- Activity interests, such as food, sightseeing, shopping, museums, nightlife, outdoors, and relaxation
- Lodging type, such as a hotel or Airbnb
- Desired lodging quality or star level when relevant
- Lodging amenities and other preferences
- Whether the traveler wants to stay with the group or separately
- Destination or city preferences when relevant
- Optional freeform notes

## Manual Availability

Manual availability is required for the MVP. Each traveler uses an in-app calendar or date interface to mark available dates within the host's possible travel window.

Calendar provider integration is not required for the MVP. Google Calendar OAuth is a stretch feature and must not block the core demo.

## Known-Destination Flow

When the host supplies a destination:

1. Travelers submit their questionnaires.
2. The system produces three candidate approaches for that destination.
3. Travelers review and vote on the candidates and may leave feedback.
4. Muse performs one compromise or revision pass.
5. One candidate becomes the basis for the canonical group itinerary.

## Unknown-Destination Flow

When the host does not supply a destination:

1. Travelers submit their questionnaires.
2. The system produces three candidate destinations.
3. Each destination includes enough of a sample plan for the group to understand the option.
4. Travelers vote and may leave feedback.
5. Muse performs one compromise or revision pass.
6. The group selects a destination.
7. The system creates the full canonical itinerary only after destination selection.

## Candidate Plans

Candidate plans help the group compare distinct options before committing. The system should maintain no more than three candidates and should not keep three full editable itineraries indefinitely.

## Voting

Travelers can vote on candidate plans or destinations and may explain what they like or dislike. The initial workflow has one primary vote and feedback phase followed by one compromise or revision phase. It must avoid an endless AI and voting loop.

## Muse Spark Responsibilities

Muse Spark will eventually reason across all travelers rather than behave like a chatbot for one traveler. Its inputs may include:

- Host trip intent
- Traveler questionnaire responses
- Manual availability
- Budgets and preferences
- Candidate votes and feedback
- Current itinerary state
- Relevant real travel data from external providers

Muse should produce structured candidates, compromises, and itinerary changes. It must not invent real flight, hotel, attraction, price, or booking information.

## Canonical Group Itinerary

After candidate selection, the group has one shared canonical itinerary. It may include transportation, lodging, meals, attractions, activities, free time, and reconvening points arranged by day and time.

Later versions should account for geography, travel time, walking or transit time, operating hours, budget, and traveler preferences. The canonical itinerary remains editable and serves as the shared source of truth.

## Global Group Revisions

A group-level revision changes the canonical itinerary for everyone. Muse should eventually evaluate the request using group preferences, feedback, geography, schedule, budget, and nearby itinerary items.

For example, if the whole group rejects a shopping activity, Muse may replace it with a museum that fits the group and does not disrupt dinner plans.

## Personal Overrides

The application must not duplicate the complete itinerary for every traveler. A personal schedule is the canonical group itinerary plus that traveler's overrides.

For example, one traveler may replace a group shopping activity with an arcade visit and rejoin the group for dinner. The interface should clearly distinguish group activities from individual activities, show participants, and show reconvening points. Other travelers may later choose to join an alternative activity.

## Travel Data

Real flights, hotel prices, places, operating hours, and booking information must come from external travel or search providers. External data retrieval is separate from Muse reasoning, and all provider calls must be made from server-side code.

## Booking Concept

The MVP may demonstrate a simulated booking workflow. A traveler can review an item, approve it, and see a demo confirmation that clearly states no payment or real transaction occurred.

The MVP must not spend money, perform actual purchases, or imply that a reservation was completed with a real provider.

## Muse Spark vs. Personal Muse Agent

Muse Spark or the Meta Model API is the group planner. It reasons about shared constraints, compromise, candidate generation, and structured itinerary creation.

A personal Muse agent is a possible future execution assistant for one traveler. With explicit approval, it could eventually read that traveler's booking checklist and perform reservation tasks. Personal agent booking and connector or MCP capabilities are not part of the initial MVP.

## MVP

The MVP should demonstrate the core group coordination flow:

- Host creates a trip with an optional destination and date window
- App creates a shareable link
- Travelers join by name without accounts
- Each traveler submits a questionnaire
- Each traveler manually selects availability
- Group receives up to three mock or AI-generated candidates
- Travelers complete one vote and feedback round
- System establishes one canonical itinerary
- Group changes and personal overrides are represented clearly
- Any booking interaction is simulated and labeled as a demo

Reliability and a coherent end-to-end demonstration are more important than production-scale architecture.

## Stretch Features

- Google Calendar OAuth
- Apple Calendar integration
- Real booking provider integrations
- Real payments
- Personal Muse connector or MCP server
- Automated purchases
- Advanced multi-user real-time synchronization
- Full user accounts and authentication

## Explicitly Out of Scope for MVP

- Real payment processing
- Real purchases or reservations
- Automated booking by a personal agent
- Production-grade authentication
- Required calendar-provider integration
- Keeping three complete itineraries after consensus
- Unlimited AI revision and voting loops
- Advanced real-time collaboration
- Fabricated travel inventory, prices, or availability
