import { describe, it, expect } from "vitest";
import { classify, WFD_BOUNDARIES } from "../wfd";
import { aggregate } from "../bayes";
import { METHOD_VERSION } from "../method-version";

describe("WFD_BOUNDARIES", () => {
  it("covers the unit interval without gaps", () => {
    const bands = Object.values(WFD_BOUNDARIES).sort((a, b) => a.min - b.min);
    expect(bands[0].min).toBe(0);
    expect(bands[bands.length - 1].max).toBe(1);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].min).toBeCloseTo(bands[i - 1].max, 6);
    }
  });
});

describe("classify", () => {
  it("refuses to assign a class when confidence is too low", () => {
    const result = classify(aggregate([{ good: 1, bad: 0, weight: 0.1 }]), 0.05);
    expect(result.sufficientData).toBe(false);
    expect(result.klass).toBeNull();
  });

  it("assigns bad to strongly negative evidence", () => {
    const posterior = aggregate(
      Array.from({ length: 40 }, () => ({ good: 0, bad: 5, weight: 1 })),
    );
    const result = classify(posterior, 0.9);
    expect(result.sufficientData).toBe(true);
    expect(result.klass).toBe("bad");
  });

  it("assigns high to strongly positive evidence", () => {
    const posterior = aggregate(
      Array.from({ length: 40 }, () => ({ good: 5, bad: 0, weight: 1 })),
    );
    expect(classify(posterior, 0.9).klass).toBe("high");
  });

  it("returns probabilities that sum to one", () => {
    const posterior = aggregate([{ good: 3, bad: 2, weight: 1 }]);
    const total = Object.values(classify(posterior, 0.8).probabilities).reduce(
      (a, b) => a + b,
      0,
    );
    expect(total).toBeCloseTo(1, 4);
  });

  it("names the most probable class as the assigned class", () => {
    const posterior = aggregate([{ good: 8, bad: 2, weight: 1 }]);
    const result = classify(posterior, 0.8);
    const best = (Object.entries(result.probabilities) as [string, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
    expect(result.klass).toBe(best);
  });

  it("classifies a heavily observed stream with balanced evidence", () => {
    const posterior = aggregate(
      Array.from({ length: 300 }, () => ({ good: 2, bad: 2, weight: 1 })),
    );
    const result = classify(posterior, 0.9);
    expect(result.klass).toBe("moderate");
    expect(result.probabilities.moderate).toBeGreaterThan(0.99);
  });
});

describe("METHOD_VERSION", () => {
  it("is versioned and cites its sources", () => {
    expect(METHOD_VERSION.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(METHOD_VERSION.citations.length).toBeGreaterThanOrEqual(3);
  });
});
