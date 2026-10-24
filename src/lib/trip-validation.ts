import type { CreateTripInput } from "./trip-types";

export type TripValidationResult =
  | { valid: true; data: CreateTripInput }
  | { valid: false; errors: string[] };

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
