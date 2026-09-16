import { NextResponse } from "next/server";
import { observationSchema } from "@/lib/validation/observation-schema";
import { toIndicators } from "@/lib/science/indicators";
import { observationWeight } from "@/lib/science/weighting";
import { computeSnapshot, type StoredObservation } from "@/lib/science/snapshot";
import { assessmentDelta } from "@/lib/science/delta";
import {
  isHeldForReview,
  plausibilityStatus,
  PLAUSIBILITY,
  type FlagReason,
  type ValidationStatus,
} from "@/lib/science/plausibility";
import { photoCheck } from "@/lib/moderation/photo-check";
import { embeddedTrustScore } from "@/lib/db/embed";
import { observerFromRequest } from "@/lib/identity/token";
import { recomputeTrust } from "@/lib/trust/recompute";
import { supabaseAdmin } from "@/lib/db/client";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = observationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const db = supabaseAdmin();

  // A missing or invalid token never blocks submission — the observation is
  // stored anonymously either way.
  const observer = await observerFromRequest(db, request);

  const [{ data: waterbody }, { data: existing }, recentByObserver, distanceFromWaterbodyM] =
    await Promise.all([
      db.from("waterbodies").select("name").eq("id", payload.waterbodyId).maybeSingle(),
      db
        .from("observations")
        .select(
          "id, observed_at, observer_id, survey, quality_weight, validation_status, observers(trust_score)",
        )
        .eq("waterbody_id", payload.waterbodyId),
      observer
        ? db
            .from("observations")
            .select("id", { count: "exact", head: true })
            .eq("observer_id", observer.id)
            // Keyed on the server's `created_at`, never the client-supplied
            // `observed_at` — otherwise a fabricated timestamp lets a flood
            // of submissions dodge this hourly cap entirely.
            .gte("created_at", new Date(Date.now() - 3_600_000).toISOString())
            .then(({ count }) => count ?? 0)
        : Promise.resolve(0),
      // Distance from the submitted point to the claimed water body's own
      // geometry. Never blocks submission — only ever raises validation_status
      // to "flagged" below. A failed RPC call falls through to null and the
      // existing plausibility logic decides the status alone.
      (async (): Promise<number | null> => {
        try {
          const { data, error } = await db.rpc("waterbody_distance_m", {
            p_waterbody: payload.waterbodyId,
            p_lon: payload.longitude,
            p_lat: payload.latitude,
          });
          if (error) {
            console.error("waterbody_distance_m failed:", error);
            return null;
          }
          return typeof data === "number" ? data : null;
        } catch (rpcError) {
          console.error("waterbody_distance_m threw:", rpcError);
          return null;
        }
      })(),
    ]);

  if (!waterbody) {
    return NextResponse.json({ error: "unknown_waterbody" }, { status: 404 });
  }

  const ageHours =
    (Date.now() - new Date(payload.observedAt).getTime()) / 3_600_000;

  const weight = observationWeight({
    hasPhoto: payload.forelUleIndex !== null,
    forelUleConfidence: payload.forelUleConfidence,
    gpsAccuracyMetres: payload.gpsAccuracyM,
    measurementCount: Object.keys(payload.survey.measurements).length,
    ageHours: Math.max(0, ageHours),
  });

  // Every plausibility signal is checked independently and all that apply
  // are kept — an earlier version stopped at the first match, which meant a
  // report already flagged for distance never got its photo looked at, so
  // the photo check could look "broken" (it simply never ran). None of
  // these ever reject a submission, only route it to /moderate.
  const reasons: FlagReason[] = [];

  const gpsCheck = plausibilityStatus({
    gpsAccuracyM: payload.gpsAccuracyM,
    recentByObserver,
  });
  if (gpsCheck.reason) reasons.push(gpsCheck.reason);

  if (
    distanceFromWaterbodyM !== null &&
    distanceFromWaterbodyM > PLAUSIBILITY.maxDistanceFromWaterbodyM
  ) {
    reasons.push("distance_from_waterbody");
  }

  // Skipped entirely (never flags) when GROQ_API_KEY is unset, the call
  // errors, times out, or the answer is uncertain — see photoCheck's own
  // doc comment. Runs even when another check already flagged the report,
  // so a moderator sees every reason at once.
  if (payload.photoThumbnail) {
    const result = await photoCheck(payload.photoThumbnail);
    if (result && !result.isWater && result.confidence !== "low") {
      reasons.push("ai_not_water");
    }
  }

  const validationStatus: ValidationStatus = reasons.length > 0 ? "flagged" : "auto_approved";
  const flagReason = reasons.length > 0 ? reasons.join(",") : null;

  const { data, error } = await db
    .from("observations")
    .insert({
      waterbody_id: payload.waterbodyId,
      observer_id: observer?.id ?? null,
      observed_at: payload.observedAt,
      location: `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`,
      gps_accuracy_m: payload.gpsAccuracyM,
      forel_ule_index: payload.forelUleIndex,
      forel_ule_confidence: payload.forelUleConfidence,
      survey: payload.survey,
      indicators: toIndicators(payload.survey),
      quality_weight: weight,
      validation_status: validationStatus,
      flag_reason: flagReason,
      // photoThumbnail is used above, transiently, and is never persisted.
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // Recompute trust for every observer who has observed this water body.
  // Never fails the request: the observation is already saved.
  try {
    const observerIds = [
      ...(existing ?? []).map((o) => o.observer_id),
      observer?.id ?? null,
    ];
    await recomputeTrust(db, observerIds);
  } catch (recomputeError) {
    console.error("trust recompute failed:", recomputeError);
  }

  // The delta shown to the resident must match what the map and water body
  // page will show: same trust weighting, same review hold.
  // Trust was just recomputed above, so read it fresh rather than from the
  // embed fetched before this observation existed.
  const trustIds = [
    ...new Set(
      [observer?.id, ...(existing ?? []).map((o) => o.observer_id)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
  const { data: freshTrust } =
    trustIds.length > 0
      ? await db.from("observers").select("id, trust_score").in("id", trustIds)
      : { data: null };
  const trustById = new Map(
    (freshTrust ?? []).map((r) => [r.id as string, Number(r.trust_score)]),
  );

  const prior: StoredObservation[] = (existing ?? [])
    .filter((o) => !isHeldForReview(o.validation_status))
    .map((o) => ({
      id: o.id,
      observedAt: o.observed_at,
      observerId: o.observer_id,
      survey: o.survey,
      qualityWeight: Number(o.quality_weight),
      observerTrust:
        (o.observer_id && trustById.get(o.observer_id)) ??
        embeddedTrustScore(o.observers),
    }));

  const heldForReview = isHeldForReview(validationStatus);

  const current: StoredObservation = {
    id: data.id,
    observedAt: payload.observedAt,
    observerId: observer?.id ?? null,
    survey: payload.survey,
    qualityWeight: weight,
    observerTrust: observer ? trustById.get(observer.id) : undefined,
  };

  return NextResponse.json(
    {
      id: data.id,
      qualityWeight: weight,
      waterbodyName: waterbody.name,
      observer: observer ? { id: observer.id, displayName: observer.displayName } : null,
      heldForReview,
      delta: assessmentDelta(
        computeSnapshot(prior),
        computeSnapshot(heldForReview ? prior : [...prior, current]),
      ),
    },
    { status: 201 },
  );
}
