import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/db/client";
import { computeSnapshot } from "@/lib/science/snapshot";
import {
  toLocationOah,
  toObservationIndicators,
  type FhirObservation,
} from "@/lib/fhir/observation";
import { buildBundle, type FhirResource } from "./bundle";

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
      "id, observed_at, observer_id, survey, indicators, quality_weight, is_synthetic",
    )
    .eq("waterbody_id", waterbodyId)
    .order("observed_at", { ascending: false });

  if (observationsError) {
    return NextResponse.json(
      { error: "database_unavailable" },
      { status: 503 },
    );
  }

  const observations = rows ?? [];
  const resources: FhirResource[] = [];

  const [lon, lat] = (waterbody.centroid as { coordinates: [number, number] })
    .coordinates;
  resources.push(
    toLocationOah({
      id: waterbody.id,
      name: waterbody.name,
      city: waterbody.city,
      centroidLon: lon,
      centroidLat: lat,
    }),
  );

  let anySynthetic = false;

  for (const row of observations) {
    if (row.is_synthetic) anySynthetic = true;

    for (const indicator of row.indicators as { code: string; value: number }[]) {
      resources.push(
        toObservationIndicators({
          id: `${row.id}-${indicator.code}`,
          waterbodyId: waterbody.id,
          effectiveDateTime: row.observed_at,
          performerDisplay: row.observer_id
            ? `Observer ${row.observer_id}`
            : "Anonymous citizen scientist",
          code: indicator.code,
          value: { kind: "quantity", value: indicator.value, unit: "1" },
          synthetic: row.is_synthetic,
        }) as FhirObservation,
      );
    }

    if (row.survey?.forelUle != null) {
      resources.push(
        toObservationIndicators({
          id: `${row.id}-fu`,
          waterbodyId: waterbody.id,
          effectiveDateTime: row.observed_at,
          performerDisplay: "Anonymous citizen scientist",
          code: "forel-ule-index",
          value: { kind: "quantity", value: row.survey.forelUle, unit: "FU" },
          synthetic: row.is_synthetic,
        }) as FhirObservation,
      );
    }
  }

  const snapshot = computeSnapshot(
    observations.map((o) => ({
      id: o.id,
      observedAt: o.observed_at,
      observerId: o.observer_id,
      survey: o.survey,
      qualityWeight: Number(o.quality_weight),
    })),
  );

  if (snapshot.assessment.klass) {
    resources.push(
      toObservationIndicators({
        id: `${waterbody.id}-wfd`,
        waterbodyId: waterbody.id,
        effectiveDateTime: new Date().toISOString(),
        performerDisplay: `Rivulet method ${snapshot.methodVersion}`,
        code: "wfd-ecological-status",
        value: {
          kind: "code",
          code: snapshot.assessment.klass,
          display: snapshot.assessment.klass,
        },
        synthetic: anySynthetic,
      }) as FhirObservation,
    );
  }

  return NextResponse.json(buildBundle(resources), {
    headers: { "content-type": "application/fhir+json" },
  });
}
