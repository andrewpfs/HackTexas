import { NextResponse } from "next/server";
import {
  addAssistantBooking,
  describeBookingDetails,
  describeMyBookings,
  describeMyTrip,
  findTravelerByToken,
  hashAssistantToken,
} from "@/lib/assistant-connector";
import { findTripsByAssistantToken, saveBooking } from "@/lib/trip-repository";

// A Model Context Protocol server (Streamable HTTP, stateless JSON responses).
// Each traveler's token gives their own AI assistant access to only their trip and bookings.

const supportedVersions = ["2025-06-18", "2025-03-26", "2024-11-05"];

const tools = [
  {
    name: "get_my_trip",
    description: "The traveler's group trip: destination, dates, who is going, and the day-by-day itinerary from the traveler's point of view (including any stop where they do their own thing).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_my_bookings",
    description: "The traveler's booking checklist: their chosen flight, the group hotel and whether they book it or pay a share, and any confirmation codes so far.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_booking_details",
    description: "Everything needed to book one item: flight times, airports, and fare, or the hotel's dates, guests, price, and link.",
    inputSchema: {
      type: "object",
      properties: { item: { type: "string", enum: ["flight", "hotel"] } },
      required: ["item"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "mark_booked",
    description: "Record a booking the traveler approved and you completed, so the group can see it. Only call this after a real booking and with the traveler's approval.",
    inputSchema: {
      type: "object",
      properties: {
        item: { type: "string", enum: ["flight", "hotel"] },
        confirmation_code: { type: "string", minLength: 3, maxLength: 40 },
        amount_usd: { type: "number", minimum: 0 },
        label: { type: "string", maxLength: 120 },
      },
      required: ["item", "confirmation_code", "amount_usd"],
      additionalProperties: false,
    },
  },
];

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const result = (id: JsonRpcRequest["id"], value: unknown) => NextResponse.json({ jsonrpc: "2.0", id, result: value });
const rpcError = (id: JsonRpcRequest["id"], code: number, message: string, status = 200) =>
  NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });
const toolText = (id: JsonRpcRequest["id"], value: unknown, isError = false) =>
  result(id, { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], isError });

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) {
    return NextResponse.json(
      { error: "Add your trip connection token as a Bearer token." },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="trip-planner"' } },
    );
  }

  let message: JsonRpcRequest;
  try {
    message = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  if (Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(null, -32600, "Invalid request", 400);
  }

  const tokenHash = hashAssistantToken(token);
  const match = findTravelerByToken(await findTripsByAssistantToken(tokenHash), tokenHash);
  if (!match) {
    return NextResponse.json(
      { error: "That connection token is not valid. Create a new one on the trip's Connect page." },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="trip-planner", error="invalid_token"' } },
    );
  }
  const { trip, traveler } = match;

  // Notifications get no response body.
  if (message.id === undefined) {
    return new NextResponse(null, { status: 202 });
  }

  switch (message.method) {
    case "initialize": {
      const requested = typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : supportedVersions[0];
      return result(message.id, {
        protocolVersion: supportedVersions.includes(requested) ? requested : supportedVersions[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "hacktx-trip-planner", title: "HackTX Trip Planner", version: "1.0.0" },
        instructions: `You are connected to ${traveler.name}'s group trip. You can read their itinerary and booking checklist and record bookings they approved. Never pay for anything without the traveler's explicit approval.`,
      });
    }
    case "ping":
      return result(message.id, {});
    case "tools/list":
      return result(message.id, { tools });
    case "tools/call": {
      const name = message.params?.name;
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;

      if (name === "get_my_trip") return toolText(message.id, describeMyTrip(trip, traveler.id));
      if (name === "get_my_bookings") return toolText(message.id, describeMyBookings(trip, traveler.id));
      if (name === "get_booking_details") {
        if (args.item !== "flight" && args.item !== "hotel") return toolText(message.id, { error: "item must be flight or hotel" }, true);
        const details = describeBookingDetails(trip, traveler.id, args.item);
        return toolText(message.id, details, "error" in details);
      }
      if (name === "mark_booked") {
        const code = typeof args.confirmation_code === "string" ? args.confirmation_code.trim() : "";
        const amount = typeof args.amount_usd === "number" && args.amount_usd >= 0 ? args.amount_usd : NaN;
        if ((args.item !== "flight" && args.item !== "hotel") || code.length < 3 || code.length > 40 || Number.isNaN(amount)) {
          return toolText(message.id, { error: "Provide item (flight or hotel), confirmation_code, and amount_usd." }, true);
        }
        const booking = addAssistantBooking(trip, traveler.id, {
          kind: args.item,
          confirmationCode: code,
          amount,
          label: typeof args.label === "string" ? args.label.slice(0, 120) : undefined,
        });
        await saveBooking(trip.id, booking);
        return toolText(message.id, { saved: true, item: args.item, confirmationCode: code, message: "The group can now see this booking on the trip page." });
      }
      return rpcError(message.id, -32602, `Unknown tool: ${String(name)}`);
    }
    default:
      return rpcError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

// This server does not stream, so there is no event stream to open.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
