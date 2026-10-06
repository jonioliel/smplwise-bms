import type { IconName } from '../components/sw-icon';
import type { TabItem } from '../components/sw-tabs';
import type { RouteState } from '../router';
import type { WiskeyCatalog, WiskeyLocation } from '../wiskey/embed-connector';
import type { TabGroup } from './tabs-mode';
import { ALL_CAPABILITIES } from '../api/capabilities';
import { applyCapabilities, capHiddenHref, needsOfSegments, segmentsOfHref } from './nav-capabilities';
import type { TabsConfig, TabsSectionConfig, TabStyle, TabStyleDefaults } from '../api/media';

/** The WisKey area's tabs before (or without) a WisKey embed API handshake: the older panel's tabs. The first three are
 * the screens SMPLWISE built (CR-005 phase 1b and 2); each renders either that screen or WisKey's own Home Assistant
 * panel embedded as-is, by הגדרות › בקרות כניסה (CR-005 recorded decision 2026-09-28, embedded panel - the embed is the
 * default). The rest exist only in WisKey's panel and are always embedded (WISKEY_PANEL_TABS). */
const STATIC_WISKEY_TABS: readonly TabItem[] = [
  { id: 'overview', label: 'מרכז הכניסה', href: '#/wiskey/overview' },
  { id: 'events', label: 'פעילות', href: '#/wiskey/events' },
  { id: 'people', label: 'אנשים', href: '#/wiskey/people' },
  { id: 'devices', label: 'עמדות', href: '#/wiskey/devices' },
  { id: 'sync', label: 'סנכרון', href: '#/wiskey/sync' },
  { id: 'health', label: 'בריאות', href: '#/wiskey/health' },
  { id: 'audit', label: 'יומן שינויים', href: '#/wiskey/audit' },
  { id: 'tools', label: 'ניהול', href: '#/wiskey/tools' },
];

/** The WisKey area's tabs (AREA_TABS.wiskey is this same array, so the phone bottom bar follows too). WisKey embed API v1 (rc.19+): once the embedded panel's `wiskey:ready`
 * arrives, `setWiskeyEmbedNav` rebuilds it IN PLACE from the catalog - the user's permitted top-level screens with
 * WisKey's own labels (ids kept apart from labels; WisKey's `users` stays SMPLWISE's `people` segment, so the per-screen
 * choice and old bookmarks keep working). Until then, and for an older WisKey, the static list above. */
export const WISKEY_TABS: TabItem[] = [...STATIC_WISKEY_TABS];

/** WisKey tab id → SMPLWISE route segment (only `users` differs: SMPLWISE has always called it `people`). */
export function wiskeySegmentOf(tab: string): string {
  return tab === 'users' ? 'people' : tab;
}

/** SMPLWISE route of a WisKey location: `/wiskey/<segment>[/<tool>]` (a tool only under `tools`). */
export function wiskeyPath(loc: { tab: string; tool?: string | null }): string {
  const seg = `/wiskey/${encodeURIComponent(wiskeySegmentOf(loc.tab))}`;
  return loc.tab === 'tools' && loc.tool ? `${seg}/${encodeURIComponent(loc.tool)}` : seg;
}

/** A WisKey-area href (`#/wiskey/...`): these need access.read at installation scope and hide with ui.hide_wiskey. */
export function isWiskeyHref(href: string): boolean {
  return href.startsWith('#/wiskey/');
}

/** The WisKey embed's navigation as last reported by the embedded panel (embed API v1): the handshake's catalog (kept
 * for the session, so leaving for a SMPLWISE WisKey screen does not flip the tab row back) and the CONFIRMED location
 * while an embed is attached (null otherwise). The shell re-renders on every change. */
export interface WiskeyEmbedNav {
  catalog: WiskeyCatalog | null;
  confirmed: WiskeyLocation | null;
}
let embedNav: WiskeyEmbedNav = { catalog: null, confirmed: null };
const embedNavListeners = new Set<() => void>();

export function wiskeyEmbedNav(): WiskeyEmbedNav {
  return embedNav;
}

export function onWiskeyEmbedNav(listener: () => void): () => void {
  embedNavListeners.add(listener);
  return () => embedNavListeners.delete(listener);
}

/** Record the embed's state; a `catalog` key rebuilds WISKEY_TABS (null = the static list: an older WisKey). */
export function setWiskeyEmbedNav(patch: Partial<WiskeyEmbedNav>): void {
  embedNav = { ...embedNav, ...patch };
  if ('catalog' in patch) rebuildWiskeyTabs();
  for (const l of embedNavListeners) l();
}

/** WISKEY_TABS from the catalog (or the static list). A screen the owner set to SMPLWISE in הגדרות › בקרות כניסה
 * (מרכז הכניסה / פעילות / אנשים) is SMPLWISE's own screen, governed by SMPLWISE's access.read, not by WisKey: it stays in
 * the row even when this operator's WisKey catalog does not list it, at its usual place. */
function rebuildWiskeyTabs(): void {
  const catalog = embedNav.catalog;
  const order = STATIC_WISKEY_TABS.map((t) => t.id);
  const labels = new Map(STATIC_WISKEY_TABS.map((t) => [t.id, t.label]));
  const next: TabItem[] = catalog
    ? catalog.tabs
        .filter((t) => t.id)
        .map((t) => {
          const seg = wiskeySegmentOf(t.id);
          return { id: seg, label: t.label.trim() || labels.get(seg) || t.id, href: `#${wiskeyPath({ tab: t.id })}` };
        })
    : [...STATIC_WISKEY_TABS];
  if (catalog) {
    for (const s of WISKEY_SCREENS) {
      if (WISKEY_UI[s] !== 'smplwise' || next.some((t) => t.id === s)) continue;
      const own = STATIC_WISKEY_TABS.find((t) => t.id === s)!;
      const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
      const at = next.findIndex((t) => rank(t.id) > rank(s));
      next.splice(at < 0 ? next.length : at, 0, { ...own });
    }
  }
  WISKEY_TABS.splice(0, WISKEY_TABS.length, ...next);
}

/** What a WisKey route asks the embed to show. The confirmed-location mirror (`wiskey_tab` / `wiskey_tool` in the
 * route's query) wins when present - it is what the panel last confirmed; otherwise the path: `/wiskey/<segment>` or
 * `/wiskey/tools/<tool>`. */
export function wiskeyRequest(r: RouteState | null): WiskeyLocation {
  const mirroredTab = r?.params.get('wiskey_tab');
  if (mirroredTab) return { tab: mirroredTab, tool: r?.params.get('wiskey_tool') || null };
  const seg = wiskeyPathSegment(r);
  const tab = WISKEY_PANEL_TABS[seg] ?? seg;
  const tool = tab === 'tools' && r?.segments[2] ? safeDecode(r.segments[2]) : null;
  return { tab, tool };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The WisKey tab the tab row marks: the embed's confirmed location while one is attached (a click keeps the previous
 * selection until the panel confirms), otherwise the route. A screen the owner switched to SMPLWISE is never the
 * embed, so its route decides. */
function wiskeyActiveTab(r: RouteState | null): string {
  const path = wiskeyPathSegment(r);
  const own = (WISKEY_SCREENS as string[]).includes(path) && WISKEY_UI[path as WiskeyScreen] === 'smplwise';
  if (own) return path;
  const confirmed = embedNav.confirmed;
  return wiskeySegmentOf(confirmed ? confirmed.tab : wiskeyRequest(r).tab);
}

/** The SMPLWISE screens with a choice in הגדרות › בקרות כניסה (settings keys `access.ui.<screen>`). */
export type WiskeyScreen = 'overview' | 'events' | 'people';
export type WiskeyUi = 'wiskey' | 'smplwise';
export const WISKEY_SCREENS: WiskeyScreen[] = ['overview', 'events', 'people'];

/** The owner's choice per screen; 'wiskey' (the embedded panel) until the product settings say otherwise. Filled by the
 * shell once the settings load and by the settings screen after a save. */
export const WISKEY_UI: Record<WiskeyScreen, WiskeyUi> = { overview: 'wiskey', events: 'wiskey', people: 'wiskey' };

/** הגדרות › בקרות כניסה, experimental (`access.phone_embed`, default off): embed WisKey inside the Companion app too,
 * through the sign-in relay of `wiskey/companion-bridge.ts`. Off = the 0.1.123 behaviour (no frame in the app). */
export let WISKEY_PHONE_EMBED = false;

/** הגדרות › ממשק › "גודל תצוגת WisKey" (`ui.wiskey_size` / `ui.wiskey_scale`, owner 2026-09-30): how much of the screen the
 * embedded panel uses. normal = the content area at 100% (default); fit = the frame is rendered 1/scale larger and scaled
 * down; full = the whole viewport. The embed re-reads it on the `sw-wiskey-size` window event. */
export type WiskeySize = 'normal' | 'fit' | 'full';
export const WISKEY_SIZE_EVENT = 'sw-wiskey-size';
export let WISKEY_SIZE: WiskeySize = 'normal';
export let WISKEY_SCALE = 90;

export function applyWiskeyUi(settings: Record<string, unknown> | null | undefined): void {
  const size = String(settings?.['ui.wiskey_size'] ?? 'normal');
  const scale = Number(settings?.['ui.wiskey_scale'] ?? 90);
  const nextSize: WiskeySize = size === 'fit' || size === 'full' ? size : 'normal';
  const nextScale = [100, 90, 80, 70].includes(scale) ? scale : 90;
  const changed = nextSize !== WISKEY_SIZE || nextScale !== WISKEY_SCALE;
  WISKEY_SIZE = nextSize;
  WISKEY_SCALE = nextScale;
  if (changed && typeof window !== 'undefined') window.dispatchEvent(new Event(WISKEY_SIZE_EVENT));
  WISKEY_PHONE_EMBED = String(settings?.['access.phone_embed'] ?? 'false') === 'true';
  for (const s of WISKEY_SCREENS) WISKEY_UI[s] = String(settings?.[`access.ui.${s}`] ?? 'wiskey') === 'smplwise' ? 'smplwise' : 'wiskey';
  rebuildWiskeyTabs(); // a screen switched to SMPLWISE stays in the row whatever the WisKey catalog lists
}

/** הגדרות › בקרות כניסה (T054 follow-up, owner request): hide the whole WisKey area from the navigation for
 * everyone, regardless of role (`ui.hide_wiskey`) - the same "hidden for everyone" shape `ui.hide_map` uses for the
 * map area, but for a top-level area rather than a group of sub-tabs. Filled by the shell once settings load and by
 * the settings screen after a save (`applyWiskeyUi`'s sibling); read by `sw-app.ts` to route a direct URL to the
 * same "not available" panel a missing permission shows, and to drop every WISKEY_TABS href from HIDDEN_HREFS so the
 * area disappears from the navigation, the phone bottom bar included. */
export let WISKEY_HIDDEN = false;
export function applyWiskeyHidden(settings: Record<string, unknown> | null | undefined): boolean {
  WISKEY_HIDDEN = String(settings?.['ui.hide_wiskey'] ?? 'false') === 'true';
  return WISKEY_HIDDEN;
}

/** NN1 P2: the installation's capabilities decide which areas are offered (nav-capabilities.ts holds the one table
 * `route -> needs`). It generalises the NVR-less mode of 2026-09-29: with no NVR the live area, the camera pages and the
 * investigate area leave the navigation for everyone; with no media server the video screens do. `sw-app.ts` answers a direct
 * URL with a neutral panel. Hidden is not unprotected: the server refuses those routes itself (409). */
export { applyCapabilities };

/** Compatibility (NVR-less mode): `on` = an installation with no NVR. */
export function applyNvrLess(on: boolean): boolean {
  applyCapabilities(on ? { ...ALL_CAPABILITIES, nvr: false, live_video: false, playback: false, events_recorder: false } : null);
  return on;
}

/** An href of an area this installation cannot serve (see nav-capabilities.ts). */
export function isNvrHref(href: string): boolean {
  return needsOfSegments(segmentsOfHref(href)).length > 0;
}

/** A route of an area that needs the NVR or its media server. */
export function isNvrRoute(r: RouteState | null): boolean {
  return !!r && needsOfSegments(r.segments).length > 0;
}

/** SMPLWISE route segment (#/wiskey/<segment>) → the WisKey panel's own tab id (panel.ts `_tab`; "people" is the
 * panel's "users"). Unknown segments fall back to the panel's start tab, overview. */
export const WISKEY_PANEL_TABS: Record<string, string> = {
  overview: 'overview',
  events: 'events',
  people: 'users',
  devices: 'devices',
  sync: 'sync',
  health: 'health',
  audit: 'audit',
  tools: 'tools',
};

/** What a WisKey route renders: the SMPLWISE screen (only for the three built screens, when chosen) or the embed with
 * the WisKey location to show. Without a backend (the static demo) there is no Home Assistant to embed, so the three
 * built screens show their demo data. Any other segment is a WisKey id (from the embed API catalog, or an older
 * panel's tab) and is embedded; WisKey itself falls back to its default for an id it does not know or permit. */
export function wiskeyRoute(r: RouteState | null, api: boolean): { kind: 'smplwise'; screen: WiskeyScreen } | { kind: 'embed'; tab: string; tool: string | null } {
  // the path decides between the SMPLWISE screen and the embed; the mirror only refines what the embed shows (the
  // panel may have gone to "users" by itself while אנשים is set to SMPLWISE - that must not swap the embed out)
  const seg = wiskeyPathSegment(r);
  if ((WISKEY_SCREENS as string[]).includes(seg) && (!api || WISKEY_UI[seg as WiskeyScreen] === 'smplwise')) return { kind: 'smplwise', screen: seg as WiskeyScreen };
  const request = wiskeyRequest(r);
  return { kind: 'embed', tab: request.tab, tool: request.tool };
}

/** The route's own WisKey segment (the path, not the mirror). */
function wiskeyPathSegment(r: RouteState | null): string {
  return r?.segments[1] ? safeDecode(r.segments[1]) : 'overview';
}

/** הגדרות › אבטחה (2026-09-30): everything about the alarm system and the NVR. The intrusion alarm has a page here (and, since 0.1.147, a tab of the security area too)
 * - the same screen as `#/security/alarm` - next to its management
 * and the NVR summary. Sub-pages, each with the permission it always had: the alarm screen (alarm.view), its management
 * (system.configure) and the NVR (system.configure / sources.configure, like הגדרות › חיבורים). */
export const SECURITY_SETTINGS_HREF = '#/system/security';
export const SECURITY_CAMERAS_HREF = '#/system/security/cameras';
/** הגדרות › קטלוג התקנים (2026-09-30): the Home Assistant entity catalogue, formerly the map's "התקנים" tab
 * (#/explore/entities, which redirects here for holders of system.configure - see legacyRedirect). */
export const ENTITIES_SETTINGS_HREF = '#/system/entities';
export const SECURITY_SETTINGS_TABS: TabItem[] = [
  { id: 'alarm', label: 'אזעקה', href: '#/system/security/alarm' },
  { id: 'manage', label: 'ניהול אזעקה', href: '#/system/security/manage' },
  { id: 'nvr', label: 'NVR', href: '#/system/security/nvr' },
  /** CR-020 S1: the cameras' video settings (codec, SVC, resolution, bitrate, ...), read-only, system administrators. */
  { id: 'cameras', label: 'מצלמות', href: SECURITY_CAMERAS_HREF },
];

/** Is there an alarm panel on this platform? null = not known yet (api/alarm-presence.ts fills it once per session and
 * refreshes it on a slow timer). The two alarm sub-pages of הגדרות › אבטחה exist only while it is true: with no panel the
 * tab is not shown at all (owner 2026-09-30), rather than an empty state. Only consulted with a backend (visibleTabs). */
export let ALARM_PRESENT: boolean | null = null;
export function applyAlarmPresent(v: boolean | null): void {
  ALARM_PRESENT = v;
}
/** The alarm pages (the security area's tab and two pages of הגדרות › אבטחה): hidden only when the platform positively has
 * no panel (`ALARM_PRESENT === false`) - unknown, loading and error never hide them (owner: "if there is an alarm it MUST show"). */
const ALARM_HREFS = new Set(['#/security/alarm', '#/system/security/alarm', '#/system/security/manage']);
/** Any of these opens the alarm pages (the server still decides what each may do): the screen needs alarm.view to list
 * panels, but a holder of only arm / disarm / bypass gets the tab too (owner 2026-09-30), and a system administrator always. */
const ALARM_PERMISSIONS = ['alarm.view', 'alarm.arm', 'alarm.disarm', 'alarm.bypass', 'system.configure'];

// ---------------------------------------------------------------------------------------------
// הגדרות › ממשק › לשוניות (owner 2026-09-30, setting `ui.tabs`): the installation-wide choice of which tabs each navigation
// section shows and in which order. Data-driven from the registries in this file (TAB_SECTIONS below): every tab row, the
// security sections, the rail and the phone bottom bar go through `configureTabs`. Presentation only: it never grants or
// removes a permission (tabAllowed still gates first) and never closes a route - a hidden tab's address keeps working for
// whoever holds its permission. Ids the registry does not know are ignored, ids the stored order does not name keep their
// default place after the ones it names (a new tab appears), and a section never ends up with nothing to show.
// ---------------------------------------------------------------------------------------------
const TAB_ID = /^[a-z0-9][a-z0-9_.-]{0,47}$/;
let TABS_CONFIG: TabsConfig = {};
const tabsListeners = new Set<() => void>();

/** A stored `ui.tabs` value (an object; a JSON string is tolerated) as a clean config: only well-formed sections and ids,
 * duplicates dropped, a section with nothing to say left out. Never throws - a corrupt value is "nothing configured". */
export function normalizeTabsConfig(raw: unknown): TabsConfig {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  const out: TabsConfig = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  const ids = (list: unknown): string[] => {
    const seen: string[] = [];
    if (Array.isArray(list)) for (const v of list) if (typeof v === 'string' && TAB_ID.test(v) && !seen.includes(v)) seen.push(v);
    return seen;
  };
  for (const [section, body] of Object.entries(value as Record<string, unknown>)) {
    if (section === TAB_STYLES_KEY) continue; // the per-level defaults, not a section (normalizeTabStyles)
    if (!TAB_ID.test(section) || !body || typeof body !== 'object' || Array.isArray(body)) continue;
    let order = ids((body as { order?: unknown }).order);
    let hidden = ids((body as { hidden?: unknown }).hidden);
    // 0.1.154 migration: the home area's "schedules" tab became a segment of "קברניט" (the `automations` tab): a stored entry for it is dropped
    if (section === 'devices') {
      order = order.filter((id) => id !== 'schedules');
      hidden = hidden.filter((id) => id !== 'schedules');
    }
    const style = asTabStyle((body as { style?: unknown }).style);
    if (order.length || hidden.length || style) out[section] = style ? { order, hidden, style } : { order, hidden };
  }
  return out;
}

// ---- 0.1.148: the look of the tab bars (sw-tabs `variant`), per hierarchy level with a per-section override ----

/** The reserved key of `ui.tabs` that holds the defaults per level (`{ level1, level2 }`); it is not a section. */
export const TAB_STYLES_KEY = 'styles';
export const TAB_STYLE_VALUES: readonly TabStyle[] = ['pill', 'underline', 'underline-compact'];
/** What a level looks like when nothing is configured (owner 2026-09-30): the first bar of an area is the narrow segmented
 * pill, the sub-tabs inside the security sections are the compact underline row. */
export const TAB_STYLE_DEFAULTS: Required<TabStyleDefaults> = { level1: 'pill', level2: 'underline-compact' };
/** Which hierarchy level a bar belongs to when its section is not in the registry (nothing today). */
export type TabLevel = 1 | 2;

function asTabStyle(v: unknown): TabStyle | undefined {
  return (TAB_STYLE_VALUES as readonly unknown[]).includes(v) ? (v as TabStyle) : undefined;
}

/** The stored per-level defaults (`ui.tabs.styles`), reduced to known values; an unknown or missing value is left out
 * so the built-in default of that level applies. Never throws. */
export function normalizeTabStyles(raw: unknown): TabStyleDefaults {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  const styles = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>)[TAB_STYLES_KEY] : undefined;
  const out: TabStyleDefaults = {};
  if (styles && typeof styles === 'object' && !Array.isArray(styles)) {
    const l1 = asTabStyle((styles as Record<string, unknown>).level1);
    const l2 = asTabStyle((styles as Record<string, unknown>).level2);
    if (l1) out.level1 = l1;
    if (l2) out.level2 = l2;
  }
  return out;
}

let TAB_STYLES: TabStyleDefaults = {};

/** Filled by the shell once the product settings load and by the settings screen after a save. */
export function applyTabsConfig(settings: Record<string, unknown> | null | undefined): TabsConfig {
  TABS_CONFIG = normalizeTabsConfig(settings?.['ui.tabs']);
  TAB_STYLES = normalizeTabStyles(settings?.['ui.tabs']);
  for (const l of tabsListeners) l();
  return TABS_CONFIG;
}

/** The installation's stored per-level defaults (not resolved: an unset level is absent). */
export function tabStyleDefaults(): TabStyleDefaults {
  return TAB_STYLES;
}

/** THE helper every tab row asks (the shell's area rows and sections, the settings sub-rows): the style of one section's
 * bar - its own override, else the installation's default for its hierarchy level, else the built-in default. `level`
 * comes from the registry (TAB_SECTIONS) unless a caller names it. */
export function tabStyleOf(sectionId: string | null, level?: TabLevel): TabStyle {
  const lvl: TabLevel = level ?? TAB_SECTIONS.find((s) => s.id === sectionId)?.level ?? 1;
  const own = sectionId ? TABS_CONFIG[sectionId]?.style : undefined;
  return own ?? TAB_STYLES[lvl === 1 ? 'level1' : 'level2'] ?? TAB_STYLE_DEFAULTS[lvl === 1 ? 'level1' : 'level2'];
}

export function tabsConfig(): TabsConfig {
  return TABS_CONFIG;
}

/** The navigation follows a change of the configuration (the shell re-renders; nav-order.ts re-derives the rail's default). */
export function onTabsConfig(listener: () => void): () => void {
  tabsListeners.add(listener);
  return () => tabsListeners.delete(listener);
}

/** Tabs that stay visible whatever `hidden` says: the way back to the tabs editor itself (הגדרות › כללי). */
export const LOCKED_TABS: Record<string, readonly string[]> = { system: ['general'] };

export function isSectionConfigured(section: string | null): boolean {
  const c = section ? TABS_CONFIG[section] : undefined;
  return !!c && (c.order.length > 0 || c.hidden.length > 0);
}

/** The items of one section (already limited to what this user may see) in the configured order without the hidden
 * ones. `reorder: false` keeps the caller's order (the rail: the user's own order wins). A section is never emptied: when
 * `hidden` would leave nothing, the user's own permitted tabs are shown after all - hiding is not a lock-out. */
export function configureTabs<T extends { id: string }>(section: string | null, items: T[], reorder = true): T[] {
  const cfg: TabsSectionConfig | undefined = section ? TABS_CONFIG[section] : undefined;
  if (!section || !cfg || (!cfg.order.length && !cfg.hidden.length)) return items;
  let ordered = items;
  if (reorder) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const named: T[] = [];
    for (const id of cfg.order) {
      const it = byId.get(id);
      if (it && !named.includes(it)) named.push(it);
    }
    ordered = [...named, ...items.filter((i) => !named.includes(i))];
  }
  const locked = LOCKED_TABS[section] ?? [];
  const shown = ordered.filter((i) => locked.includes(i.id) || !cfg.hidden.includes(i.id));
  return shown.length ? shown : ordered;
}

/** The entry href of a section: its first visible tab once the admin configured the section (the order decides where it
 * lands), otherwise the default entry - kept while it is still one of the tabs, else the first visible tab. */
function entryHref(fallback: string, tabs: TabItem[], section: string | null): string {
  const first = tabs[0]?.href;
  if (!first) return fallback;
  if (isSectionConfigured(section)) return first;
  return tabs.some((t) => t.href === fallback) ? fallback : first;
}

/** CR-014: the schedules list (a tab of the home area) and its settings page (a tab of הגדרות). */
export const SCHEDULES_HREF = '#/devices/schedules';
export const SCHEDULES_SETTINGS_HREF = '#/system/schedules';
/** CR-017: the automations screen (the third tab of the home area: automations, scenes, scripts) and its settings page. */
export const AUTOMATIONS_HREF = '#/devices/automations';
export const AUTOMATIONS_SETTINGS_HREF = '#/system/automations';

/** CR-015 / CR-016: the multimedia area ("מולטימדיה", #/multimedia/*) and its settings page. Three tabs: "מסכים", "נגנים
 * ורמקולים" and "קבוצות" (0.1.150). A tab is drawn only when the installation has something of its kind (the pages report
 * the status counts through `applyMultimediaKinds`); with one tab the row is not drawn at all (sw-app shows a row from two tabs). */
export const MULTIMEDIA_SCREENS_HREF = '#/multimedia/screens';
export const MULTIMEDIA_PLAYERS_HREF = '#/multimedia/players';
export const MULTIMEDIA_GROUPS_HREF = '#/multimedia/groups';
export const MULTIMEDIA_SETTINGS_HREF = '#/system/multimedia';
/** CR-021 S2: הגדרות › עדכונים. */
export const UPDATE_SETTINGS_HREF = '#/system/update';
export const MULTIMEDIA_TABS: TabItem[] = [
  { id: 'screens', label: 'מסכים', href: MULTIMEDIA_SCREENS_HREF },
  { id: 'players', label: 'נגנים ורמקולים', href: MULTIMEDIA_PLAYERS_HREF },
  { id: 'groups', label: 'קבוצות', href: MULTIMEDIA_GROUPS_HREF },
];

/** What the installation has of the two CR-016 kinds; unknown (nothing reported yet) = none, so the row never flashes a tab that then goes. */
const MULTIMEDIA_KINDS = { players: false, groups: false };

/** CR-016: the multimedia pages report `GET /multimedia/status` counts here. "נגנים ורמקולים" is offered when at least one
 * player is approved and visible to the caller; "קבוצות" when a group exists or at least two players could form one. The tab
 * counts (the number next to the label) follow. Navigation only - never access control (the routes stay open and answer
 * their own states). Returns what is offered. */
export function applyMultimediaKinds(counts: { screens?: number | null; players?: number | null; groups?: number | null } | null | undefined): { players: boolean; groups: boolean } {
  const players = Math.max(0, Number(counts?.players ?? 0) || 0);
  const groups = Math.max(0, Number(counts?.groups ?? 0) || 0);
  const screens = Math.max(0, Number(counts?.screens ?? 0) || 0);
  const next = { players: players > 0, groups: groups > 0 || players >= 2 };
  const count = (id: string, n: number | undefined) => {
    const t = MULTIMEDIA_TABS.find((x) => x.id === id);
    if (!t || t.count === n) return false;
    t.count = n;
    return true;
  };
  let changed = next.players !== MULTIMEDIA_KINDS.players || next.groups !== MULTIMEDIA_KINDS.groups;
  MULTIMEDIA_KINDS.players = next.players;
  MULTIMEDIA_KINDS.groups = next.groups;
  if (count('screens', screens > 0 ? screens : undefined)) changed = true;
  if (count('players', players > 0 ? players : undefined)) changed = true;
  if (changed) for (const l of tabsListeners) l();
  return { ...next };
}

/** The map's tabs: the sites list and the floor map. The device catalogue left the map for הגדרות (2026-09-30). */
const EXPLORE_TABS: TabItem[] = [
  { id: 'sites', label: 'אתרים ומבנים', href: '#/explore/sites' },
  { id: 'floors', label: 'מפת קומה', href: '#/explore/floors/f0' },
];

/** The home area's tabs (`ui.tabs` (section `devices`) and the phone bottom bar follow). "מבט על" is the home screen as it always was (the
 * building tree, `#/devices/building`; an area screen is a drill-down of it, #/devices/areas/<id>, not a tab). "קברניט" (0.1.154, owner
 * 2026-10-02; the tab id stays `automations`, so route ids are untouched) holds the segments תזמונים · אוטומציות · סצנות · סקריפטים: the
 * schedules list (CR-014, `#/devices/schedules`) is its first segment, shown while the feature is on (`schedules.enabled`,
 * applySchedulesHidden) to holders of schedule.view / schedule.manage; the automations screen (CR-017, `#/devices/automations`) holds the
 * rest. The tab opens on the schedules segment when it is offered, else on the automations (`kavarnitSegments`, applied in
 * `permittedTabs`); the static href below is that default (the static demo has no gates). With only one tab visible the tab row does not
 * appear at all, so a user without those rights sees the home screen exactly as before. */
export const DEVICES_TABS: TabItem[] = [
  { id: 'building', label: 'מבט על', href: '#/devices/building' },
  { id: 'automations', label: 'קברניט', href: SCHEDULES_HREF },
];

/** 0.1.154: which segments of "קברניט" this user is offered. `schedules`: the feature is on and schedule.view / schedule.manage is held;
 * `automations`: the automations feature is on and one of its rights is held (the scenes and scripts segments follow the automations
 * status inside the screen). Without a backend (the demo) both are offered. */
export interface KavarnitSegments { schedules: boolean; automations: boolean }
export function kavarnitSegments(api: boolean, can?: Can): KavarnitSegments {
  if (!api) return { schedules: true, automations: true };
  const offered = (href: string) => !HIDDEN_HREFS.has(href) && tabAllowed(href, can);
  return { schedules: offered(SCHEDULES_HREF), automations: offered(AUTOMATIONS_HREF) };
}

// ---------------------------------------------------------------------------------------------
// Design "SW A" (mockups v1.3): originally exactly the kit's four areas as a right icon rail; WisKey
// became a 5th area 2026-09-27 by explicit owner override (a peer of live/explore/investigate/system, not
// nested under explore). The section's pages stay reachable as a tab row under the top bar.
// CR-010 (owner request 2026-09-29): "לייב" and "חקירה" are no longer areas of their own: they are the first two SECTIONS
// of one area "אבטחה" (security). The rail / phone bottom bar shows the area, the top bar a segmented control of the
// sections, and the tab row under it the section's own pages - three levels, each on its own row. #/security opens the
// section this browser used last. 2026-09-30: the third section, the intrusion alarm, is a tab again (0.1.147: #/security/alarm, also a page of הגדרות › אבטחה)
// (SECURITY_SETTINGS_TABS; #/security/alarm redirects), and camera health moved from the live pages into the
// investigation (#/investigate/health; #/system/devices redirects) - see legacyRedirect.
// ---------------------------------------------------------------------------------------------
/** CR-023: the infrastructure area ("תשתיות", #/infra/*) with its one sub-tab "מוני חשמל" (water and generators join later), and its settings tab. */
export const INFRA_METERS_HREF = '#/infra/electricity/meters';
export const INFRA_SETTINGS_HREF = '#/system/infra';
export const INFRA_TABS: TabItem[] = [{ id: 'electricity', label: 'מוני חשמל', href: INFRA_METERS_HREF }];

/** CR-023: the area is offered to holders of energy.view only when the installation has meters or the user may manage them (an installation
 * without meters shows nothing). Filled by electricity/visibility.ts; true = no meters and no manage permission. */
let INFRA_NO_METERS = false;
export function applyInfraMeters(hasMetersOrManage: boolean): void {
  const hide = !hasMetersOrManage;
  if (hide === INFRA_NO_METERS) return;
  INFRA_NO_METERS = hide;
  for (const l of tabsListeners) l();
}

export type AreaId = 'security' | 'explore' | 'system' | 'wiskey' | 'devices' | 'multimedia' | 'infra';
export type SecuritySection = 'live' | 'investigate' | 'alarm';

export interface AreaEntry {
  id: AreaId;
  icon: IconName;
  label: string;
  href: string;
}

/** The navigation tabs of the rail (desktop, tablet) and the bottom bar (phone), in their default order.
 * WisKey (0.1.103): owner override 2026-09-27 - a genuine top-level area, a peer of live/explore/
 * investigate/system, not nested under explore/מפה as phase 1a had it. Own top-level route namespace
 * (#/wiskey/...), matching how the other three areas each own their prefix.
 * CR-013 (owner request 2026-09-29): ראשי · אבטחה · מפה · WisKey, then the user avatar (not a tab: always last, not
 * movable). "ראשי" is the device overview that was "חשמל" (CR-007) - renamed with a home icon, the screen itself is
 * unchanged. "מערכת" left the bar: it is an item of the user menu, for users who hold a settings permission
 * (SYSTEM_AREA). Each user may reorder the tabs (nav-order.ts, stored on the server). */
export const NAV_A: AreaEntry[] = [
  { id: 'devices', icon: 'home', label: 'ראשי', href: '#/devices/building' },
  { id: 'security', icon: 'shield', label: 'אבטחה', href: '#/security' },
  { id: 'explore', icon: 'map', label: 'מפה', href: '#/explore/sites' },
  // CR-015 (owner decision 2a): "מולטימדיה" between the map and WisKey; shown to holders of media.read (TAB_PERMISSIONS)
  { id: 'multimedia', icon: 'media', label: 'מולטימדיה', href: '#/multimedia/screens' },
  { id: 'wiskey', icon: 'door', label: 'WisKey', href: '#/wiskey/overview' },
  // CR-023: "תשתיות" after WisKey; shown to holders of energy.view (TAB_PERMISSIONS) when the installation has meters or the user may manage them
  { id: 'infra', icon: 'bolt', label: 'תשתיות', href: INFRA_METERS_HREF },
];

/** The ids of the movable tabs, in the default order (the server keeps the same list: services/user_prefs.py). */
export type NavTabId = 'devices' | 'security' | 'explore' | 'multimedia' | 'wiskey' | 'infra';
export const NAV_TAB_IDS: NavTabId[] = NAV_A.map((n) => n.id as NavTabId);

/** "מערכת" (the settings area): a route area of its own (crumbs, tabs) but, since CR-013, reached from the user menu. */
export const SYSTEM_AREA: AreaEntry = { id: 'system', icon: 'system', label: 'מערכת', href: '#/system/diagnostics' };

/** The settings tabs every signed-in user has (their own push notification preferences): holding only these is not
 * "a settings permission" - the user menu offers them as their own item instead of "מערכת". */
export const PERSONAL_SYSTEM_HREFS = new Set<string>(['#/system/notifications']);

/** The security area's sections and their pages (CR-010). */
export const SECTION_TABS: Record<SecuritySection, TabItem[]> = {
  live: [
    { id: 'overview', label: 'תמונת מצב', href: '#/live' },
    { id: 'wall', label: 'כל המצלמות', href: '#/live/wall' },
    { id: 'views', label: 'תצוגות שמורות', href: '#/live/views' },
  ],
  investigate: [
    { id: 'events', label: 'מרכז אירועים', href: '#/investigate/events' },
    { id: 'playback', label: 'הקלטות', href: '#/investigate/playback' },
    { id: 'sync', label: 'ניגון מסונכרן', href: '#/investigate/playback/sync' },
    { id: 'history', label: 'מפה היסטורית', href: '#/investigate/floors/f0/history' },
    { id: 'reviews', label: 'סקירה', href: '#/investigate/reviews' },
    { id: 'search', label: 'חיפוש', href: '#/investigate/search' },
    { id: 'cases', label: 'תיקים', href: '#/investigate/cases' },
    { id: 'rules', label: 'חוקים והתראות', href: '#/investigate/rules' },
    { id: 'exports', label: 'ייצוא', href: '#/investigate/exports' },
    /** 2026-09-30: camera health lives in the investigation (it was the fourth live page, #/system/devices). */
    { id: 'health', label: 'בריאות מצלמות', href: '#/investigate/health' },
  ],
  /** The intrusion alarm, a section of its own again (0.1.147) - the same screen as הגדרות › אבטחה › אזעקה. */
  alarm: [{ id: 'alarm', label: 'אזעקה', href: '#/security/alarm' }],
};

export interface SectionEntry {
  id: SecuritySection;
  label: string;
  icon: IconName;
  href: string;
}

export const SECURITY_SECTIONS: SectionEntry[] = [
  { id: 'live', label: 'לייב', icon: 'camera', href: '#/live' },
  { id: 'investigate', label: 'חקירה', icon: 'search', href: '#/investigate/events' },
  { id: 'alarm', label: 'אזעקה', icon: 'shield', href: '#/security/alarm' },
];

export const AREA_TABS: Record<AreaId, TabItem[]> = {
  devices: DEVICES_TABS,
  multimedia: MULTIMEDIA_TABS,
  /** Every page of the sections: the area stays in the rail while any of them is visible. */
  security: [...SECTION_TABS.live, ...SECTION_TABS.investigate, ...SECTION_TABS.alarm],
  explore: EXPLORE_TABS,
  /** Entry Center/overview, Activity/events and People/people (CR-005 phase 1b), plus WisKey's own screens as embedded
   * tabs (CR-005 recorded decision 2026-09-28) - the same list as WISKEY_TABS. */
  wiskey: WISKEY_TABS,
  infra: INFRA_TABS,
  system: [
    { id: 'general', label: 'כללי', href: '#/system/diagnostics' },
    // CR-008 P3: per-user push notifications - every signed-in user may set their own (no TAB_PERMISSIONS entry)
    { id: 'notifications', label: 'התראות', href: '#/system/notifications' },
    { id: 'access', label: 'משתמשים והרשאות', href: '#/system/access' },
    { id: 'security', label: 'אבטחה', href: SECURITY_SETTINGS_HREF },
    { id: 'audit', label: 'אודיט', href: '#/system/audit' },
    { id: 'storage', label: 'אחסון', href: '#/system/storage' },
    // CR-021 S2: the self-update page (system.update, installation scope: system administrators only)
    { id: 'update', label: 'עדכונים', href: UPDATE_SETTINGS_HREF },
    { id: 'wizard', label: 'אשף התקנה', href: '#/system/wizard' },
    { id: 'setup', label: 'חיבורים', href: '#/system/setup' },
    { id: 'entities', label: 'קטלוג התקנים', href: ENTITIES_SETTINGS_HREF },
    { id: 'schedules', label: 'תזמונים', href: SCHEDULES_SETTINGS_HREF },
    // CR-017: every option of the automations, scenes and scripts (system.configure, installation scope)
    { id: 'automations', label: 'אוטומציות', href: AUTOMATIONS_SETTINGS_HREF },
    // CR-015: the screens' approval, connections and the remote's defaults (system.configure, installation scope)
    { id: 'multimedia', label: 'מולטימדיה', href: MULTIMEDIA_SETTINGS_HREF },
    // CR-023: prices and VAT, business details, data retention of the electricity module (energy.manage, or system.configure for the retention)
    { id: 'infra', label: 'תשתיות', href: INFRA_SETTINGS_HREF },
    /** CR-013 review M10: the screen catalogue left the user menu; a system administrator reaches it from here */
    { id: 'screens', label: 'כל המסכים', href: '#/screens' },
  ],
};

/** The security section a route belongs to (camera health, #/investigate/health, is an investigation page). */
export function sectionOf(r: RouteState | null): SecuritySection | null {
  if (!r?.mode) return null;
  if (r.mode === 'live') return 'live';
  if (r.mode === 'investigate') return 'investigate';
  if (r.mode === 'security' && r.segments[1] === 'alarm') return 'alarm';
  return null;
}

export function areaOf(r: RouteState | null): AreaId | null {
  if (!r?.mode) return null;
  if (r.mode === 'live' || r.mode === 'investigate' || r.mode === 'security') return 'security';
  return r.mode;
}

export function activeAreaTab(r: RouteState | null): string {
  const a = areaOf(r);
  if (!a || !r) return '';
  const s = r.segments;
  switch (a) {
    case 'security': {
      const sec = sectionOf(r);
      if (sec === 'live') return s[1] === 'views' ? 'views' : s[1] === 'wall' || s[1] === 'cameras' ? 'wall' : 'overview';
      if (sec === 'investigate') return s[1] === 'floors' ? 'history' : s[1] === 'playback' ? (s[2] === 'sync' ? 'sync' : 'playback') : (s[1] ?? 'events');
      return sec === 'alarm' ? 'alarm' : '';
    }
    case 'explore':
      return s[1] === 'buildings' || s[1] === 'floors' ? 'floors' : 'sites';
    case 'system':
      return !s[1] || s[1] === 'diagnostics' ? 'general' : s[1];
    case 'wiskey':
      return wiskeyActiveTab(r);
    case 'devices':
      return s[1] === 'schedules' || s[1] === 'automations' ? 'automations' : 'building'; // 0.1.154: the schedules are a segment of קברניט
    case 'infra':
      return 'electricity';
    case 'multimedia':
      return s[1] === 'players' ? 'players' : s[1] === 'groups' ? 'groups' : 'screens';
    default:
      return '';
  }
}

/** Breadcrumb text for the SW A top bar: area › (section ›) page; in הגדרות › אבטחה the sub-page follows. */
export function crumbsOf(r: RouteState | null, api = false): string[] {
  const a = areaOf(r);
  if (!a) return [];
  const area = a === 'system' ? SYSTEM_AREA : NAV_A.find((n) => n.id === a);
  const sec = a === 'security' ? SECURITY_SECTIONS.find((x) => x.id === sectionOf(r)) : undefined;
  const tabs = sec ? SECTION_TABS[sec.id] : AREA_TABS[a];
  const tab = tabs.find((x) => x.id === activeAreaTab(r));
  const label = tab ? (api && API_LABELS[tab.href ?? ''] ? API_LABELS[tab.href ?? ''] : tab.label) : '';
  const sub = a === 'system' && r?.segments[1] === 'security' ? SECURITY_SETTINGS_TABS.find((x) => x.id === r.segments[2])?.label : undefined;
  // 0.1.154: ראשי › קברניט › the segment
  const s = r?.segments ?? [];
  const kSub = a !== 'devices' ? undefined : s[1] === 'schedules' ? 'תזמונים' : s[1] === 'automations' ? (s[2] === 'scenes' ? 'סצנות' : s[2] === 'scripts' ? 'סקריפטים' : 'אוטומציות') : undefined;
  return [area?.label ?? '', sec?.label ?? '', label === sec?.label ? '' : label, sub ?? kSub ?? ''].filter(Boolean);
}

/** The sections of the security area this user sees, each opening on its first visible page. */
export function visibleSections(api: boolean, can?: Can): SectionEntry[] {
  const list = SECURITY_SECTIONS.flatMap((s) => {
    const tabs = visibleTabs(SECTION_TABS[s.id], api, can);
    // the live overview needs nothing, so the live section is there whenever the NVR is (visibleTabs keeps it)
    if (api && !tabs.length) return [];
    return [{ ...s, href: entryHref(s.href, tabs, `security.${s.id}`) }];
  });
  // ui.tabs: which section comes first (לייב / חקירה) and whether each is offered at all
  return api ? configureTabs('security', list) : list;
}

const LAST_SECTION_KEY = 'sw.security.section';

/** Remember the section this browser used last (#/security opens it). Per browser only - a convenience. */
export function rememberSection(s: SecuritySection): void {
  try {
    localStorage.setItem(LAST_SECTION_KEY, s);
  } catch {
    /* storage unavailable: #/security opens the first section */
  }
}

export function lastSection(): SecuritySection | null {
  try {
    const v = localStorage.getItem(LAST_SECTION_KEY);
    return v === 'live' || v === 'investigate' || v === 'alarm' ? v : null;
  } catch {
    return null;
  }
}

/** Where #/security goes: the last used section when it is still visible, else the first visible one (לייב by default). */
export function securityTarget(api: boolean, can?: Can): string {
  const visible = visibleSections(api, can);
  const last = lastSection();
  return (visible.find((s) => s.id === last) ?? visible[0])?.href ?? '#/live';
}

/** Ctrl+K page targets (CR-010): the security sections by name, next to the server's rooms / cameras / entities. */
export interface PageTarget {
  label: string;
  subtitle: string;
  href: string;
  keywords: string[];
}

export function pageTargets(q: string, api: boolean, can?: Can): PageTarget[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const sections = visibleSections(api, can);
  const all: PageTarget[] = sections.map((s) => ({
    label: `אבטחה › ${s.label}`,
    subtitle: s.id === 'alarm' ? 'מצב האזעקה, דריכה ונטרול, חיישנים ועקיפה' : s.id === 'live' ? 'תמונת מצב ומצלמות' : 'אירועים, הקלטות ותיקים',
    href: s.href,
    keywords: s.id === 'alarm' ? ['אזעקה', 'דריכה', 'נטרול', 'עקיפה', 'חיישנים', 'alarm'] : s.id === 'live' ? ['לייב', 'מצלמות', 'live'] : ['חקירה', 'אירועים', 'הקלטות'],
  }));
  return all.filter((t) => t.label.toLowerCase().includes(needle) || t.keywords.some((k) => k.toLowerCase().startsWith(needle) || needle.startsWith(k.toLowerCase())));
}

/** Screens that still show demo data only. With a real backend they are hidden from the tab bars until they are
 * built for real (live review 2026-09-17, F1 F3 F4 F5 F6 F7); the shell also redirects their routes. Empty since
 * T054: the access slot became the real WisKey entry center (CR-005). */
export const DEMO_ONLY_HREFS = new Set<string>();

/** Tabs whose real screen has a different name than the design's demo screen. */
export const API_LABELS: Record<string, string> = { '#/investigate/reviews': 'Review · חלונות', '#/investigate/playback/sync': 'ניגון מסונכרן' };

/** Tabs the owner hid in the settings (0.1.61: the AI search); filled by the shell once the product settings load. */
export const HIDDEN_HREFS = new Set<string>();

/** הגדרות › מסך פתיחה (0.1.68): the route the UI lands on when the address carries none. */
export const START_ROUTES: Record<string, string> = { explore: '/explore/floors/f0', live: '/live', wall: '/live/wall', events: '/investigate/events', playback: '/investigate/playback', devices: '/devices/building' };
/** The map area's entries, hidden for everyone with הגדרות › הסתרת המפה (0.1.68). */
export const MAP_HREFS = ['#/explore/sites', '#/explore/floors/f0'];

/** What a tab needs before the shell shows it: any one of the listed permissions, at any scope (owner decision
 * 2026-09-22, 0.1.81 - a viewer used to see every category and land on "אין הרשאה"). Tabs without an entry are
 * always shown; the mapping follows what each screen's first request requires. */
export const TAB_PERMISSIONS: Record<string, string[]> = {
  '#/live/wall': ['video.live'],
  '#/live/views': ['video.live'],
  '#/investigate/health': ['video.live'], // camera health, as it was under #/system/devices (which redirects here)
  '#/system/devices': ['video.live'],
  '#/explore/sites': ['map.read'],
  '#/explore/floors/f0': ['map.read'],
  // the device catalogue: a management page of the settings (it was the map's "התקנים" tab, gated by entity.state.read)
  [ENTITIES_SETTINGS_HREF]: ['system.configure'],
  '#/wiskey/overview': ['access.read'],
  '#/wiskey/events': ['access.read'],
  '#/wiskey/people': ['access.read'],
  // WisKey's own screens, always embedded: SMPLWISE only decides whether to offer the tab; inside the frame WisKey's own
  // per-area permissions (stations / events / management) decide what the user sees and may do.
  '#/wiskey/devices': ['access.read'],
  '#/wiskey/sync': ['access.read'],
  '#/wiskey/health': ['access.read'],
  '#/wiskey/audit': ['access.read'],
  '#/wiskey/tools': ['access.read'],
  // devices.read at any scope: a floor-scoped holder gets the tree narrowed to their floors (routers/devices.py),
  // so unlike WisKey the entry is NOT installation-only.
  '#/devices/building': ['devices.read'],
  // CR-014: the schedules list - schedule.view or schedule.manage at any scope (the server hides what a caller may not see:
  // a floor-scoped holder gets only the schedules whose devices are all on their floors)
  [SCHEDULES_HREF]: ['schedule.view', 'schedule.manage'],
  // its settings page: system.configure at installation scope
  [SCHEDULES_SETTINGS_HREF]: ['system.configure'],
  // CR-017, owner decision 1b (2026-10-01, no view-only access): automation.manage, a script run (script.run / script.manage) or a scene activation
  // (scene.manage or the control of a device) at any scope - the server narrows the lists to the caller's floors and leaves automations out for a caller
  // without automation.manage; the settings page is system.configure at installation scope.
  [AUTOMATIONS_HREF]: ['automation.manage', 'script.run', 'script.manage', 'scene.manage', 'devices.control', 'ha.entity.control'],
  [AUTOMATIONS_SETTINGS_HREF]: ['system.configure'],
  // CR-015: media.read at any scope (a floor-scoped holder sees the screens of their floors; the server narrows the list);
  // the settings page is system.configure at installation scope. No role holds media.read before the backend (S1) lands.
  [MULTIMEDIA_SCREENS_HREF]: ['media.read'],
  '#/multimedia/players': ['media.read'],
  '#/multimedia/groups': ['media.read'],
  // CR-028: "המסכים שלי לשידור" - a person who may cast anywhere (media.cast); a link from the live screen's picker, not a tab
  '#/multimedia/cast': ['media.cast'],
  [MULTIMEDIA_SETTINGS_HREF]: ['system.configure'],
  // CR-023: energy.view / energy.manage are installation-scope in v1; the settings tab is for managers (prices, business) and system administrators (retention)
  [INFRA_METERS_HREF]: ['energy.view'],
  [INFRA_SETTINGS_HREF]: ['energy.manage', 'system.configure'],
  // CR-021 S2: the updates page - system.update at installation scope (system administrators only, never delegable)
  [UPDATE_SETTINGS_HREF]: ['system.update'],
  // CR-010, moved to הגדרות › אבטחה 2026-09-30: the alarm screen - alarm.view at any scope: a floor-scoped holder sees the
  // panels placed on their floors (routers/alarm.py), so the entry is not installation-only. Its management is what it
  // always was (routers/alarm.py `_configurer`: system.configure); the NVR page follows הגדרות › חיבורים. The section's own
  // entry (SECURITY_SETTINGS_HREF) is listed for completeness: tabAllowed shows it when any of its pages is visible.
  '#/security/alarm': ALARM_PERMISSIONS,
  '#/system/security/alarm': ALARM_PERMISSIONS,
  '#/system/security/manage': ['system.configure'],
  '#/system/security/nvr': ['system.configure', 'sources.configure'],
  // CR-020 S1: GET /nvr/cameras needs system.configure at installation scope (owner Q6: system administrators only)
  [SECURITY_CAMERAS_HREF]: ['system.configure'],
  [SECURITY_SETTINGS_HREF]: [...ALARM_PERMISSIONS, 'sources.configure'],
  '#/investigate/events': ['events.read'],
  '#/investigate/playback': ['video.playback'],
  '#/investigate/playback/sync': ['video.playback'],
  '#/investigate/floors/f0/history': ['video.playback'],
  '#/investigate/reviews': ['events.read', 'analytics.read'], // NN5-F1B: the Frigate review screen's own permission opens it too
  '#/investigate/search': ['events.read'],
  '#/investigate/cases': ['cases.manage'],
  '#/investigate/rules': ['rules.manage'],
  '#/investigate/exports': ['video.export'],
  '#/system/diagnostics': ['system.configure'],
  '#/system/access': ['rbac.assign', 'rbac.roles.manage', 'identity.directory.read'],
  '#/system/audit': ['audit.read'],
  '#/system/storage': ['system.configure'],
  '#/system/setup': ['system.configure', 'sources.configure'],
  // T071: the wizard reads GET /setup/state, which needs system.configure at installation scope
  '#/system/wizard': ['system.configure'],
  // CR-013: the screen catalogue (a design / support tool), for system administrators only
  '#/screens': ['system.configure'],
};

/** Tabs whose permission counts only when held at installation scope, because the screen and its API check it there
 * and nowhere else: WisKey stations are not mapped to sites or floors, so access.read is installation-wide by design
 * (CR-005). A floor-scoped viewer or a site-scoped site_admin would otherwise see the tab and land on "no permission". */
export const INSTALLATION_ONLY_HREFS = new Set<string>([...STATIC_WISKEY_TABS.map((t) => t.href ?? ''), '#/system/wizard', '#/system/security/manage', SECURITY_CAMERAS_HREF, ENTITIES_SETTINGS_HREF, SCHEDULES_SETTINGS_HREF, AUTOMATIONS_SETTINGS_HREF, MULTIMEDIA_SETTINGS_HREF, UPDATE_SETTINGS_HREF, INFRA_METERS_HREF, INFRA_SETTINGS_HREF]); // the alarm management: routers/alarm.py `_configurer` checks system.configure at installation scope

/** `installationOnly`: the permission must be held at installation scope, not at any scope. */
export type Can = (permission: string, installationOnly?: boolean) => boolean;

export function tabAllowed(href: string, can?: Can): boolean {
  // every WisKey tab (the static ones and those built from the embed API catalog) needs access.read at installation scope
  const need = TAB_PERMISSIONS[href] ?? (isWiskeyHref(href) ? ['access.read'] : undefined);
  const installationOnly = INSTALLATION_ONLY_HREFS.has(href) || isWiskeyHref(href);
  return !need || !can || need.some((p) => can(p, installationOnly));
}

export function visibleTabs(items: TabItem[], api: boolean, can?: Can): TabItem[] {
  // CR-016: the players / groups tabs are offered only when the installation has players / groups (applyMultimediaKinds),
  // with or without a backend
  const offered = items === MULTIMEDIA_TABS ? items.filter((t) => t.id === 'screens' || (t.id === 'players' && MULTIMEDIA_KINDS.players) || (t.id === 'groups' && MULTIMEDIA_KINDS.groups)) : items;
  // permissions and the fixed rules decide what is offered; ui.tabs (order, hidden) then shapes it (with a backend only:
  // the static demo shows the defaults)
  if (!api) return offered;
  const permitted = permittedTabs(offered, api, can);
  const shown = configureTabs(sectionIdOf(items), permitted);
  // 0.1.154: a stored `ui.tabs` entry that hides the old "אוטומציות" tab must not take the schedules segment away with it
  if (items === DEVICES_TABS) {
    const k = permitted.find((t) => t.id === 'automations');
    if (k && !shown.includes(k) && kavarnitSegments(api, can).schedules) return [...shown, k];
  }
  return shown;
}

function permittedTabs(source: TabItem[], api: boolean, can?: Can): TabItem[] {
  // 0.1.154: the "קברניט" tab (id `automations`) stands for two gates: it is offered while its schedules or its automations segment is, and it
  // opens on the first one offered (the schedules)
  const items = api && source === DEVICES_TABS ? source.flatMap((t) => {
    if (t.id !== 'automations') return [t];
    const seg = kavarnitSegments(api, can);
    return seg.schedules || seg.automations ? [{ ...t, href: seg.schedules ? SCHEDULES_HREF : AUTOMATIONS_HREF }] : [];
  }) : source;
  return api ? items.filter((t) => !DEMO_ONLY_HREFS.has(t.href ?? '') && !HIDDEN_HREFS.has(t.href ?? '') && !(WISKEY_HIDDEN && isWiskeyHref(t.href ?? '')) && !capHiddenHref(t.href ?? '') && !(ALARM_PRESENT === false && ALARM_HREFS.has(t.href ?? '')) && !(INFRA_NO_METERS && t.href === INFRA_METERS_HREF) && (t.href !== SECURITY_SETTINGS_HREF || visibleTabs(SECURITY_SETTINGS_TABS, api, can).length > 0) && tabAllowed(t.href ?? '', can)).map((t) => (API_LABELS[t.href ?? ''] ? { ...t, label: API_LABELS[t.href ?? ''] } : t)) : items;
}

/** The rail entries the user gets: an area stays while one of its tabs is visible (the live area always - the
 * overview needs nothing), and it opens on its first visible tab when its default page is not one of them. An area is
 * not dropped because its own default page is hidden: with הסתרת המפה the map area used to keep the WisKey tab
 * for this reason (T054); since 0.1.103 WisKey is its own top-level area (not an explore tab) and MAP_HREFS does not
 * name it, so הסתרת המפה has no effect on it at all - moot, confirmed, not stale logic. */
export function visibleAreas(api: boolean, can?: Can, order: readonly string[] = defaultNavOrder()): AreaEntry[] {
  // CR-013: the user's own order (nav-order.ts; without one, the admin's ui.tabs order); an id the order does not name
  // keeps its default place at the end
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length + NAV_TAB_IDS.indexOf(id as NavTabId));
  const ordered = [...NAV_A].sort((x, y) => rank(x.id) - rank(y.id));
  const list = ordered.flatMap((n) => {
    const tabs = visibleTabs(AREA_TABS[n.id], api, can);
    // the security area stays while any section is visible (the live overview needs nothing; in the NVR-less mode only
    // the alarm section can keep it), and keeps its own #/security href - the shell opens the last used section
    if (api && !tabs.length) return [];
    if (n.id === 'security') return [n];
    return [{ ...n, href: entryHref(n.href, tabs, n.id) }];
  });
  // ui.tabs "areas": areas the admin hid leave the rail and the bottom bar (the order stays the user's)
  return api ? configureTabs('areas', list, false) : list;
}

/** The rail's default order for everyone: the admin's `ui.tabs` order of the areas, else the built-in one. A user's own
 * order (CR-013) overrides it for that user (nav-order.ts). */
export function defaultNavOrder(): NavTabId[] {
  const listed = TABS_CONFIG.areas?.order ?? [];
  const first = listed.filter((id, i): id is NavTabId => (NAV_TAB_IDS as string[]).includes(id) && listed.indexOf(id) === i);
  return [...first, ...NAV_TAB_IDS.filter((id) => !first.includes(id))];
}

/** CR-013: the user menu's "מערכת" item - only for a user who holds a settings permission (a settings tab other than the
 * personal ones is visible to them), opening on their first such tab; null otherwise. */
export function settingsEntry(api: boolean, can?: Can): AreaEntry | null {
  const tabs = visibleTabs(AREA_TABS.system, api, can).filter((t) => !PERSONAL_SYSTEM_HREFS.has(t.href ?? ''));
  if (!tabs.length) return null;
  return tabs.some((t) => t.href === SYSTEM_AREA.href) ? SYSTEM_AREA : { ...SYSTEM_AREA, href: tabs[0].href ?? SYSTEM_AREA.href };
}

/** CR-013: where the app opens when the address names no screen - the start screen of the settings (ראשי by default)
 * when this user sees it, otherwise their first visible tab in their own order. */
export function landingTarget(start: string, api: boolean, can: Can | undefined, order: readonly string[]): string {
  const area = areaOf(parseRouteLite(start));
  const tabs = area ? visibleTabs(AREA_TABS[area], api, can) : [];
  // a start screen whose area the admin took out of the rail is not a landing place either (ui.tabs "areas")
  if (tabs.some((t) => t.href === `#${start}`) && (!api || visibleAreas(api, can, order).some((a) => a.id === area))) return start;
  const first = visibleAreas(api, can, order)[0];
  if (!first) return start;
  return (first.id === 'security' ? securityTarget(api, can) : first.href).replace(/^#/, '');
}

/** A RouteState for a path, without the router's window dependency (nav.ts stays pure). */
function parseRouteLite(path: string): RouteState {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  const modes = ['live', 'explore', 'investigate', 'system', 'wiskey', 'devices', 'security', 'multimedia', 'infra'];
  return { path, segments, params: new URLSearchParams(path.split('?')[1] ?? ''), mode: modes.includes(segments[0]) ? (segments[0] as RouteState['mode']) : null };
}

/** CR-014: `schedules.enabled` off (הגדרות › תזמונים) takes the "תזמונים" tab out of the home area for everyone - the same "hidden
 * for everyone" shape as applySnapshotHidden: its href joins HIDDEN_HREFS, so the tab row (and with it the row itself, which
 * shows only with two tabs) follows. The route is not closed: the screen answers "התזמונים כבויים" itself. Called by the shell
 * after HIDDEN_HREFS was rebuilt from the product settings, and by the settings screen after a save (the navigation
 * re-renders through the tabs listeners). Returns whether the tab is hidden. */
export function applySchedulesHidden(settings: Record<string, unknown> | null | undefined): boolean {
  const hidden = String(settings?.['schedules.enabled'] ?? 'true') === 'false';
  const was = HIDDEN_HREFS.has(SCHEDULES_HREF);
  if (hidden) HIDDEN_HREFS.add(SCHEDULES_HREF);
  else HIDDEN_HREFS.delete(SCHEDULES_HREF);
  if (was !== hidden) for (const l of tabsListeners) l();
  return hidden;
}

/** CR-017: `automations.enabled` off (הגדרות › אוטומציות) takes the "אוטומציות" tab out of the home area for everyone (the same shape as applySchedulesHidden).
 * The route is not closed: the screen answers "האוטומציות כבויות" itself. Called by the shell after HIDDEN_HREFS was rebuilt from the product settings and by
 * the settings screen after a save. Returns whether the tab is hidden. */
export function applyAutomationsHidden(settings: Record<string, unknown> | null | undefined): boolean {
  const hidden = String(settings?.['automations.enabled'] ?? 'true') === 'false';
  const was = HIDDEN_HREFS.has(AUTOMATIONS_HREF);
  if (hidden) HIDDEN_HREFS.add(AUTOMATIONS_HREF);
  else HIDDEN_HREFS.delete(AUTOMATIONS_HREF);
  if (was !== hidden) for (const l of tabsListeners) l();
  return hidden;
}

/** The home screen of חשמל והתקנים ("מבט על"): `#/devices` and `#/devices/building` with any query (the panel deep link, `?edit=1`).
 * A drill-down (#/devices/areas/<id>), the schedules and every other area are not the home. The user menu's "עריכת המסך הראשי"
 * is offered only here (owner 2026-09-30: it showed on every screen). */
export function isHomeRoute(r: RouteState | null): boolean {
  return r?.mode === 'devices' && (r.segments[1] ?? 'building') === 'building';
}

/** CR-015: `multimedia.enabled` off (הגדרות › מולטימדיה) takes the multimedia area out of the rail and the bottom bar for everyone - the
 * same "hidden for everyone" shape as applySchedulesHidden (its only visible tab joins HIDDEN_HREFS, so the area has no tab
 * left). The route is not closed: the screen answers "המולטימדיה כבויה" itself. Called by the shell after HIDDEN_HREFS was
 * rebuilt from the product settings, and by the settings screen after a save. Returns whether it is hidden. */
export function applyMultimediaHidden(settings: Record<string, unknown> | null | undefined): boolean {
  const hidden = String(settings?.['multimedia.enabled'] ?? 'true') === 'false';
  const was = HIDDEN_HREFS.has(MULTIMEDIA_SCREENS_HREF);
  if (hidden) HIDDEN_HREFS.add(MULTIMEDIA_SCREENS_HREF);
  else HIDDEN_HREFS.delete(MULTIMEDIA_SCREENS_HREF);
  if (was !== hidden) for (const l of tabsListeners) l();
  return hidden;
}

/** The multimedia pages' editors are entered by `?edit=1` on `#/multimedia/screens` (the user menu's "עריכת מסך המולטימדיה"), `…/players`
 * ("עריכת מסך הנגנים") and `…/groups` ("עריכת הקבוצות השמורות"): while one is active the area's tab row is hidden, like the home editor's. */
export function isMultimediaEditRoute(r: RouteState | null): boolean {
  return r?.mode === 'multimedia' && ['screens', 'players', 'groups'].includes(r.segments[1] ?? 'screens') && r.params.get('edit') === '1';
}

/** The home screen's layout editor is entered by `?edit=1` on "מבט על" (the user menu's "עריכת המסך הראשי", devices-layout.ts):
 * while it is active the home area's tab row is hidden (like the plan editors'), so the editor is never left by a tab click. */
export function isHomeEditRoute(r: RouteState | null): boolean {
  return r?.mode === 'devices' && (r.segments[1] ?? 'building') === 'building' && r.params.get('edit') === '1';
}

/** Route → real screen for the demo-only routes when a backend exists; null when the route is fine. */
export function demoRedirect(path: string, api: boolean): string | null {
  if (!api) return null;
  if (/^\/investigate\/rules\/[^/]+$/.test(path)) return '/investigate/rules';
  return null;
}

/** The live overview, "תמונת מצב" - the first live page, hidden with הגדרות › ממשק › `ui.security_snapshot` (owner 2026-09-30):
 * its href joins HIDDEN_HREFS, so it leaves the navigation, and its route lands on the next live page
 * (liveOverviewTarget). The screen is not otherwise gated - hiding is navigation, not access control. */
export const SNAPSHOT_HREF = '#/live';

/** The `ui.security_snapshot` setting as HIDDEN_HREFS state (true = hidden). Returns whether it is hidden. */
export function applySnapshotHidden(settings: Record<string, unknown> | null | undefined): boolean {
  const hidden = String(settings?.['ui.security_snapshot'] ?? 'true') === 'false';
  if (hidden) HIDDEN_HREFS.add(SNAPSHOT_HREF);
  else HIDDEN_HREFS.delete(SNAPSHOT_HREF);
  return hidden;
}

/** Where the hidden live overview goes: the first live page this user sees; null when there is none (the overview then
 * shows as it always did, so a user with no other live page is never sent in a circle). */
export function liveOverviewTarget(api: boolean, can?: Can): string | null {
  if (!api || !HIDDEN_HREFS.has(SNAPSHOT_HREF)) return null;
  return visibleTabs(SECTION_TABS.live, api, can)[0]?.href ?? null;
}

/** What a redirect that depends on who is asking needs to know (the shell passes its session): with a backend (`api`) the
 * permission check applies, `ready` is false while the session is still loading. */
export interface LegacyAccess {
  api: boolean;
  ready: boolean;
  can: Can;
}

/** Old routes that moved (2026-09-30). Returns the new path (`/investigate/health?sort=...`) or null when the route
 * stays. Query parameters travel with the redirect (the alarm panel, the camera-health sort), so links written before the
 * move - the search result, the devices screens, notifications, bookmarks - keep working. Applies with and without a backend. */
export function legacyRedirect(r: RouteState | null, access?: LegacyAccess): string | null {
  if (!r?.mode) return null;
  const q = r.params.toString() ? `?${r.params.toString()}` : '';
  const s = r.segments;
  // the device catalogue left the map for הגדרות › קטלוג התקנים: holders of system.configure land there (the search query
  // travels), everyone else on the map; while the session is still loading nothing is decided yet
  if (r.mode === 'explore' && s[1] === 'entities') {
    if (!access) return `${ENTITIES_SETTINGS_HREF.slice(1)}${q}`;
    if (!access.ready) return null;
    return !access.api || access.can('system.configure', true) ? `${ENTITIES_SETTINGS_HREF.slice(1)}${q}` : '/explore/floors/f0';
  }
  // (the intrusion alarm is #/security/alarm again since 0.1.147: a tab of the security area, and a page of הגדרות › אבטחה)
  // camera health left the live pages for the investigation
  if (r.mode === 'system' && s[1] === 'devices') return `/investigate/health${q}`;
  // the alarm management was הגדרות › כללי › אזעקה (?tab=alarm)
  if (r.mode === 'system' && (!s[1] || s[1] === 'diagnostics') && r.params.get('tab') === 'alarm') {
    const rest = new URLSearchParams(r.params);
    rest.delete('tab');
    return `/system/security/manage${rest.toString() ? `?${rest.toString()}` : ''}`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The tab registry the settings editor (הגדרות › כללי › לשוניות) is built from: one entry per navigation section that has
// tabs, straight from the arrays above - the single source of ids, labels and default order. Section ids are what
// `ui.tabs` is keyed by (lower-case slugs; a nested level is `parent.child`).
// ---------------------------------------------------------------------------------------------
export interface TabSectionDef {
  id: string;
  label: string;
  /** Where the section shows: the surface the owner recognises it by. */
  where: string;
  /** Every tab of the section in its default order (not limited by permissions: the editor is for the whole installation). */
  tabs: () => TabItem[];
  /** The hierarchy level of its bar: 1 = the first bar of an area (the security sections, the tab row of home, map, WisKey and
   * settings), 2 = the sub-tabs below it (the pages of לייב and חקירה, the pages of הגדרות › אבטחה). */
  level: TabLevel;
  /** False for the rail / bottom bar: it has no tab-bar style. */
  bar?: boolean;
}

const plain = (items: readonly { id: string; label: string; href?: string }[]): TabItem[] => items.map((i) => ({ id: i.id, label: i.label, href: i.href }));

export const TAB_SECTIONS: TabSectionDef[] = [
  { id: 'areas', label: 'ניווט ראשי', where: 'סרגל הצד ופס הניווט התחתון', tabs: () => plain(NAV_A), level: 1, bar: false },
  { id: 'devices', label: 'ראשי', where: 'לשוניות המסך הראשי', tabs: () => plain(DEVICES_TABS), level: 1 },
  { id: 'security', label: 'אבטחה', where: 'הבחירה בראש אזור האבטחה', tabs: () => plain(SECURITY_SECTIONS), level: 1 },
  { id: 'security.live', label: 'אבטחה › לייב', where: 'לשוניות לייב', tabs: () => plain(SECTION_TABS.live), level: 2 },
  { id: 'security.investigate', label: 'אבטחה › חקירה', where: 'לשוניות חקירה', tabs: () => plain(SECTION_TABS.investigate), level: 2 },
  { id: 'explore', label: 'מפה', where: 'לשוניות המפה', tabs: () => plain(EXPLORE_TABS), level: 1 },
  { id: 'wiskey', label: 'WisKey', where: 'לשוניות WisKey', tabs: () => plain(WISKEY_TABS), level: 1 },
  { id: 'system', label: 'הגדרות', where: 'לשוניות ההגדרות', tabs: () => plain(AREA_TABS.system), level: 1 },
  { id: 'system.security', label: 'הגדרות › אבטחה', where: 'לשוניות אבטחה בהגדרות', tabs: () => plain(SECURITY_SETTINGS_TABS), level: 2 },
];

/** The `ui.tabs` section of the tab row the shell draws under an area's head: in the security area the row is the current
 * section's pages (`security.live` / `security.investigate`, level 2 - the sections themselves are `security`, level 1),
 * elsewhere the area's own tabs (home, map, WisKey, settings: level 1). null when the area has no configurable row. */
export function areaRowSection(area: AreaId | null, section: SecuritySection | null): string | null {
  if (!area) return null;
  if (area === 'security') return section ? `security.${section}` : null;
  return TAB_SECTIONS.some((s) => s.id === area) ? area : null;
}

/** 0.1.153: the tab group (shell/tabs-mode.ts) of an area's row - the unit a presentation mode (tabs / hybrid / dropdown) is set for. The
 * main bottom navigation is not a group. */
export function tabGroupOf(area: AreaId | null): TabGroup | null {
  if (!area) return null;
  if (area === 'security') return 'security';
  if (area === 'system') return 'settings';
  if (area === 'multimedia') return 'multimedia';
  return 'area';
}
export { tabModeOf } from './tabs-mode';

let ARRAY_SECTIONS: Map<readonly TabItem[], string> | null = null;

/** The section id a registry array belongs to, or null for a row `ui.tabs` does not configure. */
export function sectionIdOf(items: readonly TabItem[]): string | null {
  ARRAY_SECTIONS ??= new Map<readonly TabItem[], string>([
    [DEVICES_TABS, 'devices'],
    [SECTION_TABS.live, 'security.live'],
    [SECTION_TABS.investigate, 'security.investigate'],
    [EXPLORE_TABS, 'explore'],
    [WISKEY_TABS, 'wiskey'],
    [AREA_TABS.system, 'system'],
    [SECURITY_SETTINGS_TABS, 'system.security'],
  ]);
  return ARRAY_SECTIONS.get(items) ?? null;
}

