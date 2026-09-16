import { notFound } from "next/navigation";
import { supabaseAnon } from "@/lib/db/client";
import { computeSnapshot, weightedCitizenForelUle } from "@/lib/science/snapshot";
import type { SatelliteReading } from "@/lib/science/satellite";
import {
  colourForClass,
  CLASS_LABEL,
  PLAIN_CLASS_LABEL,
  SIMPLE_MESSAGE,
} from "@/lib/ui/wfd-colours";
import { ScoreDisclosure } from "@/components/water/ScoreDisclosure";
import { TrendChart } from "@/components/water/TrendChart";
import { RecentReports } from "@/components/water/RecentReports";
import { monthlyTrend } from "@/lib/science/trend";
import { isCurrentReading } from "@/lib/science/satellite";
import { Camera, FlaskConical, History, Map as MapIcon, MapPin, MessageSquareText, Satellite, Users } from "lucide-react";
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
      "id, observed_at, observer_id, survey, quality_weight, is_synthetic, validation_status, observers(trust_score, display_name)",
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
  // Prefer the newest pass that could actually see the water; the panel still
  // reports a stale or unusable pass as unavailable, never as agreement.
  const latestSatellite =
    satelliteReadings.find((r) => r.forelUleEquivalent !== null && isCurrentReading(r, now)) ??
    satelliteReadings.find((r) => r.forelUleEquivalent !== null) ??
    satelliteReadings[0] ??
    null;

  const trend = monthlyTrend(observationInputs, now);
  const observerCount = new Set(rows.map((o) => o.observer_id ?? o.id)).size;
  const sureness =
    snapshot.confidence >= 0.7 ? "fairly sure" : snapshot.confidence >= 0.4 ? "somewhat sure" : "not very sure yet";
  const reports = rows.slice(0, 8).map((o) => {
    const embed = Array.isArray(o.observers) ? o.observers[0] : o.observers;
    return {
      id: o.id,
      observedAt: o.observed_at,
      observerName: (embed as { display_name?: string } | null)?.display_name ?? null,
      isSynthetic: Boolean(o.is_synthetic),
      survey: o.survey,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-4">
        <div>
          <p className="field-label m-0 flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-3.5" />
            {waterbody.city}
          </p>
          <h1 className="mt-2 mb-0 text-4xl">{waterbody.name}</h1>
        </div>

        <Panel>
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className={"size-14 shrink-0 rounded-full border border-rule " + (klass ? "" : "hatch-insufficient")}
              style={klass ? { backgroundColor: colourForClass(klass) } : undefined}
            />
            <div>
              <p className="m-0 text-2xl font-medium">
                {klass ? PLAIN_CLASS_LABEL[klass] : "Not checked enough yet"}
              </p>
              <p className="mt-1 mb-0 text-ink-muted">
                {klass
                  ? `${SIMPLE_MESSAGE[klass]} Based on what neighbours noticed — we are ${sureness}.`
                  : "Too few people have reported on this stream to say how it is doing. Your report would make a real difference."}
              </p>
              <p className="mt-2 mb-0 flex items-center gap-1.5 text-sm text-ink-muted">
                <Users aria-hidden="true" className="size-4" />
                {rows.length} report{rows.length === 1 ? "" : "s"} from {observerCount}{" "}
                {observerCount === 1 ? "person" : "people"}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button href={`/observe?waterbody=${waterbody.id}`}>
              <Camera aria-hidden="true" className="size-4" />
              Check this stream
            </Button>
            <Button href={`/map?city=${waterbody.city}`} variant="secondary">
              <MapIcon aria-hidden="true" className="size-4" />
              Back to the map
            </Button>
          </div>
        </Panel>

        {(hasSynthetic || heldCount > 0) && (
          <div className="space-y-1 text-sm text-ink-muted">
            {hasSynthetic && (
              <p className="m-0">Includes demonstration reports while the pilot collects real ones.</p>
            )}
            {heldCount > 0 && (
              <p className="m-0">
                {heldCount === 1
                  ? "1 report is waiting for a person to review it and is not counted yet."
                  : `${heldCount} reports are waiting for a person to review them and are not counted yet.`}
              </p>
            )}
          </div>
        )}
      </header>

      <OneHealthPanel reading={oneHealth} />

      <section aria-labelledby="trend-heading" className="space-y-3">
        <h2 id="trend-heading" className="m-0 flex items-center gap-2 text-2xl">
          <History aria-hidden="true" className="size-6 text-river" />
          How it has changed
        </h2>
        <TrendChart points={trend} />
      </section>

      <section aria-labelledby="reports-heading" className="space-y-2">
        <h2 id="reports-heading" className="m-0 flex items-center gap-2 text-2xl">
          <MessageSquareText aria-hidden="true" className="size-6 text-river" />
          What neighbours saw
        </h2>
        <RecentReports reports={reports} now={now} />
      </section>

      <section aria-labelledby="satellite-heading" className="space-y-3">
        <h2 id="satellite-heading" className="m-0 flex items-center gap-2 text-2xl">
          <Satellite aria-hidden="true" className="size-6 text-river" />
          Seen from space
        </h2>
        <SatellitePanel
          latest={latestSatellite}
          citizenFu={citizenFu}
          divergence={snapshot.divergence}
          scientific={false}
          now={now}
        />
      </section>

      <details className="rounded-md border border-rule bg-paper-raised p-4">
        <summary className="flex cursor-pointer items-center gap-2 font-medium">
          <FlaskConical aria-hidden="true" className="size-5 text-river" />
          For scientists: the numbers behind this
        </summary>
        <div className="mt-4 space-y-4">
          <Panel>
            <p className="field-label m-0">Indicative status (WFD class names)</p>
            <p className="mt-1 mb-0 text-xl font-medium">
              {klass ? CLASS_LABEL[klass] : "Insufficient data"}
              {klass && (
                <span className="num ml-2 text-sm font-normal text-ink-muted">
                  {(snapshot.assessment.probabilities[klass] * 100).toFixed(0)}% likely
                </span>
              )}
            </p>
            <p className="num mt-3 mb-0 text-sm text-ink-muted">
              Posterior mean {snapshot.posterior.mean.toFixed(3)} (90% CrI{" "}
              {snapshot.posterior.lower.toFixed(3)}–{snapshot.posterior.upper.toFixed(3)})
            </p>
            <p className="num mt-1 mb-0 text-sm text-ink-muted">
              Data confidence {(snapshot.confidence * 100).toFixed(0)}%
            </p>
            {snapshot.divergence?.diverged && (
              <p className="mt-1 mb-0 text-sm text-ink-muted">
                Widened: a diverging satellite pass halves the effective weight
                of evidence for this water body rather than sharpening the
                estimate.
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
      </details>
    </div>
  );
}
