import { Bug, Compass, Droplet, Leaf, Palette, Repeat, Target, type LucideIcon } from "lucide-react";
import type { BadgeCode } from "@/lib/journal/journal";
import type { RarityKey } from "@/lib/journal/badge-stats";

export const BADGE_ICON: Record<BadgeCode, LucideIcon> = {
  "first-observation": Droplet,
  "colour-collector": Palette,
  "clean-water-sentinel": Bug,
  "bloom-spotter": Leaf,
  "stream-explorer": Compass,
  "returning-guardian": Repeat,
  "gap-filler": Target,
};

/** A dot colour per rarity, from plain to precious, using the site's own palette. */
export const RARITY_COLOUR: Record<RarityKey, string> = {
  common: "#8a8f8f",
  uncommon: "#185157",
  rare: "#dd7a34",
  legendary: "#e3b53c",
};
