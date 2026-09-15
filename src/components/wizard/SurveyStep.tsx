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
  { value: "musty", label: "Musty" },
  { value: "sewage", label: "Sewage" },
  { value: "chemical", label: "Chemical" },
] as const;

const CLARITIES = [
  { value: "clear", label: "Clear" },
  { value: "slightly_turbid", label: "Slightly turbid" },
  { value: "turbid", label: "Turbid" },
  { value: "opaque", label: "Opaque" },
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
        <legend className="mb-1 p-0 text-base font-medium">
          Did you see any of these small creatures?
        </legend>
        <p className="mt-0 mb-3 max-w-xl text-sm text-ink-muted">
          Lift a stone and look underneath. These animals tell us a lot about
          the water.
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
