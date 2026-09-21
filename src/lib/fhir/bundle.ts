export type FhirResource = { resourceType: string; id: string };

/** Identity base for `Bundle.entry.fullUrl`, and the root of Rivulet's read-only FHIR endpoint. */
export const FHIR_BASE = "https://rivulet-xi.vercel.app/fhir";

export type FhirBundle = {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  link?: { relation: "self"; url: string }[];
  entry: { fullUrl: string; resource: FhirResource; search: { mode: "match" | "include" } }[];
};

/**
 * A searchset. `selfUrl` is the request that produced it. Resources of
 * `matchType` are the matches; anything else (the Location an Observation
 * points at, say) rides along as an include.
 */
export function buildBundle(resources: FhirResource[], selfUrl?: string, matchType = "Observation"): FhirBundle {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.filter((r) => r.resourceType === matchType).length,
    ...(selfUrl ? { link: [{ relation: "self" as const, url: selfUrl }] } : {}),
    // Outside transactions every entry needs a fullUrl, and it is what lets a
    // relative `Location/<id>` reference resolve inside the bundle.
    entry: resources.map((resource) => ({
      fullUrl: `${FHIR_BASE}/${resource.resourceType}/${resource.id}`,
      resource,
      search: { mode: resource.resourceType === matchType ? ("match" as const) : ("include" as const) },
    })),
  };
}
