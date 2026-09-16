import { describe, it, expect } from "vitest";
import { observationSchema } from "../observation-schema";

const valid = {
  waterbodyId: "123e4567-e89b-12d3-a456-426614174000",
  observedAt: "2026-09-15T10:00:00.000Z",
  longitude: -8.42,
  latitude: 40.22,
  gpsAccuracyM: 12,
  forelUleIndex: 7,
  forelUleConfidence: 0.9,
  survey: {
    odour: "none",
    foam: false,
    litter: 0,
    deadFish: false,
    visibleAlgae: false,
    clarity: "clear",
    flow: "normal",
    indicatorTaxa: ["mayfly"],
    forelUle: 7,
    measurements: {},
  },
};

describe("observationSchema", () => {
  it("accepts a valid anonymous submission", () => {
    expect(observationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects coordinates outside the globe", () => {
    expect(
      observationSchema.safeParse({ ...valid, latitude: 120 }).success,
    ).toBe(false);
  });

  it("rejects a Forel-Ule index outside the scale", () => {
    expect(
      observationSchema.safeParse({ ...valid, forelUleIndex: 30 }).success,
    ).toBe(false);
  });

  it("accepts a submission with no photo-derived colour", () => {
    const result = observationSchema.safeParse({
      ...valid,
      forelUleIndex: null,
      forelUleConfidence: null,
      survey: { ...valid.survey, forelUle: null },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown odour value", () => {
    expect(
      observationSchema.safeParse({
        ...valid,
        survey: { ...valid.survey, odour: "lovely" },
      }).success,
    ).toBe(false);
  });

  describe("observedAt server-time window", () => {
    it("accepts a timestamp a few minutes in the future (clock skew)", () => {
      const observedAt = new Date(Date.now() + 2 * 60_000).toISOString();
      expect(
        observationSchema.safeParse({ ...valid, observedAt }).success,
      ).toBe(true);
    });

    it("rejects a timestamp more than 5 minutes in the future", () => {
      const observedAt = new Date(Date.now() + 6 * 60_000).toISOString();
      expect(
        observationSchema.safeParse({ ...valid, observedAt }).success,
      ).toBe(false);
    });

    it("rejects a timestamp more than 30 days in the past", () => {
      const observedAt = new Date(
        Date.now() - 31 * 24 * 3_600_000,
      ).toISOString();
      expect(
        observationSchema.safeParse({ ...valid, observedAt }).success,
      ).toBe(false);
    });

    it("accepts a timestamp within the 30-day past window", () => {
      const observedAt = new Date(
        Date.now() - 29 * 24 * 3_600_000,
      ).toISOString();
      expect(
        observationSchema.safeParse({ ...valid, observedAt }).success,
      ).toBe(true);
    });
  });
});
