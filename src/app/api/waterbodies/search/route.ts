import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/db/client";

const LIMIT = 10;
const MIN_QUERY_LENGTH = 2;

/**
 * Name search fallback for the map-less `/observe` entry point (Task 19.3),
 * used when geolocation is denied or fails. `ilike` is fine at this table's
 * size (a handful of pilot cities); no full-text index needed yet.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ waterbodies: [] });
  }

  const db = supabaseAnon();
  const { data, error } = await db
    .from("waterbodies")
    .select("id, name, city")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(LIMIT);

  if (error) {
    console.error("waterbody search failed:", error);
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    waterbodies: (data ?? []).map((w) => ({ id: w.id, name: w.name, city: w.city })),
  });
}
