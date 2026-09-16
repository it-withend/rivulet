import type {
  Audience,
  Concern,
  ExposureKind,
  HazardCode,
} from "@/lib/science/one-health";

// Deliberately not the WFD palette, so concern for people and animals is
// never mistaken for ecological status on the map.
export const CONCERN_COLOUR: Record<Concern, string> = {
  unknown: "#9e9e9e",
  none: "#4a8fb5",
  watch: "#e3b53c",
  care: "#dd7a34",
  avoid: "#8e2c6b",
};

export const CONCERN_LABEL: Record<Concern, string> = {
  unknown: "Not enough recent reports",
  none: "No warning signs reported",
  watch: "Worth keeping an eye on",
  care: "Take care",
  avoid: "Avoid contact with the water",
};

export const AUDIENCE_LABEL: Record<Audience, string> = {
  people: "People and children",
  dogs: "Dogs",
  wildlife: "Fish and wildlife",
};

export const HAZARD_LABEL: Record<HazardCode, string> = {
  sewage: "sewage smell",
  bloom: "algae or scum",
  chemical: "chemical smell or foam",
  dead_fish: "dead fish",
  litter: "heavy litter",
};

export const EXPOSURE_LABEL: Record<ExposureKind, string> = {
  playground: "Playground",
  school: "School",
  kindergarten: "Kindergarten",
  dog_park: "Dog park",
  park: "Park",
  bathing: "Bathing spot",
  fishing: "Fishing spot",
  allotments: "Allotment gardens",
  picnic: "Picnic site",
};
