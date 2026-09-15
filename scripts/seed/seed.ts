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

async function main() {
  const db = supabaseAdmin();

  for (const wb of waterbodies as SeedWaterbody[]) {
    const line = `SRID=4326;LINESTRING(${wb.coordinates
      .map((c) => `${c[0]} ${c[1]}`)
      .join(",")})`;
    const mid = wb.coordinates[Math.floor(wb.coordinates.length / 2)];

    const { data, error } = await db
      .from("waterbodies")
      .insert({
        name: wb.name,
        city: wb.city,
        kind: wb.kind,
        geometry: line,
        centroid: `SRID=4326;POINT(${mid[0]} ${mid[1]})`,
      })
      .select("id")
      .single();

    if (error) {
      console.error(wb.name, error.message);
      continue;
    }

    if (wb.city !== "Coimbra") continue;

    const polluted = Math.random() > 0.6;
    const count = 3 + Math.floor(Math.random() * 8);

    for (let i = 0; i < count; i++) {
      const survey = randomSurvey(polluted);
      const ageHours = Math.random() * 24 * 45;
      await db.from("observations").insert({
        waterbody_id: data.id,
        observed_at: new Date(Date.now() - ageHours * 3600_000).toISOString(),
        location: `SRID=4326;POINT(${mid[0]} ${mid[1]})`,
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

  console.log("Seed complete");
}

main();
