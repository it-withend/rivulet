// Builds FHIR samples with the same code the API serves, so the validator checks
// what Rivulet really emits rather than hand-written copies.
// Run from the repository root: npx tsx validation/generate-samples.ts
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildBundle } from "../src/app/api/fhir/Observation/bundle";
import { buildRivuletCodeSystem } from "../src/lib/fhir/code-system";
import { buildWaterbodyResources } from "../src/lib/fhir/export";
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

const resources = buildWaterbodyResources({
  waterbody,
  rows: [
    { id: "obs-rich", observed_at: "2026-09-15T10:00:00Z", observer_id: "obs-a1", is_synthetic: false, survey: richSurvey },
    { id: "obs-plain", observed_at: "2026-09-16T08:30:00Z", observer_id: null, is_synthetic: false, survey: plainSurvey },
    { id: "obs-demo", observed_at: "2026-09-17T09:00:00Z", observer_id: "obs-a2", is_synthetic: true, survey: richSurvey },
  ],
  wfdClass: "moderate",
  methodVersion: "1.4.0",
  exportedAt: "2026-09-21T12:00:00Z",
});

writeFileSync(join(out, "Bundle-export.json"), JSON.stringify(buildBundle(resources, `https://rivulet-xi.vercel.app/api/fhir/Observation?waterbody=${waterbody.id}`), null, 2));
writeFileSync(join(out, "CodeSystem-rivulet-derived.json"), JSON.stringify(buildRivuletCodeSystem(), null, 2));
console.log(`Wrote ${resources.length} resources and the Rivulet CodeSystem to ${out}`);
