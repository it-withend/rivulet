import { NextResponse } from "next/server";
import { generatePseudonym } from "@/lib/identity/pseudonym";
import { createToken, hashToken } from "@/lib/identity/token";
import { supabaseAdmin } from "@/lib/db/client";

function normaliseDisplayName(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("displayName" in body)) return null;
  const value = (body as { displayName?: unknown }).displayName;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 40 ? trimmed : null;
}

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const displayName = normaliseDisplayName(body) ?? generatePseudonym();
  const token = createToken();
  const db = supabaseAdmin();

  const { data, error } = await db
    .from("observers")
    .insert({ display_name: displayName, token_hash: hashToken(token) })
    .select("id, display_name")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json(
    { id: data.id, displayName: data.display_name, token },
    { status: 201 },
  );
}
