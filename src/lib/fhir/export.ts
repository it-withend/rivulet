import { toIndicators } from "@/lib/science/indicators";
import type { SurveyAnswers } from "@/types/observation";
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
  methodVersion: string;
  exportedAt: string;
};

/**
 * Every resource in a water body's FHIR export: its Location, one Observation
 * per indicator per report, the Forel-Ule reading, and the classified outcome.
 * Pure, so the validation job can run the exact mapping the API serves.
 */
export function buildWaterbodyResources(
  input: WaterbodyExportInput,
): (FhirLocation | FhirObservation)[] {
  const { waterbody, rows } = input;
  const resources: (FhirLocation | FhirObservation)[] = [toLocationOah(waterbody)];
  let anySynthetic = false;

  for (const row of rows) {
    if (row.is_synthetic) anySynthetic = true;
    if (!row.survey) continue;

    // Derived from the survey at export time rather than the stored
    // `indicators` column, so older rows follow the current code mapping.
    for (const indicator of toIndicators(row.survey)) {
      resources.push(
        toObservationIndicators({
          id: `${row.id}-${indicator.code}`,
          waterbodyId: waterbody.id,
          effectiveDateTime: row.observed_at,
          performerDisplay: row.observer_id
            ? `Observer ${row.observer_id}`
            : "Anonymous citizen scientist",
          code: indicator.code,
          value: { kind: "quantity", value: indicator.value, unit: "1" },
          synthetic: row.is_synthetic,
        }),
      );
    }

    if (row.survey.forelUle != null) {
      resources.push(
        toObservationIndicators({
          id: `${row.id}-fu`,
          waterbodyId: waterbody.id,
          effectiveDateTime: row.observed_at,
          performerDisplay: "Anonymous citizen scientist",
          code: "forel-ule-index",
          value: { kind: "quantity", value: row.survey.forelUle, unit: "FU" },
          synthetic: row.is_synthetic,
        }),
      );
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

  return resources;
}
