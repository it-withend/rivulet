import type { CertificateTier } from "@/lib/engagement/certificates";

export type CredentialStats = {
  countedObservations: number;
  streamsCovered: number;
  gapsFilled: number;
  trust: number;
};

export type BuildCredentialInput = {
  id: string;
  tier: CertificateTier;
  recipientName: string;
  stats: CredentialStats;
  issuedAt: string;
  baseUrl: string;
};

const ACHIEVEMENT: Record<
  CertificateTier,
  { name: string; description: string; narrative: string }
> = {
  contributor: {
    name: "Rivulet Contributor",
    description:
      "Recognises a resident who has logged at least five validated stream observations with an above-neutral Trust Score.",
    narrative:
      "The recipient submitted at least 5 validated observations of urban streams through Rivulet, and Rivulet's trust model — which weighs agreement with independent observers of the same water body — placed their Trust Score at 50% or above.",
  },
  data_steward: {
    name: "Rivulet Data Steward",
    description:
      "Recognises a resident whose sustained, trustworthy observations place them among the top contributors in their home city.",
    narrative:
      "The recipient submitted at least 20 validated observations of urban streams through Rivulet, held a Trust Score of 60% or above, and ranked in the top 100 contributors of their home city's leaderboard.",
  },
};

/**
 * Builds an Open Badges 3.0 / Verifiable Credentials Data Model v2 JSON
 * document for a Rivulet certificate. This is the object that gets signed
 * (see `jwt.ts`) and stored verbatim in `certificates.credential`.
 */
export function buildCredential(input: BuildCredentialInput) {
  const achievement = ACHIEVEMENT[input.tier];
  const credentialId = `${input.baseUrl}/certificates/${input.id}`;

  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    id: credentialId,
    issuer: {
      id: `${input.baseUrl}/issuer`,
      type: ["Profile"],
      name: "Rivulet (independent citizen-science prototype)",
    },
    validFrom: input.issuedAt,
    name: achievement.name,
    credentialSubject: {
      type: ["AchievementSubject"],
      name: input.recipientName,
      achievement: {
        id: `${input.baseUrl}/issuer#${input.tier}`,
        type: ["Achievement"],
        name: achievement.name,
        description: achievement.description,
        criteria: { narrative: achievement.narrative },
      },
    },
    evidence: [
      {
        id: credentialId,
        type: ["Evidence"],
        name: "Contribution record",
        description:
          `${input.stats.countedObservations} validated observation` +
          `${input.stats.countedObservations === 1 ? "" : "s"} across ` +
          `${input.stats.streamsCovered} stream${input.stats.streamsCovered === 1 ? "" : "s"}, ` +
          `${input.stats.gapsFilled} data gap${input.stats.gapsFilled === 1 ? "" : "s"} filled, ` +
          `Trust Score ${Math.round(input.stats.trust * 100)}%.`,
      },
    ],
  };
}

export type Credential = ReturnType<typeof buildCredential>;
