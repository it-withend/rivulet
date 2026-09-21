import { describe, expect, it } from "vitest";
import { modelBehaviour } from "../behaviour";

const now = new Date("2026-09-21T12:00:00Z");
const { agreeing, disagreeing, trust } = modelBehaviour(now);
const healthy = agreeing.filter((r) => r.scenario.startsWith("All healthy"));

describe("modelBehaviour", () => {
  it("says insufficient data with no reports", () => {
    expect(agreeing[0].reports).toBe(0);
    expect(agreeing[0].klass).toBeNull();
  });

  it("narrows the interval and raises confidence as agreeing reports accumulate", () => {
    const widths = healthy.map((r) => r.upper - r.lower);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1]);
    const confidence = healthy.map((r) => r.confidence);
    for (let i = 1; i < confidence.length; i++) expect(confidence[i]).toBeGreaterThan(confidence[i - 1]);
  });

  it("lets mixed evidence land between the extremes", () => {
    for (const r of disagreeing) {
      expect(r.mean).toBeGreaterThan(0.2);
      expect(r.mean).toBeLessThan(0.8);
    }
  });

  it("counts a trusted observer for more than a low-trust one", () => {
    const [trustedHealthy, trustedPolluted] = trust;
    expect(trustedHealthy.mean).toBeGreaterThan(trustedPolluted.mean);
  });
});
