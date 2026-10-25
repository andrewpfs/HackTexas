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
    });
  } catch {
    throw new MusePlannerError("Could not reach the Muse service.");
  }

  if (!response.ok) {
    throw new MusePlannerError(`The Muse service returned an error (HTTP ${response.status}).`);
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new MusePlannerError("Muse returned an empty response.");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new MusePlannerError("Muse returned a response that was not valid JSON.");
  }
}
