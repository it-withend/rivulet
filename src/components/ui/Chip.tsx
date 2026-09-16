import type React from "react";

type ChipProps = {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** A pictogram shown before the label, so a choice can be recognised at a glance. */
  icon?: React.ReactNode;
};

/** A toggle for multi-select choices (e.g. visible signs at the stream). */
export function Chip({ pressed, onClick, children, icon }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        "inline-flex min-h-11 items-center gap-2 rounded-sm border px-3.5 py-2 " +
        "font-sans text-[0.9375rem] leading-tight transition-colors duration-150 " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
        (pressed
          ? "border-ink bg-ink text-paper"
          : "border-rule-strong bg-paper-raised text-ink hover:border-ink")
      }
    >
      {/* A custom icon already shows which chip this is and the fill colour
          already shows pressed/unpressed, so the two never share one chip —
          stacking a checkbox glyph next to a pictogram at this size just
          crowded them into each other. */}
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 [&_svg]:size-4.5">
          {icon}
        </span>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="size-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {pressed ? (
            <path d="M2 6.5 4.8 9 10 3" strokeLinecap="square" />
          ) : (
            <rect x="1.75" y="1.75" width="8.5" height="8.5" strokeWidth="1" />
          )}
        </svg>
      )}
      {children}
    </button>
  );
}
