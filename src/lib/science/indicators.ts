import type { SurveyAnswers, TaxonCode } from "@/types/observation";

export type Indicator = { code: string; value: number; source: string };

const BMWP_SOURCE =
  "Rivulet structured survey: sum of sensitivity values for recognisable groups, set on the BMWP 1-10 family scale; a simplified proxy, not a BMWP protocol score";
const SURVEY_SOURCE = "Rivulet structured survey, derived proxy";

export const BMWP_MAX_SCORE = 10;

export const TAXON_SENSITIVITY: Record<TaxonCode, number> = {
  stonefly: 10,
  mayfly: 9,
  caddisfly: 8,
  freshwater_shrimp: 6,
  leech: 3,
  worm: 1,
  none_seen: 0,
};

const CLARITY_ORDINAL: Record<SurveyAnswers["clarity"], number> = {
  clear: 0,
  slightly_turbid: 1,
  turbid: 2,
  opaque: 3,
};

export const EVIDENCE_WEIGHTS = {
  sensitiveTaxonThreshold: 6,
  forelUleClearMax: 5,
  forelUleEnrichedMin: 13,
  forelUleClear: 1,
  forelUleEnriched: 1,
  forelUleIntermediate: 0.25,
  pollutedOdour: 1.5,
  foam: 0.5,
  deadFish: 2,
  visibleAlgae: 0.75,
  stagnantFlow: 0.5,
  heavyLitterMin: 2,
  heavyLitter: 0.5,
  clearWater: 0.5,
  opaqueWater: 1,
} as const;

export function toIndicators(answers: SurveyAnswers): Indicator[] {
  const indicators: Indicator[] = [];
  const { measurements } = answers;

  if (measurements.ph !== undefined) {
    indicators.push({
      code: "pH",
      value: measurements.ph,
      source: "Field test strip reading",
    });
  }
  if (measurements.dissolvedOxygen !== undefined) {
    indicators.push({
      code: "dissolvedO2",
      value: measurements.dissolvedOxygen,
      source: "Field test reading",
    });
  }
  if (measurements.temperature !== undefined) {
    indicators.push({
      code: "waterTemperature",
      value: measurements.temperature,
      source: "Field thermometer reading",
    });
  }
  if (measurements.nitrate !== undefined) {
    indicators.push({
      code: "nitrate",
      value: measurements.nitrate,
      source: "Field test strip reading",
    });
  }

  // Visual signs a resident reports are not laboratory measurements, so they
  // never borrow an OneAquaHealth analyte code (tss, coliforms, macrophytes,
  // LandUse). They travel under the separate Rivulet code system instead.
  indicators.push({
    code: "visual-clarity",
    value: CLARITY_ORDINAL[answers.clarity],
    source: `${SURVEY_SOURCE}: visual clarity, 0 clear to 3 opaque`,
  });

  if (answers.odour === "sewage") {
    indicators.push({
      code: "sewage-odour",
      value: 1,
      source: `${SURVEY_SOURCE}: sewage odour reported; a possible sign of faecal contamination, not a coliform count`,
    });
  }

  if (answers.visibleAlgae) {
    indicators.push({
      code: "visible-algae",
      value: 1,
      source: `${SURVEY_SOURCE}: green algae or surface scum seen`,
    });
  }

  if (answers.foam) {
    indicators.push({
      code: "surface-foam",
      value: 1,
      source: `${SURVEY_SOURCE}: foam on the surface`,
    });
  }

  if (answers.deadFish) {
    indicators.push({
      code: "dead-fish",
      value: 1,
      source: `${SURVEY_SOURCE}: dead fish seen`,
    });
  }

  const observed = answers.indicatorTaxa.filter((t) => t !== "none_seen");
  if (observed.length > 0) {
    const score = observed.reduce((acc, t) => acc + TAXON_SENSITIVITY[t], 0);
    indicators.push({
      code: "invertebrate-groups-score",
      value: score,
      source: BMWP_SOURCE,
    });
  }

  indicators.push({
    code: "flow-state",
    value: answers.flow === "stagnant" ? 0 : answers.flow === "low" ? 1 : answers.flow === "high" ? 3 : 2,
    source: `${SURVEY_SOURCE}: flow state as seen by the resident, 0 still to 3 fast`,
  });

  indicators.push({
    code: "visible-litter",
    value: answers.litter,
    source: `${SURVEY_SOURCE}: visible litter, 0 none to 3 a lot`,
  });

  return indicators;
}

export function ecologicalEvidence(
  answers: SurveyAnswers,
): {
  good: number;
  bad: number;
} {
  const w = EVIDENCE_WEIGHTS;
  let good = 0;
  let bad = 0;

  for (const taxon of answers.indicatorTaxa) {
    if (taxon === "none_seen") continue;
    const sensitivity = TAXON_SENSITIVITY[taxon];
    if (sensitivity >= w.sensitiveTaxonThreshold) {
      good += sensitivity / BMWP_MAX_SCORE;
    } else {
      bad += (w.sensitiveTaxonThreshold + 1 - sensitivity) / BMWP_MAX_SCORE;
    }
  }

  if (answers.forelUle !== null) {
    if (answers.forelUle <= w.forelUleClearMax) good += w.forelUleClear;
    else if (answers.forelUle >= w.forelUleEnrichedMin) bad += w.forelUleEnriched;
    else good += w.forelUleIntermediate;
  }

  if (answers.odour === "sewage" || answers.odour === "chemical") {
    bad += w.pollutedOdour;
  }
  if (answers.foam) bad += w.foam;
  if (answers.deadFish) bad += w.deadFish;
  if (answers.visibleAlgae) bad += w.visibleAlgae;
  if (answers.flow === "stagnant") bad += w.stagnantFlow;
  if (answers.litter >= w.heavyLitterMin) bad += w.heavyLitter;
  if (answers.clarity === "clear") good += w.clearWater;
  if (answers.clarity === "opaque") bad += w.opaqueWater;

  return { good, bad };
}
