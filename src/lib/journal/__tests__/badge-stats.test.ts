import { describe, expect, it } from "vitest";
import { computeBadgeStats, rarityOf, type BadgeStatRow } from "../badge-stats";

const row = (observerId: string, waterbodyId: string, day: string, extra: Partial<BadgeStatRow["survey"]> = {}, demo = false): BadgeStatRow => ({
  observerId,
  waterbodyId,
  observedAt: `2026-09-${day}T10:00:00Z`,
  survey: { forelUle: 8, indicatorTaxa: [], visibleAlgae: false, ...extra },
  isSynthetic: demo,
});

describe("computeBadgeStats", () => {
  const rows = [
    row("a", "w1", "10"),
    row("a", "w2", "11", { visibleAlgae: true }),
    row("a", "w3", "12", { indicatorTaxa: ["mayfly"] }),
    row("b", "w1", "10", {}, true),
  ];
  const stats = computeBadgeStats(rows, new Set(["b"]));

  it("counts observers and how many are demonstration observers", () => {
    expect(stats.observers).toBe(2);
    expect(stats.demoObservers).toBe(1);
  });

  it("counts who holds each badge with the journal's own rules", () => {
    expect(stats.counts["first-observation"]).toBe(2);
    expect(stats.counts["stream-explorer"]).toBe(1); // only "a" observed three streams
    expect(stats.counts["bloom-spotter"]).toBe(1);
    expect(stats.counts["clean-water-sentinel"]).toBe(1);
  });

  it("takes the gap-filler badge from the server-side fact, not the entries", () => {
    expect(stats.counts["gap-filler"]).toBe(1);
  });
});

describe("rarityOf", () => {
  it("names the tier from the share of observers", () => {
    expect(rarityOf(0.8).key).toBe("common");
    expect(rarityOf(0.3).key).toBe("uncommon");
    expect(rarityOf(0.1).key).toBe("rare");
    expect(rarityOf(0.01).key).toBe("legendary");
  });
});
