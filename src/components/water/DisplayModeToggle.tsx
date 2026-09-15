"use client";

import { useState } from "react";
import type React from "react";
import { Chip } from "@/components/ui/Chip";

export function DisplayModeToggle({
  simple,
  scientific,
}: {
  simple: React.ReactNode;
  scientific: React.ReactNode;
}) {
  const [mode, setMode] = useState<"simple" | "scientific">("simple");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Chip pressed={mode === "simple"} onClick={() => setMode("simple")}>
          Simple
        </Chip>
        <Chip
          pressed={mode === "scientific"}
          onClick={() => setMode("scientific")}
        >
          Scientific
        </Chip>
      </div>
      {mode === "simple" ? simple : scientific}
    </div>
  );
}
