import { NextResponse } from "next/server";
import { buildCapabilityStatement } from "@/lib/fhir/capability";

export function GET() {
  return NextResponse.json(buildCapabilityStatement(), {
    headers: { "content-type": "application/fhir+json", "cache-control": "public, max-age=3600" },
  });
}
