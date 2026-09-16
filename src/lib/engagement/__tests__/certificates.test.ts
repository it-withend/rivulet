import { describe, it, expect } from "vitest";
import { eligibility, CERTIFICATE_PARAMETERS } from "../certificates";

describe("eligibility", () => {
  it("blocks synthetic (demo) observers from every tier", () => {
    const result = eligibility(
      { countedObservations: 1000, trust: 1, isSynthetic: true },
      1,
    );
    expect(result.contributor.eligible).toBe(false);
    expect(result.data_steward.eligible).toBe(false);
  });

  it("is eligible for contributor once thresholds are met", () => {
    const result = eligibility(
      {
        countedObservations: CERTIFICATE_PARAMETERS.contributorMinObservations,
        trust: CERTIFICATE_PARAMETERS.contributorMinTrust,
        isSynthetic: false,
      },
      null,
    );
    expect(result.contributor.eligible).toBe(true);
    expect(result.contributor.missing).toEqual([]);
  });

  it("reports how many more observations are needed for contributor", () => {
    const result = eligibility(
      { countedObservations: 2, trust: CERTIFICATE_PARAMETERS.contributorMinTrust, isSynthetic: false },
      null,
    );
    expect(result.contributor.eligible).toBe(false);
    expect(result.contributor.missing).toEqual([
      `${CERTIFICATE_PARAMETERS.contributorMinObservations - 2} more validated observations`,
    ]);
  });

  it("requires trust for contributor even with enough observations", () => {
    const result = eligibility(
      { countedObservations: 50, trust: 0.1, isSynthetic: false },
      null,
    );
    expect(result.contributor.eligible).toBe(false);
    expect(result.contributor.missing.length).toBe(1);
  });

  it("requires a top-100 home-city rank for data_steward", () => {
    const summary = {
      countedObservations: CERTIFICATE_PARAMETERS.dataStewardMinObservations,
      trust: CERTIFICATE_PARAMETERS.dataStewardMinTrust,
      isSynthetic: false,
    };
    expect(eligibility(summary, CERTIFICATE_PARAMETERS.dataStewardMaxRank).data_steward.eligible).toBe(
      true,
    );
    expect(
      eligibility(summary, CERTIFICATE_PARAMETERS.dataStewardMaxRank + 1).data_steward.eligible,
    ).toBe(false);
    expect(eligibility(summary, null).data_steward.eligible).toBe(false);
  });
});
