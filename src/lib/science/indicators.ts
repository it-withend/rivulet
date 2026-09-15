import type { SurveyAnswers, TaxonCode } from "@/types/observation";

export type Indicator = { code: string; value: number; source: string };

const BMWP_SOURCE =
  "Family sensitivity after the Biological Monitoring Working Party (BMWP) score system";
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

const CLARITY_TSS: Record<SurveyAnswers["clarity"], number> = {
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

  indicators.push({
    code: "tss",
    value: CLARITY_TSS[answers.clarity],
    source: `${SURVEY_SOURCE}: visual clarity ordinal, not a gravimetric measurement`,
  });

  if (answers.odour === "sewage") {
    indicators.push({
      code: "coliforms",
      value: 1,
      source: `${SURVEY_SOURCE}: sewage odour as a faecal contamination proxy`,
    });
  }

  if (answers.visibleAlgae) {
    indicators.push({
      code: "macrophytes",
      value: 1,
      source: `${SURVEY_SOURCE}: visible algal growth`,
    });
  }

  const observed = answers.indicatorTaxa.filter((t) => t !== "none_seen");
  if (observed.length > 0) {
    const score = observed.reduce((acc, t) => acc + TAXON_SENSITIVITY[t], 0);
    indicators.push({
      code: "macroinvertebreates",
      value: score,
      source: BMWP_SOURCE,
    });
  }

  indicators.push({
    code: "hydrology",
    value: answers.flow === "stagnant" ? 0 : answers.flow === "low" ? 1 : 2,
    source: `${SURVEY_SOURCE}: observed flow state`,
  });

  indicators.push({
    code: "LandUse",
    value: answers.litter,
    source: `${SURVEY_SOURCE}: visible litter on the margins`,
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
