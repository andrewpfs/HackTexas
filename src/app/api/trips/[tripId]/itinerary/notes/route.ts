import { NextResponse } from "next/server";
import { changeItineraryNote, type NoteAction } from "@/lib/trip-repository";
import { itineraryNoteKinds, type ItineraryNoteKind } from "@/lib/trip-types";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const maximumNoteLength = 400;

// Add or remove a note on the shared itinerary (on one stop or the whole trip).
export async function POST(request: Request, context: RouteContext<"/api/trips/[tripId]/itinerary/notes">) {
  const { tripId } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Write a note first." }, { status: 400 });

  const travelerId = text(body.travelerId, 80);
  if (!travelerId) return NextResponse.json({ error: "Join this trip on this device first." }, { status: 400 });

  let change: NoteAction;
  if (body.action === "add") {
    const noteText = text(body.text, maximumNoteLength);
    if (!noteText) return NextResponse.json({ error: "Write a note first." }, { status: 400 });
    const kind = itineraryNoteKinds.includes(body.kind as ItineraryNoteKind) ? (body.kind as ItineraryNoteKind) : "note";
    const stopKey = text(body.stopKey, 300);
    change = {
      action: "add",
      travelerId,
      kind,
      text: noteText,
      ...(stopKey && typeof body.dayNumber === "number" ? { stopKey, dayNumber: body.dayNumber, stopTitle: text(body.stopTitle, 200) } : {}),
    };
  } else if (body.action === "remove") {
    change = { action: "remove", travelerId, noteId: text(body.noteId, 80) };
  } else {
    return NextResponse.json({ error: "Unknown change." }, { status: 400 });
  }

  const result = await changeItineraryNote(tripId, change);
  if (result.status !== "updated") {
    const errors = {
      "no-itinerary": ["There's no shared itinerary yet.", 404],
      "not-allowed": ["You can only remove your own notes.", 403],
      "not-found": ["That note was already removed.", 404],
      "too-many": ["This trip has a lot of notes already. Remove a few first.", 409],
    } as const;
    const [error, status] = errors[result.status];
    return NextResponse.json({ error }, { status });
  }
  const trip = result.trip;
  return NextResponse.json({ itinerary: trip.itinerary, messages: trip.chat ?? [], proposal: trip.pendingItineraryProposal ?? null, approvedProposal: trip.lastApprovedItineraryProposal ?? null });
}
