import { toIndicators } from "@/lib/science/indicators";
import { ONE_HEALTH_PARAMETERS, type Concern, type HazardCode, type OneHealthReading } from "@/lib/science/one-health";
import type { SurveyAnswers } from "@/types/observation";
import { RIVULET_SYSTEM } from "./codes";
import {
  toLocationOah,
  toObservationIndicators,
  type FhirLocation,
  type FhirObservation,
  type WaterbodyRecord,
} from "./observation";

export type ExportObservationRow = {
  id: string;
  observed_at: string;
  observer_id: string | null;
  is_synthetic: boolean;
  survey: SurveyAnswers | null;
};

export type WaterbodyExportInput = {
  waterbody: WaterbodyRecord;
  rows: ExportObservationRow[];
  /** The WFD-named class Rivulet computed for the water body, or null when there is too little data. */
  wfdClass: string | null;
  /** The One Health reading, when exposure data exists; drives the DetectedIssue. */
  oneHealth?: OneHealthReading | null;
  methodVersion: string;
  exportedAt: string;
};

type Coding = { system: string; code: string; display?: string };

export type FhirProvenance = {
  resourceType: "Provenance";
  id: string;
  target: { reference: string }[];
  recorded: string;
  agent: { type: { coding: Coding[] }; who: { display: string } }[];
  meta?: { tag: Coding[] };
};

export type FhirDetectedIssue = {
  resourceType: "DetectedIssue";
  id: string;
  status: "final";
  code: { coding: Coding[] };
  severity: "high" | "moderate" | "low";
  implicated: { reference: string }[];
  identifiedDateTime: string;
  detail: string;
  evidence: { code: { coding: Coding[] }[]; detail: { reference: string }[] }[];
  meta?: { tag: Coding[] };
};

export type FhirExportResource = FhirLocation | FhirObservation | FhirProvenance | FhirDetectedIssue;

const PARTICIPANT_TYPE = "http://terminology.hl7.org/CodeSystem/provenance-participant-type";
const TEST_TAG: Coding = {
  system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
  code: "HTEST",
  display: "test health data",
};

/** Measured values carry their UCUM unit; resident-scored signs and indices are dimensionless. */
const UNIT_FOR_CODE: Record<string, { unit: string; ucum: string }> = {
  pH: { unit: "pH", ucum: "[pH]" },
  dissolvedO2: { unit: "mg/L", ucum: "mg/L" },
  waterTemperature: { unit: "degree Celsius", ucum: "Cel" },
  nitrate: { unit: "mg/L", ucum: "mg/L" },
};
const DIMENSIONLESS = { unit: "1", ucum: "1" };

/** Which resident-reported Observation code evidences each One Health hazard. */
const HAZARD_OBSERVATION: Record<HazardCode, string> = {
  sewage: "sewage-odour",
  bloom: "visible-algae",
  chemical: "surface-foam",
  dead_fish: "dead-fish",
  litter: "visible-litter",
};

const SEVERITY: Partial<Record<Concern, FhirDetectedIssue["severity"]>> = {
  watch: "low",
  care: "moderate",
  avoid: "high",
};

const CONCERN_TEXT: Record<Concern, string> = {
  unknown: "Not enough recent reports",
  none: "No warning signs reported",
  watch: "Worth keeping an eye on",
  care: "Take care",
  avoid: "Avoid contact with the water",
};

/**
 * Every resource in a water body's FHIR export: its Location, one Observation
 * per indicator per report with a Provenance saying who reported it and what
 * assembled it, the Forel-Ule reading, the classified outcome and, when there
 * is a warning worth acting on, a DetectedIssue. Pure, so the validation job
 * can run the exact mapping the API serves.
 */
export function buildWaterbodyResources(input: WaterbodyExportInput): FhirExportResource[] {
  const { waterbody, rows } = input;
  const resources: FhirExportResource[] = [toLocationOah(waterbody)];
  const windowStart = new Date(input.exportedAt).getTime() - ONE_HEALTH_PARAMETERS.windowDays * 86_400_000;
  let anySynthetic = false;
  // Observation ids per hazard within the One Health window, as evidence.
  const evidence = new Map<string, string[]>();

  for (const row of rows) {
    if (row.is_synthetic) anySynthetic = true;
    if (!row.survey) continue;

    const performerDisplay = row.observer_id ? `Observer ${row.observer_id}` : "Anonymous citizen scientist";
    const produced: FhirObservation[] = [];

    // Derived from the survey at export time rather than the stored
    // `indicators` column, so older rows follow the current code mapping.
    for (const indicator of toIndicators(row.survey)) {
      const { unit, ucum } = UNIT_FOR_CODE[indicator.code] ?? DIMENSIONLESS;
      produced.push(
        toObservationIndicators({
          id: `${row.id}-${indicator.code}`,
          waterbodyId: waterbody.id,
          effectiveDateTime: row.observed_at,
          performerDisplay,
          code: indicator.code,
          value: { kind: "quantity", value: indicator.value, unit, ucum },
          synthetic: row.is_synthetic,
          note: indicator.source,
        }),
      );
    }

    if (row.survey.forelUle != null) {
      produced.push(
        toObservationIndicators({
          id: `${row.id}-fu`,
          waterbodyId: waterbody.id,
          effectiveDateTime: row.observed_at,
          performerDisplay: "Anonymous citizen scientist",
          code: "forel-ule-index",
          value: { kind: "quantity", value: row.survey.forelUle, unit: "Forel-Ule class", ucum: "1" },
          synthetic: row.is_synthetic,
        }),
      );
    }

    resources.push(...produced);

    if (produced.length > 0) {
      resources.push({
        resourceType: "Provenance",
        id: `${row.id}-provenance`,
        target: produced.map((o) => ({ reference: `Observation/${o.id}` })),
        recorded: row.observed_at,
        agent: [
          { type: { coding: [{ system: PARTICIPANT_TYPE, code: "author" }] }, who: { display: performerDisplay } },
          { type: { coding: [{ system: PARTICIPANT_TYPE, code: "assembler" }] }, who: { display: "Rivulet web app" } },
        ],
        ...(row.is_synthetic ? { meta: { tag: [TEST_TAG] } } : {}),
      });
    }

    if (new Date(row.observed_at).getTime() >= windowStart) {
      for (const o of produced) {
        const list = evidence.get(o.code.coding[0].code) ?? [];
        list.push(o.id);
        evidence.set(o.code.coding[0].code, list);
      }
    }
  }

  if (input.wfdClass) {
    resources.push(
      toObservationIndicators({
        id: `${waterbody.id}-wfd`,
        waterbodyId: waterbody.id,
        effectiveDateTime: input.exportedAt,
        performerDisplay: `Rivulet method ${input.methodVersion}`,
        code: "wfd-ecological-status",
        value: { kind: "code", code: input.wfdClass, display: input.wfdClass },
        synthetic: anySynthetic,
      }),
    );
  }

  const severity = input.oneHealth ? SEVERITY[input.oneHealth.overall] : undefined;
  if (input.oneHealth && severity) {
    const warned = input.oneHealth.hazards.filter((h) => h.level !== "none");
    resources.push({
      resourceType: "DetectedIssue",
      id: `${waterbody.id}-one-health`,
      status: "final",
      code: {
        coding: [{ system: RIVULET_SYSTEM, code: "one-health-concern", display: "One Health concern" }],
      },
      severity,
      implicated: [{ reference: `Location/${waterbody.id}` }],
      identifiedDateTime: input.exportedAt,
      detail:
        `${CONCERN_TEXT[input.oneHealth.overall]}. Based on ${input.oneHealth.recentReports} resident report(s) ` +
        `in the last ${ONE_HEALTH_PARAMETERS.windowDays} days and nearby places people and animals use. ` +
        `Indicative, not a public-health assessment.`,
      evidence: warned.map((h) => ({
        code: [{ coding: [{ system: RIVULET_SYSTEM, code: HAZARD_OBSERVATION[h.code] }] }],
        detail: (evidence.get(HAZARD_OBSERVATION[h.code]) ?? []).slice(0, 5).map((id) => ({
          reference: `Observation/${id}`,
        })),
      })),
      ...(anySynthetic ? { meta: { tag: [TEST_TAG] } } : {}),
    });
  }

  return resources;
}
