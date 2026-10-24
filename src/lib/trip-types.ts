export type TripStatus = "collecting_preferences";

export type Traveler = {
  id: string;
  name: string;
  isHost: boolean;
  preferencesComplete: boolean;
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
