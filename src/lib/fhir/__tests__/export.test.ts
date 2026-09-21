import { describe, expect, it } from "vitest";
import { buildWaterbodyResources } from "../export";
import { readOneHealth } from "@/lib/science/one-health";
import type { SurveyAnswers } from "@/types/observation";

const survey: SurveyAnswers = {
  odour: "sewage",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: ["none_seen"],
  forelUle: 9,
  measurements: { ph: 7.4, temperature: 17.5 },
};

const waterbody = { id: "wb-1", name: "Stream", city: "Coimbra", centroidLon: -8.4, centroidLat: 40.2 };
const rows = [
  { id: "r1", observed_at: "2026-09-20T09:00:00Z", observer_id: "o1", is_synthetic: false, survey },
  { id: "r2", observed_at: "2026-09-20T10:00:00Z", observer_id: "o2", is_synthetic: false, survey },
];
const exportedAt = "2026-09-21T12:00:00Z";

describe("buildWaterbodyResources", () => {
  const stored = rows.map((r) => ({
    id: r.id,
    observedAt: r.observed_at,
    observerId: r.observer_id,
    survey: r.survey,
    qualityWeight: 1,
    observerTrust: 0.6,
  }));
  const oneHealth = readOneHealth(stored, [{ kind: "playground", siteCount: 1, nearestM: 50, nearestName: null }], new Date(exportedAt));
  const resources = buildWaterbodyResources({ waterbody, rows, wfdClass: "poor", oneHealth, methodVersion: "1.4.0", exportedAt });

  it("codes measured values with their UCUM unit", () => {
    const ph = resources.find((r) => r.resourceType === "Observation" && r.id === "r1-pH");
    expect(ph && "valueQuantity" in ph && ph.valueQuantity).toMatchObject({ code: "[pH]", system: "http://unitsofmeasure.org" });
    const temp = resources.find((r) => r.id === "r1-waterTemperature");
    expect(temp && "valueQuantity" in temp && temp.valueQuantity?.code).toBe("Cel");
  });

  it("writes one Provenance per report, naming who reported and what assembled it", () => {
    const provenance = resources.filter((r) => r.resourceType === "Provenance");
    expect(provenance).toHaveLength(2);
    const first = provenance[0];
    expect("agent" in first && first.agent.map((a) => a.type.coding[0].code)).toEqual(["author", "assembler"]);
    expect("target" in first && first.target.length).toBeGreaterThan(1);
  });

  it("raises a DetectedIssue for a warning near a place people use, evidenced by the reports", () => {
    const issue = resources.find((r) => r.resourceType === "DetectedIssue");
    expect(issue && "severity" in issue && issue.severity).not.toBe("low");
    expect(issue && "evidence" in issue && issue.evidence[0].detail.length).toBeGreaterThan(0);
  });

  it("raises no DetectedIssue when there is no exposure data", () => {
    const without = buildWaterbodyResources({ waterbody, rows, wfdClass: null, oneHealth: null, methodVersion: "1.4.0", exportedAt });
    expect(without.some((r) => r.resourceType === "DetectedIssue")).toBe(false);
  });
});
