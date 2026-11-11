/**
 * PLAN3D-REALISM2-2433 S1: where a baked AO volume comes from - this browser's IndexedDB (keyed by ao-volume.aoVolumeKey: the
 * geometry hash), else a worker bake (ao-volume.worker.ts), else the same bake on the main thread in slices (no Worker, a
 * worker that failed to start). Every store access is guarded: a private window, blocked site data or a full disk only cost
 * the cache, never the bake. The newest MAX_ENTRIES volumes are kept.
 */
import { bakeAoVolume, type AoVolume, type AoVolumeInput } from './ao-volume';

const DB = 'sw-plan3d-ao';
const STORE = 'volumes';
const MAX_ENTRIES = 12;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' }).createIndex('at', 'at');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function cachedVolume(key: string): Promise<AoVolume | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise<AoVolume | null>((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => {
        const row = req.result as { volume?: AoVolume } | undefined;
        const v = row?.volume;
        resolve(v && v.key === key && v.data instanceof Uint8Array ? v : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function storeVolume(v: AoVolume): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      st.put({ key: v.key, at: Date.now(), volume: v });
      const keys = st.index('at').getAllKeys();
      keys.onsuccess = () => {
        const all = keys.result as IDBValidKey[];
        // the index is ascending by time: drop the oldest beyond the cap (the new row is the last)
        for (const k of all.slice(0, Math.max(0, all.length - MAX_ENTRIES))) st.delete(k);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* the cache is optional */
  } finally {
    db.close();
  }
}

let worker: Worker | null | undefined;
let seq = 0;
const waiting = new Map<number, { resolve: (v: AoVolume | null) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('./ao-volume.worker.ts', import.meta.url), { type: 'module' });
    if (worker) {
      worker.onmessage = (e: MessageEvent<{ id: number; volume?: AoVolume | null; error?: string }>) => {
        const w = waiting.get(e.data.id);
        if (!w) return;
        waiting.delete(e.data.id);
        if (e.data.error) w.reject(new Error(e.data.error));
        else w.resolve(e.data.volume ?? null);
      };
      worker.onerror = (ev) => {
        ev.preventDefault();
        // a worker that cannot start: every waiting bake runs in-thread, the next ones too
        worker?.terminate();
        worker = null;
        for (const w of waiting.values()) w.reject(new Error('ao worker failed'));
        waiting.clear();
      };
    }
  } catch {
    worker = null;
  }
  return worker;
}

const slice = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** The volume for an input: cached, else baked (worker, else in-thread). `source` says which (the perf report). */
export async function loadVolume(inp: AoVolumeInput, key: string, useCache = true): Promise<{ volume: AoVolume | null; source: 'cache' | 'worker' | 'main' }> {
  if (useCache) {
    const hit = await cachedVolume(key);
    if (hit) return { volume: hit, source: 'cache' };
  }
  const w = getWorker();
  if (w) {
    try {
      const id = ++seq;
      const volume = await new Promise<AoVolume | null>((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        w.postMessage({ id, input: inp });
      });
      if (volume && useCache) void storeVolume(volume);
      return { volume, source: 'worker' };
    } catch {
      /* fall through to the main thread */
    }
  }
  const volume = await bakeAoVolume(inp, { yieldSlice: slice, now: () => performance.now() });
  if (volume && useCache) void storeVolume(volume);
  return { volume, source: 'main' };
}
