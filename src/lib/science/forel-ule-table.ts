import table from "./forel-ule-table.json";

export type ForelUleEntry = {
  index: number;
  hueAngleMin: number;
  hueAngleMax: number;
  srgb: string;
  description: string;
};

export const FU_TABLE: ForelUleEntry[] = table as ForelUleEntry[];

export const FU_TABLE_SOURCE =
  "Hue angle class limits: Novoa, Wernand & van der Woerd 2013, J. Eur. Opt. Soc. Rapid Publ. 8, 13057 (doi:10.2971/jeos.2013.13057), as distributed in CefasRepRes/FUME data/hue_angle_limits_NWW2013.csv; legend colours from FUME forelulecmap(). FUME contains public sector information licensed under the Open Government Licence v3.0. Hue angle measured from chromaticity x = y = 1/3.";
