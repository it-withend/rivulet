import { aggregate, dataConfidence, type Posterior } from "./bayes";
import { classify, type WfdAssessment } from "./wfd";
import { ecologicalEvidence } from "./indicators";
import { METHOD_VERSION } from "./method-version";
import { trustMultiplier, TRUST_PARAMETERS } from "./trust";
import {
  divergence,
  isCurrentReading,
  satelliteEvidence,
  SATELLITE_PARAMETERS,
  type DivergenceResult,
  type SatelliteReading,
} from "./satellite";
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
  source?: "citizen" | "satellite";
};

/** Weighted mean citizen Forel-Ule reading, for comparison against a satellite pass. Null with no photo readings. */
export function weightedCitizenForelUle(observations: StoredObservation[]): number | null {
  const withFu = observations.filter((o) => o.survey.forelUle !== null);
  if (withFu.length === 0) return null;
  let sumWeight = 0;
  let sumWeighted = 0;
  for (const o of withFu) {
    sumWeight += o.qualityWeight;
    sumWeighted += (o.survey.forelUle as number) * o.qualityWeight;
  }
  return sumWeighted / sumWeight;
}

export type Snapshot = {
  posterior: Posterior;
  assessment: WfdAssessment;
  confidence: number;
  observationCount: number;
  uniqueObservers: number;
  methodVersion: string;
  inputs: SnapshotInput[];
  /** Null when no current, usable satellite reading was available to compare. */
  divergence: DivergenceResult | null;
};

export function computeSnapshot(
  observations: StoredObservation[],
  now: Date = new Date(),
  satellite?: SatelliteReading[],
): Snapshot {
  const inputs: SnapshotInput[] = observations.map((o) => {
    const evidence = ecologicalEvidence(o.survey);
    const multiplier = trustMultiplier(o.observerTrust ?? TRUST_PARAMETERS.neutralTrust);
    return {
      observationId: o.id,
      weight: o.qualityWeight * multiplier,
      good: evidence.good,
      bad: evidence.bad,
      source: "citizen" as const,
    };
  });

  // A satellite pass is an independent, coarse cross-check: only the most
  // recent reading still within `maxAgeDays` enters the model, at a fixed
  // evidence weight. A cloudy or unusable pass (forelUleEquivalent null) is
  // never treated as agreement — it simply contributes nothing.
  const current = (satellite ?? [])
    .filter((r) => isCurrentReading(r, now))
    .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
  const latestSatellite = current[0];

  let divergenceResult: DivergenceResult | null = null;

  if (latestSatellite && latestSatellite.forelUleEquivalent !== null) {
    const evidence = satelliteEvidence(latestSatellite);
    inputs.push({
      observationId: `satellite-${latestSatellite.id}`,
      weight: SATELLITE_PARAMETERS.evidenceWeight,
      good: evidence.good,
      bad: evidence.bad,
      source: "satellite" as const,
    });

    const citizenFu = weightedCitizenForelUle(observations);
    if (citizenFu !== null) {
      divergenceResult = divergence(citizenFu, latestSatellite.forelUleEquivalent);
    }
  }

  // Divergence is signal, not error: it must widen the posterior, never
  // sharpen it, and must never raise data confidence. Halving every
  // contributing weight (citizen and satellite alike) for this water body
  // achieves both — effective N falls, so the credible interval widens and
  // the volume component of data confidence can only fall or hold.
  if (divergenceResult?.diverged) {
    for (const input of inputs) input.weight *= 0.5;
  }

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
    divergence: divergenceResult,
  };
}
