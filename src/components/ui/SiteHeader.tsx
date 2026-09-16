"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Camera, Map, Trophy } from "lucide-react";
import { ForelUleRibbon } from "./ForelUleRibbon";

const NAV = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/city", label: "City report", icon: BarChart3 },
  { href: "/journal", label: "My journal", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule bg-paper print:hidden">
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
                    <item.icon aria-hidden="true" className="mr-1.5 size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="flex items-center pl-1">
              <Link
                href="/observe"
                aria-current={pathname?.startsWith("/observe") ? "page" : undefined}
                className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-sm bg-river px-3 text-[0.9375rem] font-medium text-paper no-underline hover:bg-river-deep"
              >
                <Camera aria-hidden="true" className="size-4" />
                Check a stream
              </Link>
            </li>
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
