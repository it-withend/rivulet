// Demo data for the leaderboard: 60 synthetic observers, with every synthetic
// Coimbra observation assigned to one of them (skewed: a few very active,
// many occasional), and six of them made "unreliable" by inverting their
// survey evidence. Idempotent: aborts if synthetic observers already exist.
//
// Run once with `npx tsx --env-file=.env.local scripts/seed/seed-observers.ts`,
// then `npx tsx --env-file=.env.local scripts/recompute-trust.ts`.
import { supabaseAdmin } from "../../src/lib/db/client";
import { generatePseudonym } from "../../src/lib/identity/pseudonym";
import { toIndicators } from "../../src/lib/science/indicators";
import type { SurveyAnswers } from "../../src/types/observation";

const OBSERVER_COUNT = 60;
const UNRELIABLE_COUNT = 6;
const UPDATE_CONCURRENCY = 20;

type Database = ReturnType<typeof supabaseAdmin>;

// Mirrors the two survey templates scripts/seed/seed.ts uses for Coimbra's
// synthetic observations, so inversion (clean <-> polluted) is well-defined.
function templateSurvey(polluted: boolean): SurveyAnswers {
  return {
    odour: polluted ? "sewage" : "none",
    foam: polluted,
    litter: polluted ? 2 : 0,
    deadFish: false,
    visibleAlgae: polluted,
    clarity: polluted ? "turbid" : "clear",
    flow: polluted ? "low" : "normal",
    indicatorTaxa: polluted ? ["worm"] : ["mayfly", "caddisfly"],
    forelUle: polluted ? 15 : 4,
    measurements: {},
  };
}

function isPolluted(survey: SurveyAnswers): boolean {
  return survey.odour !== "none";
}

/** Weighted pick, biased toward the front of `weights` (a Zipf-like curve). */
function weightedIndex(weights: number[], random: () => number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

type Update = {
  id: string;
  observer_id: string;
  survey?: SurveyAnswers;
  indicators?: ReturnType<typeof toIndicators>;
};

async function applyUpdates(db: Database, updates: Update[], concurrency: number) {
  for (let start = 0; start < updates.length; start += concurrency) {
    const chunk = updates.slice(start, start + concurrency);
    const results = await Promise.all(
      chunk.map((u) =>
        db
          .from("observations")
          .update(
            u.survey
              ? { observer_id: u.observer_id, survey: u.survey, indicators: u.indicators }
              : { observer_id: u.observer_id },
          )
          .eq("id", u.id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    console.log(
      `observations: ${Math.min(start + concurrency, updates.length)} / ${updates.length}`,
    );
  }
}

async function main() {
  const db = supabaseAdmin();

  const { count: existingSynthetic, error: guardError } = await db
    .from("observers")
    .select("id", { count: "exact", head: true })
    .eq("is_synthetic", true);
  if (guardError) throw new Error(guardError.message);
  if (existingSynthetic && existingSynthetic > 0) {
    throw new Error(
      `${existingSynthetic} synthetic observers already exist; aborting (idempotent guard)`,
    );
  }

  const observerRows = Array.from({ length: OBSERVER_COUNT }, () => ({
    display_name: generatePseudonym(),
    is_synthetic: true,
  }));

  const { data: observers, error: insertError } = await db
    .from("observers")
    .insert(observerRows)
    .select("id");
  if (insertError || !observers) {
    throw new Error(insertError?.message ?? "observer insert failed");
  }

  const observerIds = observers.map((o) => o.id as string);

  // Skewed activity: a Zipf-like curve so a few observers are very active and
  // most are occasional, rather than an even split.
  const weights = observerIds.map((_, i) => 1 / Math.pow(i + 1, 1.3));

  const unreliableIds = new Set(
    Array.from({ length: UNRELIABLE_COUNT }, (_, i) =>
      observerIds[Math.floor((i * observerIds.length) / UNRELIABLE_COUNT)],
    ),
  );

  const { data: coimbraObservations, error: fetchError } = await db
    .from("observations")
    .select("id, survey, waterbodies!inner(city)")
    .eq("is_synthetic", true)
    .eq("waterbodies.city", "Coimbra");
  if (fetchError) throw new Error(fetchError.message);
  if (!coimbraObservations || coimbraObservations.length === 0) {
    throw new Error(
      "No synthetic Coimbra observations found to assign — run scripts/seed/seed.ts first",
    );
  }

  const updates: Update[] = coimbraObservations.map((o) => {
    const observerId = observerIds[weightedIndex(weights, Math.random)];
    if (!unreliableIds.has(observerId)) {
      return { id: o.id as string, observer_id: observerId };
    }

    const inverted = templateSurvey(!isPolluted(o.survey as SurveyAnswers));
    return {
      id: o.id as string,
      observer_id: observerId,
      survey: inverted,
      indicators: toIndicators(inverted),
    };
  });

  await applyUpdates(db, updates, UPDATE_CONCURRENCY);

  console.log(
    `Assigned ${updates.length} Coimbra observations across ${OBSERVER_COUNT} synthetic ` +
      `observers (${UNRELIABLE_COUNT} unreliable). Next: ` +
      `npx tsx --env-file=.env.local scripts/recompute-trust.ts`,
  );
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
