import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/phone-auth";

export async function POST() {
  const response = NextResponse.json({ signedIn: false });
  response.cookies.set(sessionCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
