import type React from "react";

type PanelProps = {
  children: React.ReactNode;
  className?: string;
  tone?: "paper" | "ink";
};

const tones = {
  paper: "border-rule bg-paper-raised text-ink",
  ink: "border-ink bg-ink text-paper [&_.field-label]:text-rule",
} as const;

/** A bordered sheet. Hairline edge, no shadow. */
export function Panel({ children, className = "", tone = "paper" }: PanelProps) {
  return (
    <div
      data-tone={tone}
      className={`rounded-md border p-5 sm:p-6 ${tones[tone]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
