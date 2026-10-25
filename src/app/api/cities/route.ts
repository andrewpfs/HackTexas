import { NextResponse } from "next/server";
import { searchCities } from "@/lib/city-search";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";

  try {
    return NextResponse.json({ cities: await searchCities(query) });
  } catch (error) {
    console.error("City search failed:", error);
    return NextResponse.json({ cities: [], unavailable: true });
  }
}
