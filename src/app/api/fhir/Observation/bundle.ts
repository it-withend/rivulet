export type FhirResource = { resourceType: string; id: string };

/** Identity base for `Bundle.entry.fullUrl`; it names resources, it is not a server to call. */
export const FHIR_BASE = "https://rivulet-xi.vercel.app/fhir";

export type FhirBundle = {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  entry: { fullUrl: string; resource: FhirResource }[];
};

export function buildBundle(resources: FhirResource[]): FhirBundle {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    // Outside transactions every entry needs a fullUrl, and it is what lets a
    // relative `Location/<id>` reference resolve inside the bundle.
    entry: resources.map((resource) => ({
      fullUrl: `${FHIR_BASE}/${resource.resourceType}/${resource.id}`,
      resource,
    })),
  };
}
