"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ForelUleRibbon } from "@/components/ui/ForelUleRibbon";
import { Panel } from "@/components/ui/Panel";
import {
  colourCollection,
  evaluateBadges,
  type JournalEntry,
} from "@/lib/journal/journal";
import { loadJournal } from "@/lib/journal/storage";
import { ObserverIdentityPanel } from "./ObserverIdentityPanel";
import { CertificatesPanel } from "./CertificatesPanel";
import { Droplet, FileText, Sparkles, Waves } from "lucide-react";

export function FieldJournal() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);

  // localStorage exists only in the browser; reading it during render would
  // make the server HTML disagree with the first client render.
  useEffect(() => {
    setEntries(loadJournal());
  }, []);

  if (entries === null) return null;

  if (entries.length === 0) {
    return (
      <div className="space-y-6">
        <ObserverIdentityPanel />
        <CertificatesPanel />
        <Panel>
          <p className="field-label m-0">Field journal</p>
          <h2 className="mt-2 mb-2 text-2xl">Your journal is empty</h2>
          <p className="m-0 max-w-md text-sm text-ink-muted">
            Record your first observation and it will appear here, along with
            the colour of the water you found.
          </p>
          <div className="mt-4">
            <Button href="/map">Find a stream</Button>
          </div>
        </Panel>
      </div>
    );
  }

  const colours = colourCollection(entries);
  const badges = evaluateBadges(entries);
  const impact = [
    { icon: FileText, value: entries.length, label: entries.length === 1 ? "report sent" : "reports sent" },
    { icon: Waves, value: new Set(entries.map((e) => e.waterbodyId)).size, label: "streams you checked" },
    { icon: Sparkles, value: entries.filter((e) => e.wasDataGap).length, label: "first checks where nobody had looked" },
    { icon: Droplet, value: colours.length, label: "water colours found" },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="impact-heading">
        <h2 id="impact-heading" className="mt-0 mb-3 text-2xl">Your impact</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
          {impact.map(({ icon: Icon, value, label }) => (
            <li key={label} className="rounded-md border border-rule bg-paper-raised p-3">
              <Icon aria-hidden="true" className="size-5 text-river" />
              <p className="num m-0 mt-1 text-2xl">{value}</p>
              <p className="m-0 text-xs text-ink-muted">{label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 mb-0 text-sm text-ink-muted">
          Each report tells neighbours, dog owners and the city a little more
          about how their stream is doing.
        </p>
      </section>

      <ObserverIdentityPanel />
      <CertificatesPanel />

      <section className="space-y-3">
        <p className="field-label m-0">Signature scale</p>
        <h2 className="m-0 text-2xl">Colour collection</h2>
        <p data-testid="colour-count" className="num m-0 text-sm text-ink-muted">
          {colours.length} of 21 water colours found
        </p>
        <ForelUleRibbon collected={colours} size="md" />
      </section>

      <section className="space-y-3">
        <p className="field-label m-0">Recognition</p>
        <h2 className="m-0 text-2xl">Badges</h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {badges.map((badge) => (
            <li key={badge.code} data-earned={badge.earned}>
              <div
                className={
                  "h-full rounded-md border p-4 " +
                  (badge.earned
                    ? "border-ink bg-ink text-paper"
                    : "border-dashed border-rule-strong bg-paper-raised text-ink-muted")
                }
              >
                <p className="m-0 text-base font-medium">{badge.title}</p>
                <p className="mt-1 mb-0 text-sm">{badge.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <p className="field-label m-0">Log</p>
        <h2 className="m-0 text-2xl">Observations</h2>
        <ol className="m-0 list-none space-y-2 p-0">
          {[...entries].reverse().map((e) => (
            <li
              key={e.observationId}
              className="flex flex-wrap items-baseline gap-x-2 border-b border-rule pb-2 text-sm"
            >
              <a href={`/water/${e.waterbodyId}`} className="text-ink">
                {e.waterbodyName}
              </a>
              <time dateTime={e.observedAt} className="num text-ink-muted">
                {e.observedAt.slice(0, 10)}
              </time>
              {e.forelUle !== null && (
                <span className="num text-ink-muted">FU {e.forelUle}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <p className="m-0 max-w-md text-sm text-ink-muted">
        Your journal is stored only on this device. It is a personal record
        and has no effect on how any stream is assessed.
      </p>
    </div>
  );
}
