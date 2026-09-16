import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { isAuthorisedModerator } from "@/lib/moderation/auth";
import { recomputeTrust } from "@/lib/trust/recompute";

/**
 * Approve or reject one flagged observation. Approving sets
 * `human_approved`, which the rest of the app already treats exactly like
 * `auto_approved` (contribution points, the ecological model, FHIR export).
 * Rejecting sets `rejected`, which stays excluded from all of those forever
 * (see `HELD_FOR_REVIEW` in plausibility.ts) — never deleted, so the record
 * stays auditable.
 *
 * Either action changes what counts as evidence for every observer who has
 * reported on this water body, so trust is recomputed for all of them
 * afterwards — the same step the submission route runs.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorisedModerator(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = (body as { action?: unknown } | null)?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: existing, error: fetchError } = await db
    .from("observations")
    .select("id, waterbody_id, validation_status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.validation_status !== "flagged") {
    return NextResponse.json({ error: "not_pending" }, { status: 409 });
  }

  const newStatus = action === "approve" ? "human_approved" : "rejected";

  const { error: updateError } = await db
    .from("observations")
    .update({ validation_status: newStatus, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  try {
    const { data: peers } = await db
      .from("observations")
      .select("observer_id")
      .eq("waterbody_id", existing.waterbody_id);
    await recomputeTrust(db, (peers ?? []).map((p) => p.observer_id));
  } catch (recomputeError) {
    console.error("trust recompute after moderation failed:", recomputeError);
  }

  return NextResponse.json({ id, status: newStatus });
}
