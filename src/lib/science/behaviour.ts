import { computeSnapshot, type StoredObservation } from "./snapshot";
import type { SurveyAnswers } from "@/types/observation";

const HEALTHY: SurveyAnswers = {
  odour: "none",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: ["mayfly", "stonefly"],
  forelUle: 4,
  measurements: {},
};

const POLLUTED: SurveyAnswers = {
  odour: "sewage",
  foam: true,
  litter: 3,
  deadFish: false,
  visibleAlgae: true,
  clarity: "turbid",
  flow: "stagnant",
  indicatorTaxa: ["worm"],
  forelUle: 16,
  measurements: {},
};

export type BehaviourRow = {
  scenario: string;
  reports: number;
  mean: number;
  lower: number;
  upper: number;
  confidence: number;
  /** The status class, or null when the engine says "insufficient data". */
  klass: string | null;
};

type Report = { survey: SurveyAnswers; trust: number };

function run(scenario: string, reports: Report[], now: Date): BehaviourRow {
  const observations: StoredObservation[] = reports.map((r, i) => ({
    id: `${scenario}-${i}`,
    observedAt: new Date(now.getTime() - i * 3_600_000).toISOString(),
    observerId: `observer-${scenario}-${i}`,
    survey: r.survey,
    qualityWeight: 1,
    observerTrust: r.trust,
  }));
  const snapshot = computeSnapshot(observations, now);
  return {
    scenario,
    reports: reports.length,
    mean: snapshot.posterior.mean,
    lower: snapshot.posterior.lower,
    upper: snapshot.posterior.upper,
    confidence: snapshot.confidence,
    klass: snapshot.assessment.klass,
  };
}

const many = (survey: SurveyAnswers, n: number, trust = 0.5): Report[] =>
  Array.from({ length: n }, () => ({ survey, trust }));

/**
 * The engine's own answers to simple, fixed situations, so its behaviour can be
 * read off a table instead of taken on trust: what a few agreeing reports do to
 * the interval, what disagreement does, and how much an observer's trust counts.
 * Computed live from `computeSnapshot`, so it cannot drift from what runs.
 */
export function modelBehaviour(now: Date = new Date()): { agreeing: BehaviourRow[]; disagreeing: BehaviourRow[]; trust: BehaviourRow[] } {
  const counts = [1, 2, 3, 5, 8, 12];
  return {
    agreeing: [
      run("No reports (0)", [], now),
      ...counts.map((n) => run(`All healthy (${n})`, many(HEALTHY, n), now)),
      ...counts.map((n) => run(`All polluted (${n})`, many(POLLUTED, n), now)),
    ],
    disagreeing: [4, 8, 12].map((n) =>
      run(`Half healthy, half polluted (${n})`, [...many(HEALTHY, n / 2), ...many(POLLUTED, n / 2)], now),
    ),
    trust: [
      run("3 healthy from trusted observers, 3 polluted from low-trust", [...many(HEALTHY, 3, 0.85), ...many(POLLUTED, 3, 0.15)], now),
      run("3 healthy from low-trust observers, 3 polluted from trusted", [...many(HEALTHY, 3, 0.15), ...many(POLLUTED, 3, 0.85)], now),
    ],
  };
}
