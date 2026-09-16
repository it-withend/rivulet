"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Award, Info } from "lucide-react";
import { CERTIFICATE_PARAMETERS } from "@/lib/engagement/certificates";
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
  heldForReview: number;
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

  if (!observer) {
    return (
      <Panel>
        <h2 className="mt-0 mb-2 flex items-center gap-2 text-2xl">
          <Award aria-hidden="true" className="size-6 text-river" />
          Earn a volunteer certificate
        </h2>
        <p className="m-0 max-w-lg text-sm text-ink-muted">
          Send {CERTIFICATE_PARAMETERS.contributorMinObservations} reports while
          standing at streams — at most one per stream per day — and you can
          claim a signed Contributor certificate for a CV or school portfolio.
          No account needed.
        </p>
        <div className="mt-4">
          <Button href="/observe">Check a stream</Button>
        </div>
      </Panel>
    );
  }
  if (!summary) return null;

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
      <h2 className="mt-2 mb-2 flex items-center gap-2 text-2xl">
        <Award aria-hidden="true" className="size-6 text-river" />
        Certificates
      </h2>
      <p className="mt-0 mb-4 max-w-lg text-sm text-ink-muted">
        A signed certificate you can add to a CV or school portfolio. It counts
        reports made at the stream itself — at most one per stream per day — from
        people whose reports agree with their neighbours&apos;.
      </p>

      {summary.heldForReview > 0 && (
        <p className="mt-0 mb-4 flex gap-2 rounded-sm border border-rule bg-paper p-3 text-sm">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-river" />
          <span>
            {summary.heldForReview === 1 ? "1 of your reports is" : `${summary.heldForReview} of your reports are`}{" "}
            waiting for review and not counted yet — usually because your
            phone&apos;s location was far from the stream you picked. Reports sent
            while standing at the stream count straight away.
          </span>
        </p>
      )}

      <div className="space-y-6">
        {TIERS.map((tier) => {
          const tierEligibility = elig[tier];
          return (
            <div key={tier} className="border-t border-rule pt-4 first:border-t-0 first:pt-0">
              <p className="m-0 text-base font-medium">{TIER_LABEL[tier]}</p>
              {(() => {
                const need =
                  tier === "contributor"
                    ? CERTIFICATE_PARAMETERS.contributorMinObservations
                    : CERTIFICATE_PARAMETERS.dataStewardMinObservations;
                const have = Math.min(summary.countedObservations, need);
                return (
                  <div className="mt-2 mb-2">
                    <div
                      className="h-2 rounded-full bg-rule"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={need}
                      aria-valuenow={have}
                      aria-label={`${TIER_LABEL[tier]}: ${have} of ${need} counted reports`}
                    >
                      <div className="h-2 rounded-full bg-river" style={{ width: `${(have / need) * 100}%` }} />
                    </div>
                    <p className="num m-0 mt-1 text-xs text-ink-muted">
                      {have} of {need} counted reports
                    </p>
                  </div>
                );
              })()}
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
