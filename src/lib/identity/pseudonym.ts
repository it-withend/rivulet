// Fixed list of freshwater species a resident of any of the pilot cities
// could plausibly recognise; used only to generate a public pseudonym.
const SPECIES = [
  "Kingfisher",
  "Heron",
  "Otter",
  "Dipper",
  "Mayfly",
  "Caddis",
  "Stonefly",
  "Grayling",
  "Wagtail",
  "Newt",
  "Dragonfly",
  "Damselfly",
  "Water Vole",
  "Trout",
  "Salamander",
  "Moorhen",
  "Egret",
  "Beaver",
] as const;

/** `"<Species> <4 digits>"`, e.g. "Kingfisher 0472". Anonymous by default. */
export function generatePseudonym(random: () => number = Math.random): string {
  const species = SPECIES[Math.floor(random() * SPECIES.length)];
  const digits = Math.floor(random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${species} ${digits}`;
}
