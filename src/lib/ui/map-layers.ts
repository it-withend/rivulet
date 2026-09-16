import type { WfdClass } from "@/lib/science/wfd";
import type { Concern } from "@/lib/science/one-health";
import { CONCERN_COLOUR, CONCERN_LABEL } from "./one-health-copy";
import {
  AGREEMENT_COLOUR,
  DIVERGENCE_COLOUR,
  INSUFFICIENT_DATA_COLOUR,
  PLAIN_CLASS_LABEL,
  colourForClass,
} from "./wfd-colours";

export type MapLayer = "status" | "health" | "divergence";

export const MAP_LAYERS: Record<MapLayer, { label: string; question: string }> = {
  status: { label: "Water health", question: "How healthy is the water, going by what neighbours noticed?" },
  health: { label: "Safe to touch?", question: "Should people, children and dogs be careful here?" },
  divergence: { label: "Satellite check", question: "Does the satellite see the same colour as residents?" },
};

export type LegendEntry = { colour: string; label: string; dashed?: boolean };

const WFD_ORDER: WfdClass[] = ["high", "good", "moderate", "poor", "bad"];

export const LEGEND: Record<MapLayer, LegendEntry[]> = {
  status: [
    ...WFD_ORDER.map((k) => ({ colour: colourForClass(k), label: PLAIN_CLASS_LABEL[k] })),
    { colour: INSUFFICIENT_DATA_COLOUR, label: "Not checked enough yet — your visit helps most", dashed: true },
  ],
  health: [
    ...(["none", "watch", "care", "avoid"] as Concern[]).map((c) => ({
      colour: CONCERN_COLOUR[c],
      label: CONCERN_LABEL[c],
    })),
    { colour: CONCERN_COLOUR.unknown, label: "No recent reports — unknown, not safe", dashed: true },
  ],
  divergence: [
    { colour: AGREEMENT_COLOUR, label: "Satellite agrees with residents" },
    { colour: DIVERGENCE_COLOUR, label: "Satellite sees something different" },
    { colour: INSUFFICIENT_DATA_COLOUR, label: "No clear satellite view (clouds, or stream too narrow)", dashed: true },
  ],
};
