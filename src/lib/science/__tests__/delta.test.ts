import { describe, it, expect } from "vitest";
import { assessmentDelta } from "../delta";
import { computeSnapshot, type StoredObservation } from "../snapshot";
import type { SurveyAnswers } from "@/types/observation";

const clean: SurveyAnswers = {
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

function observations(count: number): StoredObservation[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `o${i}`,
    observerId: `observer-${i}`,
    observedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    survey: clean,
    qualityWeight: 0.8,
  }));
}

describe("assessmentDelta", () => {
  it("flags a data gap when the stream had no assessment before", () => {
    const delta = assessmentDelta(
      computeSnapshot([]),
      computeSnapshot(observations(1)),
    );
    expect(delta.wasDataGap).toBe(true);
    expect(delta.confidenceGain).toBeGreaterThan(0);
  });

  it("reports no data gap for an already assessed stream", () => {
    const delta = assessmentDelta(
      computeSnapshot(observations(12)),
      computeSnapshot(observations(13)),
    );
    expect(delta.wasDataGap).toBe(false);
  });

  it("detects when the class changes", () => {
    const delta = assessmentDelta(
      computeSnapshot([]),
      computeSnapshot(observations(12)),
    );
    expect(delta.before.klass).toBeNull();
    expect(delta.after.klass).not.toBeNull();
    expect(delta.classChanged).toBe(true);
  });

  it("reports no change when the class holds", () => {
    const delta = assessmentDelta(
      computeSnapshot(observations(12)),
      computeSnapshot(observations(13)),
    );
    expect(delta.classChanged).toBe(false);
  });
});
