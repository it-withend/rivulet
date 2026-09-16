import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { selectAll } from "@/lib/db/select-all";
import { isAuthorisedModerator } from "@/lib/moderation/auth";
import { FLAG_REASON_LABEL, type FlagReason } from "@/lib/science/plausibility";
import { firstOrSelf } from "@/lib/db/embed";

/** The review queue: every observation still waiting for a person to look at it. */
export async function GET(request: Request) {
  if (!isAuthorisedModerator(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await selectAll((from, to) =>
    db
      .from("observations")
      .select(
        "id, waterbody_id, observed_at, created_at, gps_accuracy_m, survey, forel_ule_index, forel_ule_confidence, quality_weight, flag_reason, is_synthetic, observer_id, observers(display_name, trust_score), waterbodies(name, city)",
      )
      .eq("validation_status", "flagged")
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  if (error) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    items: data.map((o) => {
      const waterbody = firstOrSelf<{ name: string; city: string }>(o.waterbodies);
      const obs = firstOrSelf<{ display_name: string; trust_score: number | string | null }>(
        o.observers,
      );
      const reasons = (o.flag_reason ?? "").split(",").filter(Boolean) as FlagReason[];
      return {
        id: o.id,
        waterbodyId: o.waterbody_id,
        waterbodyName: waterbody?.name ?? "Unknown water body",
        city: waterbody?.city ?? null,
        observedAt: o.observed_at,
        createdAt: o.created_at,
        gpsAccuracyM: o.gps_accuracy_m,
        survey: o.survey,
        forelUleIndex: o.forel_ule_index,
        forelUleConfidence:
          o.forel_ule_confidence === null ? null : Number(o.forel_ule_confidence),
        qualityWeight: Number(o.quality_weight),
        flagReason: o.flag_reason,
        reasonLabel:
          reasons.length > 0
            ? reasons.map((r) => FLAG_REASON_LABEL[r] ?? r).join("; ")
            : null,
        isSynthetic: Boolean(o.is_synthetic),
        observerId: o.observer_id,
        observerName: obs?.display_name ?? null,
        observerTrust: obs?.trust_score != null ? Number(obs.trust_score) : null,
      };
    }),
  });
}
