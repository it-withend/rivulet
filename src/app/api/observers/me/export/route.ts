import { NextResponse } from "next/server";
import { observerFromRequest } from "@/lib/identity/token";
import { supabaseAdmin } from "@/lib/db/client";

/**
 * GDPR data-subject export: the observer's own profile (never their
 * `token_hash` — that stays a server secret even from the observer
 * themselves, since it authenticates them), their observations and their
 * certificates. See review 2026-09-16 §1.5 — deletion existed, export did
 * not.
 */
export async function GET(request: Request) {
  const db = supabaseAdmin();
  const observer = await observerFromRequest(db, request);
  if (!observer) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: observations, error: observationsError }, { data: certificates, error: certificatesError }] =
    await Promise.all([
      db
        .from("observers")
        .select("id, display_name, locale, email, is_minor, trust_score, is_synthetic, created_at")
        .eq("id", observer.id)
        .maybeSingle(),
      db
        .from("observations")
        .select(
          "id, waterbody_id, observed_at, created_at, gps_accuracy_m, forel_ule_index, forel_ule_confidence, survey, indicators, quality_weight, validation_status",
        )
        .eq("observer_id", observer.id)
        .order("observed_at", { ascending: false }),
      db
        .from("certificates")
        .select("id, tier, recipient_name, credential, jwt, issued_at, revoked_at, endorsements")
        .eq("observer_id", observer.id)
        .order("issued_at", { ascending: false }),
    ]);

  if (profileError || !profile || observationsError || certificatesError) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      profile: {
        id: profile.id,
        displayName: profile.display_name,
        locale: profile.locale,
        email: profile.email,
        isMinor: profile.is_minor,
        trustScore: profile.trust_score != null ? Number(profile.trust_score) : null,
        isSynthetic: profile.is_synthetic,
        createdAt: profile.created_at,
      },
      observations: (observations ?? []).map((o) => ({
        id: o.id,
        waterbodyId: o.waterbody_id,
        observedAt: o.observed_at,
        createdAt: o.created_at,
        gpsAccuracyM: o.gps_accuracy_m,
        forelUleIndex: o.forel_ule_index,
        forelUleConfidence: o.forel_ule_confidence,
        survey: o.survey,
        indicators: o.indicators,
        qualityWeight: Number(o.quality_weight),
        validationStatus: o.validation_status,
      })),
      certificates: (certificates ?? []).map((c) => ({
        id: c.id,
        tier: c.tier,
        recipientName: c.recipient_name,
        credential: c.credential,
        jwt: c.jwt,
        issuedAt: c.issued_at,
        revokedAt: c.revoked_at,
        endorsements: c.endorsements,
      })),
    },
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-disposition": "attachment; filename=rivulet-my-data.json",
      },
    },
  );
}
