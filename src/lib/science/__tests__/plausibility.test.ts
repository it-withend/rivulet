import { describe, it, expect } from "vitest";
import { plausibilityStatus, PLAUSIBILITY } from "../plausibility";

describe("plausibilityStatus", () => {
  it("approves a precise, first report", () => {
    expect(plausibilityStatus({ gpsAccuracyM: 10, recentByObserver: 0 })).toEqual({
      status: "auto_approved",
      reason: null,
    });
  });

  it("flags imprecise GPS with the right reason", () => {
    expect(
      plausibilityStatus({ gpsAccuracyM: PLAUSIBILITY.maxGpsAccuracyM + 1, recentByObserver: 0 }),
    ).toEqual({ status: "flagged", reason: "gps_accuracy" });
  });

  it("flags a missing GPS accuracy as imprecise, not as approved", () => {
    expect(plausibilityStatus({ gpsAccuracyM: null, recentByObserver: 0 })).toEqual({
      status: "flagged",
      reason: "gps_accuracy",
    });
  });

  it("flags an hourly flood with the rate-limit reason", () => {
    expect(
      plausibilityStatus({ gpsAccuracyM: 10, recentByObserver: PLAUSIBILITY.maxPerHour + 1 }),
    ).toEqual({ status: "flagged", reason: "rate_limit" });
  });
});
