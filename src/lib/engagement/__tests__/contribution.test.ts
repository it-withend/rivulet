import { describe, it, expect } from "vitest";
import { contributions, CONTRIBUTION_PARAMETERS, type ContributionRow } from "../contribution";

function row(overrides: Partial<ContributionRow>): ContributionRow {
  return {
    observerId: "observer-1",
    waterbodyId: "w1",
    observedAt: "2026-09-01T10:00:00.000Z",
    qualityWeight: 1,
    observerTrust: 0.5,
    validationStatus: "auto_approved",
    isSynthetic: false,
    ...overrides,
  };
}

describe("contributions", () => {
  it("caps counted observations at one per observer per water body per UTC day", () => {
    const rows = [
      row({ observedAt: "2026-09-01T08:00:00.000Z" }),
      row({ observedAt: "2026-09-01T20:00:00.000Z" }),
    ];
    const [summary] = contributions(rows);
    expect(summary.countedObservations).toBe(1);
  });

  it("counts a second day separately", () => {
    const rows = [
      row({ observedAt: "2026-09-01T08:00:00.000Z" }),
      row({ observedAt: "2026-09-02T08:00:00.000Z" }),
    ];
    const [summary] = contributions(rows);
    expect(summary.countedObservations).toBe(2);
  });

  it("excludes flagged and pending observations", () => {
    const rows = [
      row({ validationStatus: "flagged" }),
      row({ validationStatus: "pending", waterbodyId: "w2" }),
    ];
    expect(contributions(rows)).toHaveLength(0);
  });

  it("counts human-approved observations alongside auto-approved ones", () => {
    const rows = [row({ validationStatus: "human_approved" })];
    const [summary] = contributions(rows);
    expect(summary.countedObservations).toBe(1);
  });

  it("applies the gap bonus once for the first observation on a neglected stream", () => {
    const rows = [
      // No prior observation at all on w1 -> counts as a gap fill.
      row({ waterbodyId: "w1", observedAt: "2026-09-01T08:00:00.000Z" }),
      // A different water body with a recent prior observation -> no gap bonus.
      row({
        observerId: "observer-2",
        waterbodyId: "w2",
        observedAt: "2026-09-10T08:00:00.000Z",
      }),
      row({
        observerId: "observer-3",
        waterbodyId: "w2",
        observedAt: "2026-09-15T08:00:00.000Z",
      }),
    ];
    const byObserver = new Map(contributions(rows).map((s) => [s.observerId, s]));
    expect(byObserver.get("observer-1")?.gapsFilled).toBe(1);
    expect(byObserver.get("observer-2")?.gapsFilled).toBe(1);
    expect(byObserver.get("observer-3")?.gapsFilled).toBe(0);

    const basePoints =
      CONTRIBUTION_PARAMETERS.basePoints * 1 /* qualityWeight */ * 1 /* neutral trust multiplier */;
    expect(byObserver.get("observer-3")?.points).toBe(Math.round(basePoints));
    expect(byObserver.get("observer-1")?.points).toBe(
      Math.round(basePoints) + CONTRIBUTION_PARAMETERS.gapBonus,
    );
  });

  it("excludes anonymous observations from the leaderboard", () => {
    const rows = [row({ observerId: null })];
    expect(contributions(rows)).toHaveLength(0);
  });
});
