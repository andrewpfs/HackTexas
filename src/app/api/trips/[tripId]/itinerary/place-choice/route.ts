import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { lookupDestinationArea } from "@/lib/city-search";
import { notifyGroup, voteOpenedText } from "@/lib/group-texts";
import { createItineraryProposal } from "@/lib/itinerary-proposals";
import { makeChatMessage } from "@/lib/itinerary-revision";
import { personalLocationError } from "@/lib/personal-location";
import { readSessionValue, sessionCookieName } from "@/lib/phone-auth";
import { canActAsTraveler, travelerCookieName } from "@/lib/trip-browser-identity";
import { changePersonalOverride, getTripById, markPlaceOptionChosen, saveItineraryProposal } from "@/lib/trip-repository";

// A traveler picks one of the 3 places Muse found for a stop: either propose it to
// the group (a vote; if it loses it becomes their personal plan) or keep it just for them.
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/itinerary/place-choice">) {
  const { tripId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { travelerId?: unknown; messageId?: unknown; placeIndex?: unknown; mode?: unknown };
  const travelerId = typeof body.travelerId === "string" ? body.travelerId : "";
  const mode = body.mode === "group" || body.mode === "me" ? body.mode : null;
  if (!mode || typeof body.messageId !== "string" || typeof body.placeIndex !== "number") {
    return NextResponse.json({ error: "Pick a place first." }, { status: 400 });
  }

  const trip = await getTripById(tripId);
  if (!trip?.itinerary) return NextResponse.json({ error: "There is no shared itinerary yet." }, { status: 404 });
  const cookieStore = await cookies();
  const session = readSessionValue(cookieStore.get(sessionCookieName)?.value);
  const traveler = trip.travelers.find((item) => item.id === travelerId);
  if (!traveler || !canActAsTraveler(trip, travelerId, cookieStore.get(travelerCookieName(tripId))?.value, session)) {
    return NextResponse.json({ error: "Open this trip from your invite link on this device first." }, { status: 403 });
  }

  const message = trip.chat?.find((item) => item.id === body.messageId);
  const options = message?.placeOptions;
  const place = options?.places[body.placeIndex];
  if (!options || !place) return NextResponse.json({ error: "Those options are no longer available." }, { status: 404 });
  if (options.chosen) return NextResponse.json({ error: "Someone already picked from these options." }, { status: 409 });

  const itinerary = trip.itinerary;
  const day = itinerary.days.find((item) => item.dayNumber === options.dayNumber);
  const stopIndex = day?.activities.findIndex((item) => item.time === options.stopTime && item.title === options.stopTitle) ?? -1;
  if (!day || stopIndex < 0) return NextResponse.json({ error: "That stop changed. Ask @muse again for fresh options." }, { status: 409 });

  const area = await lookupDestinationArea(itinerary.destination);
  const locationError = personalLocationError(itinerary, day.dayNumber, options.stopTime, options.stopTitle, place, area);
  if (locationError) return NextResponse.json({ error: locationError }, { status: 400 });

  const origin = new URL(request.url).origin;
  if (mode === "group") {
    const stop = day.activities[stopIndex];
    const days = structuredClone(itinerary.days);
    days.find((item) => item.dayNumber === day.dayNumber)!.activities[stopIndex] = {
      ...stop,
      title: place.name,
      location: place.address || place.name,
      placeSearchQuery: [place.name, place.address].filter(Boolean).join(" "),
      place,
    };
    const change = `Day ${day.dayNumber}: ${place.name} instead of ${stop.title}`;
    const proposal = createItineraryProposal(trip, traveler.id, { reply: `${traveler.name} suggests ${place.name} for ${stop.title} on Day ${day.dayNumber}.`, changes: [change], days });
    const museMessage = makeChatMessage({ role: "muse", authorName: "Muse", text: `${traveler.name} picked ${place.name} for Day ${day.dayNumber}. It's up for a group vote; if the group says no, it becomes ${traveler.name}'s personal plan.`, changes: [change] });
    const saved = await saveItineraryProposal(tripId, proposal, museMessage);
    if (saved.status === "already-open") return NextResponse.json({ error: "Finish the open vote first, then propose this." }, { status: 409 });
    if (saved.status !== "saved") return NextResponse.json({ error: "The plan changed. Ask @muse again for fresh options." }, { status: 409 });
    after(() => notifyGroup(saved.trip, voteOpenedText(saved.trip, proposal), origin, traveler.id));
  } else {
    const result = await changePersonalOverride(tripId, {
      action: "add", travelerId, dayNumber: day.dayNumber, stopTime: options.stopTime, stopTitle: options.stopTitle,
      title: place.name, location: place.address || place.name, place, destinationArea: area,
      expectedDestination: itinerary.destination, requireSelectedPlace: true,
      note: [place.category, place.rating ? `★ ${place.rating}` : null].filter(Boolean).join(" · "),
    });
    if (result.status === "invalid-location") return NextResponse.json({ error: result.error }, { status: 400 });
    if (result.status !== "updated") return NextResponse.json({ error: "Couldn't save your plan. Try again." }, { status: 409 });
  }

  const updated = await markPlaceOptionChosen(tripId, body.messageId, { placeIndex: body.placeIndex, mode, travelerName: traveler.name });
  return NextResponse.json({ itinerary: updated?.itinerary, messages: updated?.chat ?? [], proposal: updated?.pendingItineraryProposal ?? null, approvedProposal: updated?.lastApprovedItineraryProposal ?? null });
}
