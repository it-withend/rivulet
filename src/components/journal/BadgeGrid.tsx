"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import type { Badge } from "@/lib/journal/journal";
import { rarityOf, type BadgeStats } from "@/lib/journal/badge-stats";
import { BADGE_ICON, RARITY_COLOUR } from "./badge-meta";

function shareLabel(share: number, count: number): string {
  if (count === 0) return "Nobody has earned this yet";
  const pct = share * 100;
  return `Earned by ${pct < 1 ? "<1" : Math.round(pct)}% of observers`;
}

/**
 * The badges as cards: an icon, what it takes, how far along you are, and how
 * rare it is among everyone who has reported. The rarity comes from a cached
 * route; until it arrives the cards simply omit it.
 */
export function BadgeGrid({ badges }: { badges: Badge[] }) {
  const [stats, setStats] = useState<BadgeStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/badges/stats")
      .then((response) => (response.ok ? (response.json() as Promise<BadgeStats>) : null))
      .then((body) => {
        if (!cancelled && body) setStats(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
        {badges.map((badge) => {
          const Icon = BADGE_ICON[badge.code];
          const count = stats?.counts[badge.code] ?? 0;
          const share = stats && stats.observers > 0 ? count / stats.observers : 0;
          const tier = stats ? rarityOf(share) : null;
          const pct = Math.round((badge.progress.value / badge.progress.target) * 100);

          return (
            <li key={badge.code} data-earned={badge.earned}>
              <div
                className={
                  "flex h-full gap-3 rounded-md border p-4 " +
                  (badge.earned
                    ? "border-ink bg-ink text-paper"
                    : "border-dashed border-rule-strong bg-paper-raised text-ink-muted")
                }
              >
                <span
                  aria-hidden="true"
                  className={
                    "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full border " +
                    (badge.earned ? "border-paper/40 bg-paper/10 text-[#e3b53c]" : "border-rule-strong text-ink-muted")
                  }
                >
                  <Icon className="size-6" />
                  {!badge.earned && (
                    <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full border border-rule-strong bg-paper-raised">
                      <Lock className="size-3" />
                    </span>
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="m-0 text-base font-medium">{badge.title}</p>
                  <p className="mt-1 mb-0 text-sm">{badge.description}</p>

                  {badge.earned ? (
                    <p className="num mt-2 mb-0 text-xs text-paper/70">Earned</p>
                  ) : (
                    <div className="mt-2">
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={badge.progress.target}
                        aria-valuenow={badge.progress.value}
                        aria-label={`${badge.title} progress`}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-rule"
                      >
                        <div className="h-full bg-river" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="num m-0 mt-1 text-xs">
                        {badge.progress.value} of {badge.progress.target}
                      </p>
                    </div>
                  )}

                  {stats && tier && (
                    <p className={"m-0 mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs " + (badge.earned ? "text-paper/80" : "")}>
                      <span
                        aria-hidden="true"
                        className="inline-block size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: RARITY_COLOUR[tier.key] }}
                      />
                      <span className="whitespace-nowrap font-medium">{count === 0 ? "Unclaimed" : tier.label}</span>
                      <span>· {shareLabel(share, count)}</span>
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {stats && stats.observers > 0 && (
        <p className="m-0 text-xs text-ink-muted">
          Shares are out of {stats.observers} observers with a validated report
          {stats.demoObservers > 0 ? `, ${stats.demoObservers} of them demonstration observers while the pilot collects real ones` : ""}
          . Rare is under 20% and very rare under 5%.
        </p>
      )}
    </div>
  );
}
