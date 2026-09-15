import { describe, it, expect } from "vitest";
import { observationWeight } from "../weighting";

const baseline = {
  hasPhoto: true,
  forelUleConfidence: 0.9,
  gpsAccuracyMetres: 8,
  measurementCount: 2,
  ageHours: 1,
};

describe("observationWeight", () => {
  it("stays within bounds for a strong observation", () => {
    const w = observationWeight(baseline);
    expect(w).toBeGreaterThan(0.1);
    expect(w).toBeLessThanOrEqual(1);
  });

  it("scores a photo-backed observation above one without", () => {
    const withPhoto = observationWeight(baseline);
    const without = observationWeight({
      ...baseline,
      hasPhoto: false,
      forelUleConfidence: null,
    });
    expect(withPhoto).toBeGreaterThan(without);
  });

  it("penalises poor GPS accuracy", () => {
    const precise = observationWeight(baseline);
    const vague = observationWeight({ ...baseline, gpsAccuracyMetres: 500 });
    expect(precise).toBeGreaterThan(vague);
  });

  it("decays with age", () => {
    const fresh = observationWeight(baseline);
    const stale = observationWeight({ ...baseline, ageHours: 24 * 90 });
    expect(fresh).toBeGreaterThan(stale);
  });

  it("never drops below the floor", () => {
    const w = observationWeight({
      hasPhoto: false,
      forelUleConfidence: null,
      gpsAccuracyMetres: 10000,
      measurementCount: 0,
      ageHours: 24 * 3650,
    });
    expect(w).toBeGreaterThanOrEqual(0.1);
  });

  it("treats unknown GPS accuracy as poor, not as good", () => {
    const known = observationWeight({ ...baseline, gpsAccuracyMetres: 8 });
    const unknown = observationWeight({ ...baseline, gpsAccuracyMetres: null });
    expect(unknown).toBeLessThan(known);
  });
});
