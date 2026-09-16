import { aggregate, dataConfidence, type Posterior } from "./bayes";
import { classify, type WfdAssessment } from "./wfd";
import { ecologicalEvidence } from "./indicators";
import { METHOD_VERSION } from "./method-version";
import { trustMultiplier, TRUST_PARAMETERS } from "./trust";
import type { SurveyAnswers } from "@/types/observation";

export type StoredObservation = {
  id: string;
  observedAt: string;
  observerId: string | null;
  survey: SurveyAnswers;
  qualityWeight: number;
  /** Observer's trust score (0-1); neutral (0.5) if unknown or anonymous. */
  observerTrust?: number;
};

export type SnapshotInput = {
  observationId: string;
  weight: number;
  good: number;
  bad: number;
};

export type Snapshot = {
  posterior: Posterior;
  assessment: WfdAssessment;
  confidence: number;
  observationCount: number;
  uniqueObservers: number;
  methodVersion: string;
  inputs: SnapshotInput[];
};

export function computeSnapshot(
  observations: StoredObservation[],
  now: Date = new Date(),
): Snapshot {
  const inputs: SnapshotInput[] = observations.map((o) => {
    const evidence = ecologicalEvidence(o.survey);
    const multiplier = trustMultiplier(o.observerTrust ?? TRUST_PARAMETERS.neutralTrust);
    return {
      observationId: o.id,
      weight: o.qualityWeight * multiplier,
      good: evidence.good,
      bad: evidence.bad,
    };
  });

  const posterior = aggregate(
    inputs.map((i) => ({ good: i.good, bad: i.bad, weight: i.weight })),
  );

  const observerKeys = new Set(
    observations.map((o, i) => o.observerId ?? `anonymous-${i}`),
  );

  const newestAgeHours =
    observations.length === 0
      ? Number.POSITIVE_INFINITY
      : Math.min(
          ...observations.map(
            (o) =>
              (now.getTime() - new Date(o.observedAt).getTime()) / 3600_000,
          ),
        );

  const confidence = dataConfidence({
    observationCount: observations.length,
    uniqueObservers: observerKeys.size,
    newestAgeHours: observations.length === 0 ? 0 : newestAgeHours,
    effectiveN: posterior.effectiveN,
  });

  return {
    posterior,
    assessment: classify(posterior, confidence),
    confidence,
    observationCount: observations.length,
    uniqueObservers: observerKeys.size,
    methodVersion: METHOD_VERSION.version,
    inputs,
  };
}
