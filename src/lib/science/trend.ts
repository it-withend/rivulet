import { computeSnapshot, type StoredObservation } from "./snapshot";
import type { WfdClass } from "./wfd";

export type TrendPoint = {
  /** First day of the month, UTC, ISO date. */
  month: string;
  count: number;
  /** Posterior mean and 90% interval of that month's reports alone; null without reports. */
  mean: number | null;
  lower: number | null;
  upper: number | null;
  klass: WfdClass | null;
};

/**
 * One point per calendar month, each assessed from that month's reports only,
 * so a change over time is visible instead of being averaged away. A month
 * with no reports is a gap, never a carried-forward value.
 */
export function monthlyTrend(
  observations: StoredObservation[],
  now: Date = new Date(),
  months = 6,
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const inMonth = observations.filter((o) => {
      const t = new Date(o.observedAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    if (inMonth.length === 0) {
      points.push({ month: start.toISOString().slice(0, 10), count: 0, mean: null, lower: null, upper: null, klass: null });
      continue;
    }
    const snapshot = computeSnapshot(inMonth, new Date(Math.min(end.getTime() - 1, now.getTime())));
    points.push({
      month: start.toISOString().slice(0, 10),
      count: inMonth.length,
      mean: snapshot.posterior.mean,
      lower: snapshot.posterior.lower,
      upper: snapshot.posterior.upper,
      klass: snapshot.assessment.klass,
    });
  }
  return points;
}
