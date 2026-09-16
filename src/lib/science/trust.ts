import { aggregate, type WeightedEvidence } from "./bayes";
import { ecologicalEvidence } from "./indicators";
import type { SurveyAnswers } from "@/types/observation";

export const TRUST_PARAMETERS = {
  priorStrength: 5,
  minIndependent: 2,
  multiplierMin: 0.4,
  multiplierMax: 1.6,
  neutralTrust: 0.5,
} as const;

export type TrustObservation = {
  id: string;
  observerId: string | null;
  waterbodyId: string;
  survey: SurveyAnswers;
  qualityWeight: number;
};

/**
 * Agreement with independent observers of the same water body, shrunk
 * towards neutral trust with a Beta-binomial-style pseudo-count prior
 * (Gelman et al., Bayesian Data Analysis, 3rd ed., ch. 5).
 *
 * `observations` must include every observation by `observerId` plus every
 * other observation on the water bodies those touch — see
 * `src/lib/trust/recompute.ts` for how callers assemble that set.
 */
export function computeTrust(
  observerId: string,
  observations: TrustObservation[],
): number {
  const p = TRUST_PARAMETERS;
  const own = observations.filter((o) => o.observerId === observerId);

  let sumAgreement = 0;
  let n = 0;

  for (const observation of own) {
    const evidence = ecologicalEvidence(observation.survey);
    if (evidence.good + evidence.bad === 0) continue;
    const p_i = evidence.good / (evidence.good + evidence.bad);

    const independent = observations.filter(
      (o) =>
        o.waterbodyId === observation.waterbodyId &&
        o.id !== observation.id &&
        o.observerId !== observerId,
    );
    if (independent.length < p.minIndependent) continue;

    const independentEvidence: WeightedEvidence[] = independent.map((o) => {
      const e = ecologicalEvidence(o.survey);
      return { good: e.good, bad: e.bad, weight: o.qualityWeight };
    });
    const m = aggregate(independentEvidence).mean;

    sumAgreement += 1 - Math.abs(p_i - m);
    n += 1;
  }

  return (p.priorStrength * p.neutralTrust + sumAgreement) / (p.priorStrength + n);
}

/** Neutral trust (0.5) maps to 1; the multiplier is clamped either side. */
export function trustMultiplier(trust: number): number {
  const p = TRUST_PARAMETERS;
  return Math.max(p.multiplierMin, Math.min(p.multiplierMax, trust / p.neutralTrust));
}
