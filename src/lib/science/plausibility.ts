export const PLAUSIBILITY = {
  maxGpsAccuracyM: 250,
  maxPerHour: 5,
  maxFutureMinutes: 5,
  maxPastDays: 30,
  maxDistanceFromWaterbodyM: 200,
} as const;

export type PlausibilityInput = {
  gpsAccuracyM: number | null;
  /** Observations by the same observer in the previous hour, this one excluded. */
  recentByObserver: number;
};

export type ValidationStatus = "auto_approved" | "flagged";

/**
 * Statuses kept out of assessments, trust and exports until a person reviews
 * them. A flagged observation is stored, never discarded, but it does not
 * move a stream's status on its own say-so.
 */
export const HELD_FOR_REVIEW = ["flagged", "rejected"] as const;

/** `HELD_FOR_REVIEW` in PostgREST list syntax, for `.not("validation_status", "in", ...)`. */
export const HELD_FOR_REVIEW_FILTER = `(${HELD_FOR_REVIEW.join(",")})`;

export function isHeldForReview(status: string | null | undefined): boolean {
  return (HELD_FOR_REVIEW as readonly string[]).includes(status ?? "");
}

/**
 * Cheap, explainable auto-validation: flags an observation for later human
 * review instead of ever blocking submission. Both thresholds are priors —
 * see METHOD_PARAMETERS.
 */
export function plausibilityStatus(input: PlausibilityInput): ValidationStatus {
  const p = PLAUSIBILITY;
  if (input.gpsAccuracyM === null || input.gpsAccuracyM > p.maxGpsAccuracyM) {
    return "flagged";
  }
  if (input.recentByObserver > p.maxPerHour) {
    return "flagged";
  }
  return "auto_approved";
}
