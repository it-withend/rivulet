const OBSERVER_KEY = "rivulet.observer.v1";

export type StoredObserver = { id: string; displayName: string; token: string };

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isStoredObserver(value: unknown): value is StoredObserver {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StoredObserver).id === "string" &&
    typeof (value as StoredObserver).displayName === "string" &&
    typeof (value as StoredObserver).token === "string"
  );
}

/** Reads the pseudonymous identity from this device, if any. Never throws. */
export function getObserver(
  store: KeyValueStore | null = browserStorage(),
): StoredObserver | null {
  if (!store) return null;
  try {
    const raw = store.getItem(OBSERVER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredObserver(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveObserver(
  observer: StoredObserver,
  store: KeyValueStore | null = browserStorage(),
): void {
  if (!store) return;
  try {
    store.setItem(OBSERVER_KEY, JSON.stringify(observer));
  } catch {
    // Private browsing or full storage: the identity just won't persist.
  }
}

export function clearObserver(
  store: KeyValueStore | null = browserStorage(),
): void {
  if (!store) return;
  try {
    store.removeItem(OBSERVER_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

/**
 * Returns the device's observer identity, creating one via `POST
 * /api/observers` the first time. Never blocks observation submission: a
 * failure here just means the observation is sent anonymously.
 */
export async function ensureObserver(): Promise<StoredObserver | null> {
  const existing = getObserver();
  if (existing) return existing;

  try {
    const response = await fetch("/api/observers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      id: string;
      displayName: string;
      token: string;
    };
    const observer: StoredObserver = {
      id: body.id,
      displayName: body.displayName,
      token: body.token,
    };
    saveObserver(observer);
    return observer;
  } catch {
    return null;
  }
}
