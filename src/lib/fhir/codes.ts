export const OAH_SYSTEM =
  "http://hl7.eu/fhir/ig/oah/CodeSystem/temporarySystem-oah-eu";

// A canonical on a host we control, served by src/app/fhir/CodeSystem/rivulet-derived.
export const RIVULET_SYSTEM =
  "https://rivulet-xi.vercel.app/fhir/CodeSystem/rivulet-derived";

// Identifier namespace for water bodies (Location.identifier is required by LocationOah).
export const RIVULET_WATERBODY_ID_SYSTEM =
  "https://rivulet-xi.vercel.app/fhir/waterbody-id";

// A profile's canonical ends in the StructureDefinition *Id* from the IG source
// (input/fsh/profiles), not its Name — `observation-indicators-oah`, not `ObservationIndicatorsOah`.
export const OAH_PROFILE_INDICATORS =
  "http://hl7.eu/fhir/ig/oah/StructureDefinition/observation-indicators-oah";

export const OAH_PROFILE_LOCATION =
  "http://hl7.eu/fhir/ig/oah/StructureDefinition/location-oah";

// Codes taken verbatim from the OneAquaHealth IG code system, including its spellings
export const OAH_CODES = [
  "pH",
  "dissolvedO2",
  "waterTemperature",
  "tds",
  "tss",
  "conductivity",
  "nutrients",
  "total-phosphates",
  "nitrate",
  "sulphate",
  "chloride",
  "ammonium",
  "nitrite",
  "macroinvertebreates",
  "diatomes",
  "fishes",
  "macrophytes",
  "diatomTratology",
  "coliforms",
  "morophology",
  "hydrology",
  "LandUse",
  "riparianVegetation",
] as const;

// Concepts Rivulet derives that the OAH IG has no code for; each names the gap it fills
export const RIVULET_CODES = {
  "forel-ule-index": "Forel-Ule index (1-21) — no OAH code for water colour",
  "wfd-ecological-status":
    "WFD ecological status class — no OAH code for the classified outcome",
  "data-confidence":
    "Rivulet data confidence (0-1) — no OAH code for evidence strength",
  "visual-clarity":
    "Visual clarity reported by a resident (0 clear to 3 opaque) — not a suspended-solids measurement, so not OAH tss",
  "sewage-odour":
    "Sewage odour reported by a resident — a possible sign of faecal contamination, not a coliform count",
  "visible-algae":
    "Green algae or surface scum seen — not a macrophyte survey",
  "surface-foam": "Foam on the water surface seen by a resident",
  "dead-fish": "Dead fish seen by a resident",
  "visible-litter":
    "Visible litter on the margins (0 none to 3 a lot) — not a land-use classification",
} as const;

export type OahCode = (typeof OAH_CODES)[number];
export type RivuletCode = keyof typeof RIVULET_CODES;

export function systemFor(code: string): string {
  return (OAH_CODES as readonly string[]).includes(code)
    ? OAH_SYSTEM
    : RIVULET_SYSTEM;
}
