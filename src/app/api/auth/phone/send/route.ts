import { NextResponse } from "next/server";
import { isSmsConfigured, normalizePhone, sendCode } from "@/lib/phone-auth";

export async function POST(request: Request) {
  let body: { phone?: unknown };
  try {
    body = (await request.json()) as { phone?: unknown };
  } catch {
    body = {};
  }

  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  if (!phone) {
    return NextResponse.json({ error: "Enter a full phone number, like (512) 555-0134 or +81 90 1234 5678." }, { status: 400 });
  }

  const result = await sendCode(phone);
  if (result.status !== "sent") {
    return NextResponse.json({ error: result.error }, { status: result.status === "rate-limited" ? 429 : 502 });
  }

  // demoCode is only present when no SMS provider is configured.
  return NextResponse.json({ sent: true, demoMode: !isSmsConfigured(), demoCode: result.demoCode });
}
