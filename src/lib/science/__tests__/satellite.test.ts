import { describe, it, expect } from "vitest";
import { divergence, satelliteEvidence, type SatelliteReading } from "../satellite";
import { computeSnapshot } from "../snapshot";
import type { SurveyAnswers } from "@/types/observation";

function reading(overrides: Partial<SatelliteReading> = {}): SatelliteReading {
  return {
    id: "sat-1",
    waterbodyId: "w1",
    acquiredAt: new Date().toISOString(),
    sceneId: "scene-1",
    cloudCover: 5,
    usablePixels: 20,
    ndci: 0.1,
    turbidity: 0.05,
    forelUleEquivalent: 4,
    hueAngle: 200,
    ...overrides,
  };
}

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

function citizenObservation(id: string, ageHours: number) {
  return {
    id,
    observerId: `obs-${id}`,
    observedAt: new Date(Date.now() - ageHours * 3600_000).toISOString(),
    survey: cleanSurvey,
    qualityWeight: 0.8,
  };
}

describe("satelliteEvidence", () => {
  it("maps a clear satellite reading to good evidence, same as ecologicalEvidence", () => {
    const evidence = satelliteEvidence(reading({ forelUleEquivalent: 3 }));
    expect(evidence.good).toBeGreaterThan(0);
    expect(evidence.bad).toBe(0);
  });

  it("maps an enriched satellite reading to bad evidence", () => {
    const evidence = satelliteEvidence(reading({ forelUleEquivalent: 16 }));
    expect(evidence.bad).toBeGreaterThan(0);
    expect(evidence.good).toBe(0);
  });

  it("gives no evidence either way for an unusable (cloudy) pass", () => {
    const evidence = satelliteEvidence(reading({ forelUleEquivalent: null }));
    expect(evidence.good).toBe(0);
    expect(evidence.bad).toBe(0);
  });
});

describe("divergence", () => {
  it("does not flag readings within the threshold", () => {
    const result = divergence(3, 5);
    expect(result.diverged).toBe(false);
    expect(result.deltaFu).toBe(2);
  });

  it("flags readings beyond the threshold", () => {
    const result = divergence(3, 15);
    expect(result.diverged).toBe(true);
    expect(result.deltaFu).toBe(12);
  });
});

describe("computeSnapshot with satellite readings", () => {
  const observations = Array.from({ length: 4 }, (_, i) =>
    citizenObservation(`o${i}`, 2),
  );
  const now = new Date();

  it("has a wider credible interval and no higher confidence when the satellite reading diverges", () => {
    const withoutSatellite = computeSnapshot(observations, now);
    const diverging = reading({ forelUleEquivalent: 18, acquiredAt: now.toISOString() });
    const withDivergingSatellite = computeSnapshot(observations, now, [diverging]);

    expect(withDivergingSatellite.divergence?.diverged).toBe(true);

    const widthWithout =
      withoutSatellite.posterior.upper - withoutSatellite.posterior.lower;
    const widthWith =
      withDivergingSatellite.posterior.upper - withDivergingSatellite.posterior.lower;
    expect(widthWith).toBeGreaterThan(widthWithout);
    expect(withDivergingSatellite.confidence).toBeLessThanOrEqual(
      withoutSatellite.confidence,
    );
  });

  it("reports no divergence and unavailable comparison when the pass is unusable", () => {
    const cloudy = reading({ forelUleEquivalent: null, acquiredAt: now.toISOString() });
    const snapshot = computeSnapshot(observations, now, [cloudy]);
    expect(snapshot.divergence).toBeNull();
  });

  it("ignores a satellite reading older than maxAgeDays", () => {
    const stale = reading({
      forelUleEquivalent: 18,
      acquiredAt: new Date(now.getTime() - 60 * 86_400_000).toISOString(),
    });
    const snapshot = computeSnapshot(observations, now, [stale]);
    expect(snapshot.divergence).toBeNull();
  });
});
