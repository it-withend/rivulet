import { NextResponse } from "next/server";
import { RIVULET_CODES, RIVULET_SYSTEM } from "@/lib/fhir/codes";

/**
 * The CodeSystem behind `RIVULET_SYSTEM`, served at its own canonical URL so a
 * FHIR consumer can resolve the codes Rivulet adds where the OneAquaHealth IG
 * has none (water colour, resident-reported signs, the classified outcome).
 */
export function GET() {
  return NextResponse.json(
    {
      resourceType: "CodeSystem",
      url: RIVULET_SYSTEM,
      name: "RivuletDerived",
      title: "Rivulet derived concepts",
      status: "draft",
      experimental: true,
      content: "complete",
      caseSensitive: true,
      description:
        "Concepts Rivulet derives from resident observations that the OneAquaHealth IG code system has no code for. Not endorsed by the OneAquaHealth consortium.",
      concept: Object.entries(RIVULET_CODES).map(([code, definition]) => ({
        code,
        display: code,
        definition,
      })),
    },
    { headers: { "content-type": "application/fhir+json" } },
  );
}
