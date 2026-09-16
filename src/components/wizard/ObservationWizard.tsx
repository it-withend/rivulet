"use client";

import { useState } from "react";
import { PhotoStep, type ForelUleResult } from "./PhotoStep";
import { SurveyStep } from "./SurveyStep";
import { ObservationResult, type ObservationResultProps } from "./ObservationResult";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { appendEntry, loadJournal } from "@/lib/journal/storage";
import { evaluateBadges, newlyEarned, type JournalEntry } from "@/lib/journal/journal";
import { ensureObserver } from "@/lib/identity/client";
import type { AssessmentDelta } from "@/lib/science/delta";
import type { SurveyAnswers } from "@/types/observation";

const EMPTY: SurveyAnswers = {
  odour: "none",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: [],
  forelUle: null,
  measurements: {},
};

const STEPS = ["Photo", "What you see", "Send"];

export function ObservationWizard({ waterbodyId }: { waterbodyId: string }) {
  const [step, setStep] = useState(0);
  const [survey, setSurvey] = useState<SurveyAnswers>(EMPTY);
  const [fu, setFu] = useState<ForelUleResult | null>(null);
  const [result, setResult] = useState<ObservationResultProps | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSubmitting(true);

    const position = await new Promise<GeolocationPosition | null>((resolve) =>
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: true,
        timeout: 8000,
      }),
    );

    if (!position) {
      setError("We need your location to attach the observation to a stream.");
      setSubmitting(false);
      return;
    }

    try {
      const observer = await ensureObserver();

      const response = await fetch("/api/observations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(observer ? { authorization: `Bearer ${observer.token}` } : {}),
        },
        body: JSON.stringify({
          waterbodyId,
          observedAt: new Date().toISOString(),
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          gpsAccuracyM: Math.round(position.coords.accuracy),
          forelUleIndex: fu?.index ?? null,
          forelUleConfidence: fu?.confidence ?? null,
          survey: { ...survey, forelUle: fu?.index ?? null },
        }),
      });

      if (!response.ok) {
        setError("We could not save your observation. Please try again.");
        return;
      }

      const body = (await response.json()) as {
        id: string;
        waterbodyName: string;
        heldForReview: boolean;
        delta: AssessmentDelta;
      };

      const entry: JournalEntry = {
        observationId: body.id,
        waterbodyId,
        waterbodyName: body.waterbodyName,
        observedAt: new Date().toISOString(),
        forelUle: fu?.index ?? null,
        indicatorTaxa: survey.indicatorTaxa,
        visibleAlgae: survey.visibleAlgae,
        wasDataGap: body.delta.wasDataGap,
      };

      const before = loadJournal();
      const after = appendEntry(entry);
      const unlocked = newlyEarned(before, after);

      setResult({
        waterbodyId,
        waterbodyName: body.waterbodyName,
        forelUle: entry.forelUle,
        delta: body.delta,
        heldForReview: body.heldForReview,
        newBadges: evaluateBadges(after).filter((b) => unlocked.includes(b.code)),
      });
    } catch {
      setError("We could not save your observation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <ObservationResult {...result} />;
  }

  return (
    <div className="space-y-6">
      <ol className="m-0 flex list-none gap-4 p-0">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={
              "field-label " + (i === step ? "text-ink" : "text-ink-muted")
            }
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && <PhotoStep onResult={setFu} />}
      {step === 1 && <SurveyStep value={survey} onChange={setSurvey} />}
      {step === 2 && (
        <div className="space-y-4">
          <p className="m-0 max-w-xl text-sm text-ink-muted">
            Your photo never leaves your phone — only the colour reading is
            sent. Your location attaches this observation to the stream, and
            we never publish your exact position.
          </p>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Sending…" : "Send observation"}
          </Button>
          {error && (
            <Panel>
              <p className="m-0 text-sm">{error}</p>
            </Panel>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < 2 && (
          <Button onClick={() => setStep(step + 1)}>Continue</Button>
        )}
      </div>
    </div>
  );
}
