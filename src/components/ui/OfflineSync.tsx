"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudOff, CheckCircle2 } from "lucide-react";
import { flushQueue, queuedCount, subscribeToQueue } from "@/lib/offline/report-queue";

/**
 * Registers the service worker and sends any reports saved while offline as
 * soon as the connection is back. A small notice says what is waiting, so a
 * report saved at a stream never feels lost.
 */
export function OfflineSync() {
  const waiting = useSyncExternalStore(subscribeToQueue, queuedCount, () => 0);
  const [justSent, setJustSent] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    async function send() {
      if (!navigator.onLine) return;
      const { sent } = await flushQueue();
      if (sent > 0) {
        setJustSent(sent);
        clearTimeout(timer);
        timer = setTimeout(() => setJustSent(0), 7000);
      }
    }

    void send();
    window.addEventListener("online", send);
    return () => {
      window.removeEventListener("online", send);
      clearTimeout(timer);
    };
  }, []);

  if (waiting === 0 && justSent === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-40 flex items-center gap-2 rounded-md border border-river/40 bg-paper-raised p-3 text-sm sm:right-auto sm:max-w-sm print:hidden"
    >
      {waiting > 0 ? (
        <>
          <CloudOff aria-hidden="true" className="size-4 shrink-0 text-river" />
          {waiting === 1 ? "1 report is saved on this phone" : `${waiting} reports are saved on this phone`} and will be
          sent when you are back online.
        </>
      ) : (
        <>
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-river" />
          {justSent === 1 ? "Your saved report was sent." : `${justSent} saved reports were sent.`}
        </>
      )}
    </div>
  );
}
