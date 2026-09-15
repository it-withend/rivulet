import type { JournalEntry } from "./journal";

export const JOURNAL_KEY = "rivulet.journal.v1";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadJournal(
  store: KeyValueStore | null = browserStorage(),
): JournalEntry[] {
  if (!store) return [];
  try {
    const raw = store.getItem(JOURNAL_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendEntry(
  entry: JournalEntry,
  store: KeyValueStore | null = browserStorage(),
): JournalEntry[] {
  const next = [
    ...loadJournal(store).filter((e) => e.observationId !== entry.observationId),
    entry,
  ];
  if (store) {
    try {
      store.setItem(JOURNAL_KEY, JSON.stringify(next));
    } catch {
      // Private browsing or full storage: the observation itself is already
      // saved server-side, so losing the personal journal entry is acceptable.
    }
  }
  return next;
}
