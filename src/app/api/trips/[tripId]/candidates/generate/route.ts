import { after, NextResponse } from "next/server";
import { notifyGroup, optionsReadyText } from "@/lib/group-texts";
import { generateCandidateOptionsForTrip } from "@/lib/candidate-generation";
import { validateCandidateOptions } from "@/lib/candidate-validation";
import {
  isMockFallbackEnabled,
  selectCandidatePlanner,
} from "@/lib/candidate-planner-factory";
import { MockCandidatePlanner } from "@/lib/mock-candidate-planner";
import { MusePlannerError } from "@/lib/muse-candidate-planner";
import { addImagesToCandidates } from "@/lib/place-images";
import { claimCandidateGeneration, getTripById, releaseCandidateGeneration, saveCandidateOptions } from "@/lib/trip-repository";
import type { PlannerSource } from "@/lib/trip-types";
import { logError, logInfo, logWarn } from "@/lib/server-log";

// Muse and the travel searches can take 20-45 seconds; don't let the host cut them off early.
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]/candidates/generate">,
) {
  const { tripId } = await context.params;
  let claimed = false;
  const started = Date.now();
  logInfo("generate", "start", { tripId });

  try {
    const trip = await getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    if (trip.candidateOptions) {
      const existingValidation = validateCandidateOptions(trip.candidateOptions);
      if (existingValidation.valid) {
        return NextResponse.json({
          tripId: trip.id,
          candidateCount: trip.candidateOptions.length,
          optionsPath: `/trip/${trip.id}/options`,
          alreadyGenerated: true,
        });
      }
    }

    // Someone else's browser may already be planning (for example an automatic refresh).
    if ((await claimCandidateGeneration(trip.id)) === "busy") {
      logInfo("generate", "already running in another request", { tripId, since: trip.candidatesGeneratingSince });
      return NextResponse.json({ inProgress: true, optionsPath: `/trip/${trip.id}/options` }, { status: 202 });
    }
    claimed = true;

    const selection = selectCandidatePlanner();
    let plannerSource: PlannerSource = selection.source;
    let generationResult;

    try {
      generationResult = await generateCandidateOptionsForTrip(trip, selection.planner);
    } catch (error) {
      if (!(error instanceof MusePlannerError)) {
        throw error;
      }

      logError("generate", "Muse planner failed", error, { tripId, mockFallback: isMockFallbackEnabled(), ms: Date.now() - started });

      if (!isMockFallbackEnabled()) {
        return NextResponse.json(
          { error: "Muse could not create trip options right now. Please try again." },
          { status: 502 },
        );
      }

      plannerSource = "mock-fallback";
      generationResult = await generateCandidateOptionsForTrip(
        trip,
        new MockCandidatePlanner(),
      );
    }

    if (!generationResult.success && generationResult.reason === "not-ready") {
      logWarn("generate", "group not ready", { tripId, blockers: generationResult.blockers });
      return NextResponse.json(
        {
          error: "The group is not ready to generate trip options yet.",
          blockers: generationResult.blockers,
        },
        { status: 409 },
      );
    }

    if (!generationResult.success) {
      logError("generate", "planner returned invalid options twice", undefined, { tripId, errors: generationResult.errors.slice(0, 5), ms: Date.now() - started });
      return NextResponse.json(
        { error: "The planner could not create valid trip options. Please try again." },
        { status: 500 },
      );
    }

    const saveResult = await saveCandidateOptions(
      trip.id,
      await addImagesToCandidates(generationResult.candidates),
      plannerSource,
    );
    if (saveResult.status === "trip-not-found") {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    const origin = new URL(request.url).origin;
    after(() => notifyGroup(saveResult.trip, optionsReadyText(saveResult.trip), origin));
    logInfo("generate", "done", { tripId, planner: plannerSource, options: generationResult.candidates.length, ms: Date.now() - started });

    return NextResponse.json(
      {
        tripId: trip.id,
        candidateCount: generationResult.candidates.length,
        optionsPath: `/trip/${trip.id}/options`,
        alreadyGenerated: false,
        planner: plannerSource,
      },
      { status: 201 },
    );
  } catch (error) {
    logError("generate", "crashed", error, { tripId, ms: Date.now() - started });
    return NextResponse.json(
      { error: "We could not generate trip options. Please try again." },
      { status: 500 },
    );
  } finally {
    // Saving options already clears the lock; this covers errors and early returns.
    if (claimed) await releaseCandidateGeneration(tripId).catch(() => undefined);
  }
}
