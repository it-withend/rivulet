import { RIVULET_CODES, RIVULET_SYSTEM } from "./codes";

/**
 * The CodeSystem behind `RIVULET_SYSTEM`: the concepts Rivulet derives from
 * resident observations where the OneAquaHealth IG code system has no code.
 * Served at its canonical URL and loaded by the FHIR validation job.
 */
export function buildRivuletCodeSystem() {
  return {
    resourceType: "CodeSystem" as const,
    id: "rivulet-derived",
    url: RIVULET_SYSTEM,
    name: "RivuletDerived",
    title: "Rivulet derived concepts",
    status: "draft" as const,
    experimental: true,
    content: "complete" as const,
    caseSensitive: true,
    description:
      "Concepts Rivulet derives from resident observations that the OneAquaHealth IG code system has no code for. Not endorsed by the OneAquaHealth consortium.",
    concept: Object.entries(RIVULET_CODES).map(([code, definition]) => ({
      code,
      display: code,
      definition,
    })),
  };
}
