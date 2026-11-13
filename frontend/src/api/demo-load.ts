/**
 * CR-MOCKS-LAZY-2436 (review 07:F2, 08:F02): the demo stores load on demand. An API module that answers from an in-memory demo
 * store without a backend selects it with `isApi() ? rest : demo`; the demo side is fetched with a dynamic `import()` on its
 * first call, so with a backend the demo module is never fetched and the entry chunk does not carry it. Without one the demo
 * answers after one extra chunk request (every adapter method already returns a promise).
 *
 * Nothing here knows a store: each API module passes its own `import()`.
 */

/** A dynamic import, started on the first call and shared by every later call. `loaded` is the value once it arrived. */
export interface Lazy<T> {
  (): Promise<T>;
  readonly loaded: T | null;
}

export function lazy<T>(load: () => Promise<T>): Lazy<T> {
  let p: Promise<T> | null = null;
  const fn = (() => {
    p ??= load().then(
      (v) => {
        state.loaded = v;
        return v;
      },
      (e: unknown) => {
        p = null; // a failed chunk request is tried again on the next call
        throw e;
      },
    );
    return p;
  }) as Lazy<T>;
  const state = fn as { loaded: T | null };
  state.loaded = null;
  return fn;
}

/** The members of `T` that are not "a method returning a promise": they cannot wait for a chunk, so the caller supplies them. */
type AsyncKey<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : T[K] extends (...args: never[]) => Promise<unknown> ? K : never }[keyof T];
export type SyncPart<T> = { [K in Exclude<keyof T, AsyncKey<T>>]-?: T[K] };

/**
 * An adapter whose every promise-returning method forwards to the adapter `load` resolves to (resolved again on every call, so
 * a store a spec resets is the one that answers). The synchronous and optional members come from `sync`, verbatim - an optional
 * method the demo store does not have is listed there as `undefined`, so `if (api.x)` reads the same as before.
 */
const PROBES = new Set(['then', 'toJSON', 'asymmetricMatch', 'nodeType', 'tagName']);

export function lazyAdapter<T extends object>(load: () => Promise<T>, sync: SyncPart<T>): T {
  const own = sync as Record<PropertyKey, unknown>;
  const methods = new Map<PropertyKey, (...args: unknown[]) => Promise<unknown>>();
  return new Proxy(own, {
    get(target, prop) {
      // the given members, and what every plain object has (`constructor`, `toString`, ...), as on the plain adapter objects before
      if (prop in target) return Reflect.get(target, prop);
      // what generic code probes an object for is absent, as before - never a forwarder that would load the store: not a thenable
      // (`await adapter`), no `toJSON` (JSON.stringify, test reporters), no symbol or framework protocol
      if (typeof prop === 'symbol' || PROBES.has(prop) || prop.startsWith('$$') || prop.startsWith('@@')) return undefined;
      let m = methods.get(prop);
      if (!m) {
        m = (...args: unknown[]) => load().then((a) => (a as Record<PropertyKey, (...x: unknown[]) => Promise<unknown>>)[prop](...args));
        methods.set(prop, m);
      }
      return m;
    },
  }) as unknown as T;
}
