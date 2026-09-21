export type FhirResource = { resourceType: string; id: string };

/** Identity base for `Bundle.entry.fullUrl`; it names resources, it is not a server to call. */
export const FHIR_BASE = "https://rivulet-xi.vercel.app/fhir";

export type FhirBundle = {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  link?: { relation: "self"; url: string }[];
  entry: { fullUrl: string; resource: FhirResource; search: { mode: "match" | "include" } }[];
};

/** `selfUrl` is the request that produced the bundle, as a searchset should declare. */
export function buildBundle(resources: FhirResource[], selfUrl?: string): FhirBundle {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    ...(selfUrl ? { link: [{ relation: "self" as const, url: selfUrl }] } : {}),
    // Outside transactions every entry needs a fullUrl, and it is what lets a
    // relative `Location/<id>` reference resolve inside the bundle.
    entry: resources.map((resource) => ({
      fullUrl: `${FHIR_BASE}/${resource.resourceType}/${resource.id}`,
      resource,
      // The search is for Observations; the Location they point at rides along as an include.
      search: { mode: resource.resourceType === "Observation" ? ("match" as const) : ("include" as const) },
    })),
  };
}
