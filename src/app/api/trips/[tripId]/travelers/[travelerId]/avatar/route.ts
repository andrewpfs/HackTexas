import { NextResponse } from "next/server";
import { normalizeLook } from "@/lib/avatar-look";
import { updateTravelerAvatar } from "@/lib/trip-repository";

export async function PUT(
  request: Request,
  context: RouteContext<"/api/trips/[tripId]/travelers/[travelerId]/avatar">,
) {
  const { tripId, travelerId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pick a look for your avatar." }, { status: 400 });
  }

  const avatar = normalizeLook(body);
  if (!avatar) {
    return NextResponse.json({ error: "That avatar look isn't valid." }, { status: 400 });
  }

  try {
    const result = await updateTravelerAvatar(tripId, travelerId, avatar);
    if (result.status !== "updated") {
      return NextResponse.json({ error: "We couldn't find that traveler on this trip." }, { status: 404 });
    }

    return NextResponse.json({ avatar });
  } catch (error) {
    console.error("Failed to save avatar:", error);
    return NextResponse.json({ error: "We couldn't save your avatar. Please try again." }, { status: 500 });
  }
}
