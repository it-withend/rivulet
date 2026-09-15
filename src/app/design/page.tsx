"use client";

import { useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { ForelUleRibbon } from "@/components/ui/ForelUleRibbon";

const BASE_TOKENS = [
  { name: "paper", hex: "#eeede5", note: "Ground" },
  { name: "paper-raised", hex: "#f7f6f1", note: "Panels, inputs" },
  { name: "ink", hex: "#151b1c", note: "Text · 14.8:1 on paper" },
  { name: "ink-muted", hex: "#3b4546", note: "Secondary text · 8.4:1" },
  { name: "rule", hex: "#c8c6bb", note: "Hairlines" },
  { name: "rule-strong", hex: "#8a887e", note: "Control borders" },
  { name: "river", hex: "#185157", note: "Accent, primary action" },
  { name: "river-deep", hex: "#113c41", note: "Accent hover" },
] as const;

const STATUS_TOKENS = [
  { name: "wfd-high", label: "High", hex: "#1a9641" },
  { name: "wfd-good", label: "Good", hex: "#a6d96a" },
  { name: "wfd-moderate", label: "Moderate", hex: "#ffffbf" },
  { name: "wfd-poor", label: "Poor", hex: "#fdae61" },
  { name: "wfd-bad", label: "Bad", hex: "#d7191c" },
] as const;

const SIGNS = ["Foam", "Sewage smell", "Litter", "Oily sheen", "Dead fish"];

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule py-10 sm:grid sm:grid-cols-[11rem_1fr] sm:gap-8">
      <header className="mb-6 sm:mb-0">
        <p className="field-label m-0">{label}</p>
        <h2 className="mt-1 text-2xl">{title}</h2>
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  const [signs, setSigns] = useState<string[]>(["Foam"]);
  const toggle = (s: string) =>
    setSigns((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-12 sm:px-6">
      <p className="field-label m-0">Reference · v1</p>
      <h1 className="mt-2 mb-3 text-5xl sm:text-6xl">Design system</h1>
      <p className="m-0 max-w-xl text-ink-muted">
        Every token and component Rivulet screens are built from. If a screen
        needs something that is not on this page, add it here first.
      </p>

      <Section label="Signature" title="Forel–Ule scale">
        <p className="mt-0 max-w-xl">
          The 21 reference colours of water, from indigo blue to cola brown.
          They mean water colour and nothing else.
        </p>
        <div className="space-y-10">
          <div>
            <p className="field-label mb-1">Header strip · size sm</p>
            <ForelUleRibbon size="sm" />
          </div>
          <div>
            <p className="field-label mb-1">Scale · size md</p>
            <ForelUleRibbon />
          </div>
          <div>
            <p className="field-label mb-1">
              Current reading · <data value="9">FU 9</data>
            </p>
            <ForelUleRibbon active={9} />
          </div>
          <div>
            <p className="field-label mb-1">
              Journal collection · <data value="6">6</data> of 21
            </p>
            <ForelUleRibbon collected={[2, 5, 6, 9, 13, 17]} />
          </div>
          <div>
            <p className="field-label mb-1">Collection with current reading</p>
            <ForelUleRibbon active={13} collected={[2, 5, 6, 9, 13, 17]} />
          </div>
        </div>
      </Section>

      <Section label="Type" title="Three families">
        <div className="space-y-6">
          <div>
            <p className="field-label mb-1">Display · Newsreader</p>
            <p className="m-0 font-display text-6xl font-medium italic leading-none">
              Ribeira de Coselhas
            </p>
            <p className="mt-2 mb-0 font-display text-4xl leading-tight">
              Heading two, set in Newsreader
            </p>
            <p className="mt-2 mb-0 font-display text-2xl leading-tight">
              Heading three, for panels and steps
            </p>
          </div>
          <div>
            <p className="field-label mb-1">Interface · IBM Plex Sans</p>
            <p className="m-0 max-w-xl text-lg">
              Stand where you can see the water surface without glare. Hold the
              phone flat above the stream and fill the frame with water.
            </p>
            <p className="mt-2 mb-0 max-w-xl text-sm text-ink-muted">
              Secondary text for hints and captions. Still above 7:1 on paper.
            </p>
          </div>
          <div>
            <p className="field-label mb-1">Data · IBM Plex Mono</p>
            <p className="num m-0 text-3xl">
              FU <data value="9">09</data> · hue <data value="88.41">88.41°</data>
            </p>
            <p className="num mt-2 mb-0 text-base text-ink-muted">
              P(good or better) = <data value="0.62">0.62</data> · 90% CI{" "}
              <data value="0.41">0.41</data>–<data value="0.80">0.80</data>
            </p>
          </div>
        </div>
      </Section>

      <Section label="Colour" title="Tokens">
        <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-5 p-0 sm:grid-cols-4">
          {BASE_TOKENS.map((t) => (
            <li key={t.name}>
              <span
                className="block h-14 rounded-sm border border-rule"
                style={{ backgroundColor: `var(--color-${t.name})` }}
              />
              <p className="num mt-2 mb-0 text-sm text-ink">--color-{t.name}</p>
              <p className="num m-0 text-xs text-ink-muted">{t.hex}</p>
              <p className="m-0 text-xs text-ink-muted">{t.note}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Status" title="Ecological status">
        <p className="mt-0 max-w-xl">
          Reserved for Water Framework Directive classes. Missing evidence is
          grey and hatched, and never takes a class colour.
        </p>
        <ul className="m-0 grid list-none grid-cols-3 gap-x-3 gap-y-5 p-0 sm:grid-cols-6">
          {STATUS_TOKENS.map((t) => (
            <li key={t.name}>
              <span
                className="block h-14 rounded-sm border border-rule"
                style={{ backgroundColor: `var(--color-${t.name})` }}
              />
              <p className="mt-2 mb-0 text-sm font-medium">{t.label}</p>
              <p className="num m-0 text-xs text-ink-muted">{t.hex}</p>
            </li>
          ))}
          <li className="sm:border-l sm:border-rule sm:pl-3">
            <span className="hatch-insufficient block h-14 rounded-sm border border-rule" />
            <p className="mt-2 mb-0 text-sm font-medium">Insufficient data</p>
            <p className="num m-0 text-xs text-ink-muted">#9e9e9e</p>
          </li>
        </ul>
      </Section>

      <Section label="Actions" title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Record an observation</Button>
          <Button variant="secondary">Skip this step</Button>
          <Button href="/map">See the map</Button>
          <Button variant="secondary" href="/open-data">
            Download open data
          </Button>
          <Button disabled>Send observation</Button>
        </div>
        <p className="mt-4 mb-0 text-sm text-ink-muted">
          Primary, secondary, as links, and disabled. Tab through to see the
          focus ring. Every control is at least 44px tall.
        </p>
      </Section>

      <Section label="Choices" title="Chips">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-3 p-0 text-base">What do you notice?</legend>
          <div className="flex flex-wrap gap-2">
            {SIGNS.map((s) => (
              <Chip key={s} pressed={signs.includes(s)} onClick={() => toggle(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section label="Surfaces" title="Panels">
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel>
            <p className="field-label m-0">Tone paper</p>
            <h3 className="mt-2 mb-2 text-2xl">Your reading</h3>
            <p className="num m-0 text-4xl">
              FU <data value="9">9</data>
            </p>
            <p className="mt-1 mb-0 text-sm text-ink-muted">
              Green — noticeable algae
            </p>
          </Panel>
          <Panel tone="ink">
            <p className="field-label m-0">Tone ink</p>
            <h3 className="mt-2 mb-2 text-2xl">Why this score?</h3>
            <p className="m-0 text-sm">
              Three observations in 30 days. The interval stays wide until more
              evidence arrives.
            </p>
          </Panel>
        </div>
      </Section>
    </div>
  );
}
