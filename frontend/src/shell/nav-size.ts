/**
 * UI round 1 (owner 2026-09-30): the size of the navigation - the side rail (desktop) and the phone bottom bar.
 *
 * One value shape, validated by the backend with the same ranges (services/nav_size.py):
 *   { mode: 'rel', preset: 's' | 'm' | 'l' | 'xl' }                     a preset scales every part together
 *   { mode: 'free', icon: 14..40, label: 0 | 9..16, item: 36..96 }       independent sizes in px; label 0 = labels off
 * Two owners of that value: the installation default (`ui.nav_size` product setting) and the user's own override
 * (`ui.nav_size` of /me/prefs; the personal value wins, resetting it falls back to the installation's). The static demo has
 * no backend: the personal value then lives in this browser only. `navSize()` is the effective value; `navDims()` turns it
 * into the concrete pixel sizes the shell puts on itself as CSS variables (design A only).
 * "m" is the size the shell had before this setting existed.
 */
import { getMyPrefs, putMyPrefs } from '../api/me-prefs';

export type NavPreset = 's' | 'm' | 'l' | 'xl';
export type NavSize = { mode: 'rel'; preset: NavPreset } | { mode: 'free'; icon: number; label: number; item: number };

export const NAV_PRESETS: readonly NavPreset[] = ['s', 'm', 'l', 'xl'];
export const NAV_PRESET_LABEL: Record<NavPreset, string> = { s: 'קטן', m: 'בינוני', l: 'גדול', xl: 'גדול מאוד' };
export const NAV_DEFAULT: NavSize = { mode: 'rel', preset: 'm' };

/** Same ranges as the backend. `label: 0` = labels off. */
export const NAV_RANGE = { icon: [14, 40], label: [9, 16], item: [36, 96] } as const;

/** What the shell draws. Desktop rail: `icon`, `label`, `item` (item height), `itemW` (the item's minimum width; the rail
 * itself is as wide as its widest label needs, never clipped), `avatar`. Phone bar: `bar` (its height, >= 44), `pIcon`,
 * `pLabel`, `pill` (the icon's pill), `pAvatar`. `labels` false = no label text anywhere. */
export interface NavDims {
  icon: number;
  label: number;
  labels: boolean;
  item: number;
  itemW: number;
  avatar: number;
  bar: number;
  pIcon: number;
  pLabel: number;
  pillW: number;
  pillH: number;
  pAvatar: number;
}

const PRESET_DIMS: Record<NavPreset, { icon: number; label: number; item: number; itemW: number; avatar: number }> = {
  s: { icon: 18, label: 10, item: 46, itemW: 52, avatar: 24 },
  m: { icon: 20, label: 10.5, item: 52, itemW: 56, avatar: 28 },
  l: { icon: 25, label: 12, item: 64, itemW: 68, avatar: 34 },
  xl: { icon: 30, label: 13.5, item: 76, itemW: 80, avatar: 40 },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function int(v: unknown, lo: number, hi: number, allowZero = false): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v)) return null;
  if (allowZero && v === 0) return 0;
  return v >= lo && v <= hi ? v : null;
}

/** The backend's rule: a whole, in-range value in exactly one of the two shapes; anything else is null. */
export function normalizeNavSize(v: unknown): NavSize | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort().join(',');
  if (o.mode === 'rel' && keys === 'mode,preset') return (NAV_PRESETS as readonly unknown[]).includes(o.preset) ? { mode: 'rel', preset: o.preset as NavPreset } : null;
  if (o.mode === 'free' && keys === 'icon,item,label,mode') {
    const icon = int(o.icon, ...NAV_RANGE.icon);
    const label = int(o.label, ...NAV_RANGE.label, true);
    const item = int(o.item, ...NAV_RANGE.item);
    return icon !== null && label !== null && item !== null ? { mode: 'free', icon, label, item } : null;
  }
  return null;
}

export function sameNavSize(a: NavSize, b: NavSize): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The free sizes a preset stands for (the "חופשי" editor starts from the current preset). */
export function freeFrom(size: NavSize): Extract<NavSize, { mode: 'free' }> {
  if (size.mode === 'free') return size;
  const p = PRESET_DIMS[size.preset];
  return { mode: 'free', icon: p.icon, label: Math.round(p.label), item: p.item };
}

export function navDims(size: NavSize): NavDims {
  let icon: number;
  let label: number;
  let item: number;
  let itemW: number;
  let avatar: number;
  if (size.mode === 'rel') {
    ({ icon, label, item, itemW, avatar } = PRESET_DIMS[size.preset]);
  } else {
    icon = size.icon;
    label = size.label;
    item = size.item;
    itemW = Math.max(item + 4, 44);
    avatar = clamp(Math.round(icon * 1.4), 20, 48);
  }
  const labels = label > 0;
  // the phone bar keeps a 44 px target whatever is chosen; its parts follow the same proportions a little smaller
  const pIcon = Math.max(14, icon - 1);
  return {
    icon,
    label,
    labels,
    item,
    itemW,
    avatar,
    bar: clamp(item - 2, 44, 94),
    pIcon,
    pLabel: labels ? Math.max(9, label - 0.5) : 0,
    pillW: pIcon + 24,
    pillH: pIcon + 7,
    pAvatar: Math.max(18, Math.round(avatar * 0.8)),
  };
}

/** The sizes as CSS custom properties (put on <sw-app>; the fallbacks in its stylesheet are the "m" preset). */
export function navCssVars(d: NavDims): Record<string, string> {
  return {
    '--nav-icon': `${d.icon}px`,
    '--nav-label': `${d.labels ? d.label : 0}px`,
    '--nav-item-h': `${d.item}px`,
    '--nav-item-w': `${d.itemW}px`,
    '--nav-avatar': `${d.avatar}px`,
    '--nav-bar-h': `${d.bar}px`,
    '--nav-p-label': `${d.labels ? d.pLabel : 0}px`,
    '--nav-pill-w': `${d.pillW}px`,
    '--nav-pill-h': `${d.pillH}px`,
  };
}

// ---- the effective value: the user's own over the installation's over the built-in ----

const CACHE_KEY = 'sw.nav.size';
let installation: NavSize = NAV_DEFAULT;
let own: NavSize | null = null;
let user: string | null = null;
let remote = false;
const listeners = new Set<(s: NavSize) => void>();

function notify(): void {
  const s = navSize();
  for (const l of listeners) l(s);
}

export function navSize(): NavSize {
  return own ?? installation;
}

export function installationNavSize(): NavSize {
  return installation;
}

/** The user's own value, or null (they follow the installation's). */
export function ownNavSize(): NavSize | null {
  return own;
}

export function onNavSize(fn: (s: NavSize) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The installation default (the product setting): at load, and right after the settings screen saved it. */
export function setInstallationNavSize(v: unknown): void {
  installation = normalizeNavSize(v) ?? NAV_DEFAULT;
  notify();
}

function readCache(): { u: string; size: NavSize } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { u?: unknown; size?: unknown };
    const size = normalizeNavSize(c.size);
    return typeof c.u === 'string' && size ? { u: c.u, size } : null;
  } catch {
    return null;
  }
}

function writeCache(u: string, s: NavSize | null): void {
  try {
    if (!s) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify({ u, size: s }));
  } catch {
    /* storage unavailable: the server copy still applies after load */
  }
}

/** Once the session is known: this user's cached value at once (a cached copy belongs to one user id), then the server's. */
export async function loadNavSize(userId: string, api: boolean): Promise<void> {
  user = userId;
  remote = api;
  const cached = readCache();
  own = cached && cached.u === userId ? cached.size : null;
  notify();
  if (!api) return;
  try {
    const p = await getMyPrefs();
    if (user !== userId) return;
    const stored = Array.isArray(p.stored) && p.stored.includes('ui.nav_size');
    const v = stored ? normalizeNavSize(p.prefs['ui.nav_size']) : null;
    writeCache(userId, v);
    own = v;
    notify();
  } catch {
    /* an older backend, or offline: keep the cached copy */
  }
}

/** Save (a value) or clear (null: "ברירת מחדל של המערכת") the user's own size. Optimistic; reverted when refused. */
export async function saveOwnNavSize(v: NavSize | null): Promise<void> {
  const before = own;
  own = v;
  if (user) writeCache(user, v);
  notify();
  if (!remote) return;
  const who = user;
  try {
    await putMyPrefs({ 'ui.nav_size': v });
  } catch (err) {
    if (user !== who) return;
    own = before;
    if (user) writeCache(user, before);
    notify();
    throw err;
  }
}
