import Link from "next/link";
import type React from "react";
import { CityMap, type MapFeature } from "@/components/map/CityMap";
import { supabaseAnon } from "@/lib/db/client";
import { embeddedTrustScore } from "@/lib/db/embed";
import {
  computeSnapshot,
  type StoredObservation,
} from "@/lib/science/snapshot";
import type { SatelliteReading } from "@/lib/science/satellite";

type GeoJsonLineString = {
  type: string;
  coordinates: [number, number][];
};

const CITY_CENTRES: Record<string, [number, number]> = {
  Coimbra: [-8.4195, 40.2033],
  Toulouse: [1.4442, 43.6047],
  Benevento: [14.7826, 41.1299],
  Gent: [3.7174, 51.0543],
  Oslo: [10.7522, 59.9139],
};

const CITIES = Object.keys(CITY_CENTRES);
const DEFAULT_CITY = "Coimbra";

function CityChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "inline-flex min-h-11 items-center rounded-sm border px-3.5 py-2 " +
        "font-sans text-[0.9375rem] leading-tight no-underline transition-colors duration-150 " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
        (active
          ? "border-ink bg-ink text-paper"
          : "border-rule-strong bg-paper-raised text-ink hover:border-ink")
      }
    >
      {children}
    </Link>
  );
}

export default async function MapPage(props: PageProps<"/map">) {
  const searchParams = await props.searchParams;
  const cityParam = searchParams.city;
  const requested = Array.isArray(cityParam) ? cityParam[0] : cityParam;
  const city = requested && CITY_CENTRES[requested] ? requested : DEFAULT_CITY;
  const centre = CITY_CENTRES[city];

  const layerParam = searchParams.layer;
  const requestedLayer = Array.isArray(layerParam) ? layerParam[0] : layerParam;
  const layer = requestedLayer === "divergence" ? "divergence" : "status";

  const db = supabaseAnon();

  // One query for the whole city; a query per water body is too slow with
  // hundreds of OpenStreetMap segments. Only the columns the map needs —
  // Oslo alone has 2,549 segments.
  const { data: waterbodies, error: waterbodiesError } = await db
    .from("waterbodies")
    .select("id, name, geometry")
    .eq("city", city);

  const { data: observations, error: observationsError } = await db
    .from("observations")
    .select(
      "id, waterbody_id, observed_at, observer_id, survey, quality_weight, is_synthetic, observers(trust_score), waterbodies!inner(city)",
    )
    .eq("waterbodies.city", city);

  const { data: satelliteReadings, error: satelliteError } = await db
    .from("satellite_readings")
    .select(
      "id, waterbody_id, acquired_at, scene_id, cloud_cover, usable_pixels, ndci, turbidity, forel_ule_equivalent, hue_angle, waterbodies!inner(city)",
    )
    .eq("waterbodies.city", city);

  const byWaterbody = new Map<string, StoredObservation[]>();
  let hasSynthetic = false;

  if (!observationsError) {
    for (const o of observations ?? []) {
      if (o.is_synthetic) hasSynthetic = true;
      const list = byWaterbody.get(o.waterbody_id) ?? [];
      list.push({
        id: o.id,
        observedAt: o.observed_at,
        observerId: o.observer_id,
        survey: o.survey,
        qualityWeight: Number(o.quality_weight),
        observerTrust: embeddedTrustScore(o.observers),
      });
      byWaterbody.set(o.waterbody_id, list);
    }
  }

  const satelliteByWaterbody = new Map<string, SatelliteReading[]>();
  if (!satelliteError) {
    for (const r of satelliteReadings ?? []) {
      const list = satelliteByWaterbody.get(r.waterbody_id) ?? [];
      list.push({
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
      });
      satelliteByWaterbody.set(r.waterbody_id, list);
    }
  }

  const features: MapFeature[] = waterbodiesError
    ? []
    : (waterbodies ?? []).map((wb) => {
        const snapshot = computeSnapshot(
          byWaterbody.get(wb.id) ?? [],
          new Date(),
          satelliteByWaterbody.get(wb.id) ?? [],
        );
        return {
          id: wb.id,
          name: wb.name,
          klass: snapshot.assessment.klass,
          diverged: snapshot.divergence?.diverged ?? null,
          coordinates: (wb.geometry as GeoJsonLineString).coordinates,
        };
      });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="field-label m-0">Field map</p>
      <h1 className="mt-2 mb-5 text-4xl">Urban streams in {city}</h1>

      <nav aria-label="Cities" className="mb-6 flex flex-wrap gap-2">
        {CITIES.map((name) => (
          <CityChip
            key={name}
            href={`/map?city=${name}${layer === "divergence" ? "&layer=divergence" : ""}`}
            active={name === city}
          >
            {name}
          </CityChip>
        ))}
      </nav>

      <nav aria-label="Map layer" className="mb-4 flex flex-wrap gap-2">
        <CityChip href={`/map?city=${city}`} active={layer === "status"}>
          Ecological status
        </CityChip>
        <CityChip href={`/map?city=${city}&layer=divergence`} active={layer === "divergence"}>
          Citizen–satellite divergence
        </CityChip>
      </nav>

      <CityMap features={features} centre={centre} layer={layer} />

      {features.length === 0 && (
        <p className="mt-3 text-sm text-ink-muted">
          The water network for this city has not been loaded yet.
        </p>
      )}

      {hasSynthetic && (
        <p className="mt-3 text-sm text-ink-muted">
          Includes synthetic demo observations while the pilot collects real
          data.
        </p>
      )}

      {layer === "divergence" ? (
        <p className="mt-3 text-xs text-ink-muted">
          Purple marks water bodies where the latest Sentinel-2 pass
          disagrees with citizen reports beyond the declared threshold; teal
          marks a current pass that agrees. Dashed grey lines mark water
          bodies with no usable satellite pass in the last 30 days to compare
          — cloud cover or too few water pixels, never treated as agreement.
        </p>
      ) : (
        <p className="mt-3 text-xs text-ink-muted">
          Dashed grey lines mark water bodies where there is not yet enough data
          to assign an ecological status.
        </p>
      )}
    </div>
  );
}
