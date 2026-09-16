"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ForelUleRibbon } from "./ForelUleRibbon";

const NAV = [
  { href: "/map", label: "Map" },
  { href: "/observe", label: "Record" },
  { href: "/journal", label: "Journal" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/open-data", label: "Open data" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-10 focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-baseline gap-2 py-2 text-ink no-underline"
        >
          <span className="font-display text-[1.625rem] font-medium italic leading-none tracking-tight">
            Rivulet
          </span>
          <span className="field-label hidden sm:inline">urban streams</span>
        </Link>
        <nav aria-label="Main" className="-mx-2 w-full sm:mx-0 sm:w-auto">
          <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0">
            {NAV.map((item) => {
              const current =
                pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={
                      "flex min-h-11 items-center whitespace-nowrap border-b-2 px-2 text-[0.9375rem] no-underline " +
                      (current
                        ? "border-river font-medium text-ink"
                        : "border-transparent text-ink-muted hover:border-rule-strong hover:text-ink")
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      {/* The scale as a thin signature strip; decorative here, so hidden from assistive tech */}
      <div aria-hidden="true">
        <ForelUleRibbon size="sm" />
      </div>
    </header>
  );
}
