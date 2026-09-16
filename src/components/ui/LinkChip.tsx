import Link from "next/link";
import type React from "react";

/** A chip-styled link, for choices that change the URL (city, map layer). */
export function LinkChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "inline-flex min-h-11 items-center gap-2 rounded-sm border px-3.5 py-2 " +
        "font-sans text-[0.9375rem] leading-tight no-underline transition-colors duration-150 " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
        (active
          ? "border-ink bg-ink text-paper"
          : "border-rule-strong bg-paper-raised text-ink hover:border-ink")
      }
    >
      {children}
    </Link>
  );
}
