import { describe, it, expect } from "vitest";
import { computeSnapshot } from "../snapshot";
import type { SurveyAnswers } from "@/types/observation";

const cleanSurvey: SurveyAnswers = {
  odour: "none",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: ["mayfly"],
  forelUle: 3,
  measurements: {},
};

function observation(id: string, observerId: string | null, ageHours: number) {
  return {
    id,
    observerId,
    observedAt: new Date(Date.now() - ageHours * 3600_000).toISOString(),
    survey: cleanSurvey,
    qualityWeight: 0.8,
  };
}

describe("computeSnapshot", () => {
  it("reports insufficient data for an empty water body", () => {
    const snapshot = computeSnapshot([]);
    expect(snapshot.assessment.sufficientData).toBe(false);
    expect(snapshot.assessment.klass).toBeNull();
    expect(snapshot.confidence).toBe(0);
  });

  it("counts unique observers, not observations", () => {
    const snapshot = computeSnapshot([
      observation("a", "obs-1", 1),
      observation("b", "obs-1", 2),
      observation("c", "obs-2", 3),
    ]);
    expect(snapshot.observationCount).toBe(3);
    expect(snapshot.uniqueObservers).toBe(2);
  });

  it("counts each anonymous observation as its own observer", () => {
    const snapshot = computeSnapshot([
      observation("a", null, 1),
      observation("b", null, 2),
    ]);
    expect(snapshot.uniqueObservers).toBe(2);
  });

  it("records one traceable input per observation", () => {
    const snapshot = computeSnapshot([
      observation("a", "obs-1", 1),
      observation("b", "obs-2", 2),
    ]);
    expect(snapshot.inputs).toHaveLength(2);
    expect(snapshot.inputs[0].observationId).toBe("a");
    expect(snapshot.inputs[0].weight).toBeCloseTo(0.8, 6);
  });

  it("stamps the method version", () => {
    expect(computeSnapshot([]).methodVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("assigns a class once enough consistent evidence exists", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      observation(`o${i}`, `obs-${i}`, 2),
    );
    const snapshot = computeSnapshot(many);
    expect(snapshot.assessment.sufficientData).toBe(true);
    expect(snapshot.assessment.klass).not.toBeNull();
  });
});
