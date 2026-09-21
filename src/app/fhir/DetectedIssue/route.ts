import { buildBundle } from "@/lib/fhir/bundle";
import { loadWaterbodyExport } from "@/lib/fhir/load";
import { fhirError, fhirJson, referenceId } from "@/lib/fhir/http";

/** DetectedIssue?implicated=Location/<id>: the One Health warning for a water body, when there is one. */
export async function GET(request: Request) {
  const id = referenceId(new URL(request.url).searchParams.get("implicated"), "Location");
  if (!id) return fhirError(400, "required", "The implicated search parameter is required, as Location/<id>");

  const result = await loadWaterbodyExport(id);
  if (!result.ok) {
    return result.error === "not_found"
      ? fhirError(404, "not-found", "No such Location")
      : fhirError(503, "transient", "The database is unavailable");
  }

  const resources = result.resources.filter((r) => r.resourceType === "DetectedIssue" || r.resourceType === "Location");
  return fhirJson(buildBundle(resources, request.url, "DetectedIssue"));
}
