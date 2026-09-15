export const OAH_SYSTEM =
  "http://hl7.eu/fhir/ig/oah/CodeSystem/temporarySystem-oah-eu";

export const RIVULET_SYSTEM =
  "https://rivulet.eco/fhir/CodeSystem/rivulet-derived";

export const OAH_PROFILE_INDICATORS =
  "http://hl7.eu/fhir/ig/oah/StructureDefinition/ObservationIndicatorsOah";

export const OAH_PROFILE_LOCATION =
  "http://hl7.eu/fhir/ig/oah/StructureDefinition/LocationOah";

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
} as const;

export type OahCode = (typeof OAH_CODES)[number];
export type RivuletCode = keyof typeof RIVULET_CODES;

export function systemFor(code: string): string {
  return (OAH_CODES as readonly string[]).includes(code)
    ? OAH_SYSTEM
    : RIVULET_SYSTEM;
}
