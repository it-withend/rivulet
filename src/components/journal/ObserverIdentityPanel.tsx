"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import {
  clearObserver,
  getObserver,
  saveObserver,
  type StoredObserver,
} from "@/lib/identity/client";

type Summary = {
  trust: number;
  points: number;
  countedObservations: number;
  streamsCovered: number;
  gapsFilled: number;
  rank: number | null;
};

/**
 * The viewer's pseudonymous identity: rename form, trust/points/rank, and
 * the GDPR "delete my data" erasure path. Renders nothing if this device has
 * no observer identity yet (it is created lazily on first observation).
 */
export function ObserverIdentityPanel() {
  const [observer, setObserver] = useState<StoredObserver | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const current = getObserver();
    setObserver(current);
    if (!current) return;
    setName(current.displayName);

    fetch("/api/observers/me/summary", {
      headers: { authorization: `Bearer ${current.token}` },
    })
      .then((response) => (response.ok ? (response.json() as Promise<Summary>) : null))
      .then((body) => {
        if (body) setSummary(body);
      })
      .catch(() => {
        // Summary is a nice-to-have; the identity itself still works offline.
      });
  }, []);

  if (deleted) {
    return (
      <Panel>
        <p className="m-0 text-sm">
          Your identity has been deleted from this device and from Rivulet.
        </p>
      </Panel>
    );
  }

  if (!observer) return null;

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      setError("Names must be 2 to 40 characters.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/observers/me", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${observer!.token}`,
        },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!response.ok) {
        setError("Could not rename. Try a different name.");
        return;
      }
      const updated = { ...observer!, displayName: trimmed };
      saveObserver(updated);
      setObserver(updated);
    } catch {
      setError("Could not rename. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteData() {
    setDeleting(true);
    try {
      await fetch("/api/observers/me", {
        method: "DELETE",
        headers: { authorization: `Bearer ${observer!.token}` },
      });
    } catch {
      // Best-effort: the device should forget the identity either way.
    } finally {
      clearObserver();
      setDeleted(true);
      setDeleting(false);
    }
  }

  return (
    <Panel>
      <p className="field-label m-0">Your field name</p>
      <h2 className="mt-2 mb-3 text-2xl">{observer.displayName}</h2>

      {summary && (
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="field-label">Trust</dt>
            <dd className="num m-0 mt-0.5">{Math.round(summary.trust * 100)}%</dd>
          </div>
          <div>
            <dt className="field-label">Points</dt>
            <dd className="num m-0 mt-0.5">{summary.points}</dd>
          </div>
          <div>
            <dt className="field-label">Rank</dt>
            <dd className="num m-0 mt-0.5">
              {summary.rank ? `#${summary.rank}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="field-label">Streams</dt>
            <dd className="num m-0 mt-0.5">{summary.streamsCovered}</dd>
          </div>
        </dl>
      )}

      <form onSubmit={rename} className="mt-5 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Rename your pseudonym
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={40}
            className="min-h-11 rounded-sm border border-rule-strong bg-paper px-3 py-2 text-ink"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? "Saving…" : "Save name"}
        </Button>
      </form>
      {error && <p className="mt-2 mb-0 text-sm text-ink-muted">{error}</p>}

      <div className="mt-6 border-t border-rule pt-4">
        {confirmingDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 text-sm">
              Delete your identity? This cannot be undone.
            </p>
            <Button variant="secondary" onClick={deleteData} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmingDelete(true)}>
            Delete my data
          </Button>
        )}
        <p className="mt-2 mb-0 text-xs text-ink-muted">
          Removes your pseudonymous identity from Rivulet. Your past
          observations keep their data but are no longer linked to you.
        </p>
      </div>
    </Panel>
  );
}
