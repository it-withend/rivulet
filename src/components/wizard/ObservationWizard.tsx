"use client";

import { useState } from "react";
import type React from "react";
import {
  Camera,
  Clock,
  CloudOff,
  Eye,
  EyeOff,
  MapPin,
  Send,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import { PhotoStep, type ForelUleResult } from "./PhotoStep";
import { SurveyStep } from "./SurveyStep";
import { ObservationResult, type ObservationResultProps } from "./ObservationResult";
import { CLARITIES, FLOWS, LITTER, ODOURS, TAXA, labelFor, signsSeen } from "./survey-options";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { appendEntry, loadJournal } from "@/lib/journal/storage";
import { evaluateBadges, newlyEarned, type JournalEntry } from "@/lib/journal/journal";
import { ensureObserver } from "@/lib/identity/client";
import { enqueueReport } from "@/lib/offline/report-queue";
import { FU_TABLE } from "@/lib/science/forel-ule-table";
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

const STEPS = [
  { label: "Before you start", icon: ShieldCheck },
  { label: "Photo", icon: Camera },
  { label: "What you notice", icon: Eye },
  { label: "Check and send", icon: ListChecks },
] as const;

function Tip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-rule bg-paper text-river [&_svg]:size-5"
      >
        {icon}
      </span>
      <span className="pt-1.5 text-[0.9375rem]">{children}</span>
    </li>
  );
}

export function ObservationWizard({
  waterbodyId,
  waterbodyName,
}: {
  waterbodyId: string;
  waterbodyName?: string;
}) {
  const [step, setStep] = useState(0);
  const [survey, setSurvey] = useState<SurveyAnswers>(EMPTY);
  const [fu, setFu] = useState<ForelUleResult | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [result, setResult] = useState<ObservationResultProps | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

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
      setError(
        "We need your location to link this report to the stream. Please allow location for this site in your browser, then press Send again.",
      );
      setSubmitting(false);
      return;
    }

    const payload = {
      waterbodyId,
      observedAt: new Date().toISOString(),
      longitude: position.coords.longitude,
      latitude: position.coords.latitude,
      gpsAccuracyM: Math.round(position.coords.accuracy),
      forelUleIndex: fu?.index ?? null,
      forelUleConfidence: fu?.confidence ?? null,
      survey: { ...survey, forelUle: fu?.index ?? null },
      ...(thumbnail ? { photoThumbnail: thumbnail } : {}),
    };

    // No connection at the stream: keep the report on this phone and send it later.
    function saveForLater() {
      if (enqueueReport(payload)) setQueued(true);
      else setError("You are offline and this browser cannot store the report. Please try again with a connection.");
    }

    if (!navigator.onLine) {
      saveForLater();
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
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError("We could not save your report. Please check your connection and try again.");
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
    } catch (failure) {
      // fetch rejects with a TypeError when the network is unreachable.
      if (failure instanceof TypeError) saveForLater();
      else setError("We could not save your report. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <ObservationResult {...result} />;
  }

  if (queued) {
    return (
      <div className="space-y-4 rounded-md border border-river/40 bg-paper-raised p-5" role="status">
        <p className="m-0 flex items-center gap-2 text-lg font-medium">
          <CloudOff aria-hidden="true" className="size-5 text-river" />
          Saved on this phone
        </p>
        <p className="m-0 text-ink-muted">
          There is no connection right now, so your report is waiting on this phone. It keeps the time you made it
          and is sent by itself as soon as you are back online. You do not need to do anything.
        </p>
        <Button href="/map" variant="secondary">
          Back to the map
        </Button>
      </div>
    );
  }

  const colour = fu ? FU_TABLE.find((e) => e.index === fu.index) : null;
  const seen = [
    ...signsSeen(survey),
    ...survey.indicatorTaxa.map((t) => labelFor(TAXA.map((x) => ({ value: x.code, label: x.label })), t)),
  ];

  const review: { label: string; value: string; step: number }[] = [
    { label: "Water colour", value: colour ? colour.description : "No photo — that's fine", step: 1 },
    { label: "Smell", value: labelFor(ODOURS, survey.odour), step: 2 },
    { label: "Clarity", value: labelFor(CLARITIES, survey.clarity), step: 2 },
    { label: "Movement", value: labelFor(FLOWS, survey.flow), step: 2 },
    { label: "Litter", value: labelFor(LITTER, survey.litter), step: 2 },
    { label: "Also noticed", value: seen.length > 0 ? seen.join(", ") : "Nothing else", step: 2 },
  ];

  return (
    <div className="space-y-6">
      {waterbodyName && (
        <p className="m-0 flex items-center gap-2 text-ink-muted">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          {waterbodyName}
        </p>
      )}

      <div>
        <ol className="m-0 grid list-none grid-cols-4 gap-2 p-0" aria-label="Steps">
          {STEPS.map(({ label, icon: Icon }, i) => (
            <li
              key={label}
              aria-current={i === step ? "step" : undefined}
              className={"flex flex-col items-center gap-1 text-center " + (i <= step ? "text-ink" : "text-ink-muted")}
            >
              <span
                aria-hidden="true"
                className={
                  "inline-flex size-9 items-center justify-center rounded-full border [&_svg]:size-4.5 " +
                  (i < step
                    ? "border-river bg-river text-paper"
                    : i === step
                      ? "border-ink bg-ink text-paper"
                      : "border-rule bg-paper-raised")
                }
              >
                <Icon />
              </span>
              <span className="text-xs leading-tight">{label}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 h-1 rounded-full bg-rule" aria-hidden="true">
          <div
            className="h-1 rounded-full bg-river transition-[width] duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {step === 0 && (
        <Panel>
          <h2 className="mt-0 mb-4 text-2xl">Thanks for checking this stream</h2>
          <ul className="m-0 list-none space-y-4 p-0">
            <Tip icon={<ShieldCheck />}>
              <strong>Stay safe.</strong> Stay on the bank, never step into the
              water, and wash your hands afterwards.
            </Tip>
            <Tip icon={<Clock />}>
              <strong>About two minutes.</strong> A photo helps, but you can
              skip it.
            </Tip>
            <Tip icon={<EyeOff />}>
              <strong>Your full photo never leaves your phone.</strong> Only
              the water colour we read from it, and a small thumbnail used
              once to check it&apos;s really water, are sent.
            </Tip>
            <Tip icon={<MapPin />}>
              <strong>We ask for your location once, when you send,</strong> to
              check you are at this stream. Your exact position is never shown
              to anyone.
            </Tip>
          </ul>
        </Panel>
      )}
      {step === 1 && <PhotoStep onResult={setFu} onThumbnail={setThumbnail} />}
      {step === 2 && <SurveyStep value={survey} onChange={setSurvey} />}
      {step === 3 && (
        <div className="space-y-4">
          <Panel>
            <h2 className="mt-0 mb-3 text-xl">Is this right?</h2>
            <dl className="m-0 divide-y divide-rule">
              {review.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 py-2.5">
                  <div>
                    <dt className="field-label">{row.label}</dt>
                    <dd className="m-0 mt-0.5">{row.value}</dd>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(row.step)}
                    className="min-h-9 shrink-0 cursor-pointer rounded-sm border border-rule-strong bg-transparent px-2.5 text-sm text-ink hover:border-ink"
                  >
                    Change
                  </button>
                </div>
              ))}
            </dl>
          </Panel>
          <Button onClick={submit} disabled={submitting} className="w-full">
            <Send aria-hidden="true" className="size-4" />
            {submitting ? "Sending…" : "Send my report"}
          </Button>
          {error && (
            <Panel>
              <p className="m-0 text-sm" role="alert">{error}</p>
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
        {step < STEPS.length - 1 && (
          <Button onClick={() => setStep(step + 1)} className="flex-1">
            {step === 0 ? "I'm at the stream — start" : step === 1 && !fu ? "Skip the photo" : "Continue"}
          </Button>
        )}
      </div>
    </div>
  );
}
