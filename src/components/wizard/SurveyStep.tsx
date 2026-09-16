"use client";

import type React from "react";
import { Bug, Droplets, Eye, Fish, Sprout, Trash2, Waves, Wind, CloudFog } from "lucide-react";
import type { SurveyAnswers, TaxonCode } from "@/types/observation";
import { Chip } from "@/components/ui/Chip";
import { CLARITIES, FLOWS, LITTER, ODOURS, SIGNS, TAXA } from "./survey-options";

type Props = {
  value: SurveyAnswers;
  onChange: (next: SurveyAnswers) => void;
};

const SIGN_ICON: Record<(typeof SIGNS)[number][0], React.ReactNode> = {
  foam: <CloudFog />,
  deadFish: <Fish />,
  visibleAlgae: <Sprout />,
};

function Question({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-3 flex items-center gap-3 p-0 text-base font-medium">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-river text-paper [&_svg]:size-5"
        >
          {icon}
        </span>
        {title}
      </legend>
      {hint && <p className="mt-0 mb-3 max-w-xl text-sm text-ink-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function SurveyStep({ value, onChange }: Props) {
  function toggleTaxon(code: TaxonCode) {
    const has = value.indicatorTaxa.includes(code);
    onChange({
      ...value,
      indicatorTaxa: has
        ? value.indicatorTaxa.filter((t) => t !== code)
        : [...value.indicatorTaxa, code],
    });
  }

  return (
    <div className="space-y-8">
      <p className="m-0 max-w-xl text-sm text-ink-muted">
        Tap what matches. There are no wrong answers — just tell us what you
        notice from the bank.
      </p>

      <Question icon={<Wind />} title="Does the water smell?">
        {ODOURS.map((odour) => (
          <Chip
            key={odour.value}
            pressed={value.odour === odour.value}
            onClick={() => onChange({ ...value, odour: odour.value })}
          >
            {odour.label}
          </Chip>
        ))}
      </Question>

      <Question icon={<Droplets />} title="How clear is the water?">
        {CLARITIES.map((clarity) => (
          <Chip
            key={clarity.value}
            pressed={value.clarity === clarity.value}
            onClick={() => onChange({ ...value, clarity: clarity.value })}
          >
            {clarity.label}
          </Chip>
        ))}
      </Question>

      <Question icon={<Waves />} title="Is the water moving?">
        {FLOWS.map((flow) => (
          <Chip
            key={flow.value}
            pressed={value.flow === flow.value}
            onClick={() => onChange({ ...value, flow: flow.value })}
          >
            {flow.label}
          </Chip>
        ))}
      </Question>

      <Question icon={<Trash2 />} title="Any litter in or beside the water?">
        {LITTER.map((level) => (
          <Chip
            key={level.value}
            pressed={value.litter === level.value}
            onClick={() => onChange({ ...value, litter: level.value })}
          >
            {level.label}
          </Chip>
        ))}
      </Question>

      <Question icon={<Eye />} title="Did you notice any of these?" hint="Tap all that apply, or none.">
        {SIGNS.map(([key, label]) => (
          <Chip
            key={key}
            icon={SIGN_ICON[key]}
            pressed={value[key]}
            onClick={() => onChange({ ...value, [key]: !value[key] })}
          >
            {label}
          </Chip>
        ))}
      </Question>

      <Question
        icon={<Bug />}
        title="Small creatures under stones (optional)"
        hint="Only if you looked: lift a stone near the edge without stepping in. Some of these animals only live in clean water."
      >
        {TAXA.map((taxon) => (
          <Chip
            key={taxon.code}
            pressed={value.indicatorTaxa.includes(taxon.code)}
            onClick={() => toggleTaxon(taxon.code)}
          >
            {taxon.label}
          </Chip>
        ))}
      </Question>
    </div>
  );
}
