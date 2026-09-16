import Link from "next/link";
import type React from "react";
import { CityMap, type MapFeature } from "@/components/map/CityMap";
import { supabaseAnon } from "@/lib/db/client";
import { embeddedTrustScore } from "@/lib/db/embed";
import {
  computeSnapshot,
  type StoredObservation,
} from "@/lib/science/snapshot";
import { selectAll } from "@/lib/db/select-all";
import { HELD_FOR_REVIEW_FILTER } from "@/lib/science/plausibility";
import { readOneHealth, type Concern, type ExposureSite } from "@/lib/science/one-health";
import { CONCERN_COLOUR, CONCERN_LABEL } from "@/lib/ui/one-health-copy";

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
  const layer = searchParams.layer === "health" ? "health" : "status";

  const db = supabaseAnon();

  // One query for the whole city; a query per water body is too slow with
  // hundreds of OpenStreetMap segments. Only the columns the map needs —
  // Oslo alone has 2,549 segments.
  const [
    { data: waterbodies, error: waterbodiesError },
    { data: observations, error: observationsError },
    { data: exposureRows },
  ] = await Promise.all([
    selectAll((from, to) =>
      db
        .from("waterbodies")
        .select("id, name, geometry")
        .eq("city", city)
        .order("id")
        .range(from, to),
    ),
    // Observations flagged for review stay out of the assessment until a
    // person has looked at them.
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
  ]);

  const exposureByWaterbody = new Map<string, ExposureSite[]>();
  for (const e of exposureRows) {
    const list = exposureByWaterbody.get(e.waterbody_id) ?? [];
    list.push({
      kind: e.kind,
      siteCount: e.site_count,
      nearestM: Number(e.nearest_m),
      nearestName: e.nearest_name,
    });
    exposureByWaterbody.set(e.waterbody_id, list);
  }

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

  const features: MapFeature[] = waterbodiesError
    ? []
    : (waterbodies ?? []).map((wb) => {
        const stored = byWaterbody.get(wb.id) ?? [];
        return {
          id: wb.id,
          name: wb.name,
          klass: computeSnapshot(stored).assessment.klass,
          concern: readOneHealth(stored, exposureByWaterbody.get(wb.id) ?? []).overall,
          coordinates: (wb.geometry as GeoJsonLineString).coordinates,
        };
      });

  const LEGEND: Concern[] = ["none", "watch", "care", "avoid"];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="field-label m-0">Field map</p>
      <h1 className="mt-2 mb-5 text-4xl">Urban streams in {city}</h1>

      <nav aria-label="Cities" className="mb-6 flex flex-wrap gap-2">
        {CITIES.map((name) => (
          <CityChip
            key={name}
            href={`/map?city=${name}${layer === "health" ? "&layer=health" : ""}`}
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
        <CityChip href={`/map?city=${city}&layer=health`} active={layer === "health"}>
          People &amp; animals
        </CityChip>
      </nav>

      <CityMap features={features} centre={centre} layer={layer} />

      {layer === "health" && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm">
          {LEGEND.map((concern) => (
            <li key={concern} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-1 w-6 rounded-full"
                style={{ backgroundColor: CONCERN_COLOUR[concern] }}
              />
              {CONCERN_LABEL[concern]}
            </li>
          ))}
        </ul>
      )}

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

      <p className="mt-3 text-xs text-ink-muted">
        {layer === "health"
          ? "Concern for people and animals combines warning signs residents reported in the last 30 days with playgrounds, schools, parks and bathing spots nearby. Dashed grey lines have no recent reports — that is unknown, not safe. An indicative prompt, not a public health assessment."
          : "Dashed grey lines mark water bodies where there is not yet enough data to assign an ecological status."}
      </p>
    </div>
  );
}
