import { supabaseAnon } from "@/lib/db/client";
import { embeddedTrustScore } from "@/lib/db/embed";
import { HELD_FOR_REVIEW_FILTER } from "@/lib/science/plausibility";
import { readOneHealth, type ExposureSite } from "@/lib/science/one-health";
import { computeSnapshot, type StoredObservation } from "@/lib/science/snapshot";
import { buildWaterbodyResources, type FhirExportResource } from "./export";

export type WaterbodyExport =
  | { ok: true; resources: FhirExportResource[] }
  | { ok: false; error: "not_found" | "database_unavailable" };

/**
 * Everything Rivulet exports for one water body, from the database to FHIR
 * resources. Shared by the export route and the read-only /fhir endpoint.
 * Anonymous clients cannot read observations.location or gps_accuracy_m
 * (see the RLS migration), so they are never selected here, and observations
 * waiting for human review stay out.
 */
export async function loadWaterbodyExport(waterbodyId: string): Promise<WaterbodyExport> {
  const db = supabaseAnon();

  const { data: waterbody, error: waterbodyError } = await db
    .from("waterbodies")
    .select("id, name, city, centroid")
    .eq("id", waterbodyId)
    .maybeSingle();
  if (waterbodyError) return { ok: false, error: "database_unavailable" };
  if (!waterbody) return { ok: false, error: "not_found" };

  const [{ data: rows, error: observationsError }, { data: exposureRows }] = await Promise.all([
    db
      .from("observations")
      .select("id, observed_at, observer_id, survey, quality_weight, is_synthetic, observers(trust_score)")
      .eq("waterbody_id", waterbodyId)
      .not("validation_status", "in", HELD_FOR_REVIEW_FILTER)
      .order("observed_at", { ascending: false }),
    db.from("waterbody_exposure").select("kind, site_count, nearest_m, nearest_name").eq("waterbody_id", waterbodyId),
  ]);
  if (observationsError) return { ok: false, error: "database_unavailable" };

  const observations = rows ?? [];
  const stored: StoredObservation[] = observations.map((o) => ({
    id: o.id,
    observedAt: o.observed_at,
    observerId: o.observer_id,
    survey: o.survey,
    qualityWeight: Number(o.quality_weight),
    observerTrust: embeddedTrustScore(o.observers),
  }));
  const sites: ExposureSite[] = (exposureRows ?? []).map((e) => ({
    kind: e.kind,
    siteCount: e.site_count,
    nearestM: Number(e.nearest_m),
    nearestName: e.nearest_name,
  }));

  const now = new Date();
  const snapshot = computeSnapshot(stored, now);
  const [lon, lat] = (waterbody.centroid as { coordinates: [number, number] }).coordinates;

  return {
    ok: true,
    resources: buildWaterbodyResources({
      waterbody: { id: waterbody.id, name: waterbody.name, city: waterbody.city, centroidLon: lon, centroidLat: lat },
      rows: observations,
      wfdClass: snapshot.assessment.klass,
      oneHealth: sites.length > 0 ? readOneHealth(stored, sites, now) : null,
      methodVersion: snapshot.methodVersion,
      exportedAt: now.toISOString(),
    }),
  };
}
