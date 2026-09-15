import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../../src/lib/db/client";
import { toIndicators } from "../../src/lib/science/indicators";
import { observationWeight } from "../../src/lib/science/weighting";
import type { SurveyAnswers } from "../../src/types/observation";
import waterbodies from "./waterbodies.json";

type SeedWaterbody = {
  name: string;
  city: string;
  kind: "river" | "stream";
  coordinates: [number, number][];
};

type Database = ReturnType<typeof supabaseAdmin>;

// Row-by-row inserts against the remote project took hours; batches take seconds.
const WATERBODY_BATCH = 250;
const OBSERVATION_BATCH = 500;
const UNOBSERVED_SHARE = 0.3;

function randomSurvey(polluted: boolean): SurveyAnswers {
  return {
    odour: polluted ? "sewage" : "none",
    foam: polluted && Math.random() > 0.5,
    litter: polluted ? 2 : 0,
    deadFish: polluted && Math.random() > 0.8,
    visibleAlgae: polluted && Math.random() > 0.4,
    clarity: polluted ? "turbid" : "clear",
    flow: polluted ? "low" : "normal",
    indicatorTaxa: polluted ? ["worm"] : ["mayfly", "caddisfly"],
    forelUle: polluted ? 15 : 4,
    measurements: {},
  };
}

async function insertInBatches(
  db: Database,
  table: "waterbodies" | "observations",
  rows: Record<string, unknown>[],
  size: number,
) {
  for (let start = 0; start < rows.length; start += size) {
    const { error } = await db.from(table).insert(rows.slice(start, start + size));
    if (error) {
      throw new Error(`${table} rows ${start}-${start + size}: ${error.message}`);
    }
    console.log(`${table}: ${Math.min(start + size, rows.length)} / ${rows.length}`);
  }
}

async function main() {
  const waterbodyRows: Record<string, unknown>[] = [];
  const observationRows: Record<string, unknown>[] = [];

  for (const wb of waterbodies as SeedWaterbody[]) {
    const id = randomUUID();
    const mid = wb.coordinates[Math.floor(wb.coordinates.length / 2)];
    const point = `SRID=4326;POINT(${mid[0]} ${mid[1]})`;

    waterbodyRows.push({
      id,
      name: wb.name,
      city: wb.city,
      kind: wb.kind,
      geometry: `SRID=4326;LINESTRING(${wb.coordinates
        .map((c) => `${c[0]} ${c[1]}`)
        .join(",")})`,
      centroid: point,
    });

    // Some streams stay unobserved so the map shows honest insufficient-data states.
    if (wb.city !== "Coimbra" || Math.random() < UNOBSERVED_SHARE) continue;

    const polluted = Math.random() > 0.6;
    const count = 3 + Math.floor(Math.random() * 8);

    for (let i = 0; i < count; i++) {
      const survey = randomSurvey(polluted);
      const ageHours = Math.random() * 24 * 45;
      observationRows.push({
        waterbody_id: id,
        observed_at: new Date(Date.now() - ageHours * 3600_000).toISOString(),
        location: point,
        gps_accuracy_m: 10,
        forel_ule_index: survey.forelUle,
        forel_ule_confidence: 0.85,
        survey,
        indicators: toIndicators(survey),
        quality_weight: observationWeight({
          hasPhoto: true,
          forelUleConfidence: 0.85,
          gpsAccuracyMetres: 10,
          measurementCount: 0,
          ageHours,
        }),
        validation_status: "auto_approved",
        is_synthetic: true,
      });
    }
  }

  const db = supabaseAdmin();
  await insertInBatches(db, "waterbodies", waterbodyRows, WATERBODY_BATCH);
  await insertInBatches(db, "observations", observationRows, OBSERVATION_BATCH);
  console.log("Seed complete");
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
