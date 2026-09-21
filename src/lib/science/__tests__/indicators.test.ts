import { describe, it, expect } from "vitest";
import { toIndicators, ecologicalEvidence } from "../indicators";
import type { SurveyAnswers } from "@/types/observation";

const clean: SurveyAnswers = {
  odour: "none",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: ["mayfly", "caddisfly"],
  forelUle: 3,
  measurements: {},
};

const polluted: SurveyAnswers = {
  odour: "sewage",
  foam: true,
  litter: 3,
  deadFish: true,
  visibleAlgae: true,
  clarity: "opaque",
  flow: "stagnant",
  indicatorTaxa: ["worm", "leech"],
  forelUle: 18,
  measurements: { ph: 8.9, dissolvedOxygen: 2.1 },
};

describe("toIndicators", () => {
  it("emits an indicator for every supplied measurement", () => {
    const codes = toIndicators(polluted).map((i) => i.code);
    expect(codes).toContain("pH");
    expect(codes).toContain("dissolvedO2");
  });

  it("omits measurements that were not supplied", () => {
    const codes = toIndicators(clean).map((i) => i.code);
    expect(codes).not.toContain("pH");
  });

  it("keeps visual signs off OneAquaHealth analyte codes", () => {
    const codes = toIndicators(polluted).map((i) => i.code);
    expect(codes).toContain("sewage-odour");
    for (const borrowed of ["coliforms", "macrophytes", "LandUse", "tss"]) {
      expect(codes).not.toContain(borrowed);
    }
  });

  it("maps observed taxa to a Rivulet proxy, not the OneAquaHealth macroinvertebrate count", () => {
    const codes = toIndicators(clean).map((i) => i.code);
    expect(codes).toContain("invertebrate-groups-score");
    expect(codes).not.toContain("macroinvertebreates");
    expect(codes).toContain("flow-state");
    expect(codes).not.toContain("hydrology");
  });

  it("cites a source on every indicator", () => {
    for (const indicator of toIndicators(polluted)) {
      expect(indicator.source.length).toBeGreaterThan(0);
    }
  });
});

describe("ecologicalEvidence", () => {
  it("weighs a clean survey toward good", () => {
    const e = ecologicalEvidence(clean);
    expect(e.good).toBeGreaterThan(e.bad);
  });

  it("weighs a polluted survey toward bad", () => {
    const e = ecologicalEvidence(polluted);
    expect(e.bad).toBeGreaterThan(e.good);
  });

  it("never returns negative pseudo-counts", () => {
    for (const answers of [clean, polluted]) {
      const e = ecologicalEvidence(answers);
      expect(e.good).toBeGreaterThanOrEqual(0);
      expect(e.bad).toBeGreaterThanOrEqual(0);
    }
  });

  it("produces weak evidence when nothing was observed", () => {
    const empty: SurveyAnswers = {
      ...clean,
      indicatorTaxa: ["none_seen"],
      forelUle: null,
    };
    const e = ecologicalEvidence(empty);
    expect(e.good + e.bad).toBeLessThan(
      ecologicalEvidence(clean).good + ecologicalEvidence(clean).bad,
    );
  });
});
