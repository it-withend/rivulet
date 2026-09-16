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

/** Why an observation was held back; shown to moderators, never to the public. */
export type FlagReason = "gps_accuracy" | "rate_limit" | "distance_from_waterbody" | "ai_not_water";

export const FLAG_REASON_LABEL: Record<FlagReason, string> = {
  gps_accuracy: "GPS accuracy was worse than the plausibility limit",
  rate_limit: "More than the hourly limit of reports from this device",
  distance_from_waterbody: "Reported position was far from this stream's mapped path",
  ai_not_water: "Automatic photo check did not recognise this as a photo of water",
};

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
export function plausibilityStatus(
  input: PlausibilityInput,
): { status: ValidationStatus; reason: FlagReason | null } {
  const p = PLAUSIBILITY;
  if (input.gpsAccuracyM === null || input.gpsAccuracyM > p.maxGpsAccuracyM) {
    return { status: "flagged", reason: "gps_accuracy" };
  }
  if (input.recentByObserver > p.maxPerHour) {
    return { status: "flagged", reason: "rate_limit" };
  }
  return { status: "auto_approved", reason: null };
}
