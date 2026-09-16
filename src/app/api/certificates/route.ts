import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { observerFromRequest } from "@/lib/identity/token";
import { supabaseAdmin } from "@/lib/db/client";
import { contributions, type ContributionRow } from "@/lib/engagement/contribution";
import { eligibility, type CertificateTier } from "@/lib/engagement/certificates";
import { buildCredential } from "@/lib/credentials/open-badge";
import { signCredential } from "@/lib/credentials/jwt";
import { issuerPrivateKey } from "@/lib/credentials/keys";
import { embeddedTrustScore, embeddedCity } from "@/lib/db/embed";

const TIERS: CertificateTier[] = ["contributor", "data_steward"];

function parseBody(body: unknown): { tier: CertificateTier; recipientName: string } | null {
  if (!body || typeof body !== "object") return null;
  const tier = (body as { tier?: unknown }).tier;
  const recipientName = (body as { recipientName?: unknown }).recipientName;
  if (typeof tier !== "string" || !TIERS.includes(tier as CertificateTier)) return null;
  if (typeof recipientName !== "string") return null;
  const trimmed = recipientName.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return null;
  return { tier: tier as CertificateTier, recipientName: trimmed };
}

export async function POST(request: Request) {
  const db = supabaseAdmin();
  const observer = await observerFromRequest(db, request);
  if (!observer) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  if (!issuerPrivateKey()) {
    return NextResponse.json({ error: "issuer_unavailable" }, { status: 503 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseBody(rawBody);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const { tier, recipientName } = parsed;

  const [{ data: rows, error: rowsError }, { data: self, error: selfError }] = await Promise.all([
    db
      .from("observations")
      .select(
        "id, waterbody_id, observed_at, created_at, observer_id, quality_weight, validation_status, is_synthetic, observers(trust_score), waterbodies!inner(city)",
      ),
    db.from("observers").select("trust_score, is_synthetic").eq("id", observer.id).maybeSingle(),
  ]);

  if (rowsError || selfError || !self) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  const contributionRows: ContributionRow[] = (rows ?? []).map((o) => ({
    observerId: o.observer_id,
    waterbodyId: o.waterbody_id,
    observedAt: o.observed_at,
    createdAt: o.created_at,
    qualityWeight: Number(o.quality_weight),
    observerTrust: embeddedTrustScore(o.observers) ?? null,
    validationStatus: o.validation_status,
    isSynthetic: Boolean(o.is_synthetic),
    waterbodyCity: embeddedCity(o.waterbodies),
  }));

  const ranked = contributions(contributionRows);
  const mine = ranked.find((r) => r.observerId === observer.id) ?? null;

  const trust = self.trust_score != null ? Number(self.trust_score) : (mine?.trust ?? 0.5);
  const homeCity = mine?.homeCity ?? null;

  let rank: number | null = null;
  if (homeCity) {
    const cityRanked = contributions(
      contributionRows.filter((r) => r.waterbodyCity === homeCity),
    ).sort((a, b) => b.points - a.points);
    const idx = cityRanked.findIndex((r) => r.observerId === observer.id);
    rank = idx >= 0 ? idx + 1 : null;
  }

  const summary = {
    countedObservations: mine?.countedObservations ?? 0,
    trust,
    isSynthetic: Boolean(self.is_synthetic),
  };

  const tierEligibility = eligibility(summary, rank)[tier];
  if (!tierEligibility.eligible) {
    return NextResponse.json(
      { error: "not_eligible", missing: tierEligibility.missing },
      { status: 403 },
    );
  }

  const { data: existing } = await db
    .from("certificates")
    .select("id")
    .eq("observer_id", observer.id)
    .eq("tier", tier)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "already_issued", id: existing.id }, { status: 409 });
  }

  const id = randomUUID();
  const baseUrl = new URL(request.url).origin;
  const issuedAt = new Date().toISOString();

  const credential = buildCredential({
    id,
    tier,
    recipientName,
    stats: {
      countedObservations: mine?.countedObservations ?? 0,
      streamsCovered: mine?.streamsCovered ?? 0,
      gapsFilled: mine?.gapsFilled ?? 0,
      trust,
    },
    issuedAt,
    baseUrl,
  });

  const jwt = signCredential(credential);
  if (!jwt) {
    return NextResponse.json({ error: "issuer_unavailable" }, { status: 503 });
  }

  const { error: insertError } = await db.from("certificates").insert({
    id,
    observer_id: observer.id,
    tier,
    recipient_name: recipientName,
    credential,
    jwt,
    issued_at: issuedAt,
  });

  if (insertError) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ id, url: `${baseUrl}/certificates/${id}` }, { status: 201 });
}
