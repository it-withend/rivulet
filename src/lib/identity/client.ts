const OBSERVER_KEY = "rivulet.observer.v1";

export type StoredObserver = {
  id: string;
  displayName: string;
  token: string;
  /** Ids of certificates this device has claimed, so the journal can link to them. */
  certificateIds?: string[];
};

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isStoredObserver(value: unknown): value is StoredObserver {
  if (typeof value !== "object" || value === null) return false;
  const v = value as StoredObserver;
  return (
    typeof v.id === "string" &&
    typeof v.displayName === "string" &&
    typeof v.token === "string" &&
    (v.certificateIds === undefined ||
      (Array.isArray(v.certificateIds) &&
        v.certificateIds.every((c) => typeof c === "string")))
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

/** Records a newly issued certificate id against the stored identity. */
export function addCertificateId(
  id: string,
  store: KeyValueStore | null = browserStorage(),
): StoredObserver | null {
  const current = getObserver(store);
  if (!current) return null;
  const certificateIds = [...(current.certificateIds ?? []), id];
  const updated = { ...current, certificateIds };
  saveObserver(updated, store);
  return updated;
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
