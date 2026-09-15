import type { WfdClass } from "@/lib/science/wfd";

// These values are the source of truth for the five WFD status colours and
// match the --color-wfd-* / --color-insufficient tokens in globals.css. They
// are duplicated here (rather than read from CSS) because MapLibre paint
// expressions and inline swatch styles need plain colour strings.
export const INSUFFICIENT_DATA_COLOUR = "#9e9e9e";

const PALETTE: Record<WfdClass, string> = {
  high: "#1a9641",
  good: "#a6d96a",
  moderate: "#ffffbf",
  poor: "#fdae61",
  bad: "#d7191c",
};

export function colourForClass(klass: WfdClass | null): string {
  return klass === null ? INSUFFICIENT_DATA_COLOUR : PALETTE[klass];
}

export const CLASS_LABEL: Record<WfdClass, string> = {
  high: "High",
  good: "Good",
  moderate: "Moderate",
  poor: "Poor",
  bad: "Bad",
};

export const SIMPLE_MESSAGE: Record<WfdClass, string> = {
  high: "This water is in very good condition.",
  good: "This water is in good condition.",
  moderate: "This water shows signs of stress.",
  poor: "This water is in poor condition.",
  bad: "This water is badly degraded.",
};
