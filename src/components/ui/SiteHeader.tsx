"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Camera, Map, Trophy } from "lucide-react";
import { ForelUleRibbon } from "./ForelUleRibbon";
import { Logo } from "./Logo";

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
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-2 py-2 text-ink no-underline"
        >
          <Logo className="size-7 shrink-0" />
          <span className="font-display text-[1.625rem] font-medium italic leading-none tracking-tight">
            Rivulet
          </span>
          <span className="field-label hidden sm:inline">urban streams</span>
        </Link>
        {/* Icon-only on narrow screens so the "Check a stream" button below
            never gets pushed off-screen behind a horizontal scrollbar. */}
        <nav aria-label="Main" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="m-0 flex list-none gap-1 p-0">
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
                    <item.icon aria-hidden="true" className="size-4 shrink-0 sm:mr-1.5" />
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sr-only sm:hidden">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href="/observe"
          aria-current={pathname?.startsWith("/observe") ? "page" : undefined}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm bg-river px-3 text-[0.9375rem] font-medium text-paper no-underline hover:bg-river-deep"
        >
          <Camera aria-hidden="true" className="size-4 shrink-0" />
          Check
        </Link>
      </div>
      {/* The scale as a thin signature strip; decorative here, so hidden from assistive tech */}
      <div aria-hidden="true">
        <ForelUleRibbon size="sm" />
      </div>
    </header>
  );
}
