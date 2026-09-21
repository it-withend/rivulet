import {
  OAH_PROFILE_INDICATORS,
  OAH_PROFILE_LOCATION,
  RIVULET_CODES,
  RIVULET_STATUS_CLASSES,
  RIVULET_WATERBODY_ID_SYSTEM,
  systemFor,
  UCUM,
} from "./codes";

export type WaterbodyRecord = {
  id: string;
  name: string;
  city: string;
  centroidLon: number;
  centroidLat: number;
};

export type FhirLocation = {
  resourceType: "Location";
  id: string;
  meta: { profile: string[] };
  identifier: { system: string; value: string }[];
  name: string;
  mode: "instance";
  position?: { longitude: number; latitude: number };
  address: { city: string };
};

export type FhirCoding = { system: string; code: string; display?: string };

export type FhirObservation = {
  resourceType: "Observation";
  id: string;
  meta: { profile: string[]; tag?: FhirCoding[] };
  status: "final";
  code: { coding: FhirCoding[] };
  subject: { reference: string };
  effectiveDateTime: string;
  performer: { display: string }[];
  valueQuantity?: { value: number; unit: string; system?: string; code?: string };
  note?: { text: string }[];
  valueCodeableConcept?: { coding: FhirCoding[] };
};

export type IndicatorValue =
  /** `ucum` is the UCUM code for `unit`; when given, the quantity is coded, not just labelled. */
  | { kind: "quantity"; value: number; unit: string; ucum?: string }
  | { kind: "code"; code: string; display: string };

export type IndicatorObservationInput = {
  id: string;
  waterbodyId: string;
  effectiveDateTime: string;
  performerDisplay: string;
  code: string;
  value: IndicatorValue;
  synthetic?: boolean;
  /** How the value was derived, carried as Observation.note so a proxy is never mistaken for a measurement. */
  note?: string;
};

export function toLocationOah(waterbody: WaterbodyRecord): FhirLocation {
  return {
    resourceType: "Location",
    id: waterbody.id,
    meta: { profile: [OAH_PROFILE_LOCATION] },
    // LocationOah requires identifier (1..) and mode = instance.
    identifier: [{ system: RIVULET_WATERBODY_ID_SYSTEM, value: waterbody.id }],
    name: waterbody.name,
    mode: "instance",
    position: {
      longitude: waterbody.centroidLon,
      latitude: waterbody.centroidLat,
    },
    address: { city: waterbody.city },
  };
}

export function toObservationIndicators(
  input: IndicatorObservationInput,
): FhirObservation {
  const system = systemFor(input.code);
  const display =
    system.includes("rivulet")
      ? RIVULET_CODES[input.code as keyof typeof RIVULET_CODES]?.display
      : undefined;

  const observation: FhirObservation = {
    resourceType: "Observation",
    id: input.id,
    meta: { profile: [OAH_PROFILE_INDICATORS] },
    status: "final",
    code: { coding: [{ system, code: input.code, display }] },
    subject: { reference: `Location/${input.waterbodyId}` },
    effectiveDateTime: input.effectiveDateTime,
    performer: [{ display: input.performerDisplay }],
  };

  if (input.synthetic) {
    observation.meta.tag = [
      {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
        code: "HTEST",
        display: "test health data",
      },
    ];
  }

  if (input.note) observation.note = [{ text: input.note }];

  if (input.value.kind === "quantity") {
    observation.valueQuantity = {
      value: input.value.value,
      unit: input.value.unit,
      ...(input.value.ucum ? { system: UCUM, code: input.value.ucum } : {}),
    };
  } else {
    observation.valueCodeableConcept = {
      coding: [
        {
          system: systemFor(input.code),
          code: input.value.code,
          // The Rivulet code system fixes the display for a status class; anything else keeps the caller's.
          display:
            RIVULET_STATUS_CLASSES[input.value.code as keyof typeof RIVULET_STATUS_CLASSES]?.display ??
            input.value.display,
        },
      ],
    };
  }

  return observation;
}
