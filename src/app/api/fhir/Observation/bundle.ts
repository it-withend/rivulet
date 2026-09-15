export type FhirResource = { resourceType: string; id: string };

export type FhirBundle = {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  entry: { resource: FhirResource }[];
};

export function buildBundle(resources: FhirResource[]): FhirBundle {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    entry: resources.map((resource) => ({ resource })),
  };
}
