import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTrust, type TrustObservation } from "@/lib/science/trust";
import { selectAll } from "@/lib/db/select-all";
import { HELD_FOR_REVIEW_FILTER } from "@/lib/science/plausibility";

/**
 * Recomputes `observers.trust_score` for the given observer ids. Loads their
 * observations plus every observation on the water bodies those touched (the
 * independent evidence trust needs), then updates each observer in turn.
 * Never throws — a failed recompute should never fail the caller's request.
 */
export async function recomputeTrust(
  db: SupabaseClient,
  observerIds: (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(observerIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;

  const { data: ownRows, error: ownError } = await db
    .from("observations")
    .select("waterbody_id")
    .in("observer_id", ids);

  if (ownError || !ownRows || ownRows.length === 0) return;

  const waterbodyIds = [...new Set(ownRows.map((r) => r.waterbody_id as string))];

  const { data: rows, error: rowsError } = await selectAll((from, to) =>
    db
      .from("observations")
      .select("id, observer_id, waterbody_id, survey, quality_weight")
      .in("waterbody_id", waterbodyIds)
      .not("validation_status", "in", HELD_FOR_REVIEW_FILTER)
      .order("id")
      .range(from, to),
  );

  if (rowsError || !rows) return;

  const observations: TrustObservation[] = rows.map((r) => ({
    id: r.id as string,
    observerId: r.observer_id as string | null,
    waterbodyId: r.waterbody_id as string,
    survey: r.survey,
    qualityWeight: Number(r.quality_weight),
  }));

  for (const observerId of ids) {
    const trust = computeTrust(observerId, observations);
    const { error } = await db
      .from("observers")
      .update({ trust_score: trust })
      .eq("id", observerId);
    if (error) {
      console.error(`trust recompute: failed to update ${observerId}: ${error.message}`);
    }
  }
}
