import { NextResponse } from "next/server";
import { observerFromRequest } from "@/lib/identity/token";
import { supabaseAdmin } from "@/lib/db/client";

export async function PATCH(request: Request) {
  const db = supabaseAdmin();
  const observer = await observerFromRequest(db, request);
  if (!observer) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const displayName =
    body && typeof body === "object" && "displayName" in body
      ? (body as { displayName?: unknown }).displayName
      : undefined;

  const trimmed = typeof displayName === "string" ? displayName.trim() : "";
  if (trimmed.length < 2 || trimmed.length > 40) {
    return NextResponse.json({ error: "invalid_display_name" }, { status: 400 });
  }

  const { error } = await db
    .from("observers")
    .update({ display_name: trimmed })
    .eq("id", observer.id);

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ id: observer.id, displayName: trimmed }, { status: 200 });
}

export async function DELETE(request: Request) {
  const db = supabaseAdmin();
  const observer = await observerFromRequest(db, request);
  if (!observer) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  // GDPR erasure: the observer row is removed. Their observations keep their
  // data with observer_id set null by the existing FK (on delete set null).
  const { error } = await db.from("observers").delete().eq("id", observer.id);

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({}, { status: 200 });
}
