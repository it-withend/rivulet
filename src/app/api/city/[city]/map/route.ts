import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";
import { loadCityMapPayload } from "@/lib/city-map-data";

/**
 * Map data for one city as JSON, so the map page itself can render at once and
 * switching city or colour layer never reloads the page. The CDN keeps a copy
 * for five minutes and serves a stale one while it refreshes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  if (!CITIES.includes(city)) {
    return NextResponse.json({ error: "unknown_city" }, { status: 404 });
  }

  const payload = await loadCityMapPayload(city);
  if (payload.failed) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
  });
}
