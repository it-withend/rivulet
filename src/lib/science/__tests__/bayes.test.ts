import { describe, it, expect } from "vitest";
import { aggregate, dataConfidence, regularizedIncompleteBeta } from "../bayes";

describe("aggregate", () => {
  it("returns the prior mean when there is no evidence", () => {
    const p = aggregate([]);
    expect(p.mean).toBeCloseTo(0.5, 6);
    expect(p.effectiveN).toBe(0);
  });

  it("keeps the interval ordered around the mean", () => {
    const p = aggregate([{ good: 3, bad: 1, weight: 1 }]);
    expect(p.lower).toBeLessThanOrEqual(p.mean);
    expect(p.mean).toBeLessThanOrEqual(p.upper);
    expect(p.lower).toBeGreaterThanOrEqual(0);
    expect(p.upper).toBeLessThanOrEqual(1);
  });

  it("narrows the interval as consistent evidence accumulates", () => {
    const few = aggregate([{ good: 3, bad: 1, weight: 1 }]);
    const many = aggregate(
      Array.from({ length: 30 }, () => ({ good: 3, bad: 1, weight: 1 })),
    );
    expect(many.upper - many.lower).toBeLessThan(few.upper - few.lower);
  });

  it("keeps the mean near one half when evidence conflicts", () => {
    const p = aggregate([
      ...Array.from({ length: 10 }, () => ({ good: 4, bad: 0, weight: 1 })),
      ...Array.from({ length: 10 }, () => ({ good: 0, bad: 4, weight: 1 })),
    ]);
    expect(p.mean).toBeGreaterThan(0.4);
    expect(p.mean).toBeLessThan(0.6);
  });

  it("gives a low-weight observation less influence than a full-weight one", () => {
    const light = aggregate([{ good: 5, bad: 0, weight: 0.1 }]);
    const heavy = aggregate([{ good: 5, bad: 0, weight: 1 }]);
    expect(heavy.mean).toBeGreaterThan(light.mean);
  });

  it("moves toward zero when evidence is bad", () => {
    const p = aggregate(
      Array.from({ length: 20 }, () => ({ good: 0, bad: 4, weight: 1 })),
    );
    expect(p.mean).toBeLessThan(0.2);
  });
});

describe("dataConfidence", () => {
  it("returns zero when there are no observations", () => {
    expect(
      dataConfidence({
        observationCount: 0,
        uniqueObservers: 0,
        newestAgeHours: 0,
        effectiveN: 0,
      }),
    ).toBe(0);
  });

  it("rewards more observers over a single prolific one", () => {
    const solo = dataConfidence({
      observationCount: 10,
      uniqueObservers: 1,
      newestAgeHours: 2,
      effectiveN: 10,
    });
    const crowd = dataConfidence({
      observationCount: 10,
      uniqueObservers: 6,
      newestAgeHours: 2,
      effectiveN: 10,
    });
    expect(crowd).toBeGreaterThan(solo);
  });

  it("decays as the newest observation ages", () => {
    const fresh = dataConfidence({
      observationCount: 8,
      uniqueObservers: 4,
      newestAgeHours: 2,
      effectiveN: 8,
    });
    const stale = dataConfidence({
      observationCount: 8,
      uniqueObservers: 4,
      newestAgeHours: 24 * 120,
      effectiveN: 8,
    });
    expect(fresh).toBeGreaterThan(stale);
  });

  it("stays within zero and one", () => {
    const c = dataConfidence({
      observationCount: 500,
      uniqueObservers: 200,
      newestAgeHours: 0,
      effectiveN: 500,
    });
    expect(c).toBeLessThanOrEqual(1);
    expect(c).toBeGreaterThanOrEqual(0);
  });
});

describe("regularizedIncompleteBeta", () => {
  it("equals x for the uniform distribution", () => {
    expect(regularizedIncompleteBeta(0.3, 1, 1)).toBeCloseTo(0.3, 10);
  });

  it("matches the closed form for Beta(2, 2)", () => {
    const x = 0.3;
    expect(regularizedIncompleteBeta(x, 2, 2)).toBeCloseTo(
      3 * x ** 2 - 2 * x ** 3,
      10,
    );
  });

  it("matches the closed form x^a when b is 1", () => {
    expect(regularizedIncompleteBeta(0.8, 5, 1)).toBeCloseTo(0.8 ** 5, 10);
  });

  it("matches the closed form 1 - (1 - x)^b when a is 1, exercising reflection", () => {
    expect(regularizedIncompleteBeta(0.8, 1, 5)).toBeCloseTo(1 - 0.2 ** 5, 10);
  });

  it("stays finite and centred for large symmetric parameters", () => {
    expect(regularizedIncompleteBeta(0.5, 600, 600)).toBeCloseTo(0.5, 6);
  });

  it("returns the bounds at the edges of the unit interval", () => {
    expect(regularizedIncompleteBeta(0, 2, 3)).toBe(0);
    expect(regularizedIncompleteBeta(1, 2, 3)).toBe(1);
  });
});
