import Link from "next/link";
import type React from "react";

type ButtonProps = {
  variant?: "primary" | "secondary";
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border px-5 py-2 " +
  "font-sans text-[0.9375rem] font-medium leading-tight no-underline " +
  "transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
  "disabled:cursor-not-allowed disabled:border-rule disabled:bg-transparent disabled:text-ink-muted";

const variants = {
  primary:
    "border-river bg-river text-paper hover:border-river-deep hover:bg-river-deep",
  secondary:
    "border-ink bg-transparent text-ink hover:bg-paper-raised",
} as const;

export function Button({
  variant = "primary",
  href,
  className = "",
  children,
  type,
  ...rest
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${className}`.trim();

  if (href !== undefined) {
    return (
      <Link
        href={href}
        className={classes}
        id={rest.id}
        aria-label={rest["aria-label"]}
      >
        {children}
      </Link>
    );
  }

  return (
    <button type={type ?? "button"} className={classes} {...rest}>
      {children}
    </button>
  );
}
