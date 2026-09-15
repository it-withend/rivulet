import { describe, it, expect } from "vitest";
import { buildBundle } from "../Observation/bundle";
import { toObservationIndicators } from "@/lib/fhir/observation";

const observation = toObservationIndicators({
  id: "obs-1",
  waterbodyId: "wb-1",
  effectiveDateTime: "2026-09-15T10:00:00Z",
  performerDisplay: "Anonymous citizen scientist",
  code: "pH",
  value: { kind: "quantity", value: 7.2, unit: "pH" },
});

describe("buildBundle", () => {
  it("produces a searchset Bundle", () => {
    const bundle = buildBundle([observation]);
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("searchset");
  });

  it("reports the entry total", () => {
    expect(buildBundle([observation, observation]).total).toBe(2);
  });

  it("wraps every resource in an entry", () => {
    const bundle = buildBundle([observation]);
    expect(bundle.entry).toHaveLength(1);
    expect(bundle.entry[0].resource.resourceType).toBe("Observation");
  });

  it("handles an empty result set", () => {
    const bundle = buildBundle([]);
    expect(bundle.total).toBe(0);
    expect(bundle.entry).toEqual([]);
  });
});
