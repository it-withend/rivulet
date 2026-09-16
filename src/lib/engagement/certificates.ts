export const CERTIFICATE_PARAMETERS = {
  contributorMinObservations: 5,
  contributorMinTrust: 0.5,
  dataStewardMinObservations: 20,
  dataStewardMinTrust: 0.6,
  dataStewardMaxRank: 100,
} as const;

export type CertificateTier = "contributor" | "data_steward";

export type EligibilitySummary = {
  countedObservations: number;
  trust: number;
  isSynthetic: boolean;
};

export type TierEligibility = { eligible: boolean; missing: string[] };

function observationsMissing(have: number, need: number): string | null {
  if (have >= need) return null;
  const remaining = need - have;
  return `${remaining} more validated observation${remaining === 1 ? "" : "s"}`;
}

function trustMissing(have: number, need: number): string | null {
  if (have >= need) return null;
  return `a Trust Score of at least ${Math.round(need * 100)}% (currently ${Math.round(have * 100)}%)`;
}

/**
 * Per-tier eligibility for a certificate, in plain language. `rank` is the
 * observer's position (1 = first) in their home city's people leaderboard,
 * or null if they have no ranked contributions there. Synthetic (demo)
 * observers are never eligible for any tier — see the phase 2a plan's global
 * constraints. Thresholds are programme rules, not scientific estimates, but
 * are declared in METHOD_PARAMETERS for transparency.
 */
export function eligibility(
  summary: EligibilitySummary,
  rank: number | null,
): Record<CertificateTier, TierEligibility> {
  if (summary.isSynthetic) {
    const blocked: TierEligibility = {
      eligible: false,
      missing: ["Demo observers cannot receive a certificate."],
    };
    return { contributor: blocked, data_steward: blocked };
  }

  const p = CERTIFICATE_PARAMETERS;

  const contributorMissing = [
    observationsMissing(summary.countedObservations, p.contributorMinObservations),
    trustMissing(summary.trust, p.contributorMinTrust),
  ].filter((m): m is string => m !== null);

  const rankMissing =
    rank === null || rank > p.dataStewardMaxRank
      ? [`a place in the top ${p.dataStewardMaxRank} of your home city's leaderboard`]
      : [];

  const dataStewardMissing = [
    observationsMissing(summary.countedObservations, p.dataStewardMinObservations),
    trustMissing(summary.trust, p.dataStewardMinTrust),
    ...rankMissing,
  ].filter((m): m is string => m !== null);

  return {
    contributor: { eligible: contributorMissing.length === 0, missing: contributorMissing },
    data_steward: { eligible: dataStewardMissing.length === 0, missing: dataStewardMissing },
  };
}
