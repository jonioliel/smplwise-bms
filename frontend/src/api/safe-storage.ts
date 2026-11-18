/**
 * CR-FE-NITS-2442 (code review 06:STORE-1): the one defensive door to the browser's storage.
 *
 * A private window, blocked site data or a full quota make `localStorage` / `sessionStorage` throw - on the property read
 * itself or on any call. A remembered choice is never worth an exception: every function here answers "nothing stored" or
 * does nothing instead. The same few lines were written out in schedule-editor.ts, devices-schedules.ts,
 * access-control/settings-cards-logic.ts and system-access-parity.ts.
 *
 * Every helper takes the storage as its last argument (default: the browser's local storage), so a test passes its own.
 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The browser's local storage, or null when touching it throws (or there is none: node, a worker). */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The tab's session storage, or null when touching it throws (or there is none). */
export function browserSession(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** The stored text of a key; null when there is none or the storage refuses. */
export function storedText(key: string, storage: StorageLike | null = browserStorage()): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Stores a text; a storage that refuses simply does not remember. */
export function storeText(key: string, value: string, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* storage unavailable: the value is not remembered */
  }
}

/** Forgets a key; a storage that refuses is left alone. */
export function dropStored(key: string, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** A value stored as JSON; null when there is none, the text is empty or not JSON, or the storage refuses. */
export function readStoredJson<T>(key: string, storage: StorageLike | null = browserStorage()): T | null {
  const raw = storedText(key, storage);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Stores a value as JSON; a value that cannot be written (or serialised) is not remembered. */
export function writeStoredJson(key: string, value: unknown, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the choice is not remembered */
  }
}
