/**
 * Release 0.1.153 (owner decision): how a group of tabs is presented on the phone - as `tabs` (today, the default everywhere), as a
 * `hybrid` (a segmented control for three items or fewer, a dropdown for more) or as a `dropdown`.
 *
 * Applies per tab GROUP (the main bottom navigation is not one): `home` (the areas chip row of the home screen), `area` (the sub-tabs of
 * the home / map / WisKey areas), `multimedia`, `security` (both rows) and `settings`. A global value plus a per-group override, owned
 * twice: the installation's (`ui.tabs_mode`, `ui.tabs_mode_groups` product settings) and the user's own (the same keys of /me/prefs;
 * null = follow the installation). The effective value for a group, first match wins:
 *   the user's group override, the user's global value, the installation's group override, the installation's global value, `tabs`.
 * Presentation only (nothing here is a permission). The mode takes effect on the phone (<= 767 px) only; `tabModeOf` answers
 * `tabs` on a wider screen. Backend validation: services/tabs_mode.py (same closed lists).
 */
import { getMyPrefs, putMyPrefs } from '../api/me-prefs';

export type TabMode = 'tabs' | 'hybrid' | 'dropdown';
export type TabGroup = 'home' | 'area' | 'multimedia' | 'security' | 'settings';

export const TAB_MODES: readonly TabMode[] = ['tabs', 'hybrid', 'dropdown'];
export const TAB_MODE_DEFAULT: TabMode = 'tabs';
export const TAB_MODE_LABEL: Record<TabMode, string> = { tabs: 'כמוסות ופסים', hybrid: 'משולב', dropdown: 'תפריטים נפתחים' };
export const TAB_MODE_HINT: Record<TabMode, string> = {
  tabs: 'כמו היום: כל הלשוניות גלויות',
  hybrid: 'עד שלוש אפשרויות כפס, יותר מזה כתפריט',
  dropdown: 'כל קבוצה כתפריט אחד, חוסך מקום',
};
export const TAB_GROUPS: readonly TabGroup[] = ['home', 'area', 'multimedia', 'security', 'settings'];
export const TAB_GROUP_LABEL: Record<TabGroup, string> = { home: 'אזורים בקומה (מסך האזור)', area: 'לשוניות האזור', multimedia: 'מולטימדיה', security: 'אבטחה', settings: 'הגדרות' };
/** The widest screen the mode applies to (the phone). */
export const TAB_MODE_MAX_WIDTH = 767;
/** `hybrid`: up to this many items stay a segmented control. */
export const HYBRID_MAX_ITEMS = 3;

export type TabModeGroups = Partial<Record<TabGroup, TabMode>>;

export function asTabMode(v: unknown): TabMode | null {
  return typeof v === 'string' && (TAB_MODES as readonly string[]).includes(v) ? (v as TabMode) : null;
}

/** The stored per-group overrides, reduced to known groups and modes (a stored string is parsed); never throws. */
export function normalizeTabModeGroups(raw: unknown): TabModeGroups {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  const out: TabModeGroups = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const g of TAB_GROUPS) {
      const m = asTabMode((value as Record<string, unknown>)[g]);
      if (m) out[g] = m;
    }
  }
  return out;
}

const CACHE_KEY = 'sw.tabs.mode';
let installation: { mode: TabMode; groups: TabModeGroups } = { mode: TAB_MODE_DEFAULT, groups: {} };
let own: { mode: TabMode | null; groups: TabModeGroups } = { mode: null, groups: {} };
let user: string | null = null;
let remote = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

/** The shell, its rows and the screens with their own chip rows follow every change of the mode. */
export function onTabsMode(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Is the viewport the phone's? (the mode does not apply above it). */
export function isPhoneWidth(): boolean {
  try {
    return window.matchMedia(`(max-width: ${TAB_MODE_MAX_WIDTH}px)`).matches;
  } catch {
    return false;
  }
}

/** The configured mode of a group (user over installation, group over global), regardless of the screen width. */
export function configuredTabMode(group: TabGroup): TabMode {
  return resolveTabMode(group).mode;
}

/** Where a group's configured mode comes from (the settings card names it, so a personal value that hides a changed default is visible). */
export type TabModeSource = 'own-group' | 'own' | 'installation-group' | 'installation';

/** THE resolver (the shell's rows, the screens' chip rows and the settings card all go through it): user's group, user's global,
 * installation's group, installation's global. The built-in `tabs` default is the installation value when nothing was saved. */
export function resolveTabMode(group: TabGroup): { mode: TabMode; source: TabModeSource } {
  const og = own.groups[group];
  if (og) return { mode: og, source: 'own-group' };
  if (own.mode) return { mode: own.mode, source: 'own' };
  const ig = installation.groups[group];
  if (ig) return { mode: ig, source: 'installation-group' };
  return { mode: installation.mode, source: 'installation' };
}

/**
 * THE helper every tab row asks, next to nav.ts `tabStyleOf`: how the group is presented now. `tabs` on a screen wider than the phone
 * (or when `phone` says so), else the configured mode. `phone` lets a caller that already knows its width (the shell) pass it.
 */
export function tabModeOf(group: TabGroup, phone: boolean = isPhoneWidth()): TabMode {
  return phone ? configuredTabMode(group) : 'tabs';
}

/** What a tab bar of a group gets for sw-tabs: the bar's own style while the mode is `tabs` (nothing changes), `dropdown`, or `adaptive` for the hybrid. */
export function tabModeProps<S extends string>(group: TabGroup, style: S, phone: boolean = isPhoneWidth()): { variant: S | 'dropdown'; adaptive: boolean } {
  const mode = tabModeOf(group, phone);
  return { variant: mode === 'dropdown' ? 'dropdown' : style, adaptive: mode === 'hybrid' };
}

/** A Lit reactive controller for a screen that draws its own tab / chip row: it re-renders the host when the mode changes and when
 * the viewport crosses the phone width. `this.mode = new TabsModeController(this, 'multimedia')`; then `this.mode.value`. */
export class TabsModeController {
  private mq: MediaQueryList | null = null;
  private stop?: () => void;
  constructor(private host: { requestUpdate(): void; addController(c: unknown): void }, private group: TabGroup) {
    host.addController(this);
  }
  get value(): TabMode {
    return tabModeOf(this.group);
  }
  /** `variant` / `adaptive` for an sw-tabs of this group. */
  props<S extends string>(style: S): { variant: S | 'dropdown'; adaptive: boolean } {
    return tabModeProps(this.group, style);
  }
  private tick = () => this.host.requestUpdate();
  hostConnected() {
    this.stop = onTabsMode(this.tick);
    try {
      this.mq = window.matchMedia(`(max-width: ${TAB_MODE_MAX_WIDTH}px)`);
      this.mq.addEventListener('change', this.tick);
    } catch {
      this.mq = null;
    }
  }
  hostDisconnected() {
    this.stop?.();
    this.mq?.removeEventListener('change', this.tick);
    this.mq = null;
  }
}

export function installationTabsMode(): { mode: TabMode; groups: TabModeGroups } {
  return installation;
}

/** The user's own values: `mode` null = follows the installation; `groups` holds only the groups they set. */
export function ownTabsMode(): { mode: TabMode | null; groups: TabModeGroups } {
  return own;
}

/** The installation default (the product settings): at load, and right after the settings screen saved it. */
export function setInstallationTabsMode(settings: Record<string, unknown> | null | undefined): void {
  installation = { mode: asTabMode(settings?.['ui.tabs_mode']) ?? TAB_MODE_DEFAULT, groups: normalizeTabModeGroups(settings?.['ui.tabs_mode_groups']) };
  notify();
}

function readCache(): { u: string; mode: TabMode | null; groups: TabModeGroups } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { u?: unknown; mode?: unknown; groups?: unknown };
    return typeof c.u === 'string' ? { u: c.u, mode: asTabMode(c.mode), groups: normalizeTabModeGroups(c.groups) } : null;
  } catch {
    return null;
  }
}

function writeCache(u: string, v: { mode: TabMode | null; groups: TabModeGroups }): void {
  try {
    if (!v.mode && !Object.keys(v.groups).length) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify({ u, mode: v.mode, groups: v.groups }));
  } catch {
    /* storage unavailable: the server copy still applies after load */
  }
}

/** Once the session is known: this user's cached choice at once (first paint; a cached copy belongs to one user id), then the server's. */
export async function loadTabsMode(userId: string, api: boolean): Promise<void> {
  user = userId;
  remote = api;
  const cached = readCache();
  own = cached && cached.u === userId ? { mode: cached.mode, groups: cached.groups } : { mode: null, groups: {} };
  notify();
  if (!api) return;
  try {
    const p = await getMyPrefs();
    if (user !== userId) return;
    const stored = Array.isArray(p.stored) ? p.stored : [];
    const next = {
      mode: stored.includes('ui.tabs_mode') ? asTabMode(p.prefs['ui.tabs_mode']) : null,
      groups: stored.includes('ui.tabs_mode_groups') ? normalizeTabModeGroups(p.prefs['ui.tabs_mode_groups']) : {},
    };
    writeCache(userId, next);
    own = next;
    notify();
  } catch {
    /* an older backend, or offline: keep the cached copy */
  }
}

/**
 * Save the user's own choice: `mode` null = follow the installation, `groups` only the overrides (an empty object = none). Optimistic;
 * reverted when the server refuses. The static demo has no backend: the choice then lives in this browser only.
 */
export async function saveOwnTabsMode(mode: TabMode | null, groups: TabModeGroups): Promise<void> {
  const before = own;
  own = { mode, groups };
  if (user) writeCache(user, own);
  notify();
  if (!remote) return;
  const who = user;
  try {
    await putMyPrefs({ 'ui.tabs_mode': mode, 'ui.tabs_mode_groups': Object.keys(groups).length ? (groups as Record<string, string>) : null });
  } catch (err) {
    if (user !== who) return;
    own = before;
    if (user) writeCache(user, before);
    notify();
    throw err;
  }
}
