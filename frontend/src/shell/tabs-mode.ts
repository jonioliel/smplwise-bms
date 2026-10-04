/**
 * Release 0.1.153 (owner decision): how a group of tabs is presented on the phone - as `tabs` (today, the default everywhere), as a
 * `hybrid` (a segmented control for three items or fewer, a dropdown for more) or as a `dropdown`.
 *
 * Applies per tab GROUP (the main bottom navigation is not one): `home` (the areas chip row of the home screen), `area` (the sub-tabs of
 * the home / map / WisKey areas), `multimedia`, `security` (both rows) and `settings`. A global value plus a per-group override, owned
 * twice: the installation's (`ui.tabs_mode`, `ui.tabs_mode_groups` product settings) and the user's own (the same keys of /me/prefs;
 * null = follow the installation). The effective value for a group, first match wins:
 *   the user's group override, the user's global value, the installation's group override, the installation's global value, `tabs`.
 * Presentation only (nothing here is a permission). Since 0.1.157 the mode takes effect on EVERY width: `tabModeOf` answers the
 * configured mode on a wide screen too (before it answered `tabs` above 767 px). Backend validation: services/tabs_mode.py (same
 * closed lists).
 *
 * 0.1.157: the width gate is gone (the dropdown works on every width; `hybrid` keeps its three-item rule), and the LOOK of the dropdown
 * is a second setting of the same shape: `DdStyle` (auto = today's look | pill | field | underline | text | prefix | tonal), global
 * plus per tab group, installation (`ui.dd_style`, `ui.dd_style_groups`) and personal (/me/prefs), resolved by `resolveDdStyle`.
 * Backend validation: services/dd_style.py.
 */
import { getMyPrefs, putMyPrefs } from '../api/me-prefs';
import { DD_STYLE_IDS, type DdStyle } from '../components/dd-style';

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
/** The phone's width (the shell's phone layout, the pair row); the mode itself no longer depends on it (0.1.157). */
export const TAB_MODE_MAX_WIDTH = 767;
/** `hybrid`: up to this many items stay a segmented control. */
export const HYBRID_MAX_ITEMS = 3;

export type TabModeGroups = Partial<Record<TabGroup, TabMode>>;

export type { DdStyle };
export const DD_STYLES: readonly DdStyle[] = DD_STYLE_IDS;
export const DD_STYLE_DEFAULT: DdStyle = 'auto';
export const DD_STYLE_LABEL: Record<DdStyle, string> = { auto: 'כמו היום', pill: 'כמוסה', field: 'שדה מעוגל', underline: 'קו תחתון', text: 'טקסט', prefix: 'קידומת קבוצה', tonal: 'גוון הדגשה' };
export type DdStyleGroups = Partial<Record<TabGroup, DdStyle>>;

/** How a dropdown opens on a PHONE (owner decision 2026-10-03): a bottom sheet (default) or the regular small list under the field.
 * One global value, installation (`ui.dd_phone`) and personal (/me/prefs; null = follow the installation). Backend twin: services/dd_style.py. */
export type DdPhone = 'sheet' | 'list';
export const DD_PHONES: readonly DdPhone[] = ['sheet', 'list'];
export const DD_PHONE_DEFAULT: DdPhone = 'sheet';
export const DD_PHONE_LABEL: Record<DdPhone, string> = { sheet: 'גיליון שעולה מלמטה', list: 'רשימה קטנה מתחת לשדה' };
export function asDdPhone(v: unknown): DdPhone | null {
  return typeof v === 'string' && (DD_PHONES as readonly string[]).includes(v) ? (v as DdPhone) : null;
}

export function asTabMode(v: unknown): TabMode | null {
  return typeof v === 'string' && (TAB_MODES as readonly string[]).includes(v) ? (v as TabMode) : null;
}

export function asDdStyle(v: unknown): DdStyle | null {
  return typeof v === 'string' && (DD_STYLES as readonly string[]).includes(v) ? (v as DdStyle) : null;
}

/** The stored per-group dropdown styles, reduced to known groups and styles (a stored string is parsed); never throws. */
export function normalizeDdStyleGroups(raw: unknown): DdStyleGroups {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  const out: DdStyleGroups = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const g of TAB_GROUPS) {
      const m = asDdStyle((value as Record<string, unknown>)[g]);
      if (m) out[g] = m;
    }
  }
  return out;
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
let ddInstallation: { style: DdStyle; groups: DdStyleGroups } = { style: DD_STYLE_DEFAULT, groups: {} };
let ddOwn: { style: DdStyle | null; groups: DdStyleGroups } = { style: null, groups: {} };
let ddPhoneInstallation: DdPhone = DD_PHONE_DEFAULT;
let ddPhoneOwn: DdPhone | null = null;
let user: string | null = null;
let remote = false;
const listeners = new Set<() => void>();

/** The effective phone choice (user over installation) as an attribute of <html>, which `sw-dropdown` reads when a list opens. */
function applyDdPhone(): void {
  try {
    document.documentElement.setAttribute('data-dd-phone', ddPhoneOwn ?? ddPhoneInstallation);
  } catch {
    /* no document (unit specs under node) */
  }
}

function notify(): void {
  applyDdPhone();
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
 * THE helper every tab row asks, next to nav.ts `tabStyleOf`: how the group is presented now - the configured mode on EVERY width
 * (0.1.157: the phone-only gate was removed). The second argument is kept so existing callers compile; it no longer matters.
 */
export function tabModeOf(group: TabGroup, _phone?: boolean): TabMode {
  return configuredTabMode(group);
}

/** Where a group's dropdown style comes from: user's group, user's global, installation's group, installation's global, `auto`. */
export function resolveDdStyle(group: TabGroup): { style: DdStyle; source: TabModeSource } {
  const og = ddOwn.groups[group];
  if (og) return { style: og, source: 'own-group' };
  if (ddOwn.style) return { style: ddOwn.style, source: 'own' };
  const ig = ddInstallation.groups[group];
  if (ig) return { style: ig, source: 'installation-group' };
  return { style: ddInstallation.style, source: 'installation' };
}

/** The dropdown style a group's chips get now (`auto` = today's look). */
export function ddStyleOf(group: TabGroup): DdStyle {
  return resolveDdStyle(group).style;
}

/** What a tab bar of a group gets for sw-tabs: the bar's own style while the mode is `tabs` (nothing changes), `dropdown`, or `adaptive` for the hybrid; `ddStyle` is the look of the dropdown. */
export function tabModeProps<S extends string>(group: TabGroup, style: S, _phone?: boolean): { variant: S | 'dropdown'; adaptive: boolean; ddStyle: DdStyle } {
  const mode = tabModeOf(group);
  return { variant: mode === 'dropdown' ? 'dropdown' : style, adaptive: mode === 'hybrid', ddStyle: ddStyleOf(group) };
}

/** A Lit reactive controller for a screen that draws its own tab / chip row: it re-renders the host when the mode or the style changes
 * and when the viewport crosses the phone width. `this.mode = new TabsModeController(this, 'multimedia')`; then `this.mode.value`. */
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
  props<S extends string>(style: S): { variant: S | 'dropdown'; adaptive: boolean; ddStyle: DdStyle } {
    return tabModeProps(this.group, style);
  }
  /** The look of this group's dropdown chips. */
  get ddStyle(): DdStyle {
    return ddStyleOf(this.group);
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

/** The effective phone choice: the user's own over the installation's. */
export function resolveDdPhone(): { mode: DdPhone; source: 'own' | 'installation' } {
  return ddPhoneOwn ? { mode: ddPhoneOwn, source: 'own' } : { mode: ddPhoneInstallation, source: 'installation' };
}

export function installationDdPhone(): DdPhone {
  return ddPhoneInstallation;
}

/** The user's own phone choice; null = follows the installation. */
export function ownDdPhone(): DdPhone | null {
  return ddPhoneOwn;
}

export function installationDdStyle(): { style: DdStyle; groups: DdStyleGroups } {
  return ddInstallation;
}

/** The user's own dropdown styles: `style` null = follows the installation; `groups` holds only the groups they set. */
export function ownDdStyle(): { style: DdStyle | null; groups: DdStyleGroups } {
  return ddOwn;
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
  ddInstallation = { style: asDdStyle(settings?.['ui.dd_style']) ?? DD_STYLE_DEFAULT, groups: normalizeDdStyleGroups(settings?.['ui.dd_style_groups']) };
  ddPhoneInstallation = asDdPhone(settings?.['ui.dd_phone']) ?? DD_PHONE_DEFAULT;
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

const DD_CACHE_KEY = 'sw.dd.style';
const DD_PHONE_CACHE_KEY = 'sw.dd.phone';

function readDdPhoneCache(): { u: string; mode: DdPhone | null } | null {
  try {
    const raw = localStorage.getItem(DD_PHONE_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { u?: unknown; mode?: unknown };
    return typeof c.u === 'string' ? { u: c.u, mode: asDdPhone(c.mode) } : null;
  } catch {
    return null;
  }
}

function writeDdPhoneCache(u: string, mode: DdPhone | null): void {
  try {
    if (!mode) localStorage.removeItem(DD_PHONE_CACHE_KEY);
    else localStorage.setItem(DD_PHONE_CACHE_KEY, JSON.stringify({ u, mode }));
  } catch {
    /* storage unavailable: the server copy still applies after load */
  }
}

function readDdCache(): { u: string; style: DdStyle | null; groups: DdStyleGroups } | null {
  try {
    const raw = localStorage.getItem(DD_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { u?: unknown; style?: unknown; groups?: unknown };
    return typeof c.u === 'string' ? { u: c.u, style: asDdStyle(c.style), groups: normalizeDdStyleGroups(c.groups) } : null;
  } catch {
    return null;
  }
}

function writeDdCache(u: string, v: { style: DdStyle | null; groups: DdStyleGroups }): void {
  try {
    if (!v.style && !Object.keys(v.groups).length) localStorage.removeItem(DD_CACHE_KEY);
    else localStorage.setItem(DD_CACHE_KEY, JSON.stringify({ u, style: v.style, groups: v.groups }));
  } catch {
    /* storage unavailable: the server copy still applies after load */
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
  const ddCached = readDdCache();
  ddOwn = ddCached && ddCached.u === userId ? { style: ddCached.style, groups: ddCached.groups } : { style: null, groups: {} };
  const phoneCached = readDdPhoneCache();
  ddPhoneOwn = phoneCached && phoneCached.u === userId ? phoneCached.mode : null;
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
    const ddNext = {
      style: stored.includes('ui.dd_style') ? asDdStyle(p.prefs['ui.dd_style']) : null,
      groups: stored.includes('ui.dd_style_groups') ? normalizeDdStyleGroups(p.prefs['ui.dd_style_groups']) : {},
    };
    writeDdCache(userId, ddNext);
    ddOwn = ddNext;
    ddPhoneOwn = stored.includes('ui.dd_phone') ? asDdPhone(p.prefs['ui.dd_phone']) : null;
    writeDdPhoneCache(userId, ddPhoneOwn);
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

/** Save the user's own dropdown style: `style` null = follow the installation, `groups` only the overrides. Optimistic, reverted on refusal (as saveOwnTabsMode). */
export async function saveOwnDdStyle(style: DdStyle | null, groups: DdStyleGroups): Promise<void> {
  const before = ddOwn;
  ddOwn = { style, groups };
  if (user) writeDdCache(user, ddOwn);
  notify();
  if (!remote) return;
  const who = user;
  try {
    await putMyPrefs({ 'ui.dd_style': style, 'ui.dd_style_groups': Object.keys(groups).length ? (groups as Record<string, string>) : null });
  } catch (err) {
    if (user !== who) return;
    ddOwn = before;
    if (user) writeDdCache(user, before);
    notify();
    throw err;
  }
}

/** Save the user's own phone choice: null = follow the installation. Optimistic, reverted on refusal (as saveOwnDdStyle). */
export async function saveOwnDdPhone(mode: DdPhone | null): Promise<void> {
  const before = ddPhoneOwn;
  ddPhoneOwn = mode;
  if (user) writeDdPhoneCache(user, mode);
  notify();
  if (!remote) return;
  const who = user;
  try {
    await putMyPrefs({ 'ui.dd_phone': mode });
  } catch (err) {
    if (user !== who) return;
    ddPhoneOwn = before;
    if (user) writeDdPhoneCache(user, before);
    notify();
    throw err;
  }
}
