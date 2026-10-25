export type TripStatus = "collecting_preferences";

export const activityInterestOptions = [
  "Food",
  "Sightseeing",
  "Shopping",
  "Museums & Culture",
  "Outdoors",
  "Nightlife",
  "Relaxation",
  "Theme Parks",
  "Sports",
] as const;

export const lodgingTypeOptions = [
  "Hotel",
  "Airbnb / vacation rental",
  "Hostel",
  "Resort",
  "No preference",
  "No need",
] as const;

export const groupLodgingPreferenceOptions = [
  "Stay with the group",
  "Prefer separate lodging",
  "No preference",
] as const;

export const lodgingAmenityOptions = [
  "Breakfast included",
  "Laundry",
  "Kitchen",
  "Gym",
  "Pool",
  "Near public transit",
] as const;

export type ActivityInterest = (typeof activityInterestOptions)[number];
export type LodgingType = (typeof lodgingTypeOptions)[number];
export type GroupLodgingPreference = (typeof groupLodgingPreferenceOptions)[number];
export type LodgingAmenity = (typeof lodgingAmenityOptions)[number];

export type TravelerPreferences = {
  currency: "USD";
  maximumBudget: number;
  foodBudgetPerDay?: number;
  lodgingBudgetPerNight?: number;
  activitiesBudget?: number;
  preferredDurationDays: number;
  activityInterests: ActivityInterest[];
  lodgingType: LodgingType;
  groupLodgingPreference: GroupLodgingPreference;
  // Lodging price level from 1 ($) to 4 ($$$$). Kept under the old field name for stored trips.
  hotelStars?: number;
  activityDetails?: string;
  lodgingAmenities: LodgingAmenity[];
  destinationPreferences?: string;
  notes?: string;
};

export type Traveler = {
  id: string;
  name: string;
  isHost: boolean;
  departureLocation?: string;
  preferencesComplete: boolean;
  preferences?: TravelerPreferences;
  availabilityComplete?: boolean;
  availableDates?: string[];
};

export type CandidateActivity = {
  timeOfDay: "Morning" | "Afternoon" | "Evening";
  title: string;
  description: string;
  // The specific landmark or venue for this stop, as titled on Wikipedia; used to find a photo.
  placeName?: string;
  imageUrl?: string;
};

export type CandidateDay = {
  dayNumber: number;
  date: string;
  title: string;
  activities: CandidateActivity[];
};

export type CandidateTripOption = {
  id: string;
  title: string;
  destination: string;
  summary: string;
  rationale: string;
  estimatedDurationDays: number;
  suggestedStartDate: string;
  suggestedEndDate: string;
  highlights: string[];
  considerations: string[];
  days: CandidateDay[];
  generatedAt: string;
  // The option's best-known attraction and a photo of it, used as the card backdrop.
  heroPlace?: string;
  imageUrl?: string;
};

export type PlannerSource = "muse" | "mock" | "mock-fallback";

export type CandidateVote = {
  travelerId: string;
  candidateId: string;
  feedback?: string;
  votedAt: string;
};

export const itineraryActivityTypes = [
  ...activityInterestOptions,
  "Travel",
  "Free time",
] as const;

export type ItineraryActivityType = (typeof itineraryActivityTypes)[number];

export type PlaceReview = {
  author: string;
  rating: number | null;
  snippet: string;
  date: string;
};

// A real place found through SerpApi (Google Maps) for one itinerary activity.
export type PlaceSuggestion = {
  name: string;
  rating: number | null;
  reviewCount: number | null;
  price: string | null;
  category: string | null;
  address: string | null;
  thumbnail: string | null;
  latitude?: number;
  longitude?: number;
  mapsUrl: string;
  reviews: PlaceReview[];
};

export type ItineraryActivity = {
  time: string;
  title: string;
  type: ItineraryActivityType;
  location: string;
  description: string;
  placeSearchQuery?: string;
  place?: PlaceSuggestion;
};

export type ItineraryDay = {
  dayNumber: number;
  date: string;
  title: string;
  activities: ItineraryActivity[];
};

export type GroupItinerary = {
  id: string;
  basedOnCandidateId: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  summary: string;
  compromiseExplanation: string;
  compromises: string[];
  days: ItineraryDay[];
  source: PlannerSource;
  generatedAt: string;
  // "pending" while a lookup is running, so two viewers don't both spend credits.
  placesStatus?: "pending" | "added";
  placesStartedAt?: string;
  // Bumped each time chat feedback changes the plan.
  revision?: number;
  updatedAt?: string;
};

export type ChatMessage = {
  id: string;
  role: "traveler" | "muse";
  travelerId?: string;
  authorName: string;
  text: string;
  createdAt: string;
  // What Muse changed in the plan, for Muse messages that edited it.
  changes?: string[];
  // The stop the traveler was looking at when they wrote the message.
  focus?: { dayNumber: number; title: string };
};

export type Trip = {
  id: string;
  inviteCode: string;
  hostName: string;
  name?: string;
  prompt: string;
  origin: string;
  destination?: string;
  earliestPossibleDate: string;
  latestPossibleDate: string;
  preferredDurationDays?: number;
  expectedTravelerCount?: number;
  status: TripStatus;
  createdAt: string;
  travelers: Traveler[];
  candidateOptions?: CandidateTripOption[];
  candidatesGeneratedAt?: string;
  candidatesSource?: PlannerSource;
  // "pending" while stop photos are being looked up, so two viewers do not both spend credits.
  optionPhotosStatus?: "pending" | "added";
  optionPhotosStartedAt?: string;
  votes?: CandidateVote[];
  itinerary?: GroupItinerary;
  chat?: ChatMessage[];
};

export type CreateTripInput = {
  hostName: string;
  name?: string;
  prompt: string;
  origin: string;
  destination?: string;
  earliestPossibleDate: string;
  latestPossibleDate: string;
  preferredDurationDays?: number;
  expectedTravelerCount?: number;
};

export type UpdateTripInput = {
  name?: string;
  prompt: string;
  destination?: string;
  earliestPossibleDate: string;
  latestPossibleDate: string;
  preferredDurationDays?: number;
  expectedTravelerCount?: number;
};

export type JoinTripPreview = {
  inviteCode: string;
  displayName: string;
  hostName: string;
  prompt: string;
  destination?: string;
  earliestPossibleDate: string;
  latestPossibleDate: string;
  preferredDurationDays?: number;
  travelerCount: number;
  expectedTravelerCount?: number;
};
