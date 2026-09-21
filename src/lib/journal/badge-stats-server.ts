import { unstable_cache } from "next/cache";
import { supabaseAnon } from "@/lib/db/client";
import { embeddedTrustScore, firstOrSelf } from "@/lib/db/embed";
import { selectAll } from "@/lib/db/select-all";
import { contributions, type ContributionRow } from "@/lib/engagement/contribution";
import { computeBadgeStats, type BadgeStatRow, type BadgeStats } from "./badge-stats";

const COUNTED = new Set(["auto_approved", "human_approved"]);

async function build(): Promise<BadgeStats> {
  const db = supabaseAnon();
  const { data, error } = await selectAll((from, to) =>
    db
      .from("observations")
      .select(
        "id, waterbody_id, observed_at, created_at, observer_id, survey, quality_weight, validation_status, is_synthetic, observers(trust_score, is_synthetic)",
      )
      .order("id")
      .range(from, to),
  );
  const rows = error ? [] : (data ?? []);

  const counted = rows.filter((o) => o.observer_id && COUNTED.has(o.validation_status));
  const stats: BadgeStatRow[] = counted.map((o) => ({
    observerId: o.observer_id as string,
    waterbodyId: o.waterbody_id,
    observedAt: o.observed_at,
    survey: o.survey,
    isSynthetic: Boolean(firstOrSelf<{ is_synthetic: boolean }>(o.observers)?.is_synthetic),
  }));

  const contributionRows: ContributionRow[] = rows.map((o) => ({
    observerId: o.observer_id,
    waterbodyId: o.waterbody_id,
    observedAt: o.observed_at,
    createdAt: o.created_at,
    qualityWeight: Number(o.quality_weight),
    observerTrust: embeddedTrustScore(o.observers) ?? null,
    validationStatus: o.validation_status,
    isSynthetic: Boolean(o.is_synthetic),
  }));
  const gapFillers = new Set(
    contributions(contributionRows)
      .filter((c) => c.gapsFilled > 0)
      .map((c) => c.observerId),
  );

  return computeBadgeStats(stats, gapFillers);
}

/** Recomputed at most every five minutes; the shares move slowly and the read is large. */
export const getBadgeStats = unstable_cache(build, ["badge-stats-v1"], { revalidate: 300 });
