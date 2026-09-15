import { describe, it, expect } from "vitest";
import { METHOD_PARAMETERS, type MethodParameter } from "../method-parameters";

type Prior = Extract<MethodParameter, { kind: "prior" }>;

describe("METHOD_PARAMETERS", () => {
  it("gives every parameter a unique id", () => {
    const ids = METHOD_PARAMETERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cites a source for every standard and a rationale for every prior", () => {
    for (const p of METHOD_PARAMETERS) {
      const text = p.kind === "standard" ? p.source : p.rationale;
      expect(text.length, p.id).toBeGreaterThan(20);
    }
  });

  it("declares every prior as uncalibrated", () => {
    const priors = METHOD_PARAMETERS.filter((p): p is Prior => p.kind === "prior");
    expect(priors.length).toBeGreaterThan(0);
    for (const prior of priors) {
      expect(prior.rationale, prior.id).toMatch(/uncalibrated/i);
    }
  });

  it("holds only finite numbers", () => {
    for (const p of METHOD_PARAMETERS) {
      const values = typeof p.value === "number" ? [p.value] : [...p.value];
      expect(values.every(Number.isFinite), p.id).toBe(true);
    }
  });

  it("registers the Forel–Ule priors", () => {
    expect(METHOD_PARAMETERS.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        "forel-ule.min-usable-pixels",
        "forel-ule.min-chroma-distance",
        "forel-ule.confidence-spread-scale",
      ]),
    );
  });
});
