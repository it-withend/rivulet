import { FHIR_BASE } from "./bundle";
import { OAH_PROFILE_INDICATORS, OAH_PROFILE_LOCATION, RIVULET_SYSTEM } from "./codes";

/**
 * What Rivulet's read-only FHIR endpoint supports, stated exactly: reads and
 * searches over the data the export already builds, nothing that writes.
 */
export function buildCapabilityStatement() {
  const search = (name: string, type: "reference" | "string" | "number", documentation: string) => ({
    name,
    type,
    documentation,
  });

  return {
    resourceType: "CapabilityStatement" as const,
    id: "rivulet-capability",
    url: `${FHIR_BASE}/metadata`,
    version: "1.0.0",
    name: "RivuletReadOnlyFhirEndpoint",
    title: "Rivulet read-only FHIR endpoint",
    status: "draft" as const,
    experimental: true,
    date: "2026-09-21",
    publisher: "Rivulet (independent prototype)",
    description:
      "Read-only FHIR R4 access to Rivulet's citizen stream observations, mapped to the OneAquaHealth Implementation Guide profiles. Not endorsed by the OneAquaHealth consortium. Observations held for human review are never served; demonstration data is tagged HTEST.",
    kind: "instance" as const,
    software: { name: "Rivulet", version: "0.1.0" },
    implementation: { description: "Rivulet on Vercel", url: FHIR_BASE },
    fhirVersion: "4.0.1" as const,
    format: ["json", "application/fhir+json"],
    rest: [
      {
        mode: "server" as const,
        documentation: `Codes Rivulet adds beyond the OneAquaHealth code system are defined at ${RIVULET_SYSTEM}.`,
        resource: [
          {
            type: "Location",
            profile: OAH_PROFILE_LOCATION,
            interaction: [{ code: "read" as const }, { code: "search-type" as const }],
            searchParam: [
              search("city", "string", "Water bodies in a city, e.g. Coimbra (required)"),
              search("_count", "number", "Page size, default 50, at most 200"),
              search("_offset", "number", "Zero-based offset into the result"),
            ],
          },
          {
            type: "Observation",
            profile: OAH_PROFILE_INDICATORS,
            interaction: [{ code: "search-type" as const }],
            searchParam: [search("subject", "reference", "Location/<id> of the water body (required)")],
          },
          {
            type: "DetectedIssue",
            interaction: [{ code: "search-type" as const }],
            searchParam: [search("implicated", "reference", "Location/<id> of the water body (required)")],
          },
        ],
      },
    ],
  };
}
