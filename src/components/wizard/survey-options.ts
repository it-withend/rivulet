import type { SurveyAnswers, TaxonCode } from "@/types/observation";

/** Plain-language answers, shared by the survey and the review step so both say the same thing. */
export const TAXA: { code: TaxonCode; label: string }[] = [
  { code: "mayfly", label: "Mayfly nymph" },
  { code: "stonefly", label: "Stonefly nymph" },
  { code: "caddisfly", label: "Caddisfly larva" },
  { code: "freshwater_shrimp", label: "Freshwater shrimp" },
  { code: "leech", label: "Leech" },
  { code: "worm", label: "Sludge worm" },
  { code: "none_seen", label: "Nothing seen" },
];

export const ODOURS = [
  { value: "none", label: "No smell" },
  { value: "musty", label: "Earthy or musty" },
  { value: "sewage", label: "Sewage or rotten eggs" },
  { value: "chemical", label: "Chemical, like fuel or bleach" },
] as const;

export const CLARITIES = [
  { value: "clear", label: "Clear, I can see the bottom" },
  { value: "slightly_turbid", label: "A bit cloudy" },
  { value: "turbid", label: "Cloudy" },
  { value: "opaque", label: "Can't see into it at all" },
] as const;

export const FLOWS = [
  { value: "normal", label: "Flowing" },
  { value: "high", label: "Fast, after rain" },
  { value: "low", label: "Barely moving" },
  { value: "stagnant", label: "Not moving at all" },
] as const;

export const LITTER = [
  { value: 0, label: "None" },
  { value: 1, label: "A few pieces" },
  { value: 2, label: "Quite a lot" },
  { value: 3, label: "Piles of rubbish" },
] as const;

export const SIGNS = [
  ["foam", "Foam on the surface"],
  ["deadFish", "Dead fish"],
  ["visibleAlgae", "Green algae or scum"],
] as const;

export function labelFor<T extends { value: unknown; label: string }>(
  options: readonly T[],
  value: unknown,
): string {
  return options.find((o) => o.value === value)?.label ?? String(value);
}

export function signsSeen(answers: SurveyAnswers): string[] {
  return SIGNS.filter(([key]) => answers[key]).map(([, label]) => label);
}
