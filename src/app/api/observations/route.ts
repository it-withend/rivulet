import { NextResponse } from "next/server";
import { observationSchema } from "@/lib/validation/observation-schema";
import { toIndicators } from "@/lib/science/indicators";
import { observationWeight } from "@/lib/science/weighting";
import { computeSnapshot, type StoredObservation } from "@/lib/science/snapshot";
import { assessmentDelta } from "@/lib/science/delta";
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

  const [{ data: waterbody }, { data: existing }] = await Promise.all([
    db.from("waterbodies").select("name").eq("id", payload.waterbodyId).maybeSingle(),
    db
      .from("observations")
      .select("id, observed_at, observer_id, survey, quality_weight")
      .eq("waterbody_id", payload.waterbodyId),
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

  const { data, error } = await db
    .from("observations")
    .insert({
      waterbody_id: payload.waterbodyId,
      observed_at: payload.observedAt,
      location: `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`,
      gps_accuracy_m: payload.gpsAccuracyM,
      forel_ule_index: payload.forelUleIndex,
      forel_ule_confidence: payload.forelUleConfidence,
      survey: payload.survey,
      indicators: toIndicators(payload.survey),
      quality_weight: weight,
      validation_status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const prior: StoredObservation[] = (existing ?? []).map((o) => ({
    id: o.id,
    observedAt: o.observed_at,
    observerId: o.observer_id,
    survey: o.survey,
    qualityWeight: Number(o.quality_weight),
  }));

  const current: StoredObservation = {
    id: data.id,
    observedAt: payload.observedAt,
    observerId: null,
    survey: payload.survey,
    qualityWeight: weight,
  };

  return NextResponse.json(
    {
      id: data.id,
      qualityWeight: weight,
      waterbodyName: waterbody.name,
      delta: assessmentDelta(
        computeSnapshot(prior),
        computeSnapshot([...prior, current]),
      ),
    },
    { status: 201 },
  );
}
