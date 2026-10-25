import { NextResponse } from "next/server";
import { generateCandidateOptionsForTrip } from "@/lib/candidate-generation";
import { MuseCandidatePlanner } from "@/lib/muse-candidate-planner";
import { DEFAULT_MUSE_BASE_URL, DEFAULT_MUSE_MODEL, requestMuseJson } from "@/lib/muse-client";
import { calculatePlanningReadiness } from "@/lib/planning-context";
import { getTripById } from "@/lib/trip-repository";

// Muse and live travel searches can take a minute or more (with retries). Without this,
// Vercel stops the function early and the request fails part of the time.
export const maxDuration = 300;

// Development-only check of the Muse connection. Never available in production
// and never returns the key. GET /api/debug/muse, or ?tripId=... to also try
// planning options for that trip (nothing is saved).
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found." }, { status: 404 });

  const apiKey = process.env.META_API_KEY?.trim() ?? "";
  const baseUrl = process.env.META_API_BASE_URL?.trim() || DEFAULT_MUSE_BASE_URL;
  const model = process.env.META_MODEL?.trim() || DEFAULT_MUSE_MODEL;
  const report: Record<string, unknown> = { keyConfigured: apiKey !== "", keyLength: apiKey.length, baseUrl, model, fallbackToMock: process.env.MUSE_FALLBACK_TO_MOCK === "true" };
  if (!apiKey) return NextResponse.json(report);

  const config = { apiKey, baseUrl, model };
  const pingStart = Date.now();
  try {
    report.ping = await requestMuseJson(config, {
      systemPrompt: "Reply with JSON only.",
      userPrompt: "Say hello in one word.",
      schemaName: "ping",
      schema: { type: "object", additionalProperties: false, required: ["word"], properties: { word: { type: "string" } } },
    });
  } catch (error) {
    report.pingError = error instanceof Error ? error.message : String(error);
  }
  report.pingMs = Date.now() - pingStart;

  const tripId = new URL(request.url).searchParams.get("tripId");
  if (tripId) {
    const trip = await getTripById(tripId);
    if (!trip) {
      report.trip = "not found";
    } else {
      const readiness = calculatePlanningReadiness(trip);
      report.readiness = { ready: readiness.readyForCandidateGeneration, blockers: readiness.blockers.map((item) => item.message) };
      if (readiness.readyForCandidateGeneration) {
        const start = Date.now();
        try {
          const result = await generateCandidateOptionsForTrip(trip, new MuseCandidatePlanner(config));
          report.options = result.success ? result.candidates.map((item) => `${item.title} (${item.suggestedStartDate} to ${item.suggestedEndDate})`) : result;
        } catch (error) {
          report.optionsError = error instanceof Error ? error.message : String(error);
        }
        report.optionsMs = Date.now() - start;
      }
    }
  }
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
