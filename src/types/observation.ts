export type TaxonCode =
  | "mayfly"
  | "stonefly"
  | "caddisfly"
  | "freshwater_shrimp"
  | "leech"
  | "worm"
  | "none_seen";

export type Measurements = {
  ph?: number;
  dissolvedOxygen?: number;
  temperature?: number;
  nitrate?: number;
};

export type SurveyAnswers = {
  odour: "none" | "musty" | "sewage" | "chemical";
  foam: boolean;
  litter: 0 | 1 | 2 | 3;
  deadFish: boolean;
  visibleAlgae: boolean;
  clarity: "clear" | "slightly_turbid" | "turbid" | "opaque";
  flow: "normal" | "low" | "stagnant" | "high";
  indicatorTaxa: TaxonCode[];
  forelUle: number | null;
  measurements: Measurements;
};
