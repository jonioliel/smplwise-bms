/**
 * CRY (2026-10-10): the background artwork behind the glass. One product setting, `ui.background` (הגדרות › כללי › מראה המערכת › רקע,
 * system.configure), and a personal override of the same shape in /me/prefs (`ui.background`, null = follow the installation):
 *
 *   builtin  the two original artworks that ship with the product (public/backgrounds/crystal-day.webp / crystal-night.webp):
 *            day under the light scheme, night under the dark one - "auto day / night by the product scheme"
 *   none     no artwork: the skin's canvas alone
 *   custom   the installation's own uploaded pictures (POST /settings/background/{day|night}); a missing slot falls back to the other
 *            one, both missing falls back to the built-in pair. The server re-encodes the upload and stamps `ui.background_images`
 *            ({ day, night }: a version stamp or null), which is the cache key of the picture's address.
 *
 * Resolution: ?bg= (this page view only, for the evidence specs) > the user's own choice > the installation's. The result is written
 * inline on <html> as `--sw-bg-image` (`url(..)` or `none`) and `data-bg`; a skin whose canvas rule paints `--sw-bg-image` shows it
 * (crystal does, under its veil; the other skins ignore the picture). Cached in this browser so the next load paints it at once.
 */
import { getMyPrefs, putMyPrefs } from '../api/me-prefs';
import { apiUrl, resourceUrl } from '../api/client';

export const BACKGROUND_MODES = ['builtin', 'none', 'custom'] as const;
export type BackgroundMode = (typeof BACKGROUND_MODES)[number];
export const BACKGROUND_SLOTS = ['day', 'night'] as const;
export type BackgroundSlot = (typeof BACKGROUND_SLOTS)[number];
/** The version stamp of each uploaded slot (null = no picture). */
export type BackgroundImages = Record<BackgroundSlot, string | null>;
export const DEFAULT_BACKGROUND: BackgroundMode = 'builtin';
export const isBackgroundMode = (v: unknown): v is BackgroundMode => typeof v === 'string' && (BACKGROUND_MODES as readonly string[]).includes(v);

/** The built-in pair: original artworks drawn in code for this product (docs/design/evidence/cry/README.md). Paths relative to the page. */
export const BUILTIN_BACKGROUNDS: Record<BackgroundSlot, string> = { day: 'backgrounds/crystal-day.webp', night: 'backgrounds/crystal-night.webp' };

const INST_KEY = 'sw.ui.background'; // the installation's last known { mode, images }
const OWN_KEY = 'sw.ui.background.own'; // this user's own choice { u, mode }

interface Installation {
  mode: BackgroundMode;
  images: BackgroundImages;
}

const NO_IMAGES: BackgroundImages = { day: null, night: null };
let installation: Installation = { mode: DEFAULT_BACKGROUND, images: { ...NO_IMAGES } };
let own: BackgroundMode | null = null;
let query: BackgroundMode | null = null;
let user: string | null = null;
let remote = false;
const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this page view only */
  }
}

/** The `ui.background_images` value as the settings carry it (an object; anything else reads as "no pictures"). */
export function normalizeImages(v: unknown): BackgroundImages {
  const out: BackgroundImages = { ...NO_IMAGES };
  if (v && typeof v === 'object') {
    for (const slot of BACKGROUND_SLOTS) {
      const s = (v as Record<string, unknown>)[slot];
      if (typeof s === 'string' && s.trim()) out[slot] = s.trim();
    }
  }
  return out;
}

function notify() {
  listeners.forEach((fn) => fn());
}

/** Subscribe to background changes (design/apply.ts re-applies the page). Returns the unsubscribe. */
export function onBackground(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Boot (design/apply.ts): what is stored, before the first paint. Idempotent. */
let booted = false;
export function bootBackground(): void {
  if (booted) return;
  booted = true;
  try {
    const c = JSON.parse(read(INST_KEY) ?? 'null') as Partial<Installation> | null;
    if (c) installation = { mode: isBackgroundMode(c.mode) ? c.mode : DEFAULT_BACKGROUND, images: normalizeImages(c.images) };
  } catch {
    /* a corrupt cache reads as the default */
  }
  try {
    const c = JSON.parse(read(OWN_KEY) ?? 'null') as { u?: unknown; mode?: unknown } | null;
    own = c && isBackgroundMode(c.mode) ? c.mode : null;
  } catch {
    own = null;
  }
  try {
    const q = new URLSearchParams(window.location.search).get('bg');
    query = isBackgroundMode(q) ? q : null;
  } catch {
    query = null;
  }
}

/** The installation's `ui.background` / `ui.background_images` as the product settings carry them (unknown values keep the current ones). */
export function setInstallationBackground(mode: unknown, images: unknown): void {
  const next: Installation = { mode: isBackgroundMode(mode) ? mode : installation.mode, images: images === undefined ? installation.images : normalizeImages(images) };
  if (next.mode === installation.mode && JSON.stringify(next.images) === JSON.stringify(installation.images)) return;
  installation = next;
  write(INST_KEY, JSON.stringify(installation));
  notify();
}

/** The static demo (no backend) keeps "the installation's" choice in this browser: same cache, same effect. */
export function saveDemoBackground(mode: BackgroundMode): void {
  setInstallationBackground(mode, installation.images);
}

export const installationBackground = (): Installation => ({ mode: installation.mode, images: { ...installation.images } });
export const ownBackgroundChoice = (): BackgroundMode | null => own;
/** The mode in force (query > own > installation). */
export const currentBackground = (): BackgroundMode => query ?? own ?? installation.mode;

/** Once the session is known: this user's cached choice at once, then the server's (`ui.background` of /me/prefs). */
export async function loadBackgroundPref(userId: string, api: boolean): Promise<void> {
  user = userId;
  remote = api;
  try {
    const c = JSON.parse(read(OWN_KEY) ?? 'null') as { u?: unknown; mode?: unknown } | null;
    own = c && c.u === userId && isBackgroundMode(c.mode) ? c.mode : null;
  } catch {
    own = null;
  }
  notify();
  if (!api) return;
  try {
    const p = await getMyPrefs();
    if (user !== userId) return;
    const v = (p.prefs as Record<string, unknown>)['ui.background'];
    own = isBackgroundMode(v) ? v : null;
    write(OWN_KEY, own ? JSON.stringify({ u: userId, mode: own }) : null);
    notify();
  } catch {
    /* an older backend, or offline: keep the cached copy */
  }
}

/** Save the user's own choice (null = "כמו המערכת"). Optimistic; reverted when the server refuses it. */
export async function saveOwnBackground(mode: BackgroundMode | null): Promise<void> {
  const before = own;
  own = mode;
  write(OWN_KEY, mode ? JSON.stringify({ u: user, mode }) : null);
  notify();
  if (!remote) return;
  try {
    await putMyPrefs({ 'ui.background': mode });
  } catch (err) {
    own = before;
    write(OWN_KEY, before ? JSON.stringify({ u: user, mode: before }) : null);
    notify();
    throw err;
  }
}

/** The address of an uploaded picture (null when the slot is empty). The stamp is the cache key: a new upload is a new address. */
export function customBackgroundUrl(slot: BackgroundSlot, images: BackgroundImages = installation.images): string | null {
  const stamp = images[slot];
  if (!stamp) return null;
  const base = typeof document === 'undefined' ? `api/v1/settings/background/${slot}` : apiUrl(`settings/background/${slot}`); // Node (the unit spec) has no page
  return `${base}?v=${encodeURIComponent(stamp)}`;
}

/** The picture the page shows for a theme under a mode (null = none). Pure: the settings preview and the evidence spec call it too. */
export function resolveBackground(mode: BackgroundMode, theme: 'light' | 'dark', images: BackgroundImages = installation.images): string | null {
  const slot: BackgroundSlot = theme === 'dark' ? 'night' : 'day';
  const other: BackgroundSlot = slot === 'day' ? 'night' : 'day';
  const builtin = typeof document === 'undefined' ? BUILTIN_BACKGROUNDS[slot] : resourceUrl(BUILTIN_BACKGROUNDS[slot]); // Node (the unit spec) has no page
  if (mode === 'none') return null;
  if (mode === 'custom') return customBackgroundUrl(slot, images) ?? customBackgroundUrl(other, images) ?? builtin;
  return builtin;
}

/** Write the resolved picture on <html>: `--sw-bg-image` (inline, so it wins over every skin block) and `data-bg`. */
export function applyBackground(theme: 'light' | 'dark'): void {
  const root = document.documentElement;
  const mode = currentBackground();
  const url = resolveBackground(mode, theme);
  const value = url ? `url("${url.replace(/["\\]/g, '')}")` : 'none';
  if (root.style.getPropertyValue('--sw-bg-image') !== value) root.style.setProperty('--sw-bg-image', value);
  if (root.getAttribute('data-bg') !== mode) root.setAttribute('data-bg', mode);
}
