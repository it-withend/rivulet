import { NextResponse } from "next/server";
import { buildBundle } from "./bundle";
import { loadWaterbodyExport } from "@/lib/fhir/load";

/** The full export for one water body: Location, Observations, Provenance and any DetectedIssue. */
export async function GET(request: Request) {
  const waterbodyId = new URL(request.url).searchParams.get("waterbody");

  if (!waterbodyId) {
    return NextResponse.json({ error: "missing_waterbody_parameter" }, { status: 400 });
  }

  const result = await loadWaterbodyExport(waterbodyId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 503 });
  }

  return NextResponse.json(buildBundle(result.resources, request.url), {
    headers: { "content-type": "application/fhir+json" },
  });
}
