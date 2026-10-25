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
  hotelStars?: number;
  lodgingAmenities: LodgingAmenity[];
  destinationPreferences?: string;
  notes?: string;
};

export type Traveler = {
  id: string;
  name: string;
  isHost: boolean;
  preferencesComplete: boolean;
  preferences?: TravelerPreferences;
  availabilityComplete?: boolean;
  availableDates?: string[];
};

export type CandidateActivity = {
  timeOfDay: "Morning" | "Afternoon" | "Evening";
  title: string;
  description: string;
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
};

export type Trip = {
  id: string;
  inviteCode: string;
  hostName: string;
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
};

export type CreateTripInput = {
  hostName: string;
  prompt: string;
  origin: string;
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
  origin: string;
  destination?: string;
  earliestPossibleDate: string;
  latestPossibleDate: string;
  preferredDurationDays?: number;
  travelerCount: number;
  expectedTravelerCount?: number;
};
