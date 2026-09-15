import type { TaxonCode } from "@/types/observation";

export type JournalEntry = {
  observationId: string;
  waterbodyId: string;
  waterbodyName: string;
  observedAt: string;
  forelUle: number | null;
  indicatorTaxa: TaxonCode[];
  visibleAlgae: boolean;
  wasDataGap: boolean;
};

export type BadgeCode =
  | "first-observation"
  | "colour-collector"
  | "clean-water-sentinel"
  | "bloom-spotter"
  | "stream-explorer"
  | "returning-guardian"
  | "gap-filler";

export type Badge = {
  code: BadgeCode;
  title: string;
  description: string;
  earned: boolean;
};

const SENSITIVE_TAXA: TaxonCode[] = ["mayfly", "stonefly", "caddisfly"];

const RULES: {
  code: BadgeCode;
  title: string;
  description: string;
  test: (entries: JournalEntry[]) => boolean;
}[] = [
  {
    code: "first-observation",
    title: "First sample",
    description: "Recorded your first observation.",
    test: (entries) => entries.length >= 1,
  },
  {
    code: "colour-collector",
    title: "Colour collector",
    description: "Recorded five different Forel–Ule water colours.",
    test: (entries) => colourCollection(entries).length >= 5,
  },
  {
    code: "clean-water-sentinel",
    title: "Clean water sentinel",
    description:
      "Found mayflies, stoneflies or caddisflies — animals that only live in clean water.",
    test: (entries) =>
      entries.some((e) => e.indicatorTaxa.some((t) => SENSITIVE_TAXA.includes(t))),
  },
  {
    code: "bloom-spotter",
    title: "Bloom spotter",
    description: "Reported visible algae, an early sign of nutrient pollution.",
    test: (entries) => entries.some((e) => e.visibleAlgae),
  },
  {
    code: "stream-explorer",
    title: "Stream explorer",
    description: "Observed three different water bodies.",
    test: (entries) => new Set(entries.map((e) => e.waterbodyId)).size >= 3,
  },
  {
    code: "returning-guardian",
    title: "Returning guardian",
    description: "Checked the same stream on three separate days.",
    test: returnedOnThreeDays,
  },
  {
    code: "gap-filler",
    title: "Gap filler",
    description: "Recorded a stream that had too little data to assess.",
    test: (entries) => entries.some((e) => e.wasDataGap),
  },
];

function returnedOnThreeDays(entries: JournalEntry[]): boolean {
  const daysByStream = new Map<string, Set<string>>();
  for (const e of entries) {
    const days = daysByStream.get(e.waterbodyId) ?? new Set<string>();
    days.add(e.observedAt.slice(0, 10));
    daysByStream.set(e.waterbodyId, days);
  }
  return [...daysByStream.values()].some((days) => days.size >= 3);
}

export function colourCollection(entries: JournalEntry[]): number[] {
  const colours = entries
    .map((e) => e.forelUle)
    .filter((fu): fu is number => fu !== null);
  return [...new Set(colours)].sort((a, b) => a - b);
}

export function evaluateBadges(entries: JournalEntry[]): Badge[] {
  return RULES.map(({ test, ...badge }) => ({ ...badge, earned: test(entries) }));
}

export function newlyEarned(
  before: JournalEntry[],
  after: JournalEntry[],
): BadgeCode[] {
  const had = new Set(
    evaluateBadges(before)
      .filter((b) => b.earned)
      .map((b) => b.code),
  );
  return evaluateBadges(after)
    .filter((b) => b.earned && !had.has(b.code))
    .map((b) => b.code);
}
