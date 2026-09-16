"use client";

import type { SurveyAnswers, TaxonCode } from "@/types/observation";
import { Chip } from "@/components/ui/Chip";

type Props = {
  value: SurveyAnswers;
  onChange: (next: SurveyAnswers) => void;
};

const TAXA: { code: TaxonCode; label: string }[] = [
  { code: "mayfly", label: "Mayfly nymph" },
  { code: "stonefly", label: "Stonefly nymph" },
  { code: "caddisfly", label: "Caddisfly larva" },
  { code: "freshwater_shrimp", label: "Freshwater shrimp" },
  { code: "leech", label: "Leech" },
  { code: "worm", label: "Sludge worm" },
  { code: "none_seen", label: "Nothing seen" },
];

const ODOURS = [
  { value: "none", label: "No smell" },
  { value: "musty", label: "Earthy or musty" },
  { value: "sewage", label: "Sewage or rotten eggs" },
  { value: "chemical", label: "Chemical, like fuel or bleach" },
] as const;

const CLARITIES = [
  { value: "clear", label: "Clear, I can see the bottom" },
  { value: "slightly_turbid", label: "A bit cloudy" },
  { value: "turbid", label: "Cloudy" },
  { value: "opaque", label: "Can't see into it at all" },
] as const;

const FLOWS = [
  { value: "normal", label: "Flowing" },
  { value: "high", label: "Fast, after rain" },
  { value: "low", label: "Barely moving" },
  { value: "stagnant", label: "Not moving at all" },
] as const;

const LITTER = [
  { value: 0, label: "None" },
  { value: 1, label: "A few pieces" },
  { value: 2, label: "Quite a lot" },
  { value: 3, label: "Piles of rubbish" },
] as const;

const SIGNS = [
  ["foam", "Foam on the surface"],
  ["deadFish", "Dead fish"],
  ["visibleAlgae", "Green algae or scum"],
] as const;

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
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-3 p-0 text-base font-medium">
          Does the water smell?
        </legend>
        <div className="flex flex-wrap gap-2">
          {ODOURS.map((odour) => (
            <Chip
              key={odour.value}
              pressed={value.odour === odour.value}
              onClick={() => onChange({ ...value, odour: odour.value })}
            >
              {odour.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-3 p-0 text-base font-medium">
          How clear is the water?
        </legend>
        <div className="flex flex-wrap gap-2">
          {CLARITIES.map((clarity) => (
            <Chip
              key={clarity.value}
              pressed={value.clarity === clarity.value}
              onClick={() => onChange({ ...value, clarity: clarity.value })}
            >
              {clarity.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-3 p-0 text-base font-medium">
          Is the water moving?
        </legend>
        <div className="flex flex-wrap gap-2">
          {FLOWS.map((flow) => (
            <Chip
              key={flow.value}
              pressed={value.flow === flow.value}
              onClick={() => onChange({ ...value, flow: flow.value })}
            >
              {flow.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-3 p-0 text-base font-medium">
          Any litter in or beside the water?
        </legend>
        <div className="flex flex-wrap gap-2">
          {LITTER.map((level) => (
            <Chip
              key={level.value}
              pressed={value.litter === level.value}
              onClick={() => onChange({ ...value, litter: level.value })}
            >
              {level.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 p-0 text-base font-medium">
          Did you see any of these small creatures?
        </legend>
        <p className="mt-0 mb-3 max-w-xl text-sm text-ink-muted">
          Optional. Lift a stone and look underneath. Some of these animals
          only live in clean water, so they tell us a lot about it. Skip this
          if you did not look.
        </p>
        <div className="flex flex-wrap gap-2">
          {TAXA.map((taxon) => (
            <Chip
              key={taxon.code}
              pressed={value.indicatorTaxa.includes(taxon.code)}
              onClick={() => toggleTaxon(taxon.code)}
            >
              {taxon.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-3 p-0 text-base font-medium">
          Anything else you noticed?
        </legend>
        <div className="flex flex-wrap gap-2">
          {SIGNS.map(([key, label]) => (
            <Chip
              key={key}
              pressed={value[key]}
              onClick={() => onChange({ ...value, [key]: !value[key] })}
            >
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
