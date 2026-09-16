import { supabaseAnon } from "@/lib/db/client";
import { embeddedTrustScore } from "@/lib/db/embed";
import { selectAll } from "@/lib/db/select-all";
import { HELD_FOR_REVIEW_FILTER } from "@/lib/science/plausibility";
import { computeSnapshot, type Snapshot, type StoredObservation } from "@/lib/science/snapshot";
import { readOneHealth, type ExposureSite, type OneHealthReading } from "@/lib/science/one-health";
import type { SatelliteReading } from "@/lib/science/satellite";

export type CityStream = {
  id: string;
  name: string;
  coordinates: [number, number][];
  observations: StoredObservation[];
  exposure: ExposureSite[];
  snapshot: Snapshot;
  oneHealth: OneHealthReading;
};

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(key(row)) ?? [];
    list.push(row);
    map.set(key(row), list);
  }
  return map;
}

/**
 * Everything the map and the city report need for one city, in four
 * city-wide paginated queries rather than a query per stream. Observations
 * flagged for review stay out until a person has looked at them.
 */
export async function loadCityStreams(city: string, now: Date = new Date()) {
  const db = supabaseAnon();

  const [waterbodies, observations, exposure, satellite] = await Promise.all([
    selectAll((from, to) =>
      db.from("waterbodies").select("id, name, geometry").eq("city", city).order("id").range(from, to),
    ),
    selectAll((from, to) =>
      db
        .from("observations")
        .select(
          "id, waterbody_id, observed_at, observer_id, survey, quality_weight, is_synthetic, observers(trust_score), waterbodies!inner(city)",
        )
        .eq("waterbodies.city", city)
        .not("validation_status", "in", HELD_FOR_REVIEW_FILTER)
        .order("id")
        .range(from, to),
    ),
    selectAll((from, to) =>
      db
        .from("waterbody_exposure")
        .select("waterbody_id, kind, site_count, nearest_m, nearest_name, waterbodies!inner(city)")
        .eq("waterbodies.city", city)
        .order("waterbody_id")
        .order("kind")
        .range(from, to),
    ),
    selectAll((from, to) =>
      db
        .from("satellite_readings")
        .select(
          "id, waterbody_id, acquired_at, scene_id, cloud_cover, usable_pixels, ndci, turbidity, forel_ule_equivalent, hue_angle, waterbodies!inner(city)",
        )
        .eq("waterbodies.city", city)
        .order("id")
        .range(from, to),
    ),
  ]);

  const observationsBy = group(observations.data, (o) => o.waterbody_id as string);
  const exposureBy = group(exposure.data, (e) => e.waterbody_id as string);
  const satelliteBy = group(satellite.data, (r) => r.waterbody_id as string);

  const streams: CityStream[] = waterbodies.data.map((wb) => {
    const stored: StoredObservation[] = (observationsBy.get(wb.id) ?? []).map((o) => ({
      id: o.id,
      observedAt: o.observed_at,
      observerId: o.observer_id,
      survey: o.survey,
      qualityWeight: Number(o.quality_weight),
      observerTrust: embeddedTrustScore(o.observers),
    }));
    const sites: ExposureSite[] = (exposureBy.get(wb.id) ?? []).map((e) => ({
      kind: e.kind,
      siteCount: e.site_count,
      nearestM: Number(e.nearest_m),
      nearestName: e.nearest_name,
    }));
    const readings: SatelliteReading[] = (satelliteBy.get(wb.id) ?? []).map((r) => ({
      id: r.id,
      waterbodyId: r.waterbody_id,
      acquiredAt: r.acquired_at,
      sceneId: r.scene_id,
      cloudCover: r.cloud_cover === null ? null : Number(r.cloud_cover),
      usablePixels: r.usable_pixels,
      ndci: r.ndci === null ? null : Number(r.ndci),
      turbidity: r.turbidity === null ? null : Number(r.turbidity),
      forelUleEquivalent: r.forel_ule_equivalent,
      hueAngle: r.hue_angle === null ? null : Number(r.hue_angle),
    }));

    return {
      id: wb.id,
      name: wb.name,
      coordinates: (wb.geometry as { coordinates: [number, number][] }).coordinates,
      observations: stored,
      exposure: sites,
      snapshot: computeSnapshot(stored, now, readings),
      oneHealth: readOneHealth(stored, sites, now),
    };
  });

  return {
    streams,
    hasSynthetic: observations.data.some((o) => o.is_synthetic),
    failed: Boolean(waterbodies.error),
  };
}
