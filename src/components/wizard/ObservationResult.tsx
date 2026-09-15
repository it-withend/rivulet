import { Button } from "@/components/ui/Button";
import { ForelUleRibbon } from "@/components/ui/ForelUleRibbon";
import { Panel } from "@/components/ui/Panel";
import { CLASS_LABEL } from "@/lib/ui/wfd-colours";
import type { AssessmentDelta } from "@/lib/science/delta";
import type { Badge } from "@/lib/journal/journal";

export type ObservationResultProps = {
  waterbodyId: string;
  waterbodyName: string;
  forelUle: number | null;
  delta: AssessmentDelta;
  newBadges: Badge[];
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function ObservationResult({
  waterbodyId,
  waterbodyName,
  forelUle,
  delta,
  newBadges,
}: ObservationResultProps) {
  return (
    <section aria-live="polite" className="space-y-6">
      <header>
        <p className="field-label m-0">Observation recorded</p>
        <h2 className="mt-2 mb-0 text-3xl">{waterbodyName}</h2>
      </header>

      {forelUle !== null && (
        <div className="space-y-2">
          <ForelUleRibbon active={forelUle} size="md" />
          <p className="m-0 text-sm text-ink-muted">
            Forel–Ule <span className="num">{forelUle}</span> is now in your
            colour collection.
          </p>
        </div>
      )}

      <Panel>
        <p data-testid="confidence-change" className="num m-0 text-base">
          Confidence in this stream&apos;s assessment:{" "}
          {percent(delta.before.confidence)} → {percent(delta.after.confidence)}
        </p>

        {delta.wasDataGap && (
          <p data-testid="data-gap" className="mt-3 mb-0 text-sm">
            This stream had too little data to assess. Observations like
            yours are exactly what closes that gap.
          </p>
        )}

        {delta.classChanged && delta.after.klass && (
          <p data-testid="class-change" className="mt-3 mb-0 text-sm">
            Its ecological status now reads{" "}
            <strong>{CLASS_LABEL[delta.after.klass]}</strong>.
          </p>
        )}
      </Panel>

      {newBadges.length > 0 && (
        <div className="space-y-3">
          <h3 className="m-0 text-xl">New in your field journal</h3>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {newBadges.map((badge) => (
              <li key={badge.code}>
                <Panel tone="ink" className="p-4">
                  <p className="m-0 text-base font-medium">{badge.title}</p>
                  <p className="mt-1 mb-0 text-sm">{badge.description}</p>
                </Panel>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button href="/journal">Open your field journal</Button>
        <Button href={`/water/${waterbodyId}`} variant="secondary">
          See this stream
        </Button>
      </div>
    </section>
  );
}
