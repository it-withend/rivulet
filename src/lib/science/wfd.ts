import { regularizedIncompleteBeta, type Posterior } from "./bayes";

export type WfdClass = "high" | "good" | "moderate" | "poor" | "bad";

export type WfdAssessment = {
  klass: WfdClass | null;
  probabilities: Record<WfdClass, number>;
  sufficientData: boolean;
};

export const MIN_CONFIDENCE_FOR_CLASS = 0.25;

export const WFD_BOUNDARIES: Record<WfdClass, { min: number; max: number }> = {
  bad: { min: 0, max: 0.2 },
  poor: { min: 0.2, max: 0.4 },
  moderate: { min: 0.4, max: 0.6 },
  good: { min: 0.6, max: 0.8 },
  high: { min: 0.8, max: 1 },
};

export function classify(
  posterior: Posterior,
  confidence: number,
): WfdAssessment {
  const probabilities = {} as Record<WfdClass, number>;

  for (const klass of Object.keys(WFD_BOUNDARIES) as WfdClass[]) {
    const band = WFD_BOUNDARIES[klass];
    probabilities[klass] =
      regularizedIncompleteBeta(band.max, posterior.alpha, posterior.beta) -
      regularizedIncompleteBeta(band.min, posterior.alpha, posterior.beta);
  }

  if (confidence < MIN_CONFIDENCE_FOR_CLASS) {
    return { klass: null, probabilities, sufficientData: false };
  }

  const best = (Object.entries(probabilities) as [WfdClass, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0][0];

  return { klass: best, probabilities, sufficientData: true };
}
