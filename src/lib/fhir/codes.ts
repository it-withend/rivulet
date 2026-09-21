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

// Concepts Rivulet derives that the OAH IG has no code for; each names the gap it fills.
// `display` is the short name a FHIR consumer sees; `definition` says what it is and is not.
export const RIVULET_CODES = {
  "forel-ule-index": {
    display: "Forel-Ule index",
    definition: "Forel-Ule colour index (1-21) — no OAH code for water colour",
  },
  "wfd-ecological-status": {
    display: "Indicative status class",
    definition: "WFD-named indicative status class — no OAH code for the classified outcome; not an official WFD classification",
  },
  "data-confidence": {
    display: "Data confidence",
    definition: "Rivulet data confidence (0-1) — no OAH code for evidence strength",
  },
  "visual-clarity": {
    display: "Visual clarity",
    definition: "Visual clarity reported by a resident (0 clear to 3 opaque) — not a suspended-solids measurement, so not OAH tss",
  },
  "sewage-odour": {
    display: "Sewage odour",
    definition: "Sewage odour reported by a resident — a possible sign of faecal contamination, not a coliform count",
  },
  "visible-algae": {
    display: "Visible algae",
    definition: "Green algae or surface scum seen — not a macrophyte survey",
  },
  "surface-foam": {
    display: "Surface foam",
    definition: "Foam on the water surface seen by a resident",
  },
  "dead-fish": {
    display: "Dead fish",
    definition: "Dead fish seen by a resident",
  },
  "visible-litter": {
    display: "Visible litter",
    definition: "Visible litter on the margins (0 none to 3 a lot) — not a land-use classification",
  },
  "invertebrate-groups-score": {
    display: "Invertebrate groups score",
    definition:
      "Sum of BMWP-family sensitivity values for the recognisable animal groups a resident reports (1-10 per group) — a simplified proxy, not the OneAquaHealth benthic macroinvertebrate count and not a BMWP protocol score",
  },
  "flow-state": {
    display: "Flow state as seen",
    definition:
      "Flow as a resident sees it, 0 still to 3 fast — not a hydromorphological survey, so not the OneAquaHealth hydrology concept",
  },
  "one-health-concern": {
    display: "One Health concern",
    definition:
      "Indicative concern for people, dogs and wildlife near a stream, from recent resident-reported warning signs and nearby places people use — a prompt to take care, not a public-health assessment",
  },
} as const;

export const UCUM = "http://unitsofmeasure.org";

// Values of `wfd-ecological-status`, in the same code system.
export const RIVULET_STATUS_CLASSES = {
  high: { display: "High", definition: "Indicative class named high; not an official WFD classification" },
  good: { display: "Good", definition: "Indicative class named good; not an official WFD classification" },
  moderate: { display: "Moderate", definition: "Indicative class named moderate; not an official WFD classification" },
  poor: { display: "Poor", definition: "Indicative class named poor; not an official WFD classification" },
  bad: { display: "Bad", definition: "Indicative class named bad; not an official WFD classification" },
} as const;

export type OahCode = (typeof OAH_CODES)[number];
export type RivuletCode = keyof typeof RIVULET_CODES;

export function systemFor(code: string): string {
  return (OAH_CODES as readonly string[]).includes(code)
    ? OAH_SYSTEM
    : RIVULET_SYSTEM;
}
