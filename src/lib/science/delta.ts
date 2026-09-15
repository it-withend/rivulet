import type { Snapshot } from "./snapshot";
import type { WfdClass } from "./wfd";

export type AssessmentSummary = {
  klass: WfdClass | null;
  mean: number;
  confidence: number;
  sufficientData: boolean;
};

export type AssessmentDelta = {
  before: AssessmentSummary;
  after: AssessmentSummary;
  classChanged: boolean;
  confidenceGain: number;
  wasDataGap: boolean;
};

function summarise(snapshot: Snapshot): AssessmentSummary {
  return {
    klass: snapshot.assessment.klass,
    mean: snapshot.posterior.mean,
    confidence: snapshot.confidence,
    sufficientData: snapshot.assessment.sufficientData,
  };
}

export function assessmentDelta(
  before: Snapshot,
  after: Snapshot,
): AssessmentDelta {
  const b = summarise(before);
  const a = summarise(after);
  return {
    before: b,
    after: a,
    classChanged: b.klass !== a.klass,
    confidenceGain: a.confidence - b.confidence,
    wasDataGap: !b.sufficientData,
  };
}
