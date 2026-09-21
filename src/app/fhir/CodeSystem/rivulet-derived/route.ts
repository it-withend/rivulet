import { NextResponse } from "next/server";
import { buildRivuletCodeSystem } from "@/lib/fhir/code-system";

/** The CodeSystem for `RIVULET_SYSTEM`, served at its own canonical URL. */
export function GET() {
  return NextResponse.json(buildRivuletCodeSystem(), {
    headers: { "content-type": "application/fhir+json" },
  });
}
