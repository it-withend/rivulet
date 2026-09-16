"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { CLARITIES, FLOWS, LITTER, ODOURS, labelFor, signsSeen } from "@/components/wizard/survey-options";
import type { SurveyAnswers } from "@/types/observation";

const STORAGE_KEY = "rivulet.moderator.token.v1";

type QueueItem = {
  id: string;
  waterbodyId: string;
  waterbodyName: string;
  city: string | null;
  observedAt: string;
  createdAt: string;
  gpsAccuracyM: number | null;
  survey: SurveyAnswers;
  forelUleIndex: number | null;
  qualityWeight: number;
  flagReason: string | null;
  reasonLabel: string | null;
  isSynthetic: boolean;
  observerId: string | null;
  observerName: string | null;
  observerTrust: number | null;
};

function summarise(survey: SurveyAnswers): string {
  const parts = [
    labelFor(ODOURS, survey.odour),
    labelFor(CLARITIES, survey.clarity),
    labelFor(FLOWS, survey.flow),
    labelFor(LITTER, survey.litter),
    ...signsSeen(survey),
  ];
  return parts.join(" · ");
}

export function ModeratorQueue() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(STORAGE_KEY));
    } catch {
      // Private browsing or blocked storage — fall back to asking every load.
    }
  }, []);

  async function load(withToken: string) {
    setError(null);
    const response = await fetch("/api/moderation/observations", {
      headers: { "x-moderator-token": withToken },
    });
    if (response.status === 401) {
      setError("That passphrase was not accepted.");
      setItems(null);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setToken(null);
      return;
    }
    if (!response.ok) {
      setError("Could not load the queue. Please try again.");
      return;
    }
    const body = (await response.json()) as { items: QueueItem[] };
    setItems(body.items);
  }

  useEffect(() => {
    if (token) void load(token);
  }, [token]);

  async function decide(id: string, action: "approve" | "reject") {
    if (!token) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/moderation/observations/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-moderator-token": token },
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        setItems((current) => current?.filter((item) => item.id !== id) ?? null);
      } else {
        setError("That decision did not save. Please try again.");
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!token) {
    return (
      <Panel>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = tokenInput.trim();
            if (!trimmed) return;
            try {
              sessionStorage.setItem(STORAGE_KEY, trimmed);
            } catch {
              /* ignore */
            }
            setToken(trimmed);
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-1.5">
              <KeyRound aria-hidden="true" className="size-4" /> Moderator passphrase
            </span>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="min-h-11 rounded-sm border border-rule-strong bg-paper px-3 py-2 text-ink"
              autoComplete="off"
            />
          </label>
          <Button type="submit">Open queue</Button>
        </form>
        {error && <p className="mt-3 mb-0 text-sm">{error}</p>}
      </Panel>
    );
  }

  if (items === null) {
    return <p className="m-0 text-sm text-ink-muted">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <Panel>
        <p className="m-0 text-sm">Nothing waiting for review right now.</p>
      </Panel>
    );
  }

  return (
    <ul className="m-0 list-none space-y-4 p-0">
      {items.map((item) => (
        <li key={item.id}>
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 font-medium">
                  {item.waterbodyName}
                  {item.city && <span className="text-ink-muted"> · {item.city}</span>}
                  {item.isSynthetic && <span className="text-ink-muted"> · demo data</span>}
                </p>
                <p className="m-0 mt-1 text-sm text-ink-muted">
                  Reported {new Date(item.createdAt).toLocaleString()} by{" "}
                  {item.observerName ?? "an anonymous device"}
                  {item.observerTrust !== null && ` (trust ${Math.round(item.observerTrust * 100)}%)`}
                </p>
              </div>
              <p className="m-0 flex items-center gap-1.5 rounded-sm border border-rule bg-paper px-2 py-1 text-sm">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-[#b0561d]" />
                {item.reasonLabel ?? "Flagged"}
              </p>
            </div>

            <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="field-label">GPS accuracy</dt>
                <dd className="num m-0">{item.gpsAccuracyM ?? "unknown"} m</dd>
              </div>
              <div>
                <dt className="field-label">Water colour</dt>
                <dd className="num m-0">{item.forelUleIndex ? `FU ${item.forelUleIndex}` : "no photo"}</dd>
              </div>
              <div>
                <dt className="field-label">Quality weight</dt>
                <dd className="num m-0">{item.qualityWeight.toFixed(2)}</dd>
              </div>
            </dl>
            <p className="m-0 mt-2 text-sm">{summarise(item.survey)}</p>

            <div className="mt-4 flex gap-2">
              <Button onClick={() => decide(item.id, "approve")} disabled={busyId === item.id}>
                <Check aria-hidden="true" className="size-4" /> Approve
              </Button>
              <Button
                variant="secondary"
                onClick={() => decide(item.id, "reject")}
                disabled={busyId === item.id}
              >
                <X aria-hidden="true" className="size-4" /> Reject
              </Button>
            </div>
          </Panel>
        </li>
      ))}
      {error && <p className="m-0 text-sm">{error}</p>}
    </ul>
  );
}
