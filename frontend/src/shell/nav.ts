import type { IconName } from '../components/sw-icon';
import type { TabItem } from '../components/sw-tabs';
import type { RouteState } from '../router';
import type { WiskeyCatalog, WiskeyLocation } from '../wiskey/embed-connector';

/**
 * Primary navigation as drawn on the boards: originally six flat entries (Overview, Sites, Cameras,
 * Events, Playback, Settings); WisKey became a 7th flat entry 2026-09-27 by explicit owner override, an
 * intentional exception to that count (see the ADR-009 "Recorded deviation" note in DECISIONS.md, and the
 * newer note there for this WisKey change specifically). The kit's five modes (live / explore /
 * investigate / system / wiskey) remain the route structure; each entry maps onto one of them, and the
 * section's pages appear as pill tabs under the top bar. Recorded as a design-asset-driven deviation
 * pending owner sign-off (see DECISIONS.md).
 */
export type NavGroup = 'overview' | 'sites' | 'cameras' | 'events' | 'playback' | 'settings' | 'wiskey' | 'devices';

export interface NavEntry {
  id: NavGroup;
  icon: IconName;
  label: string;
  href: string;
}

/** 7th flat entry (0.1.103): owner override 2026-09-27 - WisKey moved from a "sites" sub-tab to a true
 * top-level peer, breaking ADR-009's six-flat-entries count for this design on purpose. See the
 * "Recorded deviation" note on the ADR-009 row in docs/architecture/DECISIONS.md.
 * 8th flat entry (CR-007, 2026-09-28): "חשמל והתקנים" (devices), the electricity / device control area the owner
 * approved from the mockup - the same kind of recorded exception, see the CR-007 note in DECISIONS.md. */
export const NAV: NavEntry[] = [
  { id: 'overview', icon: 'dashboard', label: 'סקירה', href: '#/live' },
  { id: 'sites', icon: 'building', label: 'אתרים', href: '#/explore/sites' },
  { id: 'cameras', icon: 'camera', label: 'מצלמות', href: '#/live/wall' },
  { id: 'events', icon: 'bell', label: 'אירועים', href: '#/investigate/events' },
  { id: 'playback', icon: 'history', label: 'הקלטות', href: '#/investigate/playback' },
  { id: 'devices', icon: 'bolt', label: 'חשמל והתקנים', href: '#/devices/building' },
  { id: 'wiskey', icon: 'door', label: 'WisKey', href: '#/wiskey/overview' },
  { id: 'settings', icon: 'system', label: 'הגדרות', href: '#/system/diagnostics' },
];

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

/** The WisKey area's tabs, shared by both designs (GROUP_TABS.wiskey and AREA_TABS.wiskey are this same array, so the
 * phone bottom nav and its overflow follow too). WisKey embed API v1 (rc.19+): once the embedded panel's `wiskey:ready`
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
 * area disappears from both nav designs, the phone bottom nav and its overflow. */
export let WISKEY_HIDDEN = false;
export function applyWiskeyHidden(settings: Record<string, unknown> | null | undefined): boolean {
  WISKEY_HIDDEN = String(settings?.['ui.hide_wiskey'] ?? 'false') === 'true';
  return WISKEY_HIDDEN;
}

/** NVR-less mode (owner request 2026-09-29): the installation runs with Home Assistant only (no `nvr_host` in the add-on
 * options; /me says `mode: ha_only`). Every NVR area - the live overview and cameras, events and everything under
 * "חקירה" (history, recordings, sync, cases, rules, exports, search) and the camera health page - leaves the navigation
 * for everyone, like `ui.hide_wiskey` hides WisKey; `sw-app.ts` answers their URLs with a "מצב ללא NVR" panel. Hidden is
 * not unprotected: the server refuses the NVR routes itself (409 nvr_not_configured). Filled by the shell from the
 * session. */
export let NVR_LESS = false;
export function applyNvrLess(on: boolean): boolean {
  NVR_LESS = on;
  return NVR_LESS;
}

/** An href of an area that needs the NVR (see NVR_LESS). */
export function isNvrHref(href: string): boolean {
  return href === '#/live' || href.startsWith('#/live/') || href.startsWith('#/investigate/') || href === '#/system/devices';
}

/** A route of an area that needs the NVR: live and cameras, the whole investigate mode, camera health, the kiosk wall. */
export function isNvrRoute(r: RouteState | null): boolean {
  if (!r) return false;
  if (r.segments[0] === 'kiosk') return true;
  return r.mode === 'live' || r.mode === 'investigate' || (r.mode === 'system' && r.segments[1] === 'devices');
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

/** הגדרות › אבטחה (2026-09-30): everything about the alarm system and the NVR. The intrusion alarm left the security area
 * (its screen, `#/security/alarm`, redirects here - see legacyRedirect) and lives in Settings, next to its management
 * and the NVR summary. Sub-pages, each with the permission it always had: the alarm screen (alarm.view), its management
 * (system.configure) and the NVR (system.configure / sources.configure, like הגדרות › חיבורים). */
export const SECURITY_SETTINGS_HREF = '#/system/security';
export const SECURITY_SETTINGS_TABS: TabItem[] = [
  { id: 'alarm', label: 'אזעקה', href: '#/system/security/alarm' },
  { id: 'manage', label: 'ניהול אזעקה', href: '#/system/security/manage' },
  { id: 'nvr', label: 'NVR', href: '#/system/security/nvr' },
];

/** Is there an alarm panel on this platform? null = not known yet (api/alarm-presence.ts fills it once per session and
 * refreshes it on a slow timer). The two alarm sub-pages of הגדרות › אבטחה exist only while it is true: with no panel the
 * tab is not shown at all (owner 2026-09-30), rather than an empty state. Only consulted with a backend (visibleTabs). */
export let ALARM_PRESENT: boolean | null = null;
export function applyAlarmPresent(v: boolean | null): void {
  ALARM_PRESENT = v;
}
const ALARM_SETTINGS_HREFS = new Set(['#/system/security/alarm', '#/system/security/manage']);

export const GROUP_TABS: Record<NavGroup, TabItem[]> = {
  overview: [],
  /** The building tree (CR-007 slice 1); an area screen is a drill-down of it (#/devices/areas/<id>), not a tab.
   * Later slices (screens and remotes, layouts) add tabs here the way `wiskey` grew. */
  devices: [{ id: 'building', label: 'המבנה', href: '#/devices/building' }],
  sites: [
    { id: 'sites', label: 'אתרים ומבנים', href: '#/explore/sites' },
    { id: 'floors', label: 'מפת קומה', href: '#/explore/floors/f0' },
    { id: 'entities', label: 'התקנים', href: '#/explore/entities' },
  ],
  /** Entry Center, Activity and People (CR-005 phase 1b), plus WisKey's own screens as embedded tabs (2026-09-28). */
  wiskey: WISKEY_TABS,
  cameras: [
    { id: 'wall', label: 'כל המצלמות', href: '#/live/wall' },
    { id: 'views', label: 'תצוגות שמורות', href: '#/live/views' },
  ],
  events: [
    { id: 'events', label: 'מרכז אירועים', href: '#/investigate/events' },
    { id: 'reviews', label: 'Review', href: '#/investigate/reviews' },
    { id: 'search', label: 'חיפוש', href: '#/investigate/search' },
    { id: 'cases', label: 'תיקים', href: '#/investigate/cases' },
    { id: 'rules', label: 'חוקים והתראות', href: '#/investigate/rules' },
    { id: 'exports', label: 'ייצוא', href: '#/investigate/exports' },
    /** 2026-09-30: camera health moved out of the live pages into the investigation (was #/system/devices). */
    { id: 'health', label: 'בריאות מצלמות', href: '#/investigate/health' },
  ],
  playback: [
    { id: 'playback', label: 'הקלטות', href: '#/investigate/playback' },
    { id: 'sync', label: 'ניגון מסונכרן', href: '#/investigate/playback/sync' },
    { id: 'history', label: 'מפה היסטורית', href: '#/investigate/floors/f0/history' },
  ],
  settings: [
    { id: 'general', label: 'כללי', href: '#/system/diagnostics' },
    // CR-008 P3: per-user push notifications - every signed-in user may set their own (no TAB_PERMISSIONS entry)
    { id: 'notifications', label: 'התראות', href: '#/system/notifications' },
    { id: 'access', label: 'משתמשים והרשאות', href: '#/system/access' },
    { id: 'security', label: 'אבטחה', href: SECURITY_SETTINGS_HREF },
    { id: 'audit', label: 'אודיט', href: '#/system/audit' },
    { id: 'storage', label: 'אחסון', href: '#/system/storage' },
    { id: 'wizard', label: 'אשף התקנה', href: '#/system/wizard' },
    { id: 'setup', label: 'חיבורים', href: '#/system/setup' },
  ],
};

export function groupOf(r: RouteState | null): NavGroup | null {
  if (!r?.mode) return null;
  const s = r.segments;
  switch (r.mode) {
    case 'live':
      return s.length === 1 ? 'overview' : 'cameras';
    case 'explore':
      return 'sites';
    case 'investigate':
      return !s[1] || s[1] === 'playback' || s[1] === 'floors' ? 'playback' : 'events';
    case 'system':
      return 'settings';
    case 'wiskey':
      return 'wiskey';
    case 'devices':
      return 'devices';
    default:
      return null;
  }
}

export function activeTabOf(r: RouteState | null): string {
  const g = groupOf(r);
  if (!g || !r) return '';
  const s = r.segments;
  switch (g) {
    case 'sites':
      return s[1] === 'buildings' || s[1] === 'floors' ? 'floors' : s[1] === 'entities' ? 'entities' : 'sites';
    case 'wiskey':
      return wiskeyActiveTab(r);
    case 'devices':
      return 'building';
    case 'cameras':
      return s[1] === 'views' ? 'views' : 'wall';
    case 'events':
      return s[1] ?? 'events';
    case 'playback':
      return s[1] === 'floors' ? 'history' : s[2] === 'sync' ? 'sync' : 'playback';
    case 'settings':
      return !s[1] || s[1] === 'diagnostics' ? 'general' : s[1];
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------------------------
// Design "SW A" (mockups v1.3): originally exactly the kit's four areas as a right icon rail; WisKey
// became a 5th area 2026-09-27 by explicit owner override (a peer of live/explore/investigate/system, not
// nested under explore). The section's pages stay reachable as a tab row under the top bar.
// CR-010 (owner request 2026-09-29): "לייב" and "חקירה" are no longer areas of their own: they are the first two SECTIONS
// of one area "אבטחה" (security). The rail / phone bottom bar shows the area, the top bar a segmented control of the
// sections, and the tab row under it the section's own pages - three levels, each on its own row. #/security opens the
// section this browser used last. 2026-09-30: the third section, the intrusion alarm, left for הגדרות › אבטחה
// (SECURITY_SETTINGS_TABS; #/security/alarm redirects), and camera health moved from the live pages into the
// investigation (#/investigate/health; #/system/devices redirects) - see legacyRedirect.
// ---------------------------------------------------------------------------------------------
export type AreaId = 'security' | 'explore' | 'system' | 'wiskey' | 'devices';
export type SecuritySection = 'live' | 'investigate';

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
  { id: 'wiskey', icon: 'door', label: 'WisKey', href: '#/wiskey/overview' },
];

/** The ids of the movable tabs, in the default order (the server keeps the same list: services/user_prefs.py). */
export type NavTabId = 'devices' | 'security' | 'explore' | 'wiskey';
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
    { id: 'reviews', label: 'Review', href: '#/investigate/reviews' },
    { id: 'search', label: 'חיפוש', href: '#/investigate/search' },
    { id: 'cases', label: 'תיקים', href: '#/investigate/cases' },
    { id: 'rules', label: 'חוקים והתראות', href: '#/investigate/rules' },
    { id: 'exports', label: 'ייצוא', href: '#/investigate/exports' },
    /** 2026-09-30: camera health lives in the investigation (it was the fourth live page, #/system/devices). */
    { id: 'health', label: 'בריאות מצלמות', href: '#/investigate/health' },
  ],
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
];

export const AREA_TABS: Record<AreaId, TabItem[]> = {
  devices: [{ id: 'building', label: 'המבנה', href: '#/devices/building' }],
  /** Every page of the sections: the area stays in the rail while any of them is visible. */
  security: [...SECTION_TABS.live, ...SECTION_TABS.investigate],
  explore: [
    { id: 'sites', label: 'אתרים ומבנים', href: '#/explore/sites' },
    { id: 'floors', label: 'מפת קומה', href: '#/explore/floors/f0' },
    { id: 'entities', label: 'התקנים', href: '#/explore/entities' },
  ],
  /** Entry Center/overview, Activity/events and People/people (CR-005 phase 1b), plus WisKey's own screens as embedded
   * tabs (CR-005 recorded decision 2026-09-28) - the same list as GROUP_TABS.wiskey. */
  wiskey: WISKEY_TABS,
  system: [
    { id: 'general', label: 'כללי', href: '#/system/diagnostics' },
    // CR-008 P3: per-user push notifications - every signed-in user may set their own (no TAB_PERMISSIONS entry)
    { id: 'notifications', label: 'התראות', href: '#/system/notifications' },
    { id: 'access', label: 'משתמשים והרשאות', href: '#/system/access' },
    { id: 'security', label: 'אבטחה', href: SECURITY_SETTINGS_HREF },
    { id: 'audit', label: 'אודיט', href: '#/system/audit' },
    { id: 'storage', label: 'אחסון', href: '#/system/storage' },
    { id: 'wizard', label: 'אשף התקנה', href: '#/system/wizard' },
    { id: 'setup', label: 'חיבורים', href: '#/system/setup' },
    /** CR-013 review M10: the screen catalogue left the user menu; a system administrator reaches it from here */
    { id: 'screens', label: 'כל המסכים', href: '#/screens' },
  ],
};

/** The security section a route belongs to (camera health, #/investigate/health, is an investigation page). */
export function sectionOf(r: RouteState | null): SecuritySection | null {
  if (!r?.mode) return null;
  if (r.mode === 'live') return 'live';
  if (r.mode === 'investigate') return 'investigate';
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
      return '';
    }
    case 'explore':
      return s[1] === 'buildings' || s[1] === 'floors' ? 'floors' : s[1] === 'entities' ? 'entities' : 'sites';
    case 'system':
      return !s[1] || s[1] === 'diagnostics' ? 'general' : s[1];
    case 'wiskey':
      return wiskeyActiveTab(r);
    case 'devices':
      return 'building';
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
  return [area?.label ?? '', sec?.label ?? '', label === sec?.label ? '' : label, sub ?? ''].filter(Boolean);
}

/** The sections of the security area this user sees, each opening on its first visible page. */
export function visibleSections(api: boolean, can?: Can): SectionEntry[] {
  return SECURITY_SECTIONS.flatMap((s) => {
    const tabs = visibleTabs(SECTION_TABS[s.id], api, can);
    // the live overview needs nothing, so the live section is there whenever the NVR is (visibleTabs keeps it)
    if (api && !tabs.length) return [];
    const first = tabs[0]?.href;
    return [first && !tabs.some((t) => t.href === s.href) ? { ...s, href: first } : s];
  });
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
    return v === 'live' || v === 'investigate' ? v : null; // a stored 'alarm' (before 2026-09-30) is ignored
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
    subtitle: s.id === 'live' ? 'תמונת מצב ומצלמות' : 'אירועים, הקלטות ותיקים',
    href: s.href,
    keywords: s.id === 'live' ? ['לייב', 'מצלמות', 'live'] : ['חקירה', 'אירועים', 'הקלטות'],
  }));
  // the intrusion alarm lives in הגדרות › אבטחה (2026-09-30); offered only to those who see that page (permission + a panel exists)
  const alarm = visibleTabs(SECURITY_SETTINGS_TABS, api, can).find((t) => t.id === 'alarm');
  if (alarm?.href) all.push({ label: 'הגדרות › אבטחה › אזעקה', subtitle: 'מצב האזעקה, דריכה ונטרול, חיישנים ועקיפה', href: alarm.href, keywords: ['אזעקה', 'דריכה', 'נטרול', 'עקיפה', 'חיישנים', 'alarm'] });
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
export const MAP_HREFS = ['#/explore/sites', '#/explore/floors/f0', '#/explore/entities'];

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
  '#/explore/entities': ['entity.state.read'],
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
  // CR-010, moved to הגדרות › אבטחה 2026-09-30: the alarm screen - alarm.view at any scope: a floor-scoped holder sees the
  // panels placed on their floors (routers/alarm.py), so the entry is not installation-only. Its management is what it
  // always was (routers/alarm.py `_configurer`: system.configure); the NVR page follows הגדרות › חיבורים. The section's own
  // entry (SECURITY_SETTINGS_HREF) is listed for completeness: tabAllowed shows it when any of its pages is visible.
  '#/system/security/alarm': ['alarm.view'],
  '#/system/security/manage': ['system.configure'],
  '#/system/security/nvr': ['system.configure', 'sources.configure'],
  [SECURITY_SETTINGS_HREF]: ['alarm.view', 'system.configure', 'sources.configure'],
  '#/investigate/events': ['events.read'],
  '#/investigate/playback': ['video.playback'],
  '#/investigate/playback/sync': ['video.playback'],
  '#/investigate/floors/f0/history': ['video.playback'],
  '#/investigate/reviews': ['events.read'],
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
export const INSTALLATION_ONLY_HREFS = new Set<string>([...STATIC_WISKEY_TABS.map((t) => t.href ?? ''), '#/system/wizard', '#/system/security/manage']); // the alarm management: routers/alarm.py `_configurer` checks system.configure at installation scope

/** `installationOnly`: the permission must be held at installation scope, not at any scope. */
export type Can = (permission: string, installationOnly?: boolean) => boolean;

export function tabAllowed(href: string, can?: Can): boolean {
  // every WisKey tab (the static ones and those built from the embed API catalog) needs access.read at installation scope
  const need = TAB_PERMISSIONS[href] ?? (isWiskeyHref(href) ? ['access.read'] : undefined);
  const installationOnly = INSTALLATION_ONLY_HREFS.has(href) || isWiskeyHref(href);
  return !need || !can || need.some((p) => can(p, installationOnly));
}

export function visibleTabs(items: TabItem[], api: boolean, can?: Can): TabItem[] {
  return api ? items.filter((t) => !DEMO_ONLY_HREFS.has(t.href ?? '') && !HIDDEN_HREFS.has(t.href ?? '') && !(WISKEY_HIDDEN && isWiskeyHref(t.href ?? '')) && !(NVR_LESS && isNvrHref(t.href ?? '')) && !(ALARM_PRESENT !== true && ALARM_SETTINGS_HREFS.has(t.href ?? '')) && (t.href !== SECURITY_SETTINGS_HREF || visibleTabs(SECURITY_SETTINGS_TABS, api, can).length > 0) && tabAllowed(t.href ?? '', can)).map((t) => (API_LABELS[t.href ?? ''] ? { ...t, label: API_LABELS[t.href ?? ''] } : t)) : items;
}

/** The rail entries the user gets: an area stays while one of its tabs is visible (the live area always - the
 * overview needs nothing), and it opens on its first visible tab when its default page is not one of them. An area is
 * not dropped because its own default page is hidden: with הסתרת המפה the map area used to keep the WisKey tab
 * for this reason (T054); since 0.1.103 WisKey is its own top-level area (not an explore tab) and MAP_HREFS does not
 * name it, so הסתרת המפה has no effect on it at all - moot, confirmed, not stale logic. */
export function visibleAreas(api: boolean, can?: Can, order: readonly string[] = NAV_TAB_IDS): AreaEntry[] {
  // CR-013: the user's own order (nav-order.ts); an id the order does not name keeps its default place at the end
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length + NAV_TAB_IDS.indexOf(id as NavTabId));
  const ordered = [...NAV_A].sort((x, y) => rank(x.id) - rank(y.id));
  return ordered.flatMap((n) => {
    const tabs = visibleTabs(AREA_TABS[n.id], api, can);
    // the security area stays while any section is visible (the live overview needs nothing; in the NVR-less mode only
    // the alarm section can keep it), and keeps its own #/security href - the shell opens the last used section
    if (api && !tabs.length) return [];
    if (n.id === 'security') return [n];
    const first = tabs[0]?.href;
    return [first && !tabs.some((t) => t.href === n.href) ? { ...n, href: first } : n];
  });
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
  if (tabs.some((t) => t.href === `#${start}`)) return start;
  const first = visibleAreas(api, can, order)[0];
  if (!first) return start;
  return (first.id === 'security' ? securityTarget(api, can) : first.href).replace(/^#/, '');
}

/** A RouteState for a path, without the router's window dependency (nav.ts stays pure). */
function parseRouteLite(path: string): RouteState {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  const modes = ['live', 'explore', 'investigate', 'system', 'wiskey', 'devices', 'security'];
  return { path, segments, params: new URLSearchParams(path.split('?')[1] ?? ''), mode: modes.includes(segments[0]) ? (segments[0] as RouteState['mode']) : null };
}

/** Design B's flat entries (seven since 0.1.103, see the NAV comment), by the same rule as visibleAreas: a group
 * stays while one of its tabs is visible (the overview always) and opens on its first visible tab - it used to be
 * filtered by its own default page only, so a hidden map left "אתרים" pointing at a hidden page. WisKey is now its
 * own group, not a sites sub-tab, so הסתרת המפה no longer interacts with it at all. */
export function visibleGroups(api: boolean, can?: Can): NavEntry[] {
  return NAV.flatMap((n) => {
    if (n.id === 'overview') return api && (NVR_LESS || HIDDEN_HREFS.has(SNAPSHOT_HREF)) ? [] : [n];
    const tabs = visibleTabs(GROUP_TABS[n.id], api, can);
    if (api && !tabs.length) return [];
    const first = tabs[0]?.href;
    return [first && !tabs.some((t) => t.href === n.href) ? { ...n, href: first } : n];
  });
}

/** Route → real screen for the demo-only routes when a backend exists; null when the route is fine. */
export function demoRedirect(path: string, api: boolean): string | null {
  if (!api) return null;
  if (/^\/investigate\/rules\/[^/]+$/.test(path)) return '/investigate/rules';
  return null;
}

/** The live overview, "תמונת מצב" - the first live page, hidden with הגדרות › ממשק › `ui.security_snapshot` (owner 2026-09-30):
 * its href joins HIDDEN_HREFS, so it leaves both navigation designs, and its route lands on the next live page
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

/** Old routes that moved (2026-09-30). Returns the new path (`/system/security/alarm?panel=...`) or null when the route
 * stays. Query parameters travel with the redirect (the alarm panel, the camera-health sort), so links written before the
 * move - the search result, the devices screens, notifications, bookmarks - keep working. Applies with and without a backend. */
export function legacyRedirect(r: RouteState | null): string | null {
  if (!r?.mode) return null;
  const q = r.params.toString() ? `?${r.params.toString()}` : '';
  const s = r.segments;
  // the intrusion alarm left the security area for הגדרות › אבטחה
  if (r.mode === 'security' && s[1] === 'alarm') return `/system/security/alarm${q}`;
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

