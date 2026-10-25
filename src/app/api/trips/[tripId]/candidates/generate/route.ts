import { after, NextResponse } from "next/server";
import { optionsReadyText, textTravelers } from "@/lib/group-texts";
import { generateCandidateOptionsForTrip } from "@/lib/candidate-generation";
import { validateCandidateOptions } from "@/lib/candidate-validation";
import {
  isMockFallbackEnabled,
  selectCandidatePlanner,
} from "@/lib/candidate-planner-factory";
import { MockCandidatePlanner } from "@/lib/mock-candidate-planner";
import { MusePlannerError } from "@/lib/muse-candidate-planner";
import { addImagesToCandidates } from "@/lib/place-images";
import { getTripById, saveCandidateOptions } from "@/lib/trip-repository";
import type { PlannerSource } from "@/lib/trip-types";

export async function POST(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]/candidates/generate">,
) {
  const { tripId } = await context.params;

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

    const selection = selectCandidatePlanner();
    let plannerSource: PlannerSource = selection.source;
    let generationResult;

    try {
      generationResult = await generateCandidateOptionsForTrip(trip, selection.planner);
    } catch (error) {
      if (!(error instanceof MusePlannerError)) {
        throw error;
      }

      console.error("Muse planner failed:", error.message);

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
      return NextResponse.json(
        {
          error: "The group is not ready to generate trip options yet.",
          blockers: generationResult.blockers,
        },
        { status: 409 },
      );
    }

    if (!generationResult.success) {
      console.error("Candidate planner returned invalid output:", generationResult.errors);
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
    after(() => textTravelers(saveResult.trip, optionsReadyText(saveResult.trip, origin)));

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
    console.error("Failed to generate trip options:", error);
    return NextResponse.json(
      { error: "We could not generate trip options. Please try again." },
      { status: 500 },
    );
  }
}
