import { notFound } from "next/navigation";
import { supabaseAnon } from "@/lib/db/client";
import { computeSnapshot } from "@/lib/science/snapshot";
import {
  colourForClass,
  CLASS_LABEL,
  SIMPLE_MESSAGE,
} from "@/lib/ui/wfd-colours";
import { ScoreDisclosure } from "@/components/water/ScoreDisclosure";
import { DisplayModeToggle } from "@/components/water/DisplayModeToggle";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { embeddedTrustScore } from "@/lib/db/embed";
import { isHeldForReview } from "@/lib/science/plausibility";

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

  const allRows = observationsError ? [] : (observations ?? []);
  const rows = allRows.filter((o) => !isHeldForReview(o.validation_status));
  const heldCount = allRows.length - rows.length;
  const hasSynthetic = rows.some((o) => o.is_synthetic);

  const snapshot = computeSnapshot(
    rows.map((o) => ({
      id: o.id,
      observedAt: o.observed_at,
      observerId: o.observer_id,
      survey: o.survey,
      qualityWeight: Number(o.quality_weight),
      observerTrust: embeddedTrustScore(o.observers),
    })),
  );

  const klass = snapshot.assessment.klass;

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
            </Panel>
            <ScoreDisclosure snapshot={snapshot} />
          </div>
        }
      />
    </div>
  );
}
