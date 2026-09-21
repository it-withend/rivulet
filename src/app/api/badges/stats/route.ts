import { NextResponse } from "next/server";
import { getBadgeStats } from "@/lib/journal/badge-stats-server";

/** How many observers hold each badge, for the rarity shown on the journal. */
export async function GET() {
  const stats = await getBadgeStats();
  return NextResponse.json(stats, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
