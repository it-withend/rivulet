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

type ParameterValue = number | readonly number[];

export type MethodParameter =
  | { id: string; value: ParameterValue; kind: "standard"; source: string }
  | { id: string; value: ParameterValue; kind: "prior"; rationale: string };

const UNCALIBRATED =
  "Uncalibrated Rivulet v1 expert-judgement prior; calibration against official water-quality data is planned.";

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
];
