import { logError, logInfo, logWarn } from "./server-log";

export const DEFAULT_MUSE_BASE_URL = "https://api.meta.ai/v1";
export const DEFAULT_MUSE_MODEL = "muse-spark-1.3";

export class MusePlannerError extends Error {}

export type MuseConfig = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

type MuseJsonRequest = {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: object;
};

// Sends one Chat Completions request with a strict JSON schema and returns the
// parsed JSON. Every failure becomes a MusePlannerError so routes can handle it.
// Waits briefly before trying again after a temporary failure.
const retryDelayMs = 800;

// Sends one Chat Completions request with a strict JSON schema and returns the
// parsed JSON. A temporary failure (network, rate limit, server error) is retried
// once. Every failure becomes a MusePlannerError so routes can handle it.
export async function requestMuseJson(config: MuseConfig, request: MuseJsonRequest) {
  const baseUrl = (config.baseUrl ?? DEFAULT_MUSE_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  let response: Response | null = null;
  let failure = "Could not reach the Muse service.";
  const started = Date.now();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    try {
      response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model ?? DEFAULT_MUSE_MODEL,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schemaName, strict: true, schema: request.schema },
          },
        }),
      });
    } catch (error) {
      response = null;
      failure = "Could not reach the Muse service.";
      logError("muse", "network error", error, { step: request.schemaName, attempt: attempt + 1 });
      continue;
    }
    if (response.ok) break;
    failure = `The Muse service returned an error (HTTP ${response.status}).`;
    // Meta's error message says why (bad key, rate limit, schema problem...).
    const detail = (await response.clone().text().catch(() => "")).slice(0, 500);
    logWarn("muse", "error response", { step: request.schemaName, attempt: attempt + 1, status: response.status, detail });
    // Only rate limits and server errors are worth a second try.
    if (response.status !== 429 && response.status < 500) break;
  }

  if (!response || !response.ok) {
    logError("muse", "giving up", failure, { step: request.schemaName, ms: Date.now() - started });
    throw new MusePlannerError(failure);
  }
  logInfo("muse", "ok", { step: request.schemaName, ms: Date.now() - started });

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    logError("muse", "empty response", undefined, { step: request.schemaName });
    throw new MusePlannerError("Muse returned an empty response.");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    logError("muse", "response was not valid JSON", undefined, { step: request.schemaName, start: content.slice(0, 200) });
    throw new MusePlannerError("Muse returned a response that was not valid JSON.");
  }
}
