import {
  activityInterestOptions,
  groupLodgingPreferenceOptions,
  lodgingAmenityOptions,
  lodgingTypeOptions,
  type ActivityInterest,
  type CreateTripInput,
  type GroupLodgingPreference,
  type LodgingAmenity,
  type LodgingType,
  type TravelerPreferences,
} from "./trip-types";

export type TripValidationResult =
  | { valid: true; data: CreateTripInput }
  | { valid: false; errors: string[] };

export type JoinTripValidationResult =
  | { valid: true; data: { inviteCode: string; travelerName: string } }
  | { valid: false; error: string };

export type PreferencesValidationResult =
  | { valid: true; data: TravelerPreferences }
  | { valid: false; errors: string[] };

export const maximumTravelerNameLength = 80;
export const maximumDestinationPreferencesLength = 500;
export const maximumNotesLength = 1000;

export function normalizeInviteCode(inviteCode: string) {
  return inviteCode.trim().toUpperCase();
}

function readRequiredText(value: unknown, label: string, errors: string[]) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} is required.`);
    return "";
  }

  return value.trim();
}

function readOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    return undefined;
  }

  return trimmedValue;
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readOptionalInteger(value: unknown, label: string, maximum: number, errors: string[]) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > maximum) {
    errors.push(`${label} must be a whole number between 1 and ${maximum}.`);
    return undefined;
  }

  return numberValue;
}

export function validateCreateTripInput(body: unknown): TripValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, errors: ["Please provide valid trip details."] };
  }

  const values = body as Record<string, unknown>;
  const errors: string[] = [];
  const hostName = readRequiredText(values.hostName, "Your name", errors);
  const prompt = readRequiredText(values.prompt, "Trip idea", errors);
  const origin = readRequiredText(values.origin, "Starting city", errors);
  const destination = readOptionalText(values.destination);
  const earliestPossibleDate = readRequiredText(values.earliestPossibleDate, "Earliest date", errors);
  const latestPossibleDate = readRequiredText(values.latestPossibleDate, "Latest date", errors);

  if (earliestPossibleDate !== "" && !isValidDateString(earliestPossibleDate)) {
    errors.push("Earliest date must be a valid date.");
  }

  if (latestPossibleDate !== "" && !isValidDateString(latestPossibleDate)) {
    errors.push("Latest date must be a valid date.");
  }

  if (
    isValidDateString(earliestPossibleDate) &&
    isValidDateString(latestPossibleDate) &&
    latestPossibleDate < earliestPossibleDate
  ) {
    errors.push("Latest date cannot be before earliest date.");
  }

  const preferredDurationDays = readOptionalInteger(values.preferredDurationDays, "Preferred duration", 365, errors);
  const expectedTravelerCount = readOptionalInteger(values.expectedTravelerCount, "Expected traveler count", 100, errors);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      hostName,
      prompt,
      origin,
      destination,
      earliestPossibleDate,
      latestPossibleDate,
      preferredDurationDays,
      expectedTravelerCount,
    },
  };
}

export function validateJoinTripInput(body: unknown): JoinTripValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, error: "Please provide an invite code and your name." };
  }

  const values = body as Record<string, unknown>;
  if (typeof values.inviteCode !== "string") {
    return { valid: false, error: "Invite code is required." };
  }

  const inviteCode = normalizeInviteCode(values.inviteCode);
  if (inviteCode === "") {
    return { valid: false, error: "Invite code is required." };
  }

  if (typeof values.travelerName !== "string" || values.travelerName.trim() === "") {
    return { valid: false, error: "Your name is required." };
  }

  const travelerName = values.travelerName.trim();
  if (travelerName.length > maximumTravelerNameLength) {
    return {
      valid: false,
      error: `Your name must be ${maximumTravelerNameLength} characters or fewer.`,
    };
  }

  return { valid: true, data: { inviteCode, travelerName } };
}

function readMoneyAmount(
  value: unknown,
  label: string,
  required: boolean,
  errors: string[],
) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      errors.push(`${label} is required.`);
    }
    return undefined;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    errors.push(`${label} must be a positive amount.`);
    return undefined;
  }

  return numberValue;
}

function readSupportedValue<T extends string>(
  value: unknown,
  label: string,
  options: readonly T[],
  errors: string[],
) {
  if (typeof value !== "string" || !options.includes(value as T)) {
    errors.push(`Please choose a supported ${label.toLowerCase()}.`);
    return undefined;
  }

  return value as T;
}

function readSupportedValues<T extends string>(
  value: unknown,
  label: string,
  options: readonly T[],
  errors: string[],
) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be a list.`);
    return [];
  }

  const selectedValues: T[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !options.includes(item as T)) {
      errors.push(`${label} contains an unsupported choice.`);
      return [];
    }

    if (!selectedValues.includes(item as T)) {
      selectedValues.push(item as T);
    }
  }

  return selectedValues;
}

function readLengthLimitedText(
  value: unknown,
  label: string,
  maximumLength: number,
  errors: string[],
) {
  const text = readOptionalText(value);
  if (text && text.length > maximumLength) {
    errors.push(`${label} must be ${maximumLength} characters or fewer.`);
    return undefined;
  }

  return text;
}

export function validateTravelerPreferences(body: unknown): PreferencesValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, errors: ["Please provide valid preference details."] };
  }

  const values = body as Record<string, unknown>;
  const errors: string[] = [];
  const maximumBudget = readMoneyAmount(values.maximumBudget, "Maximum trip budget", true, errors);
  const foodBudgetPerDay = readMoneyAmount(values.foodBudgetPerDay, "Food budget per day", false, errors);
  const lodgingBudgetPerNight = readMoneyAmount(values.lodgingBudgetPerNight, "Lodging budget per night", false, errors);
  const activitiesBudget = readMoneyAmount(values.activitiesBudget, "Activities budget", false, errors);
  const preferredDurationDays = readOptionalInteger(values.preferredDurationDays, "Preferred duration", 365, errors);

  if (preferredDurationDays === undefined && (values.preferredDurationDays === undefined || values.preferredDurationDays === null || values.preferredDurationDays === "")) {
    errors.push("Preferred duration is required.");
  }

  const activityInterests = readSupportedValues<ActivityInterest>(
    values.activityInterests,
    "Activity interests",
    activityInterestOptions,
    errors,
  );
  if (activityInterests.length === 0) {
    errors.push("Choose at least one activity interest.");
  }

  const lodgingType = readSupportedValue<LodgingType>(values.lodgingType, "lodging type", lodgingTypeOptions, errors);
  const groupLodgingPreference = readSupportedValue<GroupLodgingPreference>(
    values.groupLodgingPreference,
    "group lodging preference",
    groupLodgingPreferenceOptions,
    errors,
  );
  let lodgingAmenities: LodgingAmenity[] = [];
  if (values.lodgingAmenities !== undefined && values.lodgingAmenities !== null) {
    lodgingAmenities = readSupportedValues<LodgingAmenity>(
      values.lodgingAmenities,
      "Lodging amenities",
      lodgingAmenityOptions,
      errors,
    );
  }

  let hotelStars: number | undefined;
  if (values.hotelStars !== undefined && values.hotelStars !== null && values.hotelStars !== "") {
    const starValue = typeof values.hotelStars === "number" ? values.hotelStars : Number(values.hotelStars);
    if (!Number.isInteger(starValue) || starValue < 1 || starValue > 5) {
      errors.push("Hotel quality must be a whole number from 1 to 5.");
    } else {
      hotelStars = starValue;
    }
  }

  const destinationPreferences = readLengthLimitedText(
    values.destinationPreferences,
    "Destination preferences",
    maximumDestinationPreferencesLength,
    errors,
  );
  const notes = readLengthLimitedText(values.notes, "Notes", maximumNotesLength, errors);

  if (errors.length > 0 || maximumBudget === undefined || preferredDurationDays === undefined || !lodgingType || !groupLodgingPreference) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      currency: "USD",
      maximumBudget,
      foodBudgetPerDay,
      lodgingBudgetPerNight,
      activitiesBudget,
      preferredDurationDays,
      activityInterests,
      lodgingType,
      groupLodgingPreference,
      hotelStars,
      lodgingAmenities,
      destinationPreferences,
      notes,
    },
  };
}
