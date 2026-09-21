// Builds FHIR samples with the same code the API serves, so the validator checks
// what Rivulet really emits rather than hand-written copies.
// Run from the repository root: npx tsx validation/generate-samples.ts
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildBundle } from "../src/lib/fhir/bundle";
import { buildCapabilityStatement } from "../src/lib/fhir/capability";
import { buildRivuletCodeSystem } from "../src/lib/fhir/code-system";
import { buildWaterbodyResources } from "../src/lib/fhir/export";
import { readOneHealth, type ExposureSite } from "../src/lib/science/one-health";
import type { SurveyAnswers } from "../src/types/observation";

const out = join(__dirname, "samples", "generated");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const waterbody = {
  id: "d3b0c6a4-5f0e-4c2e-9d55-2f6c1a7b0001",
  name: "Ribeira de Coselhas",
  city: "Coimbra",
  centroidLon: -8.42,
  centroidLat: 40.22,
};

// A report that exercises every indicator the mapping can emit.
const richSurvey: SurveyAnswers = {
  odour: "sewage",
  foam: true,
  litter: 2,
  deadFish: true,
  visibleAlgae: true,
  clarity: "turbid",
  flow: "low",
  indicatorTaxa: ["mayfly", "freshwater_shrimp"],
  forelUle: 12,
  measurements: { ph: 7.4, dissolvedOxygen: 6.2, temperature: 17.5, nitrate: 4.1 },
};

// A minimal report: only what a resident with no test kit sends.
const plainSurvey: SurveyAnswers = {
  odour: "none",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: ["none_seen"],
  forelUle: null,
  measurements: {},
};

const rows = [
  { id: "obs-rich", observed_at: "2026-09-15T10:00:00Z", observer_id: "obs-a1", is_synthetic: false, survey: richSurvey },
  { id: "obs-plain", observed_at: "2026-09-16T08:30:00Z", observer_id: null, is_synthetic: false, survey: plainSurvey },
  { id: "obs-demo", observed_at: "2026-09-17T09:00:00Z", observer_id: "obs-a2", is_synthetic: true, survey: richSurvey },
];

// The One Health reading the API would compute: recent warning signs near a playground.
const exposure: ExposureSite[] = [{ kind: "playground", siteCount: 1, nearestM: 80, nearestName: "Parque Verde" }];
const exportedAt = "2026-09-21T12:00:00Z";
const oneHealth = readOneHealth(
  rows.map((r) => ({
    id: r.id,
    observedAt: r.observed_at,
    observerId: r.observer_id,
    survey: r.survey,
    qualityWeight: 1,
    observerTrust: 0.6,
  })),
  exposure,
  new Date(exportedAt),
);

const resources = buildWaterbodyResources({
  waterbody,
  rows,
  wfdClass: "moderate",
  oneHealth,
  methodVersion: "1.5.0",
  exportedAt,
});
const self = `https://rivulet-xi.vercel.app/api/fhir/Observation?waterbody=${waterbody.id}`;
const write = (name: string, body: unknown) => writeFileSync(join(out, name), JSON.stringify(body, null, 2));

write("Bundle-export.json", buildBundle(resources, self));
// The shapes the read-only /fhir endpoint serves.
write(
  "Bundle-location-search.json",
  buildBundle(resources.filter((r) => r.resourceType === "Location"), "https://rivulet-xi.vercel.app/fhir/Location?city=Coimbra", "Location"),
);
write(
  "Bundle-detectedissue-search.json",
  buildBundle(
    resources.filter((r) => r.resourceType === "DetectedIssue" || r.resourceType === "Location"),
    `https://rivulet-xi.vercel.app/fhir/DetectedIssue?implicated=Location/${waterbody.id}`,
    "DetectedIssue",
  ),
);
write("CapabilityStatement-metadata.json", buildCapabilityStatement());
write("CodeSystem-rivulet-derived.json", buildRivuletCodeSystem());
console.log(`Wrote ${resources.length} resources (${oneHealth.overall} One Health concern) and supporting samples to ${out}`);
