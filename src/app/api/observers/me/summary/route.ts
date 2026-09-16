import { NextResponse } from "next/server";
import { observerFromRequest } from "@/lib/identity/token";
import { supabaseAdmin } from "@/lib/db/client";
import { contributions, type ContributionRow } from "@/lib/engagement/contribution";
import { embeddedTrustScore, embeddedCity } from "@/lib/db/embed";

export async function GET(request: Request) {
  const db = supabaseAdmin();
  const observer = await observerFromRequest(db, request);
  if (!observer) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const [{ data, error }, { data: self }] = await Promise.all([
    db
      .from("observations")
      .select(
        "id, waterbody_id, observed_at, created_at, observer_id, quality_weight, validation_status, is_synthetic, observers(trust_score), waterbodies!inner(city)",
      ),
    db.from("observers").select("trust_score").eq("id", observer.id).maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  const rows: ContributionRow[] = (data ?? []).map((o) => ({
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

  const ranked = contributions(rows).sort((a, b) => b.points - a.points);
  const index = ranked.findIndex((r) => r.observerId === observer.id);
  const mine = index >= 0 ? ranked[index] : null;
  const homeCity = mine?.homeCity ?? null;

  // Certificate eligibility (the "data_steward" tier) is decided by rank
  // within the observer's home city, not the combined all-cities rank shown
  // as `rank` above — see src/lib/engagement/certificates.ts.
  let homeCityRank: number | null = null;
  if (homeCity) {
    const cityRows = rows.filter((r) => r.waterbodyCity === homeCity);
    const cityRanked = contributions(cityRows).sort((a, b) => b.points - a.points);
    const cityIndex = cityRanked.findIndex((r) => r.observerId === observer.id);
    homeCityRank = cityIndex >= 0 ? cityIndex + 1 : null;
  }

  return NextResponse.json({
    id: observer.id,
    displayName: observer.displayName,
    trust: self?.trust_score != null ? Number(self.trust_score) : (mine?.trust ?? 0.5),
    points: mine?.points ?? 0,
    countedObservations: mine?.countedObservations ?? 0,
    streamsCovered: mine?.streamsCovered ?? 0,
    gapsFilled: mine?.gapsFilled ?? 0,
    homeCity,
    rank: index >= 0 ? index + 1 : null,
    homeCityRank,
  });
}
