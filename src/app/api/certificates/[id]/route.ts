import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/db/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = supabaseAnon();

  const { data, error } = await db
    .from("certificates")
    .select("credential")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(data.credential), {
    status: 200,
    headers: { "content-type": "application/ld+json" },
  });
}
