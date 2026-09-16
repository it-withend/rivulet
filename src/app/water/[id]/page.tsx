import { notFound } from "next/navigation";
import { supabaseAnon } from "@/lib/db/client";
import { computeSnapshot, weightedCitizenForelUle } from "@/lib/science/snapshot";
import type { SatelliteReading } from "@/lib/science/satellite";
import {
  colourForClass,
  CLASS_LABEL,
  SIMPLE_MESSAGE,
} from "@/lib/ui/wfd-colours";
import { ScoreDisclosure } from "@/components/water/ScoreDisclosure";
import { DisplayModeToggle } from "@/components/water/DisplayModeToggle";
import { SatellitePanel } from "@/components/water/SatellitePanel";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { embeddedTrustScore } from "@/lib/db/embed";
import { isHeldForReview } from "@/lib/science/plausibility";
import { readOneHealth, type ExposureSite } from "@/lib/science/one-health";
import { OneHealthPanel } from "@/components/water/OneHealthPanel";

export default async function WaterBodyPage(props: PageProps<"/water/[id]">) {
  const { id } = await props.params;
  const db = supabaseAnon();

  const { data: waterbody, error: waterbodyError } = await db
    .from("waterbodies")
    .select("id, name, city")
    .eq("id", id)
    .single();

  if (waterbodyError || !waterbody) notFound();

  // Anonymous clients cannot read location or gps_accuracy_m (see the RLS
  // migration) — never select them here.
  const { data: observations, error: observationsError } = await db
    .from("observations")
    .select(
      "id, observed_at, observer_id, survey, quality_weight, is_synthetic, validation_status, observers(trust_score)",
    )
    .eq("waterbody_id", id)
    .order("observed_at", { ascending: false });

  const { data: exposureRows } = await db
    .from("waterbody_exposure")
    .select("kind, site_count, nearest_m, nearest_name")
    .eq("waterbody_id", id);

  const exposure: ExposureSite[] = (exposureRows ?? []).map((e) => ({
    kind: e.kind,
    siteCount: e.site_count,
    nearestM: Number(e.nearest_m),
    nearestName: e.nearest_name,
  }));

  const allRows = observationsError ? [] : (observations ?? []);
  const rows = allRows.filter((o) => !isHeldForReview(o.validation_status));
  const heldCount = allRows.length - rows.length;
  const hasSynthetic = rows.some((o) => o.is_synthetic);

  const { data: satelliteRows, error: satelliteError } = await db
    .from("satellite_readings")
    .select(
      "id, acquired_at, scene_id, cloud_cover, usable_pixels, ndci, turbidity, forel_ule_equivalent, hue_angle",
    )
    .eq("waterbody_id", id)
    .order("acquired_at", { ascending: false });

  const satelliteReadings: SatelliteReading[] = satelliteError
    ? []
    : (satelliteRows ?? []).map((r) => ({
        id: r.id,
        waterbodyId: id,
        acquiredAt: r.acquired_at,
        sceneId: r.scene_id,
        cloudCover: r.cloud_cover === null ? null : Number(r.cloud_cover),
        usablePixels: r.usable_pixels,
        ndci: r.ndci === null ? null : Number(r.ndci),
        turbidity: r.turbidity === null ? null : Number(r.turbidity),
        forelUleEquivalent: r.forel_ule_equivalent,
        hueAngle: r.hue_angle === null ? null : Number(r.hue_angle),
      }));

  const observationInputs = rows.map((o) => ({
    id: o.id,
    observedAt: o.observed_at,
    observerId: o.observer_id,
    survey: o.survey,
    qualityWeight: Number(o.quality_weight),
    observerTrust: embeddedTrustScore(o.observers),
  }));

  const now = new Date();
  const snapshot = computeSnapshot(observationInputs, now, satelliteReadings);
  const oneHealth = readOneHealth(observationInputs, exposure, now);

  const klass = snapshot.assessment.klass;
  const citizenFu = weightedCitizenForelUle(observationInputs);
  // Most recent pass regardless of usability — the panel itself reports a
  // cloudy/unusable or stale pass as unavailable, never as agreement.
  const latestSatellite = satelliteReadings[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header>
        <p className="field-label m-0">{waterbody.city}</p>
        <h1 className="mt-2 mb-0 text-4xl">{waterbody.name}</h1>
        {hasSynthetic && (
          <p className="mt-2 mb-0 text-sm text-ink-muted">
            Includes synthetic demo observations while the pilot collects
            real data.
          </p>
        )}
        {heldCount > 0 && (
          <p className="mt-2 mb-0 text-sm text-ink-muted">
            {heldCount === 1
              ? "1 observation is waiting for a person to review it and is not counted yet."
              : `${heldCount} observations are waiting for a person to review them and are not counted yet.`}
          </p>
        )}
      </header>

      <DisplayModeToggle
        simple={
          <div className="space-y-4">
            <Panel>
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className={
                    "size-14 shrink-0 rounded-full border border-rule " +
                    (klass ? "" : "hatch-insufficient")
                  }
                  style={
                    klass ? { backgroundColor: colourForClass(klass) } : undefined
                  }
                />
                <div>
                  <p className="m-0 text-xl font-medium">
                    {klass ? CLASS_LABEL[klass] : "Not enough data yet"}
                  </p>
                  <p className="mt-1 mb-0 text-sm text-ink-muted">
                    {klass
                      ? SIMPLE_MESSAGE[klass]
                      : "Nobody has reported enough about this water body for us to assess it. You could be the first."}
                  </p>
                </div>
              </div>
              <Button href={`/observe?waterbody=${waterbody.id}`} className="mt-5">
                Record an observation
              </Button>
            </Panel>
            <SatellitePanel
              latest={latestSatellite}
              citizenFu={citizenFu}
              divergence={snapshot.divergence}
              scientific={false}
              now={now}
            />
          </div>
        }
        scientific={
          <div className="space-y-4">
            <Panel>
              <p className="field-label m-0">WFD ecological status</p>
              <p className="mt-1 mb-0 text-xl font-medium">
                {klass ? CLASS_LABEL[klass] : "Insufficient data"}
                {klass && (
                  <span className="num ml-2 text-sm font-normal text-ink-muted">
                    {(snapshot.assessment.probabilities[klass] * 100).toFixed(
                      0,
                    )}
                    % likely
                  </span>
                )}
              </p>
              <p className="num mt-3 mb-0 text-sm text-ink-muted">
                Posterior mean {snapshot.posterior.mean.toFixed(3)} (90% CrI{" "}
                {snapshot.posterior.lower.toFixed(3)}–
                {snapshot.posterior.upper.toFixed(3)})
              </p>
              <p className="num mt-1 mb-0 text-sm text-ink-muted">
                Data confidence {(snapshot.confidence * 100).toFixed(0)}%
              </p>
              {snapshot.divergence?.diverged && (
                <p className="mt-1 mb-0 text-sm text-ink-muted">
                  Widened: a diverging satellite pass halves the effective
                  weight of evidence for this water body rather than
                  sharpening the estimate.
                </p>
              )}
            </Panel>
            <SatellitePanel
              latest={latestSatellite}
              citizenFu={citizenFu}
              divergence={snapshot.divergence}
              scientific
              now={now}
            />
            <ScoreDisclosure snapshot={snapshot} />
          </div>
        }
      />

      <OneHealthPanel reading={oneHealth} />
    </div>
  );
}
