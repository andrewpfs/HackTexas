// Tagged server logs, so each step is easy to find in Vercel's Logs tab
// (search for "[generate]", "[muse]", and so on). Never pass keys or phone numbers.

type Details = Record<string, unknown>;

function format(area: string, message: string, details?: Details) {
  return details ? `[${area}] ${message} ${JSON.stringify(details)}` : `[${area}] ${message}`;
}

export function logInfo(area: string, message: string, details?: Details) {
  console.log(format(area, message, details));
}

export function logWarn(area: string, message: string, details?: Details) {
  console.warn(format(area, message, details));
}

export function logError(area: string, message: string, error?: unknown, details?: Details) {
  const reason = error instanceof Error ? { error: error.message, stack: error.stack?.split("\n").slice(0, 4).join(" | ") } : error !== undefined ? { error: String(error) } : {};
  console.error(format(area, message, { ...details, ...reason }));
}
