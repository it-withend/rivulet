import {
  CONFIDENCE_SPREAD_SCALE_DEGREES,
  D65_WHITE,
  HUE_REFERENCE,
  MIN_CHROMA_DISTANCE,
  MIN_USABLE_PIXELS,
  SRGB_TO_XYZ,
  SRGB_TRANSFER,
} from "./forel-ule";
import { FU_TABLE, FU_TABLE_SOURCE } from "./forel-ule-table";
import {
  BMWP_MAX_SCORE,
  EVIDENCE_WEIGHTS,
  TAXON_SENSITIVITY,
} from "./indicators";
import { OBSERVATION_WEIGHTING } from "./weighting";
import { CREDIBLE_MASS, DATA_CONFIDENCE, UNIFORM_PRIOR } from "./bayes";
import { MIN_CONFIDENCE_FOR_CLASS, WFD_BOUNDARIES } from "./wfd";
import { TRUST_PARAMETERS } from "./trust";
import { PLAUSIBILITY } from "./plausibility";
import { CONTRIBUTION_PARAMETERS } from "@/lib/engagement/contribution";

type ParameterValue = number | readonly number[];

export type MethodParameter =
  | { id: string; value: ParameterValue; kind: "standard"; source: string }
  | { id: string; value: ParameterValue; kind: "prior"; rationale: string };

const UNCALIBRATED =
  "Uncalibrated Rivulet v1 expert-judgement prior; calibration against official water-quality data is planned.";

const EVIDENCE_RATIONALE: Record<keyof typeof EVIDENCE_WEIGHTS, string> = {
  sensitiveTaxonThreshold:
    "Taxa scoring at or above this BMWP-scale value count as evidence of good condition; below it, as evidence of organic pollution.",
  forelUleClearMax:
    "Forel–Ule classes up to this value (blue to greenish-blue water) count as evidence of low algal enrichment.",
  forelUleEnrichedMin:
    "Forel–Ule classes from this value (yellowish-green to brown water) count as evidence of enrichment or heavy humic and sediment load.",
  forelUleClear: "Evidence added for a clear-water Forel–Ule class.",
  forelUleEnriched: "Evidence added for an enriched Forel–Ule class.",
  forelUleIntermediate:
    "Weak positive evidence for intermediate Forel–Ule classes, which are common in healthy lowland streams.",
  pollutedOdour:
    "Sewage or chemical odour is treated as strong evidence of contamination.",
  foam: "Persistent surface foam is treated as moderate evidence of detergents or organic load.",
  deadFish:
    "Dead fish are treated as the strongest single survey signal of acute pollution or oxygen depletion.",
  visibleAlgae:
    "Visible algal growth is treated as evidence of nutrient enrichment.",
  stagnantFlow:
    "Stagnant flow is treated as mild evidence of degraded condition through low oxygen and warming.",
  heavyLitterMin: "Litter levels from this value on the 0–3 survey scale count as heavy.",
  heavyLitter: "Evidence added for heavy litter on the margins.",
  clearWater: "Evidence added when the resident reports clear water.",
  opaqueWater: "Evidence added when the resident reports opaque water.",
};

const WEIGHTING_RATIONALE: Record<keyof typeof OBSERVATION_WEIGHTING, string> = {
  base: "Starting weight of an observation before evidence-quality adjustments.",
  photoBonus:
    "Largest weight added when a photo yields a Forel–Ule reading, scaled by that reading's confidence.",
  unknownPhotoConfidence:
    "Colour confidence assumed for a photo whose reading confidence is unknown.",
  measurementBonus:
    "Weight added for each instrument reading (pH, dissolved oxygen, temperature, nitrate).",
  maxCountedMeasurements: "Instrument readings beyond this count add no further weight.",
  preciseGpsMetres: "GPS accuracy at or better than this many metres carries no penalty.",
  approximateGpsMetres: "GPS accuracy up to this many metres counts as approximate.",
  approximateGpsFactor: "Weight multiplier for an approximate GPS position.",
  poorGpsFactor: "Weight multiplier for a poor or unknown GPS position.",
  unknownGpsMetres:
    "Accuracy assumed when the device reports none, so unknown precision is treated as poor rather than good.",
  halfLifeHours:
    "An observation's weight halves after this many hours (30 days), reflecting how quickly stream condition can change.",
  floor: "Minimum weight, so no accepted observation is silently discarded.",
};

const TRUST_RATIONALE: Record<keyof typeof TRUST_PARAMETERS, string> = {
  priorStrength:
    "Pseudo-count weight of the neutral prior against an observer's own agreement evidence, in units of observations.",
  minIndependent:
    "An observation gives no trust signal unless at least this many observations by other observers exist for the same water body.",
  multiplierMin: "Lower clamp on the trust multiplier applied to evidence weight.",
  multiplierMax: "Upper clamp on the trust multiplier applied to evidence weight.",
  neutralTrust: "Trust score with no effect on evidence weight (multiplier of 1).",
};

const PLAUSIBILITY_RATIONALE: Record<keyof typeof PLAUSIBILITY, string> = {
  maxGpsAccuracyM:
    "GPS accuracy worse than this many metres (or missing) flags the observation for human review instead of auto-approving it.",
  maxPerHour:
    "More than this many observations by the same observer in the previous hour flags the batch for human review as a basic anti-spam check.",
};

const CONTRIBUTION_RATIONALE: Record<keyof typeof CONTRIBUTION_PARAMETERS, string> = {
  basePoints: "Points awarded for one counted, trust- and quality-weighted observation.",
  gapBonus:
    "Extra points for the first observation on a water body that had none in the preceding window, rewarding coverage over repetition.",
  gapDays:
    "A water body counts as a data gap if it had no observation in this many preceding days.",
};

const CONFIDENCE_RATIONALE: Record<keyof typeof DATA_CONFIDENCE, string> = {
  volumeScale:
    "Effective observation weight at which the volume component reaches about 63% of its maximum.",
  diversityScale:
    "Number of distinct observers at which the diversity component reaches about 63% of its maximum.",
  recencyHalfLifeHours:
    "The recency component halves after this many hours (60 days) since the newest observation.",
  volumeWeight: "Share of data confidence given to the amount of weighted evidence.",
  diversityWeight: "Share of data confidence given to the number of independent observers.",
  recencyWeight: "Share of data confidence given to how recent the newest observation is.",
};

export const METHOD_PARAMETERS: MethodParameter[] = [
  {
    id: "forel-ule.class-limits",
    value: FU_TABLE.map((entry) => entry.hueAngleMin),
    kind: "standard",
    source: FU_TABLE_SOURCE,
  },
  {
    id: "forel-ule.hue-reference",
    value: [HUE_REFERENCE.x, HUE_REFERENCE.y],
    kind: "standard",
    source:
      "Forel–Ule hue angle convention, chromaticity x = y = 1/3 (Novoa, Wernand & van der Woerd 2013; as implemented in CefasRepRes/FUME)",
  },
  {
    id: "colour.srgb-transfer",
    value: [
      SRGB_TRANSFER.threshold,
      SRGB_TRANSFER.linearSlope,
      SRGB_TRANSFER.offset,
      SRGB_TRANSFER.exponent,
    ],
    kind: "standard",
    source: "IEC 61966-2-1:1999, sRGB colour space transfer function",
  },
  {
    id: "colour.srgb-to-xyz",
    value: SRGB_TO_XYZ.flat(),
    kind: "standard",
    source: "IEC 61966-2-1:1999, linear sRGB (D65) to CIE 1931 XYZ matrix",
  },
  {
    id: "colour.d65-white",
    value: [D65_WHITE.x, D65_WHITE.y],
    kind: "standard",
    source: "CIE standard illuminant D65 chromaticity, CIE 1931 2° standard observer",
  },
  {
    id: "forel-ule.min-usable-pixels",
    value: MIN_USABLE_PIXELS,
    kind: "prior",
    rationale: `Below this many coloured open-water pixels the mean hue is dominated by glare, banks and noise, so no reading is returned. ${UNCALIBRATED}`,
  },
  {
    id: "forel-ule.min-chroma-distance",
    value: MIN_CHROMA_DISTANCE,
    kind: "prior",
    rationale: `Pixels this close to the D65 white point (sky glare, foam, overcast reflections) carry no water hue and would bias readings toward blue-green classes, so they are excluded. ${UNCALIBRATED}`,
  },
  {
    id: "forel-ule.confidence-spread-scale",
    value: CONFIDENCE_SPREAD_SCALE_DEGREES,
    kind: "prior",
    rationale: `A circular hue spread of this many degrees across the sampled region maps to zero confidence, falling linearly from full confidence at zero spread. ${UNCALIBRATED}`,
  },
  {
    id: "indicators.bmwp-max-score",
    value: BMWP_MAX_SCORE,
    kind: "standard",
    source:
      "Maximum family score of the Biological Monitoring Working Party score system (Armitage, Moss, Wright & Furse 1983, Water Research 17:333–347)",
  },
  {
    id: "indicators.taxon-sensitivity",
    value: [
      TAXON_SENSITIVITY.stonefly,
      TAXON_SENSITIVITY.mayfly,
      TAXON_SENSITIVITY.caddisfly,
      TAXON_SENSITIVITY.freshwater_shrimp,
      TAXON_SENSITIVITY.leech,
      TAXON_SENSITIVITY.worm,
    ],
    kind: "prior",
    rationale: `Sensitivity for the taxon groups a resident can recognise (stonefly, mayfly, caddisfly, freshwater shrimp, leech, sludge worm), set on the 1–10 BMWP family scale (Armitage et al. 1983). Mayfly and caddisfly groups contain families with a wide range of BMWP scores, so single representative values are used. ${UNCALIBRATED}`,
  },
  ...(Object.keys(EVIDENCE_WEIGHTS) as (keyof typeof EVIDENCE_WEIGHTS)[]).map(
    (key): MethodParameter => ({
      id: `indicators.evidence.${key}`,
      value: EVIDENCE_WEIGHTS[key],
      kind: "prior",
      rationale: `${EVIDENCE_RATIONALE[key]} ${UNCALIBRATED}`,
    }),
  ),
  ...(Object.keys(OBSERVATION_WEIGHTING) as (keyof typeof OBSERVATION_WEIGHTING)[]).map(
    (key): MethodParameter => ({
      id: `weighting.${key}`,
      value: OBSERVATION_WEIGHTING[key],
      kind: "prior",
      rationale: `${WEIGHTING_RATIONALE[key]} ${UNCALIBRATED}`,
    }),
  ),
  {
    id: "bayes.uniform-prior",
    value: [UNIFORM_PRIOR.alpha, UNIFORM_PRIOR.beta],
    kind: "standard",
    source:
      "Bayes–Laplace uniform prior Beta(1, 1) for a proportion with no prior information (Gelman et al., Bayesian Data Analysis, 3rd ed., 2013, chapter 2)",
  },
  {
    id: "bayes.credible-mass",
    value: CREDIBLE_MASS,
    kind: "prior",
    rationale: `Probability mass of the reported equal-tailed credible interval; a reporting convention chosen for Rivulet v1. ${UNCALIBRATED}`,
  },
  ...(Object.keys(DATA_CONFIDENCE) as (keyof typeof DATA_CONFIDENCE)[]).map(
    (key): MethodParameter => ({
      id: `confidence.${key}`,
      value: DATA_CONFIDENCE[key],
      kind: "prior",
      rationale: `${CONFIDENCE_RATIONALE[key]} ${UNCALIBRATED}`,
    }),
  ),
  {
    id: "wfd.class-boundaries",
    value: [
      WFD_BOUNDARIES.poor.min,
      WFD_BOUNDARIES.moderate.min,
      WFD_BOUNDARIES.good.min,
      WFD_BOUNDARIES.high.min,
    ],
    kind: "prior",
    rationale: `Directive 2000/60/EC (Annex V) defines five ecological status classes on an Ecological Quality Ratio from 0 to 1, but sets class boundaries per quality element through intercalibration; Rivulet v1 uses equal-width bands with boundaries at 0.2, 0.4, 0.6 and 0.8. ${UNCALIBRATED}`,
  },
  {
    id: "wfd.min-confidence-for-class",
    value: MIN_CONFIDENCE_FOR_CLASS,
    kind: "prior",
    rationale: `Below this data confidence no ecological status class is assigned and the stream is shown as having insufficient data. ${UNCALIBRATED}`,
  },
  ...(Object.keys(TRUST_PARAMETERS) as (keyof typeof TRUST_PARAMETERS)[]).map(
    (key): MethodParameter => ({
      id: `trust.${key}`,
      value: TRUST_PARAMETERS[key],
      kind: "prior",
      rationale: `${TRUST_RATIONALE[key]} Trust is shrunk towards this neutral value using a Beta-binomial-style pseudo-count prior (Gelman et al., Bayesian Data Analysis, 3rd ed., 2013, chapter 5). ${UNCALIBRATED}`,
    }),
  ),
  ...(Object.keys(PLAUSIBILITY) as (keyof typeof PLAUSIBILITY)[]).map(
    (key): MethodParameter => ({
      id: `plausibility.${key}`,
      value: PLAUSIBILITY[key],
      kind: "prior",
      rationale: `${PLAUSIBILITY_RATIONALE[key]} ${UNCALIBRATED}`,
    }),
  ),
  ...(Object.keys(CONTRIBUTION_PARAMETERS) as (keyof typeof CONTRIBUTION_PARAMETERS)[]).map(
    (key): MethodParameter => ({
      id: `contribution.${key}`,
      value: CONTRIBUTION_PARAMETERS[key],
      kind: "prior",
      rationale: `${CONTRIBUTION_RATIONALE[key]} This is a programme rule, not a scientific estimate, but is declared here for transparency. ${UNCALIBRATED}`,
    }),
  ),
];
