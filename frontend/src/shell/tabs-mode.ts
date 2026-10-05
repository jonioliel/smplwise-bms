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
import { DD_PANEL_DEFAULT, DD_PANEL_IDS, DD_PICKER_DEFAULT, DD_PICKER_IDS, DD_RING_DEFAULT, DD_RING_IDS, DD_SEARCH_DEFAULT, DD_SEARCH_IDS, DD_SIZE_DEFAULT, DD_SIZE_IDS, DD_STYLE_IDS, type DdPanel, type DdPicker, type DdRing, type DdSearch, type DdSize, type DdStyle } from '../components/dd-style';

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
export const DD_STYLE_LABEL: Record<DdStyle, string> = { auto: 'כמו היום', pill: 'כדור מלא', field: 'שדה מעוגל', underline: 'קו תחתון', text: 'טקסט', prefix: 'קידומת קבוצה', tonal: 'גוון הדגשה', capsule: 'קפסולה' };
export type DdStyleGroups = Partial<Record<TabGroup, DdStyle>>;

/** Unreleased (owner request 2026-10-04): the SIZE of a dropdown, `md` = the reference size. Same shape as the style: global + per tab group,
 * installation (`ui.dd_size`, `ui.dd_size_groups`) and personal (/me/prefs). Backend twin: services/dd_style.py. */
export type { DdSize };
export const DD_SIZES: readonly DdSize[] = DD_SIZE_IDS;
export const DD_SIZE_LABEL: Record<DdSize, string> = { sm: 'קטן', md: 'רגיל', lg: 'גדול' };
export type DdSizeGroups = Partial<Record<TabGroup, DdSize>>;
export function asDdSize(v: unknown): DdSize | null {
  return typeof v === 'string' && (DD_SIZES as readonly string[]).includes(v) ? (v as DdSize) : null;
}

/** Unreleased (owner decisions 2026-10-04, capsule style only): the ring thickness and the open-panel width. Same shape as the size dial (global + per tab
 * group, installation `ui.dd_<key>` / `ui.dd_<key>_groups` and personal /me/prefs, null = follow the installation), kept by one small generic store. Backend twin: services/dd_style.py. */
export type { DdRing, DdPanel };
export const DD_RINGS: readonly DdRing[] = DD_RING_IDS;
export const DD_RING_LABEL: Record<DdRing, string> = { '1': '1 פיקסל', '1.5': '1.5 פיקסל', '2': '2 פיקסלים', '3': '3 פיקסלים' };
export const DD_PANELS: readonly DdPanel[] = DD_PANEL_IDS;
export const DD_PANEL_LABEL: Record<DdPanel, string> = { button: 'ברוחב הכפתור', '240': '240 פיקסלים', '300': '300 פיקסלים' };
export type DdRingGroups = Partial<Record<TabGroup, DdRing>>;
export type DdPanelGroups = Partial<Record<TabGroup, DdPanel>>;
export function asDdRing(v: unknown): DdRing | null {
  return typeof v === 'string' && (DD_RINGS as readonly string[]).includes(v) ? (v as DdRing) : null;
}
export function asDdPanel(v: unknown): DdPanel | null {
  return typeof v === 'string' && (DD_PANELS as readonly string[]).includes(v) ? (v as DdPanel) : null;
}

/** How a dropdown opens on a PHONE (owner decision 2026-10-03): a bottom sheet or the regular small list under the field (the default from 2.0.3).
 * One global value, installation (`ui.dd_phone`) and personal (/me/prefs; null = follow the installation). Backend twin: services/dd_style.py. */
export type DdPhone = 'sheet' | 'list';
export const DD_PHONES: readonly DdPhone[] = ['sheet', 'list'];
export const DD_PHONE_DEFAULT: DdPhone = 'list';
export const DD_PHONE_LABEL: Record<DdPhone, string> = { sheet: 'גיליון שעולה מלמטה', list: 'רשימה קטנה מתחת לשדה' };
export function asDdPhone(v: unknown): DdPhone | null {
  return typeof v === 'string' && (DD_PHONES as readonly string[]).includes(v) ? (v as DdPhone) : null;
}

/** 2.0.2 (owner feedback 2026-10-05): from how many cameras a multi-select picker carries a search field, and how the camera comparison
 * picker is shown. Each one global value, installation (`ui.dd_search` / `ui.dd_picker`) and personal (/me/prefs; null = follow the
 * installation), the same shape as the phone choice. Backend twin: services/dd_style.py. */
export type { DdSearch, DdPicker };
export const DD_SEARCHES: readonly DdSearch[] = DD_SEARCH_IDS;
export const DD_SEARCH_LABEL: Record<DdSearch, string> = { always: 'תמיד', '4': 'מ־4 מצלמות', '8': 'מ־8 מצלמות', never: 'אף פעם' };
export const DD_PICKERS: readonly DdPicker[] = DD_PICKER_IDS;
export const DD_PICKER_LABEL: Record<DdPicker, string> = { dropdown: 'תפריט נפתח', chips: 'כפתורים' };
export function asDdSearch(v: unknown): DdSearch | null {
  return typeof v === 'string' && (DD_SEARCHES as readonly string[]).includes(v) ? (v as DdSearch) : null;
}
export function asDdPicker(v: unknown): DdPicker | null {
  return typeof v === 'string' && (DD_PICKERS as readonly string[]).includes(v) ? (v as DdPicker) : null;
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

/** The stored per-group dropdown sizes, reduced to known groups and sizes (a stored string is parsed); never throws. */
export function normalizeDdSizeGroups(raw: unknown): DdSizeGroups {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  const out: DdSizeGroups = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const g of TAB_GROUPS) {
      const m = asDdSize((value as Record<string, unknown>)[g]);
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
let ddSizeInstallation: { size: DdSize; groups: DdSizeGroups } = { size: DD_SIZE_DEFAULT, groups: {} };
let ddSizeOwn: { size: DdSize | null; groups: DdSizeGroups } = { size: null, groups: {} };
let ddPhoneInstallation: DdPhone = DD_PHONE_DEFAULT;
let ddPhoneOwn: DdPhone | null = null;
let user: string | null = null;
let remote = false;
const listeners = new Set<() => void>();

/** The effective phone choice (user over installation) as an attribute of <html>, which `sw-dropdown` reads when a list opens;
 * 2.0.2: the multi-select search threshold the same way (`data-dd-search`). */
function applyDdPhone(): void {
  try {
    document.documentElement.setAttribute('data-dd-phone', ddPhoneOwn ?? ddPhoneInstallation);
    document.documentElement.setAttribute('data-dd-search', searchChoice.resolve().value);
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

/** Where a group's dropdown size comes from: user's group, user's global, installation's group, installation's global, `md`. */
export function resolveDdSize(group: TabGroup): { size: DdSize; source: TabModeSource } {
  const og = ddSizeOwn.groups[group];
  if (og) return { size: og, source: 'own-group' };
  if (ddSizeOwn.size) return { size: ddSizeOwn.size, source: 'own' };
  const ig = ddSizeInstallation.groups[group];
  if (ig) return { size: ig, source: 'installation-group' };
  return { size: ddSizeInstallation.size, source: 'installation' };
}

/** The dropdown size a group's chips get now (`md` = the reference size). */
export function ddSizeOf(group: TabGroup): DdSize {
  return resolveDdSize(group).size;
}

/** What a tab bar of a group gets for sw-tabs: the bar's own style while the mode is `tabs` (nothing changes), `dropdown`, or `adaptive` for the hybrid; `ddStyle` is the look of the dropdown, `ddSize` its size. */
export function tabModeProps<S extends string>(group: TabGroup, style: S, _phone?: boolean): { variant: S | 'dropdown'; adaptive: boolean; ddStyle: DdStyle; ddSize: DdSize } {
  const mode = tabModeOf(group);
  return { variant: mode === 'dropdown' ? 'dropdown' : style, adaptive: mode === 'hybrid', ddStyle: ddStyleOf(group), ddSize: ddSizeOf(group) };
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
  props<S extends string>(style: S): { variant: S | 'dropdown'; adaptive: boolean; ddStyle: DdStyle; ddSize: DdSize } {
    return tabModeProps(this.group, style);
  }
  /** The look of this group's dropdown chips. */
  get ddStyle(): DdStyle {
    return ddStyleOf(this.group);
  }
  /** The size of this group's dropdown chips. */
  get ddSize(): DdSize {
    return ddSizeOf(this.group);
  }
  /** The capsule ring thickness and open-panel width of this group's dropdown chips. */
  get ddRing(): DdRing {
    return ddRingOf(this.group);
  }
  get ddPanel(): DdPanel {
    return ddPanelOf(this.group);
  }
  /** 2.0.2: how this screen's camera comparison picker is shown (one global value; the group does not matter). */
  get ddPicker(): DdPicker {
    return ddPickerOf();
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

type DialGroups<T extends string> = Partial<Record<TabGroup, T>>;
class Dial<T extends string> {
  inst: { value: T; groups: DialGroups<T> };
  own: { value: T | null; groups: DialGroups<T> } = { value: null, groups: {} };
  constructor(private key: string, private as: (v: unknown) => T | null, private def: T, private cacheKey: string) {
    this.inst = { value: def, groups: {} };
  }
  groupsOf(raw: unknown): DialGroups<T> {
    let value = raw;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }
    const out: DialGroups<T> = {};
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const g of TAB_GROUPS) {
        const m = this.as((value as Record<string, unknown>)[g]);
        if (m) out[g] = m;
      }
    }
    return out;
  }
  resolve(group: TabGroup): { value: T; source: TabModeSource } {
    const og = this.own.groups[group];
    if (og) return { value: og, source: 'own-group' };
    if (this.own.value) return { value: this.own.value, source: 'own' };
    const ig = this.inst.groups[group];
    if (ig) return { value: ig, source: 'installation-group' };
    return { value: this.inst.value, source: 'installation' };
  }
  setInstallation(settings: Record<string, unknown> | null | undefined): void {
    this.inst = { value: this.as(settings?.[`ui.dd_${this.key}`]) ?? this.def, groups: this.groupsOf(settings?.[`ui.dd_${this.key}_groups`]) };
  }
  private write(u: string, v: { value: T | null; groups: DialGroups<T> }): void {
    try {
      if (!v.value && !Object.keys(v.groups).length) localStorage.removeItem(this.cacheKey);
      else localStorage.setItem(this.cacheKey, JSON.stringify({ u, value: v.value, groups: v.groups }));
    } catch {
      /* storage unavailable: the server copy still applies after load */
    }
  }
  loadCache(userId: string): void {
    this.own = { value: null, groups: {} };
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return;
      const c = JSON.parse(raw) as { u?: unknown; value?: unknown; groups?: unknown };
      if (c.u === userId) this.own = { value: this.as(c.value), groups: this.groupsOf(c.groups) };
    } catch {
      /* unreadable cache: follow the installation */
    }
  }
  loadServer(userId: string, prefs: Record<string, unknown>, stored: string[]): void {
    const next = {
      value: stored.includes(`ui.dd_${this.key}`) ? this.as(prefs[`ui.dd_${this.key}`]) : null,
      groups: stored.includes(`ui.dd_${this.key}_groups`) ? this.groupsOf(prefs[`ui.dd_${this.key}_groups`]) : {},
    };
    this.write(userId, next);
    this.own = next;
  }
  async save(value: T | null, groups: DialGroups<T>): Promise<void> {
    const before = this.own;
    this.own = { value, groups };
    if (user) this.write(user, this.own);
    notify();
    if (!remote) return;
    const who = user;
    try {
      await putMyPrefs({ [`ui.dd_${this.key}`]: value, [`ui.dd_${this.key}_groups`]: Object.keys(groups).length ? (groups as Record<string, string>) : null } as Parameters<typeof putMyPrefs>[0]);
    } catch (err) {
      if (user !== who) return;
      this.own = before;
      if (user) this.write(user, before);
      notify();
      throw err;
    }
  }
}
const ringDial = new Dial<DdRing>('ring', asDdRing, DD_RING_DEFAULT, 'sw.dd.ring');
const panelDial = new Dial<DdPanel>('panel', asDdPanel, DD_PANEL_DEFAULT, 'sw.dd.panel');

/** 2.0.2: one GLOBAL choice (no per-group override), installation + own, cached per user id, saved optimistically - the phone choice's shape. */
class Choice<T extends string> {
  inst: T;
  own: T | null = null;
  constructor(private key: string, private as: (v: unknown) => T | null, private def: T, private cacheKey: string) {
    this.inst = def;
  }
  resolve(): { value: T; source: 'own' | 'installation' } {
    return this.own ? { value: this.own, source: 'own' } : { value: this.inst, source: 'installation' };
  }
  setInstallation(settings: Record<string, unknown> | null | undefined): void {
    this.inst = this.as(settings?.[`ui.dd_${this.key}`]) ?? this.def;
  }
  private write(u: string, v: T | null): void {
    try {
      if (!v) localStorage.removeItem(this.cacheKey);
      else localStorage.setItem(this.cacheKey, JSON.stringify({ u, value: v }));
    } catch {
      /* storage unavailable: the server copy still applies after load */
    }
  }
  loadCache(userId: string): void {
    this.own = null;
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return;
      const c = JSON.parse(raw) as { u?: unknown; value?: unknown };
      if (c.u === userId) this.own = this.as(c.value);
    } catch {
      /* unreadable cache: follow the installation */
    }
  }
  loadServer(userId: string, prefs: Record<string, unknown>, stored: string[]): void {
    this.own = stored.includes(`ui.dd_${this.key}`) ? this.as(prefs[`ui.dd_${this.key}`]) : null;
    this.write(userId, this.own);
  }
  async save(value: T | null): Promise<void> {
    const before = this.own;
    this.own = value;
    if (user) this.write(user, value);
    notify();
    if (!remote) return;
    const who = user;
    try {
      await putMyPrefs({ [`ui.dd_${this.key}`]: value } as Parameters<typeof putMyPrefs>[0]);
    } catch (err) {
      if (user !== who) return;
      this.own = before;
      if (user) this.write(user, before);
      notify();
      throw err;
    }
  }
}
const searchChoice = new Choice<DdSearch>('search', asDdSearch, DD_SEARCH_DEFAULT, 'sw.dd.search');
const pickerChoice = new Choice<DdPicker>('picker', asDdPicker, DD_PICKER_DEFAULT, 'sw.dd.picker');

/** The effective multi-select search threshold: the user's own over the installation's. */
export function resolveDdSearch(): { search: DdSearch; source: 'own' | 'installation' } {
  const r = searchChoice.resolve();
  return { search: r.value, source: r.source };
}
export const installationDdSearch = (): DdSearch => searchChoice.inst;
/** The user's own threshold; null = follows the installation. */
export const ownDdSearch = (): DdSearch | null => searchChoice.own;
export const saveOwnDdSearch = (search: DdSearch | null): Promise<void> => searchChoice.save(search);

/** The effective camera-picker look: the user's own over the installation's. */
export function resolveDdPicker(): { picker: DdPicker; source: 'own' | 'installation' } {
  const r = pickerChoice.resolve();
  return { picker: r.value, source: r.source };
}
/** How the camera comparison pickers (recordings, synchronized playback) are drawn now. */
export const ddPickerOf = (): DdPicker => pickerChoice.resolve().value;
export const installationDdPicker = (): DdPicker => pickerChoice.inst;
/** The user's own choice; null = follows the installation. */
export const ownDdPicker = (): DdPicker | null => pickerChoice.own;
export const saveOwnDdPicker = (picker: DdPicker | null): Promise<void> => pickerChoice.save(picker);

export function resolveDdRing(group: TabGroup): { ring: DdRing; source: TabModeSource } {
  const r = ringDial.resolve(group);
  return { ring: r.value, source: r.source };
}
/** The ring thickness (px, as an id) a group's capsule dropdowns get now; other styles ignore it. */
export function ddRingOf(group: TabGroup): DdRing {
  return ringDial.resolve(group).value;
}
export function installationDdRing(): { ring: DdRing; groups: DdRingGroups } {
  return { ring: ringDial.inst.value, groups: ringDial.inst.groups };
}
export function ownDdRing(): { ring: DdRing | null; groups: DdRingGroups } {
  return { ring: ringDial.own.value, groups: ringDial.own.groups };
}
export const saveOwnDdRing = (ring: DdRing | null, groups: DdRingGroups): Promise<void> => ringDial.save(ring, groups);
export function normalizeDdRingGroups(raw: unknown): DdRingGroups {
  return ringDial.groupsOf(raw);
}

export function resolveDdPanel(group: TabGroup): { panel: DdPanel; source: TabModeSource } {
  const r = panelDial.resolve(group);
  return { panel: r.value, source: r.source };
}
/** The open-panel width a group's capsule dropdowns get now; other styles ignore it. */
export function ddPanelOf(group: TabGroup): DdPanel {
  return panelDial.resolve(group).value;
}
export function installationDdPanel(): { panel: DdPanel; groups: DdPanelGroups } {
  return { panel: panelDial.inst.value, groups: panelDial.inst.groups };
}
export function ownDdPanel(): { panel: DdPanel | null; groups: DdPanelGroups } {
  return { panel: panelDial.own.value, groups: panelDial.own.groups };
}
export const saveOwnDdPanel = (panel: DdPanel | null, groups: DdPanelGroups): Promise<void> => panelDial.save(panel, groups);
export function normalizeDdPanelGroups(raw: unknown): DdPanelGroups {
  return panelDial.groupsOf(raw);
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

export function installationDdSize(): { size: DdSize; groups: DdSizeGroups } {
  return ddSizeInstallation;
}

/** The user's own dropdown sizes: `size` null = follows the installation; `groups` holds only the groups they set. */
export function ownDdSize(): { size: DdSize | null; groups: DdSizeGroups } {
  return ddSizeOwn;
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
  ddSizeInstallation = { size: asDdSize(settings?.['ui.dd_size']) ?? DD_SIZE_DEFAULT, groups: normalizeDdSizeGroups(settings?.['ui.dd_size_groups']) };
  ringDial.setInstallation(settings);
  panelDial.setInstallation(settings);
  searchChoice.setInstallation(settings);
  pickerChoice.setInstallation(settings);
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
const DD_SIZE_CACHE_KEY = 'sw.dd.size';

function readDdSizeCache(): { u: string; size: DdSize | null; groups: DdSizeGroups } | null {
  try {
    const raw = localStorage.getItem(DD_SIZE_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { u?: unknown; size?: unknown; groups?: unknown };
    return typeof c.u === 'string' ? { u: c.u, size: asDdSize(c.size), groups: normalizeDdSizeGroups(c.groups) } : null;
  } catch {
    return null;
  }
}

function writeDdSizeCache(u: string, v: { size: DdSize | null; groups: DdSizeGroups }): void {
  try {
    if (!v.size && !Object.keys(v.groups).length) localStorage.removeItem(DD_SIZE_CACHE_KEY);
    else localStorage.setItem(DD_SIZE_CACHE_KEY, JSON.stringify({ u, size: v.size, groups: v.groups }));
  } catch {
    /* storage unavailable: the server copy still applies after load */
  }
}

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
  const sizeCached = readDdSizeCache();
  ddSizeOwn = sizeCached && sizeCached.u === userId ? { size: sizeCached.size, groups: sizeCached.groups } : { size: null, groups: {} };
  ringDial.loadCache(userId);
  panelDial.loadCache(userId);
  searchChoice.loadCache(userId);
  pickerChoice.loadCache(userId);
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
    const sizeNext = {
      size: stored.includes('ui.dd_size') ? asDdSize(p.prefs['ui.dd_size']) : null,
      groups: stored.includes('ui.dd_size_groups') ? normalizeDdSizeGroups(p.prefs['ui.dd_size_groups']) : {},
    };
    writeDdSizeCache(userId, sizeNext);
    ddSizeOwn = sizeNext;
    ringDial.loadServer(userId, p.prefs as Record<string, unknown>, stored);
    panelDial.loadServer(userId, p.prefs as Record<string, unknown>, stored);
    searchChoice.loadServer(userId, p.prefs as Record<string, unknown>, stored);
    pickerChoice.loadServer(userId, p.prefs as Record<string, unknown>, stored);
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

/** Save the user's own dropdown size: `size` null = follow the installation, `groups` only the overrides. Optimistic, reverted on refusal (as saveOwnDdStyle). */
export async function saveOwnDdSize(size: DdSize | null, groups: DdSizeGroups): Promise<void> {
  const before = ddSizeOwn;
  ddSizeOwn = { size, groups };
  if (user) writeDdSizeCache(user, ddSizeOwn);
  notify();
  if (!remote) return;
  const who = user;
  try {
    await putMyPrefs({ 'ui.dd_size': size, 'ui.dd_size_groups': Object.keys(groups).length ? (groups as Record<string, string>) : null });
  } catch (err) {
    if (user !== who) return;
    ddSizeOwn = before;
    if (user) writeDdSizeCache(user, before);
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
