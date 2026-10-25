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
export async function requestMuseJson(config: MuseConfig, request: MuseJsonRequest) {
  const baseUrl = (config.baseUrl ?? DEFAULT_MUSE_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  let response: Response;

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
      // Option planning can take about a minute; never hang forever.
      signal: AbortSignal.timeout(150000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`Muse request "${request.schemaName}" could not reach ${baseUrl}: ${reason}`);
    throw new MusePlannerError(`Could not reach the Muse service (${reason}).`);
  }

  if (!response.ok) {
    // Keep a short piece of the error body so logs say why (bad key, unknown model, schema rejected...).
    const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    console.error(`Muse request "${request.schemaName}" failed: HTTP ${response.status} ${detail}`);
    throw new MusePlannerError(`The Muse service returned an error (HTTP ${response.status}).${detail ? ` ${detail}` : ""}`);
  }

  const body = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string | null; refusal?: string | null } ; finish_reason?: string }[];
  } | null;
  const choice = body?.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content !== "string" || content.trim() === "") {
    const why = choice?.message?.refusal || (choice?.finish_reason ? `finish_reason ${choice.finish_reason}` : "no choices in the response");
    console.error(`Muse request "${request.schemaName}" returned no content: ${why}`);
    throw new MusePlannerError(`Muse returned an empty response (${why}).`);
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    // Some responses wrap the JSON in a ```json fence; accept that too.
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(content)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced) as unknown;
      } catch {
        // Fall through to the error below.
      }
    }
    console.error(`Muse request "${request.schemaName}" returned non-JSON: ${content.slice(0, 200)}`);
    throw new MusePlannerError("Muse returned a response that was not valid JSON.");
  }
}
