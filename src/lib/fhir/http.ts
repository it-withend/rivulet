import { NextResponse } from "next/server";

const FHIR_JSON = { "content-type": "application/fhir+json" };

export function fhirJson(body: unknown, init: { status?: number; cache?: string } = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: init.cache ? { ...FHIR_JSON, "cache-control": init.cache } : FHIR_JSON,
  });
}

/** An OperationOutcome, the FHIR-shaped way to say what went wrong. */
export function fhirError(status: number, code: "not-found" | "required" | "invalid" | "transient", message: string) {
  return fhirJson(
    {
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code, diagnostics: message }],
    },
    { status },
  );
}

/** "Location/abc" or "abc" gives "abc"; anything that is not an id gives null. */
export function referenceId(value: string | null, type: string): string | null {
  if (!value) return null;
  const prefix = `${type}/`;
  const id = value.startsWith(prefix) ? value.slice(prefix.length) : value;
  return /^[0-9a-fA-F-]{8,64}$/.test(id) ? id : null;
}
