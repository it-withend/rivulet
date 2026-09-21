import { getObserver } from "@/lib/identity/client";
import { appendEntry } from "@/lib/journal/storage";
import type { JournalEntry } from "@/lib/journal/journal";

/**
 * Reports that could not be sent because the connection dropped at the
 * stream. They wait in this browser and go out on their own once the device is
 * online again. The server bounds `observedAt` to the last 30 days, so a
 * report written offline keeps its true time and is still accepted.
 */
const KEY = "rivulet.queue.v1";
const CHANGE_EVENT = "rivulet:queue";

export type QueuedReport = {
  queuedAt: string;
  payload: {
    waterbodyId: string;
    observedAt: string;
    survey: { forelUle: number | null; indicatorTaxa: string[]; visibleAlgae: boolean };
    [key: string]: unknown;
  };
};

function read(): QueuedReport[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedReport[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedReport[]): boolean {
  try {
    if (items.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false; // storage full or blocked: the caller tells the person
  }
}

/** Saves a report for later. Returns false when this browser cannot store it. */
export function enqueueReport(payload: QueuedReport["payload"]): boolean {
  return write([...read(), { queuedAt: new Date().toISOString(), payload }]);
}

/** How many reports are waiting, as a stable primitive for useSyncExternalStore. */
export function queuedCount(): number {
  return read().length;
}

export function subscribeToQueue(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

let flushing = false;

/**
 * Sends what is waiting, oldest first. A network failure stops the run and
 * keeps everything left; a server error keeps that report for a later try; a
 * report the server rejects as invalid is dropped, since resending cannot fix it.
 */
export async function flushQueue(): Promise<{ sent: number; remaining: number }> {
  if (flushing) return { sent: 0, remaining: queuedCount() };
  flushing = true;
  try {
    const items = read();
    if (items.length === 0) return { sent: 0, remaining: 0 };

    const observer = getObserver();
    const keep: QueuedReport[] = [];
    let sent = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const response = await fetch("/api/observations", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(observer ? { authorization: `Bearer ${observer.token}` } : {}),
          },
          body: JSON.stringify(item.payload),
        });

        if (response.ok) {
          sent++;
          const body = (await response.json()) as {
            id: string;
            waterbodyName: string;
            delta: { wasDataGap: boolean };
          };
          const entry: JournalEntry = {
            observationId: body.id,
            waterbodyId: item.payload.waterbodyId,
            waterbodyName: body.waterbodyName,
            observedAt: item.payload.observedAt,
            forelUle: item.payload.survey.forelUle,
            indicatorTaxa: item.payload.survey.indicatorTaxa as JournalEntry["indicatorTaxa"],
            visibleAlgae: item.payload.survey.visibleAlgae,
            wasDataGap: body.delta.wasDataGap,
          };
          appendEntry(entry);
        } else if (response.status >= 500 || response.status === 429) {
          keep.push(item);
        }
      } catch {
        keep.push(item, ...items.slice(i + 1));
        break;
      }
    }

    write(keep);
    return { sent, remaining: keep.length };
  } finally {
    flushing = false;
  }
}
