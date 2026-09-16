import { describe, it, expect } from "vitest";
import { readOneHealth, type ExposureSite } from "../one-health";
import type { StoredObservation } from "../snapshot";
import type { SurveyAnswers } from "@/types/observation";

const clean: SurveyAnswers = {
  odour: "none",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: [],
  forelUle: null,
  measurements: {},
};

const now = new Date("2026-09-16T12:00:00Z");

function report(observerId: string, survey: Partial<SurveyAnswers>, ageDays = 1): StoredObservation {
  return {
    id: `${observerId}-${ageDays}`,
    observerId,
    observedAt: new Date(now.getTime() - ageDays * 86_400_000).toISOString(),
    survey: { ...clean, ...survey },
    qualityWeight: 1,
  };
}

const playground: ExposureSite = { kind: "playground", siteCount: 1, nearestM: 60, nearestName: null };

describe("readOneHealth", () => {
  it("reports unknown, never safe, when there are no recent reports", () => {
    const reading = readOneHealth([report("a", { odour: "sewage" }, 90)], [playground], now);
    expect(reading.overall).toBe("unknown");
  });

  it("raises concern for people when a hazard meets exposure nearby", () => {
    const reports = [report("a", { odour: "sewage" }), report("b", { odour: "sewage" })];
    const people = (sites: ExposureSite[]) =>
      readOneHealth(reports, sites, now).audiences.find((a) => a.audience === "people")!;
    expect(people([playground]).concern).toBe("avoid");
    expect(people([]).concern).toBe("care");
  });

  it("needs more than one observer before a hazard is likely", () => {
    const reading = readOneHealth(
      [report("a", { deadFish: true }, 1), report("a", { deadFish: true }, 2)],
      [],
      now,
    );
    expect(reading.hazards.find((h) => h.code === "dead_fish")!.level).toBe("possible");
  });
});
