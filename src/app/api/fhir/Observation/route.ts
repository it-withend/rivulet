import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/db/client";
import { computeSnapshot } from "@/lib/science/snapshot";
import { buildWaterbodyResources } from "@/lib/fhir/export";
import { buildBundle } from "./bundle";
import { embeddedTrustScore } from "@/lib/db/embed";
import { HELD_FOR_REVIEW_FILTER } from "@/lib/science/plausibility";

export async function GET(request: Request) {
  const waterbodyId = new URL(request.url).searchParams.get("waterbody");

  if (!waterbodyId) {
    return NextResponse.json(
      { error: "missing_waterbody_parameter" },
      { status: 400 },
    );
  }

  const db = supabaseAnon();

  const { data: waterbody, error: waterbodyError } = await db
    .from("waterbodies")
    .select("id, name, city, centroid")
    .eq("id", waterbodyId)
    .single();

  if (waterbodyError) {
    return NextResponse.json(
      { error: "database_unavailable" },
      { status: 503 },
    );
  }

  if (!waterbody) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Anonymous clients cannot read observations.location or gps_accuracy_m
  // (see the RLS migration) — never select them here.
  const { data: rows, error: observationsError } = await db
    .from("observations")
    .select(
      "id, observed_at, observer_id, survey, quality_weight, is_synthetic, observers(trust_score)",
    )
    .eq("waterbody_id", waterbodyId)
    // Flagged observations wait for human review before they leave Rivulet.
    .not("validation_status", "in", HELD_FOR_REVIEW_FILTER)
    .order("observed_at", { ascending: false });

  if (observationsError) {
    return NextResponse.json(
      { error: "database_unavailable" },
      { status: 503 },
    );
  }

  const observations = rows ?? [];

  const [lon, lat] = (waterbody.centroid as { coordinates: [number, number] })
    .coordinates;

  const snapshot = computeSnapshot(
    observations.map((o) => ({
      id: o.id,
      observedAt: o.observed_at,
      observerId: o.observer_id,
      survey: o.survey,
      qualityWeight: Number(o.quality_weight),
      observerTrust: embeddedTrustScore(o.observers),
    })),
  );

  const resources = buildWaterbodyResources({
    waterbody: {
      id: waterbody.id,
      name: waterbody.name,
      city: waterbody.city,
      centroidLon: lon,
      centroidLat: lat,
    },
    rows: observations,
    wfdClass: snapshot.assessment.klass,
    methodVersion: snapshot.methodVersion,
    exportedAt: new Date().toISOString(),
  });

  return NextResponse.json(buildBundle(resources, request.url), {
    headers: { "content-type": "application/fhir+json" },
  });
}
