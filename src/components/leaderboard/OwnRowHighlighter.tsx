"use client";

import { useEffect } from "react";
import { getObserver } from "@/lib/identity/client";

/**
 * Renders nothing — it just finds the row matching this device's stored
 * observer id (via `data-observer-id`) and highlights it, so a resident can
 * spot themselves on a leaderboard of pseudonyms.
 */
export function OwnRowHighlighter() {
  useEffect(() => {
    const observer = getObserver();
    if (!observer) return;

    const row = document.querySelector(`[data-observer-id="${observer.id}"]`);
    if (!row) return;

    row.setAttribute("data-own-row", "true");
    row.classList.add("bg-paper-raised", "font-medium");
  }, []);

  return null;
}
