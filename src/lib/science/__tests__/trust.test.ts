import { describe, it, expect } from "vitest";
import { computeTrust, trustMultiplier, TRUST_PARAMETERS } from "../trust";
import type { SurveyAnswers } from "@/types/observation";

const clean: SurveyAnswers = {
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

const polluted: SurveyAnswers = {
  odour: "sewage",
  foam: true,
  litter: 3,
  deadFish: true,
  visibleAlgae: true,
  clarity: "opaque",
  flow: "stagnant",
  indicatorTaxa: ["worm"],
  forelUle: 18,
  measurements: {},
};

function obs(
  id: string,
  observerId: string | null,
  waterbodyId: string,
  survey: SurveyAnswers,
) {
  return { id, observerId, waterbodyId, survey, qualityWeight: 1 };
}

describe("computeTrust", () => {
  it("returns exactly neutral trust when there is no independent data", () => {
    const observations = [obs("a", "target", "w1", clean)];
    expect(computeTrust("target", observations)).toBe(TRUST_PARAMETERS.neutralTrust);
  });

  it("scores an observer who agrees with independent observers above neutral", () => {
    const observations = [
      obs("a", "target", "w1", clean),
      obs("b", "other-1", "w1", clean),
      obs("c", "other-2", "w1", clean),
    ];
    expect(computeTrust("target", observations)).toBeGreaterThan(
      TRUST_PARAMETERS.neutralTrust,
    );
  });

  it("scores an observer who contradicts independent observers below neutral", () => {
    const observations = [
      obs("a", "target", "w1", polluted),
      obs("b", "other-1", "w1", clean),
      obs("c", "other-2", "w1", clean),
    ];
    expect(computeTrust("target", observations)).toBeLessThan(
      TRUST_PARAMETERS.neutralTrust,
    );
  });

  it("gives no signal below the independence threshold", () => {
    const observations = [
      obs("a", "target", "w1", polluted),
      obs("b", "other-1", "w1", clean),
    ];
    expect(computeTrust("target", observations)).toBe(TRUST_PARAMETERS.neutralTrust);
  });
});

describe("trustMultiplier", () => {
  it("maps neutral trust to a multiplier of 1", () => {
    expect(trustMultiplier(0.5)).toBeCloseTo(1, 6);
  });

  it("clamps at the lower bound", () => {
    expect(trustMultiplier(0)).toBeCloseTo(TRUST_PARAMETERS.multiplierMin, 6);
  });

  it("clamps at the upper bound", () => {
    expect(trustMultiplier(1)).toBeCloseTo(TRUST_PARAMETERS.multiplierMax, 6);
  });
});
