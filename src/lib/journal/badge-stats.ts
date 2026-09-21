import { evaluateBadges, type BadgeCode, type JournalEntry } from "./journal";
import type { SurveyAnswers } from "@/types/observation";

export type BadgeStatRow = {
  observerId: string;
  waterbodyId: string;
  observedAt: string;
  survey: Pick<SurveyAnswers, "forelUle" | "indicatorTaxa" | "visibleAlgae"> | null;
  /** The observer is a seeded demonstration observer. */
  isSynthetic: boolean;
};

export type BadgeStats = {
  /** Observers with at least one validated report. */
  observers: number;
  /** How many of those are demonstration observers, so the figure never passes them off as people. */
  demoObservers: number;
  /** Observers who hold each badge. */
  counts: Record<BadgeCode, number>;
};

export const RARITY_TIERS = [
  { key: "common", label: "Common", min: 0.5 },
  { key: "uncommon", label: "Uncommon", min: 0.2 },
  { key: "rare", label: "Rare", min: 0.05 },
  { key: "legendary", label: "Very rare", min: 0 },
] as const;

export type RarityKey = (typeof RARITY_TIERS)[number]["key"];

/** How rare a badge is, from the share of observers who hold it. */
export function rarityOf(share: number): (typeof RARITY_TIERS)[number] {
  return RARITY_TIERS.find((tier) => share >= tier.min) ?? RARITY_TIERS[RARITY_TIERS.length - 1];
}

/**
 * The share of observers holding each badge, computed with the same rules the
 * journal uses on a person's own reports. `gapFillers` are the observers who
 * filled a data gap; that fact needs everyone's reports, so it is passed in.
 * Only validated reports should be given: a held report earns nothing.
 */
export function computeBadgeStats(rows: BadgeStatRow[], gapFillers: ReadonlySet<string>): BadgeStats {
  const byObserver = new Map<string, { demo: boolean; entries: JournalEntry[] }>();

  for (const row of rows) {
    const holder = byObserver.get(row.observerId) ?? { demo: row.isSynthetic, entries: [] };
    holder.entries.push({
      observationId: `${row.observerId}-${holder.entries.length}`,
      waterbodyId: row.waterbodyId,
      waterbodyName: "",
      observedAt: row.observedAt,
      forelUle: row.survey?.forelUle ?? null,
      indicatorTaxa: row.survey?.indicatorTaxa ?? [],
      visibleAlgae: row.survey?.visibleAlgae ?? false,
      wasDataGap: false,
    });
    byObserver.set(row.observerId, holder);
  }

  const counts = Object.fromEntries(evaluateBadges([]).map((b) => [b.code, 0])) as Record<BadgeCode, number>;
  let demoObservers = 0;

  for (const [observerId, { demo, entries }] of byObserver) {
    if (demo) demoObservers++;
    for (const badge of evaluateBadges(entries)) {
      const earned = badge.code === "gap-filler" ? gapFillers.has(observerId) : badge.earned;
      if (earned) counts[badge.code]++;
    }
  }

  return { observers: byObserver.size, demoObservers, counts };
}
