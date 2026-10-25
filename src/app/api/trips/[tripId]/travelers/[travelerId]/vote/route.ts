import { NextResponse } from "next/server";
import { getTripById, saveTravelerVote } from "@/lib/trip-repository";
import { getVotingSummary, validateVoteInput } from "@/lib/voting";

export async function PUT(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/vote">,
) {
  const { tripId, travelerId } = await context.params;
  const trip = await getTripById(tripId);

  if (!trip) {
    return NextResponse.json({ error: "We couldn't find that trip." }, { status: 404 });
  }

  if (!trip.travelers.some((traveler) => traveler.id === travelerId)) {
    return NextResponse.json({ error: "We couldn't find that traveler on this trip." }, { status: 404 });
  }

  if (!trip.candidateOptions || trip.candidateOptions.length === 0) {
    return NextResponse.json({ error: "There are no trip options to vote on yet." }, { status: 409 });
  }

  if (trip.itinerary) {
    return NextResponse.json(
      { error: "Voting is closed because the shared itinerary was already created." },
      { status: 409 },
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Please choose a trip option." }, { status: 400 });
  }

  const validation = validateVoteInput(requestBody, trip.candidateOptions);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors[0], errors: validation.errors },
      { status: 400 },
    );
  }

  try {
    const result = await saveTravelerVote(
      tripId,
      travelerId,
      validation.data.candidateId,
      validation.data.feedback,
    );

    if (result.status === "finalized") {
      return NextResponse.json(
        { error: "Voting is closed because the shared itinerary was already created." },
        { status: 409 },
      );
    }
    if (result.status !== "updated") {
      return NextResponse.json({ error: "We couldn't save that vote." }, { status: 404 });
    }

    const summary = getVotingSummary(result.trip);
    return NextResponse.json({
      vote: result.vote,
      votedCount: summary.votedCount,
      travelerCount: summary.travelerCount,
      allVoted: summary.allVoted,
    });
  } catch (error) {
    console.error("Failed to save vote:", error);
    return NextResponse.json({ error: "We could not save your vote. Please try again." }, { status: 500 });
  }
}
