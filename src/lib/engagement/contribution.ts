import { trustMultiplier, TRUST_PARAMETERS } from "@/lib/science/trust";

export const CONTRIBUTION_PARAMETERS = {
  basePoints: 10,
  gapBonus: 5,
  gapDays: 30,
  minTrustForPoints: 0.35,
} as const;

export type ContributionRow = {
  observerId: string | null;
  waterbodyId: string;
  observedAt: string;
  /** Server-assigned insertion time — never client-supplied, unlike `observedAt`. */
  createdAt: string;
  qualityWeight: number;
  observerTrust: number | null;
  validationStatus: string;
  isSynthetic: boolean;
  waterbodyCity?: string;
};

export type ContributorSummary = {
  observerId: string;
  points: number;
  countedObservations: number;
  streamsCovered: number;
  gapsFilled: number;
  trust: number;
  homeCity: string | null;
  /** Trust too low to earn points: the observations stand, the ranking does not. */
  underReview: boolean;
};

const COUNTED_STATUSES = new Set(["auto_approved", "human_approved"]);

function utcDayKey(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Pure scoring function over already-fetched observation rows. Counts only
 * validated observations, caps one per observer per water body per UTC day
 * (the first), and adds a bonus for filling a data gap — see
 * METHOD_PARAMETERS ids `contribution.*` for the constants' rationale.
 */
export function contributions(
  observations: ContributionRow[],
  now: Date = new Date(),
): ContributorSummary[] {
  void now; // reserved for future recency-based scoring; not used yet.
  const p = CONTRIBUTION_PARAMETERS;

  const eligible = observations.filter(
    (o) => o.observerId !== null && COUNTED_STATUSES.has(o.validationStatus),
  );

  // Anti-gaming: one counted observation per observer per water body per UTC
  // day — the earliest one that day. Keyed on `createdAt` (the server's
  // insertion clock), never on the client-supplied `observedAt`, so a script
  // spreading fabricated `observedAt` values across many days cannot dodge
  // this cap.
  const sortedByTime = [...eligible].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const seenDayKeys = new Set<string>();
  const counted: ContributionRow[] = [];
  for (const o of sortedByTime) {
    const key = `${o.observerId}::${o.waterbodyId}::${utcDayKey(o.createdAt)}`;
    if (seenDayKeys.has(key)) continue;
    seenDayKeys.add(key);
    counted.push(o);
  }

  function hadPriorObservationWithinGap(row: ContributionRow): boolean {
    const targetTime = new Date(row.observedAt).getTime();
    const cutoff = targetTime - p.gapDays * 24 * 3_600_000;
    return observations.some((other) => {
      if (other === row) return false;
      if (other.waterbodyId !== row.waterbodyId) return false;
      const t = new Date(other.observedAt).getTime();
      return t < targetTime && t >= cutoff;
    });
  }

  type Accumulator = {
    points: number;
    countedObservations: number;
    streams: Set<string>;
    gapsFilled: number;
    trust: number;
    cityCounts: Map<string, number>;
  };

  const byObserver = new Map<string, Accumulator>();

  for (const row of counted) {
    const observerId = row.observerId as string;
    const entry: Accumulator =
      byObserver.get(observerId) ??
      {
        points: 0,
        countedObservations: 0,
        streams: new Set<string>(),
        gapsFilled: 0,
        trust: row.observerTrust ?? TRUST_PARAMETERS.neutralTrust,
        cityCounts: new Map<string, number>(),
      };

    const trust = row.observerTrust ?? TRUST_PARAMETERS.neutralTrust;
    const multiplier = trustMultiplier(trust);
    const gapFilled = !hadPriorObservationWithinGap(row);
    // An observer who systematically disagrees with everyone else earns no
    // points at all, so volume can never outrank trustworthiness.
    const points =
      trust < p.minTrustForPoints
        ? 0
        : Math.round(p.basePoints * row.qualityWeight * multiplier) +
          (gapFilled ? p.gapBonus : 0);

    entry.points += points;
    entry.countedObservations += 1;
    entry.streams.add(row.waterbodyId);
    if (gapFilled) entry.gapsFilled += 1;
    entry.trust = trust;
    if (row.waterbodyCity) {
      entry.cityCounts.set(
        row.waterbodyCity,
        (entry.cityCounts.get(row.waterbodyCity) ?? 0) + 1,
      );
    }

    byObserver.set(observerId, entry);
  }

  return [...byObserver.entries()].map(([observerId, entry]) => {
    let homeCity: string | null = null;
    let max = -1;
    for (const [city, count] of entry.cityCounts) {
      if (count > max) {
        max = count;
        homeCity = city;
      }
    }

    return {
      observerId,
      points: entry.points,
      countedObservations: entry.countedObservations,
      streamsCovered: entry.streams.size,
      gapsFilled: entry.gapsFilled,
      trust: entry.trust,
      homeCity,
      underReview: entry.trust < CONTRIBUTION_PARAMETERS.minTrustForPoints,
    };
  });
}
