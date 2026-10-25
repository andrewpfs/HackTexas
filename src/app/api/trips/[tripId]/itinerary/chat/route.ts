import { after, NextResponse } from "next/server";
import { notifyGroup, voteOpenedText } from "@/lib/group-texts";
import { isMockFallbackEnabled, selectItineraryReviser } from "@/lib/candidate-planner-factory";
import { ChatError, handleItineraryChat } from "@/lib/itinerary-chat";
import { MockItineraryReviser, validateChatInput } from "@/lib/itinerary-revision";
import { MusePlannerError } from "@/lib/muse-client";
import { getSerpApiKey, searchPlaces } from "@/lib/serpapi-places";
import { appendChatMessage, changePersonalOverride, getTripById, saveItineraryProposal, saveItineraryRevision } from "@/lib/trip-repository";
import { logError, logWarn } from "@/lib/server-log";


// Muse and live travel searches can take a minute or more (with retries). Without this,
// Vercel stops the function early and the request fails part of the time.
export const maxDuration = 300;

export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/itinerary/chat">) {
  const { tripId } = await context.params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Write a message first." }, { status: 400 }); }
  const input = validateChatInput(body);
  if (!input.valid) return NextResponse.json({ error: input.error }, { status: 400 });
  try {
    const result = await handleItineraryChat(tripId, input.data, {
      getTripById, appendChatMessage, changePersonalOverride, saveItineraryProposal, saveItineraryRevision,
      async findPlaces(query) {
        const apiKey = getSerpApiKey();
        return apiKey ? searchPlaces({ apiKey, includeReviews: process.env.SERPAPI_INCLUDE_REVIEWS !== "false" }, query, 3) : [];
      },
      async revise(revisionRequest) {
        try { return await selectItineraryReviser().reviser.revise(revisionRequest); }
        catch (error) {
          if (!(error instanceof MusePlannerError)) throw error;
          logError("chat", "Muse reply failed", error, { tripId, mockFallback: isMockFallbackEnabled() });
          if (!isMockFallbackEnabled()) throw new ChatError("Muse couldn't answer right now. Your message was saved; try again in a moment.", 502);
          return new MockItineraryReviser().revise();
        }
      },
    });
    const opened = "proposalOpened" in result && result.proposalOpened ? result.trip.pendingItineraryProposal : undefined;
    if (opened) {
      const origin = new URL(request.url).origin;
      after(() => notifyGroup(result.trip, voteOpenedText(result.trip, opened), origin, input.data.travelerId));
    }
    return NextResponse.json({ itinerary: result.trip.itinerary, messages: result.trip.chat ?? [], changedStops: result.changedStops, proposal: result.trip.pendingItineraryProposal ?? null, approvedProposal: result.trip.lastApprovedItineraryProposal ?? null });
  } catch (error) {
    if (error instanceof ChatError) {
      logWarn("chat", "rejected", { tripId, status: error.status, error: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError("chat", "crashed", error, { tripId });
    return NextResponse.json({ error: "We couldn't send that message. Please try again." }, { status: 500 });
  }
}
