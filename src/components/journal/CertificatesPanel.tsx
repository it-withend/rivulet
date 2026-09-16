"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import {
  eligibility,
  type CertificateTier,
  type TierEligibility,
} from "@/lib/engagement/certificates";
import { addCertificateId, getObserver, type StoredObserver } from "@/lib/identity/client";

type Summary = {
  trust: number;
  countedObservations: number;
  homeCityRank: number | null;
};

const TIER_LABEL: Record<CertificateTier, string> = {
  contributor: "Contributor",
  data_steward: "Data Steward",
};

const TIERS: CertificateTier[] = ["contributor", "data_steward"];

/**
 * Shows both certificate tiers with plain-language progress, a claim form,
 * and links to certificates this device has already claimed. Renders
 * nothing until an observer identity and summary are available.
 */
export function CertificatesPanel() {
  const [observer, setObserver] = useState<StoredObserver | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [claiming, setClaiming] = useState<CertificateTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimedUrl, setClaimedUrl] = useState<string | null>(null);

  useEffect(() => {
    const current = getObserver();
    setObserver(current);
    if (!current) return;

    fetch("/api/observers/me/summary", {
      headers: { authorization: `Bearer ${current.token}` },
    })
      .then((response) => (response.ok ? (response.json() as Promise<Summary>) : null))
      .then((body) => {
        if (body) setSummary(body);
      })
      .catch(() => {
        // The panel just shows nothing until the summary loads.
      });
  }, []);

  if (!observer || !summary) return null;

  const elig: Record<CertificateTier, TierEligibility> = eligibility(
    { countedObservations: summary.countedObservations, trust: summary.trust, isSynthetic: false },
    summary.homeCityRank,
  );

  async function claim(tier: CertificateTier, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = recipientName.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError("Names must be 2 to 80 characters.");
      return;
    }

    setClaiming(tier);
    setError(null);
    setClaimedUrl(null);
    try {
      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${observer!.token}`,
        },
        body: JSON.stringify({ tier, recipientName: trimmed }),
      });
      const body = (await response.json().catch(() => null)) as
        | { id?: string; url?: string; error?: string; missing?: string[] }
        | null;

      if (!response.ok || !body?.id) {
        setError(
          body?.missing?.join(", ") ?? body?.error ?? "Could not issue the certificate.",
        );
        return;
      }

      addCertificateId(body.id);
      setObserver(getObserver());
      setClaimedUrl(body.url ?? `/certificates/${body.id}`);
    } catch {
      setError("Could not issue the certificate. Please try again.");
    } finally {
      setClaiming(null);
    }
  }

  return (
    <Panel>
      <p className="field-label m-0">Recognition</p>
      <h2 className="mt-2 mb-4 text-2xl">Certificates</h2>

      <div className="space-y-6">
        {TIERS.map((tier) => {
          const tierEligibility = elig[tier];
          return (
            <div key={tier} className="border-t border-rule pt-4 first:border-t-0 first:pt-0">
              <p className="m-0 text-base font-medium">{TIER_LABEL[tier]}</p>
              {tierEligibility.eligible ? (
                <>
                  <p className="mt-1 mb-3 text-sm text-ink-muted">
                    You are eligible for this certificate.
                  </p>
                  <form
                    onSubmit={(e) => claim(tier, e)}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <label className="flex flex-col gap-1 text-sm">
                      Recipient name
                      <input
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        minLength={2}
                        maxLength={80}
                        className="min-h-11 rounded-sm border border-rule-strong bg-paper px-3 py-2 text-ink"
                      />
                    </label>
                    <Button type="submit" variant="secondary" disabled={claiming === tier}>
                      {claiming === tier ? "Issuing…" : "Claim certificate"}
                    </Button>
                  </form>
                  <p className="mt-2 mb-0 text-xs text-ink-muted">
                    This name will be shown publicly on the certificate&rsquo;s
                    verification page.
                  </p>
                </>
              ) : (
                <ul className="m-0 mt-1 list-none space-y-0.5 p-0 text-sm text-ink-muted">
                  {tierEligibility.missing.map((m) => (
                    <li key={m}>Needs {m}.</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 mb-0 text-sm text-ink-muted">{error}</p>}
      {claimedUrl && (
        <p className="mt-4 mb-0 text-sm">
          Certificate issued. <a href={claimedUrl}>View it</a>.
        </p>
      )}

      {observer.certificateIds && observer.certificateIds.length > 0 && (
        <div className="mt-6 border-t border-rule pt-4">
          <p className="field-label m-0">Your certificates</p>
          <ul className="m-0 mt-2 list-none space-y-1 p-0 text-sm">
            {observer.certificateIds.map((id) => (
              <li key={id}>
                <a href={`/certificates/${id}`}>{id}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
