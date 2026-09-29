/**
 * CR-013: the user's own order of the navigation tabs (rail and phone bottom bar), stored per USER on the server
 * (`nav.order` of GET/PUT /me/prefs) so it follows the user to every device. A copy is cached in this browser for an
 * instant first paint - keyed by the user id, so another user signing in on the same device never inherits it - and
 * the server's answer wins once it arrives. Without a backend (the static demo) the order lives in this browser only.
 * Presentation only: which tabs a user sees is decided by their permissions (nav.ts), never by this list.
 */
import { NAV_TAB_IDS, type NavTabId } from './nav';
import { getMyPrefs, putMyPrefs } from '../api/me-prefs';

const CACHE_KEY = 'sw.nav.order';

/** Known ids in the given order (unknown ids and duplicates dropped), then the missing ones in the default order - the
 * same rule as the server's normalize_nav_order. */
export function normalizeOrder(value: unknown): NavTabId[] {
  const seen: NavTabId[] = [];
  if (Array.isArray(value)) for (const v of value) if ((NAV_TAB_IDS as string[]).includes(v) && !seen.includes(v)) seen.push(v);
  return [...seen, ...NAV_TAB_IDS.filter((t) => !seen.includes(t))];
}

export function isDefaultOrder(o: readonly string[]): boolean {
  return o.length === NAV_TAB_IDS.length && o.every((id, i) => id === NAV_TAB_IDS[i]);
}

interface Cached {
  u: string;
  order: NavTabId[];
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<Cached>;
    return typeof c.u === 'string' ? { u: c.u, order: normalizeOrder(c.order) } : null;
  } catch {
    return null;
  }
}

function writeCache(u: string, o: NavTabId[]): void {
  try {
    if (isDefaultOrder(o)) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify({ u, order: o }));
  } catch {
    /* storage unavailable: the server copy still applies after load */
  }
}

// before /me answers, the last user of this browser is the best guess (a copy only; replaced as soon as the user is known)
let current: NavTabId[] = readCache()?.order ?? [...NAV_TAB_IDS];
let user: string | null = null;
let remote = false;
const listeners = new Set<(o: NavTabId[]) => void>();

function set(next: NavTabId[]): void {
  current = next;
  for (const l of listeners) l(current);
}

export function navOrder(): NavTabId[] {
  return current;
}

export function onNavOrder(fn: (o: NavTabId[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Once the session is known: this user's cached copy (or the default), then the server's copy with a backend. */
export async function loadNavOrder(userId: string, api: boolean): Promise<void> {
  user = userId;
  remote = api;
  const cached = readCache();
  set(cached && cached.u === userId ? cached.order : [...NAV_TAB_IDS]);
  if (!api) return;
  try {
    const p = await getMyPrefs();
    if (user !== userId) return; // another sign-in replaced this one meanwhile
    const o = normalizeOrder(p.prefs['nav.order']);
    writeCache(userId, o);
    set(o);
  } catch {
    /* an older backend without /me/prefs, or offline: keep the cached copy */
  }
}

/** Save the user's order (optimistic; reverted when the server refuses). */
export async function saveNavOrder(order: readonly string[]): Promise<void> {
  const before = current;
  const o = normalizeOrder(order);
  set(o);
  if (user) writeCache(user, o);
  if (!remote) return;
  try {
    const p = await putMyPrefs({ 'nav.order': o });
    const saved = normalizeOrder(p.prefs['nav.order']);
    if (user) writeCache(user, saved);
    set(saved);
  } catch (err) {
    if (user) writeCache(user, before);
    set(before);
    throw err;
  }
}

/** Back to the default order (the server forgets the key). */
export async function resetNavOrder(): Promise<void> {
  const before = current;
  set([...NAV_TAB_IDS]);
  if (user) writeCache(user, current);
  if (!remote) return;
  try {
    await putMyPrefs({ 'nav.order': null });
  } catch (err) {
    if (user) writeCache(user, before);
    set(before);
    throw err;
  }
}
