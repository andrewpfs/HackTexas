import { NextResponse } from "next/server";
import { generateCandidateOptionsForTrip } from "@/lib/candidate-generation";
import { validateCandidateOptions } from "@/lib/candidate-validation";
import { MockCandidatePlanner } from "@/lib/mock-candidate-planner";
import { getTripById, saveCandidateOptions } from "@/lib/trip-repository";

export async function POST(
  _request: Request,
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

    const planner = new MockCandidatePlanner();
    const generationResult = await generateCandidateOptionsForTrip(trip, planner);

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

    const saveResult = await saveCandidateOptions(trip.id, generationResult.candidates);
    if (saveResult.status === "trip-not-found") {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        tripId: trip.id,
        candidateCount: generationResult.candidates.length,
        optionsPath: `/trip/${trip.id}/options`,
        alreadyGenerated: false,
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
