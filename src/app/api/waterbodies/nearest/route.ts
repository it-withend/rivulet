import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/db/client";

const DEFAULT_LIMIT = 8;

/**
 * Nearest water bodies to a point, for the map-less `/observe` entry point
 * (Task 19.3) — a visitor who never opened the map can still find the
 * stream they are standing at. Calls the `nearest_waterbodies` SQL function
 * (migration 0006), which is granted to `anon` directly since this needs no
 * authentication.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lon = Number(url.searchParams.get("lon"));
  const lat = Number(url.searchParams.get("lat"));

  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  }

  const db = supabaseAnon();
  const { data, error } = await db.rpc("nearest_waterbodies", {
    p_lon: lon,
    p_lat: lat,
    p_limit: DEFAULT_LIMIT,
  });

  if (error) {
    console.error("nearest_waterbodies failed:", error);
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    waterbodies: (data ?? []).map((w: { id: string; name: string; city: string; distance_m: number }) => ({
      id: w.id,
      name: w.name,
      city: w.city,
      distanceM: Math.round(Number(w.distance_m)),
    })),
  });
}
