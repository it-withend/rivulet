"use client";

import { useState } from "react";
import { METHOD_VERSION } from "@/lib/science/method-version";
import { METHOD_PARAMETERS } from "@/lib/science/method-parameters";
import type { Snapshot } from "@/lib/science/snapshot";

export function ScoreDisclosure({ snapshot }: { snapshot: Snapshot }) {
  const [open, setOpen] = useState(false);
  const priors = METHOD_PARAMETERS.filter((p) => p.kind === "prior");

  return (
    <div className="rounded-md border border-rule bg-paper-raised">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between px-5 py-3 text-left text-[0.9375rem] font-medium text-ink"
      >
        Why this score?
        <span aria-hidden="true" className="text-ink-muted">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-rule px-5 py-5 text-sm">
          <section>
            <h3 className="field-label m-0">Inputs</h3>
            <p className="mt-1 mb-0 text-ink-muted">
              <span className="num">{snapshot.observationCount}</span>{" "}
              observations from{" "}
              <span className="num">{snapshot.uniqueObservers}</span>{" "}
              observers, combined with a total effective weight of{" "}
              <span className="num">
                {snapshot.posterior.effectiveN.toFixed(2)}
              </span>
              .
            </p>
          </section>

          <section>
            <h3 className="field-label m-0">Calculation</h3>
            <p className="mt-1 mb-0 text-ink-muted">
              Each observation contributes weighted pseudo-counts to a Beta
              posterior. Current parameters are alpha ={" "}
              <span className="num">
                {snapshot.posterior.alpha.toFixed(2)}
              </span>{" "}
              and beta ={" "}
              <span className="num">{snapshot.posterior.beta.toFixed(2)}</span>
              , giving a mean of{" "}
              <span className="num">{snapshot.posterior.mean.toFixed(3)}</span>{" "}
              with a 90% credible interval of{" "}
              <span className="num">
                {snapshot.posterior.lower.toFixed(3)}
              </span>{" "}
              to{" "}
              <span className="num">
                {snapshot.posterior.upper.toFixed(3)}
              </span>
              .
            </p>
          </section>

          <section>
            <h3 className="field-label m-0">Class probabilities</h3>
            <ul className="m-0 mt-1 list-none space-y-0.5 p-0 text-ink-muted">
              {Object.entries(snapshot.assessment.probabilities).map(
                ([klass, probability]) => (
                  <li key={klass}>
                    {klass}:{" "}
                    <span className="num">
                      {(probability * 100).toFixed(1)}%
                    </span>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section>
            <h3 className="field-label m-0">
              Method version <span className="num">{snapshot.methodVersion}</span>
            </h3>
            <ul className="m-0 mt-1 list-disc space-y-1 pl-5 text-ink-muted">
              {METHOD_VERSION.citations.map((citation) => (
                <li key={citation}>{citation}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-base font-display font-medium text-ink">
              Assumptions not yet calibrated
            </h3>
            <p className="mt-1 mb-2 text-ink-muted">
              These values are expert-judgement starting points. We will
              calibrate them against official water-quality measurements.
            </p>
            <ul
              data-testid="priors"
              className="m-0 list-disc space-y-2 pl-5 text-ink-muted"
            >
              {priors.map((p) => (
                <li key={p.id}>
                  {p.rationale}
                  {typeof p.value === "number" && (
                    <>
                      {" "}
                      (<span className="num">{p.value}</span>)
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-ink-muted">
            These are proxy estimates derived from citizen observations, not
            laboratory measurements.
          </p>
        </div>
      )}
    </div>
  );
}
