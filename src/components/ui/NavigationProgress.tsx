"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar under the header that appears the moment an internal link is
 * pressed and disappears when the new page has arrived. Slow pages used to
 * look like a dead button; this makes "it is working" visible immediately.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const here = `${pathname}?${search}`;

  // A new location means the pending navigation has landed.
  useEffect(() => {
    const id = setTimeout(() => setPendingFor(null), 0);
    return () => clearTimeout(id);
  }, [here]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const destination = `${url.pathname}?${url.searchParams.toString()}`;
      // Same page, or a hash jump: nothing will load.
      if (destination === `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`) return;
      setPendingFor(here);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [here]);

  // Pending until the location differs from where the click happened.
  const pending = pendingFor !== null && pendingFor === here;

  return (
    <div
      aria-hidden="true"
      className={
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-200 " +
        (pending ? "opacity-100" : "opacity-0")
      }
    >
      <div className="rivulet-progress h-full w-1/3 bg-river" />
    </div>
  );
}
