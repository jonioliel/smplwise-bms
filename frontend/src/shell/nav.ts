import type { IconName } from '../components/sw-icon';
import type { TabItem } from '../components/sw-tabs';
import type { RouteState } from '../router';
import type { WiskeyCatalog, WiskeyLocation } from '../wiskey/embed-connector';
import type { TabGroup } from './tabs-mode';
import { ALL_CAPABILITIES } from '../api/capabilities';
import { applyCapabilities, capHiddenHref, needsOfSegments, segmentsOfHref } from './nav-capabilities';
import type { TabsConfig, TabsSectionConfig, TabStyle, TabStyleDefaults } from '../api/media';
import { onTicketNames } from '../tickets/naming';
import { tt, ticketsSectionLabel as sectionLabel } from '../tickets/text';
import { bt } from '../tickets/board-text'; // CR-038 slice 6: the board tab's label
import { ot } from '../tickets/overview-text'; // MGRDASH: the overview tab's label
import { ct } from '../tickets/cost-text'; // TK258: the vendors account tab's label
import { rt } from '../tickets/rfq-text'; // TKRFQ2: the requests-for-quotation tab's label
import { xt } from '../i18n/access-external'; // SHAREDID-293: the external-access tab's label
import { dwt } from '../i18n/door-windows'; // CR-039 DOORWIN-295: the door-windows tab's label
import { announceText } from '../i18n/announce'; // ANNOUNCE-295: the announce tab's label
import { tst } from '../i18n/tab-sections'; // TABSET-293: the names of the tab registry's sections (he / en / ar / ru)
import { he } from '../i18n/he'; // TABSET-293: the generator's page names (the registry's `infra.generator` section)
import { mt } from '../i18n/maintenance'; // CR-MAINT215 slice 2: the maintenance section's label
import { ix } from '../i18n/insights'; // CR-INSIGHT215: the building report page's label
import { tr as trTab0 } from '../i18n/transit'; // BUSTIMES-295: the public-transport tab's label
import { xt as xsText } from '../i18n/xsection'; // 2.29.0: the synoptic tab's label
import { pt } from '../i18n/presence'; // WHOIN034-295: the "מי במבנה" tab's label
import { it as incText } from '../i18n/incidents'; // CR-LIVEEVENT100: the live event tab's label

/** The WisKey area's tabs before (or without) a WisKey embed API handshake: the older panel's tabs. The first three are
 * the screens SMPLWISE built (CR-005 phase 1b and 2); each renders either that screen or WisKey's own Home Assistant
 * panel embedded as-is, by הגדרות › מתגי מסכי כניסה (CR-005 recorded decision 2026-09-28, embedded panel - the embed is the
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

/** SHAREDID-293 (owner decision 6, 2026-10-20): "גישת חוץ" (the shared Arx + WisKey identity screen) sits under the access-control
 * area, under service management, or both - the installation's `access.external.placement` (access | tickets | both), set by a system
 * administrator on the screen itself. An Arx-only tab: never a tab of the embedded panel. */
export const EXTERNAL_WISKEY_HREF = '#/wiskey/external';
export const EXTERNAL_TICKETS_HREF = '#/tickets/external';
export type ExternalPlacement = 'access' | 'tickets' | 'both';
let EXTERNAL_PLACEMENT: ExternalPlacement = 'access';
const externalTab = (href: string): TabItem => ({ id: 'external', get label() { return xt('tab'); }, href });
export function externalPlacement(): ExternalPlacement {
  return EXTERNAL_PLACEMENT;
}
/** Apply `access.external.placement` (the shell once the product settings load; the screen right after the administrator saves). */
export function applyExternalPlacement(settings: Record<string, unknown> | null | undefined): ExternalPlacement {
  const raw = String(settings?.['access.external.placement'] ?? 'access');
  const next: ExternalPlacement = raw === 'tickets' || raw === 'both' ? raw : 'access';
  if (next !== EXTERNAL_PLACEMENT) {
    EXTERNAL_PLACEMENT = next;
    rebuildWiskeyTabs();
    for (const l of tabsListeners) l();
  }
  return next;
}
WISKEY_TABS.push(externalTab(EXTERNAL_WISKEY_HREF)); // the default placement (access) until the settings say otherwise

/** CR-039 DOORWIN-295: "חלונות פתיחה" (door windows + the emergency controls). The tab exists ONLY while a door feature is switched on
 * (`doors.ui.tab`, derived by the server from `doors.windows.enabled` / `doors.emergency.enabled`, both off by default) - so with the
 * shipped defaults the navigation is exactly what it was. The route itself always answers (Settings links to it; the server decides). */
export const DOOR_WINDOWS_HREF = '#/wiskey/door-windows';
let DOOR_WINDOWS_TAB = false;
const doorWindowsTab = (): TabItem => ({ id: 'door-windows', get label() { return dwt('tab'); }, href: DOOR_WINDOWS_HREF });
export function doorWindowsTabOn(): boolean {
  return DOOR_WINDOWS_TAB;
}
/** Apply `doors.ui.tab` (the shell once the product settings load). */
export function applyDoorWindowsTab(settings: Record<string, unknown> | null | undefined): boolean {
  const next = String(settings?.['doors.ui.tab'] ?? 'off') === 'on';
  if (next !== DOOR_WINDOWS_TAB) {
    DOOR_WINDOWS_TAB = next;
    rebuildWiskeyTabs();
    for (const l of tabsListeners) l();
  }
  return next;
}

/** CR-036 S9: what the native schedules screen's tab is called. */
export const WISKEY_SCHEDULES_LABEL = 'לוחות זמנים';
/** CR-036 S9: tabs that exist only as a native Arx screen - the embedded panel has no top-level tab for them (its schedule editors
 * live under its own management tools). Such a tab is in the row only while its screen is switched to Arx; with the switch off
 * (the default) nothing changes for anyone. */
const NATIVE_ONLY_WISKEY_TABS: readonly TabItem[] = [{ id: 'schedules', label: WISKEY_SCHEDULES_LABEL, href: '#/wiskey/schedules' }];
/** Where each tab sits in the row (the design's order: entry center, activity, people, stations, schedules, then the panel's own). */
const WISKEY_TAB_ORDER: readonly string[] = ['overview', 'events', 'people', 'devices', 'schedules', 'sync', 'health', 'audit', 'tools'];

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

/** WISKEY_TABS from the catalog (or the static list). A screen the owner set to SMPLWISE in הגדרות › מתגי מסכי כניסה
 * (מרכז הכניסה / פעילות / אנשים) is SMPLWISE's own screen, governed by SMPLWISE's access.read, not by WisKey: it stays in
 * the row even when this operator's WisKey catalog does not list it, at its usual place. */
function rebuildWiskeyTabs(): void {
  const catalog = embedNav.catalog;
  const order = WISKEY_TAB_ORDER;
  const labels = new Map(STATIC_WISKEY_TABS.map((t) => [t.id, t.label]));
  const next: TabItem[] = catalog
    ? catalog.tabs
        .filter((t) => t.id)
        .map((t) => {
          const seg = wiskeySegmentOf(t.id);
          return { id: seg, label: t.label.trim() || labels.get(seg) || t.id, href: `#${wiskeyPath({ tab: t.id })}` };
        })
    : [...STATIC_WISKEY_TABS];
  // a screen switched to Arx keeps its tab whatever the catalog lists; with no catalog the static list already holds the four
  // screens the panel has too, so this only adds a native-only tab (S9: the schedules) there
  for (const s of WISKEY_SCREENS) {
    const seg = WISKEY_SCREEN_SEGMENT[s];
    if (WISKEY_UI[s] !== 'smplwise' || next.some((t) => t.id === seg)) continue;
    const own = [...STATIC_WISKEY_TABS, ...NATIVE_ONLY_WISKEY_TABS].find((t) => t.id === seg);
    if (!own) continue;
    const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
    const at = next.findIndex((t) => rank(t.id) > rank(seg));
    next.splice(at < 0 ? next.length : at, 0, { ...own });
  }
  // CR-036 S6: the native stations screen is named for what it shows ("תחנות ודלתות"); WisKey's own tab keeps WisKey's label
  const named = WISKEY_UI.stations === 'smplwise' ? next.map((t) => (t.id === WISKEY_SCREEN_SEGMENT.stations ? { ...t, label: WISKEY_STATIONS_LABEL } : t)) : next;
  // SHAREDID-293: the external-access tab closes the row while the screen is placed under access control (owner decision 6)
  const withDoors = DOOR_WINDOWS_TAB ? [...named.filter((t) => t.id !== 'door-windows'), doorWindowsTab()] : named.filter((t) => t.id !== 'door-windows'); // DOORWIN-295
  const withExternal = EXTERNAL_PLACEMENT === 'tickets' ? withDoors : [...withDoors.filter((t) => t.id !== 'external'), externalTab(EXTERNAL_WISKEY_HREF)];
  WISKEY_TABS.splice(0, WISKEY_TABS.length, ...withExternal);
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
  if (path === 'external') return 'external'; // SHAREDID-293: an Arx-only screen, never the embed
  const screen = wiskeyScreenOf(path);
  const own = !!screen && WISKEY_UI[screen] === 'smplwise';
  if (own) return path;
  const confirmed = embedNav.confirmed;
  return wiskeySegmentOf(confirmed ? confirmed.tab : wiskeyRequest(r).tab);
}

/** The SMPLWISE screens with a choice in הגדרות › מתגי מסכי כניסה (settings keys `access.ui.<screen>`). `stations` (CR-036 S6,
 * "תחנות ודלתות") takes the route segment of WisKey's own devices tab, `devices`: the tab keeps its place in the row. */
export type WiskeyScreen = 'overview' | 'events' | 'people' | 'stations' | 'schedules';
export type WiskeyUi = 'wiskey' | 'smplwise';
export const WISKEY_SCREENS: WiskeyScreen[] = ['overview', 'events', 'people', 'stations', 'schedules'];

/** The route segment (`#/wiskey/<segment>`) of each screen: its own name, except `stations`, which is WisKey's `devices` tab.
 * `schedules` (CR-036 S9, read only) has no tab of the embedded panel: its tab exists only while the screen is switched to Arx. */
export const WISKEY_SCREEN_SEGMENT: Record<WiskeyScreen, string> = { overview: 'overview', events: 'events', people: 'people', stations: 'devices', schedules: 'schedules' };
/** What the native stations screen's tab is called in the row (WisKey's own tab keeps WisKey's label). */
export const WISKEY_STATIONS_LABEL = 'תחנות ודלתות';

/** The screen a route segment belongs to, or null (a segment that is only ever the embedded panel). */
export function wiskeyScreenOf(segment: string): WiskeyScreen | null {
  return WISKEY_SCREENS.find((s) => WISKEY_SCREEN_SEGMENT[s] === segment) ?? null;
}

/** The owner's choice per screen; 'wiskey' (the embedded panel) until the product settings say otherwise. Filled by the
 * shell once the settings load and by the settings screen after a save. */
export const WISKEY_UI: Record<WiskeyScreen, WiskeyUi> = { overview: 'wiskey', events: 'wiskey', people: 'wiskey', stations: 'wiskey', schedules: 'wiskey' };

/** הגדרות › מתגי מסכי כניסה, experimental (`access.phone_embed`, default off): embed WisKey inside the Companion app too,
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

/** הגדרות › מתגי מסכי כניסה (T054 follow-up, owner request): hide the whole WisKey area from the navigation for
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
  const screen = wiskeyScreenOf(seg);
  // `?classic=1` (CR-036 S6, "talk in the classic panel"): this visit shows the embedded panel even for a screen set to SMPLWISE.
  // A per-visit way to the classic panel; it changes no setting, and the embed keeps it in the address it mirrors.
  const classic = api && r?.params.get('classic') === '1';
  if (screen && !classic && (!api || WISKEY_UI[screen] === 'smplwise')) return { kind: 'smplwise', screen };
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
/** SECFIX2-295 (owner 2026-10-21): the public-interface hardening settings (system.configure; the server checks each group). */
export const SECURITY_PUBLIC_HREF = '#/system/security/public';
/** MASKUI-295: the privacy-mask editor (the page needs system.configure to open; writing needs nvr.config.privacy, checked by the server and shown on the page). */
/** SWITCHUI-295: the four access-control read switches (GET / PUT /wiskey/switches; system administrators, installation scope). */
export const SECURITY_WISKEY_HREF = '#/system/security/wiskey';
export const SECURITY_PRIVACY_MASKS_HREF = '#/system/security/privacy-masks';
/** הגדרות › קטלוג התקנים (2026-09-30): the Home Assistant entity catalogue, formerly the map's "התקנים" tab
 * (#/explore/entities, which redirects here for holders of system.configure - see legacyRedirect). */
export const ENTITIES_SETTINGS_HREF = '#/system/entities';
export const SECURITY_SETTINGS_TABS: TabItem[] = [
  { id: 'alarm', label: 'אזעקה', href: '#/system/security/alarm' },
  { id: 'manage', label: 'ניהול אזעקה', href: '#/system/security/manage' },
  { id: 'nvr', label: 'NVR', href: '#/system/security/nvr' },
  /** CR-020 S1: the cameras' video settings (codec, SVC, resolution, bitrate, ...), read-only, system administrators. */
  { id: 'cameras', label: 'מצלמות', href: SECURITY_CAMERAS_HREF },
  /** SECFIX2-295: retention / cap of vendor-typed technicians, the portal's sign-in queue, the uniform answer switch. */
  { id: 'public', label: 'ממשק ציבורי', href: SECURITY_PUBLIC_HREF },
  /** MASKUI-295: draw, review and write the cameras' privacy masks. */
  { id: 'privacy-masks', label: 'מסכות פרטיות', href: SECURITY_PRIVACY_MASKS_HREF },
  /** SWITCHUI-295: turn the access-control reads off / on (system administrators; a switch cannot be turned on without a go-live permit). */
  { id: 'wiskey', label: 'קריאות בקרת כניסה', href: SECURITY_WISKEY_HREF },
  /** CR-LIVEEVENT100: the live event mode switch and every threshold of its page (system.configure). Always offered to an administrator
   * (it is where the module is switched on); `#/system/security/incidents`. */
  { id: 'incidents', label: 'מצב אירוע חי', href: '#/system/security/incidents' },
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
// CR-038 D33: the tickets module's display name is configurable - a rename (Settings, or a new session) redraws every row that names it
onTicketNames(() => {
  for (const l of tabsListeners) l();
});

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
  migrateTicketsTabs(out);
  migrateRequestsRow(out);
  return out;
}

/** SERVICEIA1-295: the page ids of the old one-row tickets area (before the four sections) and the section each moved to. */
const TICKETS_LEGACY_PAGE_SECTION: Record<string, TicketsSection> = {
  overview: 'reports', mine: 'requests', department: 'requests', board: 'requests', all: 'requests',
  handlers: 'vendors', rfqs: 'vendors', accounts: 'vendors', external: 'vendors',
};
/** SERVICEIA2-295: the three scope pages of the one-page-per-scope rows became the single page `list`. */
const TICKETS_SCOPE_PAGE_ALIAS: Record<string, string> = { mine: 'list', department: 'list', all: 'list' };
/** The section level-2 rows `ui.tabs` configures (a section with fewer than two pages has nothing to order). */
export const TICKETS_CONFIGURABLE_SECTIONS: readonly TicketsSection[] = ['requests', 'vendors'];

/** SERVICEIA1-295 (the `devices.schedules` precedent): a stored `tickets` entry written before the sections names the old page ids. On read
 * it becomes the new shape - each page's order / hidden goes to its section's row (`tickets.<section>`, only when that row has no entry of
 * its own), the level-1 order lists the sections in the order their first page appeared, and a section whose every page was hidden is
 * hidden at level 1 (so nothing an administrator hid reappears). The bar style stays on `tickets`. The server stores whatever is saved
 * next; an entry already in the new shape is left alone. */
function migrateTicketsTabs(out: TabsConfig): void {
  const old = out.tickets;
  if (!old) return;
  const legacy = (id: string) => id in TICKETS_LEGACY_PAGE_SECTION;
  if (![...old.order, ...old.hidden].some(legacy)) return;
  const sectionOrder: TicketsSection[] = [];
  const perSection: Partial<Record<TicketsSection, { order: string[]; hidden: string[] }>> = {};
  const bucket = (s: TicketsSection) => (perSection[s] ??= { order: [], hidden: [] });
  for (const id of old.order) {
    const s = TICKETS_LEGACY_PAGE_SECTION[id];
    if (!s) continue;
    if (!sectionOrder.includes(s)) sectionOrder.push(s);
    const page = TICKETS_SCOPE_PAGE_ALIAS[id] ?? id; // SERVICEIA2-295: mine / department / all are one page, `list`, at the place of the first of them
    if (!bucket(s).order.includes(page)) bucket(s).order.push(page);
  }
  for (const id of old.hidden) {
    const s = TICKETS_LEGACY_PAGE_SECTION[id];
    if (!s) continue;
    // SERVICEIA3-295: a hidden scope stays hidden - in the `tickets.scopes` row (below); the list page is hidden only when every scope tab was
    if (TICKETS_SCOPE_PAGE_ALIAS[id]) {
      if (Object.keys(TICKETS_SCOPE_PAGE_ALIAS).every((sc) => old.hidden.includes(sc)) && !bucket(s).hidden.includes('list')) bucket(s).hidden.push('list');
    } else bucket(s).hidden.push(id);
  }
  const scopes = scopesRowOf(old.order, old.hidden);
  if (scopes && !out['tickets.scopes']) out['tickets.scopes'] = scopes;
  const hiddenSections: TicketsSection[] = [];
  for (const s of TICKETS_SECTION_IDS) {
    const b = perSection[s];
    if (!b) continue;
    // every page of the section hidden ("external" counts only when the old row offered it, i.e. when it was named; release/2150: a page the
    // old row never had - the building report of סקירה ודוחות - does not keep a section the owner had emptied)
    const pages = TICKETS_PAGE_ROWS[s].map((p) => p.id).filter((id) => (id in TICKETS_LEGACY_PAGE_SECTION || id === 'list') && (id !== 'external' || [...old.order, ...old.hidden].includes('external')));
    if (pages.length && pages.every((id) => b.hidden.includes(id))) hiddenSections.push(s);
    const key = `tickets.${s}`;
    if (TICKETS_CONFIGURABLE_SECTIONS.includes(s) && !out[key] && (b.order.length || b.hidden.length)) out[key] = { order: b.order, hidden: b.hidden };
  }
  const order = [...sectionOrder, ...old.order.filter((id) => !legacy(id) && !sectionOrder.includes(id as TicketsSection))];
  const hidden = [...hiddenSections, ...old.hidden.filter((id) => !legacy(id))];
  if (order.length || hidden.length || old.style) out.tickets = old.style ? { order, hidden, style: old.style } : { order, hidden };
  else delete out.tickets;
}

/** SERVICEIA3-295: the `tickets.scopes` row (order and hidden of mine / department / all) carried by a list of page ids; undefined when it names
 * none of them. When EVERY scope is hidden nothing is stored as hidden (hiding is not a lock-out; the caller hides the list page instead). */
function scopesRowOf(order: readonly string[], hidden: readonly string[]): TabsSectionConfig | undefined {
  const scopeIds = Object.keys(TICKETS_SCOPE_PAGE_ALIAS);
  const o = order.filter((id) => scopeIds.includes(id));
  const h = scopeIds.every((sc) => hidden.includes(sc)) ? [] : hidden.filter((id) => scopeIds.includes(id));
  return o.length || h.length ? { order: o, hidden: h } : undefined;
}

/** SERVICEIA2-295: a `tickets.requests` row saved after slice 1 names the scope pages (mine / department / board / all); they are the one
 * page `list` now (at the place of the first of them; hidden only when all three were). SERVICEIA3-295: the individual scopes move to the
 * `tickets.scopes` row (order, and which are hidden), so none of the choices is lost. Idempotent. */
function migrateRequestsRow(out: TabsConfig): void {
  const row = out['tickets.requests'];
  if (!row || ![...row.order, ...row.hidden].some((id) => id in TICKETS_SCOPE_PAGE_ALIAS)) return;
  const order: string[] = [];
  for (const id of row.order) {
    const page = TICKETS_SCOPE_PAGE_ALIAS[id] ?? id;
    if (!order.includes(page)) order.push(page);
  }
  const scopes = Object.keys(TICKETS_SCOPE_PAGE_ALIAS);
  const hidden = row.hidden.filter((id) => !(id in TICKETS_SCOPE_PAGE_ALIAS));
  if (scopes.every((sc) => row.hidden.includes(sc))) hidden.push('list');
  const moved = scopesRowOf(row.order, row.hidden);
  if (moved && !out['tickets.scopes']) out['tickets.scopes'] = moved;
  out['tickets.requests'] = row.style ? { order, hidden, style: row.style } : { order, hidden };
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
  TICKETS_SECTION_ROW = normalizeTicketsSectionRow(settings?.['ui.tickets_section_row']); // SERVICEIA1-295: saved with the tabs editor
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
export const WALL_SETTINGS_HREF = '#/system/wall'; // CR-030: wall display users (system.configure; the add / remove step also needs rbac.assign)
/** CR-036 S10: הגדרות › בקרת כניסה - the access-control status, the intercom's own action log, groups and fields (access.admin.read at any scope; the
 * pages inside it follow what the caller may have - the action log and the conflicts are installation-wide). */
export const ACCESS_CONTROL_SETTINGS_HREF = '#/system/access-control';
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
  // WHOIN034-295 (board r034): "מי במבנה" - presence.view holders only (sensitive, system_admin by default; TAB_PERMISSIONS)
  { id: 'presence', get label() { return pt('tab'); }, href: '#/explore/presence' },
];
/** WHOIN034-295: the "who is in the building" screen. */
export const PRESENCE_HREF = '#/explore/presence';

/** ANNOUNCE-295 (stage A): the announce screen for the built-in `announcer` role and every other holder of media.announce. */
export const ANNOUNCE_HREF = '#/devices/announce';
/** The home area's tabs (`ui.tabs` (section `devices`) and the phone bottom bar follow). "מבט על" is the home screen as it always was (the
 * building tree, `#/devices/building`; an area screen is a drill-down of it, #/devices/areas/<id>, not a tab). "קברניט" (0.1.154, owner
 * 2026-10-02; the tab id stays `automations`, so route ids are untouched) holds the segments תזמונים · אוטומציות · סצנות · סקריפטים: the
 * schedules list (CR-014, `#/devices/schedules`) is its first segment, shown while the feature is on (`schedules.enabled`,
 * applySchedulesHidden) to holders of schedule.view / schedule.manage; the automations screen (CR-017, `#/devices/automations`) holds the
 * rest. The tab opens on the schedules segment when it is offered, else on the automations (`kavarnitSegments`, applied in
 * `permittedTabs`); the static href below is that default (the static demo has no gates). With only one tab visible the tab row does not
 * appear at all, so a user without those rights sees the home screen exactly as before. */
/** 2.29.0: the synoptic map (ראשי › מפה סינופטית) and the wall screen's separate address (a fixed control-room display, no shell). */
export const SYNOPTIC_HREF = '#/devices/synoptic';
export const SYNOPTIC_WALL_HREF = '#/kiosk/synoptic';
let SYNOPTIC_OFF = false;
/** The option `ui.xs` syn_tab (on by default): the tab leaves the home area while it is off. The address still opens the screen. Re-applied by the shell after HIDDEN_HREFS is rebuilt. */
export function applySynopticHidden(on: boolean | null | undefined): boolean {
  SYNOPTIC_OFF = on === false;
  const was = HIDDEN_HREFS.has(SYNOPTIC_HREF);
  if (SYNOPTIC_OFF) HIDDEN_HREFS.add(SYNOPTIC_HREF);
  else HIDDEN_HREFS.delete(SYNOPTIC_HREF);
  if (was !== SYNOPTIC_OFF) for (const l of tabsListeners) l();
  return SYNOPTIC_OFF;
}
export const synopticTabOff = (): boolean => SYNOPTIC_OFF;

/** CALENDARS-UI-2310: the calendars module ("יומנים"). Its screens answer at two addresses - #/calendars/<view> (the side rail entry) and
 * #/devices/calendars/<view> (the tab of the home area) - so a viewer who reaches it from either keeps the navigation he came from. Where it
 * is offered is the installation's setting `menu_position` (rail, the default / home_tab / both; owner 2026-10-30 night); a viewer without the
 * home area (a tenant with calendars only, owner answer 25) always gets the rail entry. Off until GET /calendar/module says otherwise
 * (calendars/access.ts), the static demo too. */
export const CALENDARS_HREF = '#/calendars/cal';
export const CALENDARS_HOME_HREF = '#/devices/calendars/cal';
export const CALENDARS_SETTINGS_HREF = '#/system/calendars';
export const CALENDAR_SYNC_SETTINGS_HREF = '#/system/calendar-sync';
let CALENDARS_ON = false;
let CALENDARS_PLACEMENT: 'rail' | 'home_tab' | 'both' = 'rail';
/** Called by calendars/access.ts with the module state; re-applied by the shell after HIDDEN_HREFS is rebuilt. */
export function applyCalendarsNav(on: boolean, placement: 'rail' | 'home_tab' | 'both' = CALENDARS_PLACEMENT): void {
  const tabOn = on && placement !== 'rail';
  const changed = on !== CALENDARS_ON || placement !== CALENDARS_PLACEMENT || HIDDEN_HREFS.has(CALENDARS_HOME_HREF) === tabOn;
  CALENDARS_ON = on;
  CALENDARS_PLACEMENT = placement;
  if (tabOn) HIDDEN_HREFS.delete(CALENDARS_HOME_HREF);
  else HIDDEN_HREFS.add(CALENDARS_HOME_HREF);
  if (changed) for (const l of tabsListeners) l();
}
export const calendarsModuleOn = (): boolean => CALENDARS_ON;
export const calendarsPlacement = (): 'rail' | 'home_tab' | 'both' => CALENDARS_PLACEMENT;
/** The base address the calendars screens build their links on: the one the viewer is on. */
export const calendarsBase = (r: RouteState | null): string => (r?.mode === 'devices' ? '#/devices/calendars' : '#/calendars');
export const CALENDARS_AREA: AreaEntry = { id: 'calendars', icon: 'calendar', label: 'יומנים', href: CALENDARS_HREF };

export const DEVICES_TABS: TabItem[] = [
  { id: 'building', label: 'מבט על', href: '#/devices/building' },
  // 2.29.0 (owner decision 6, 2026-10-29): the synoptic map is the tab BETWEEN מבט על and קברניט; the installation may switch it off (ui.xs syn_tab)
  { id: 'synoptic', get label() { return xsText('synTab'); }, href: SYNOPTIC_HREF },
  // CALENDARS-UI-2310: "יומנים" between מבט על and קברניט while the installation puts it in the home menu (hidden by default: HIDDEN_HREFS)
  { id: 'calendars', label: 'יומנים', href: CALENDARS_HOME_HREF },
  { id: 'automations', label: 'קברניט', href: SCHEDULES_HREF },
  // CR-NOTICE106 put לוח הודעות here; NOTICEADD-295 (owner decision 2026-10-24) moved it to the rail (NOTICES_AREA)
  // ANNOUNCE-295: הכרזות - offered to holders of media.announce (TAB_PERMISSIONS); the screen itself says when the feature is off
  { id: 'announce', get label() { return announceText().title; }, href: ANNOUNCE_HREF },
];

/** CR-NOTICE106: the notice board page (readers and managers) and its settings page (the switch, the defaults, the TV boards). */
export const NOTICES_HREF = '#/devices/notices';
export const NOTICES_SETTINGS_HREF = '#/system/notices';
export const TRANSIT_SETTINGS_HREF = '#/system/transit'; // BUSTIMES-295: the installation's bus stops and rules (system.configure; board managers read)
let NOTICES_OFF = true;
/** The module switch (/me modules.notices, and at once after a switch in Settings): the tab joins HIDDEN_HREFS while the module is off -
 * hidden by default, so nobody sees it flash. Re-applied by the shell after HIDDEN_HREFS is rebuilt from the product settings. */
export function applyNoticesHidden(on: boolean | null | undefined): boolean {
  NOTICES_OFF = on !== true;
  const was = HIDDEN_HREFS.has(NOTICES_HREF);
  if (NOTICES_OFF) HIDDEN_HREFS.add(NOTICES_HREF);
  else HIDDEN_HREFS.delete(NOTICES_HREF);
  if (was !== NOTICES_OFF) for (const l of tabsListeners) l();
  return NOTICES_OFF;
}
export function noticesModuleOn(): boolean {
  return !NOTICES_OFF;
}

let ANNOUNCE_OFF = true;
/** FIX2200 (owner 2026-10-25): the הכרזות tab follows the voice announcements switch (/me modules.announce, and at once after a switch in
 * Settings), as the notice board tab follows its module: hidden while the feature is off (OFF by default, the static demo too). Only the
 * tab leaves - the address #/devices/announce still opens the screen, which says when the feature is off. Re-applied by the shell after
 * HIDDEN_HREFS is rebuilt from the product settings. */
export function applyAnnounceHidden(on: boolean | null | undefined): boolean {
  ANNOUNCE_OFF = on !== true;
  const was = HIDDEN_HREFS.has(ANNOUNCE_HREF);
  if (ANNOUNCE_OFF) HIDDEN_HREFS.add(ANNOUNCE_HREF);
  else HIDDEN_HREFS.delete(ANNOUNCE_HREF);
  if (was !== ANNOUNCE_OFF) for (const l of tabsListeners) l();
  return ANNOUNCE_OFF;
}

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
export const INFRA_GENERATOR_HREF = '#/infra/generator/live';
/** CR-INFRA-ELEVATORS: the elevators' live list (devices.read; offered only once an elevator is defined). */
export const INFRA_ELEVATORS_HREF = '#/infra/elevators';
/** CR-INFRA-TEMPERATURE 2.9.1: the temperature units (devices.read; offered once a unit is defined, or to a manager for setup). */
export const INFRA_TEMPERATURE_HREF = '#/infra/temperature';
/** CR-WATER78: the water meters (water.view; offered only while the module is on and the viewer may see water meters - water/access.ts). */
export const INFRA_WATER_HREF = '#/infra/water/meters';
export const INFRA_TABS: TabItem[] = [
  { id: 'electricity', label: 'מוני חשמל', href: INFRA_METERS_HREF },
  // CR-WATER78 section 3: directly after the electricity meters; hidden while the module is off (default) or the viewer lacks water.view
  { id: 'water', label: 'מים', href: INFRA_WATER_HREF },
  // CR-031: a sibling of the meters, offered only when a generator is detected (or to a manager, for setup)
  { id: 'generator', label: 'גנרטור', href: INFRA_GENERATOR_HREF },
  // CR-INFRA-ELEVATORS: hidden until at least one elevator is defined that the viewer may see (elevators/access.ts)
  { id: 'elevators', label: 'מעליות', href: INFRA_ELEVATORS_HREF },
  // CR-INFRA-TEMPERATURE 2.9.1: hidden until a unit is defined that the viewer may see (or he may manage them; temperature/access.ts)
  { id: 'temperature', label: 'טמפרטורות', href: INFRA_TEMPERATURE_HREF },
];

/** TABSET-293: the page rows inside two infrastructure screens (level 2 of the tab registry): the electricity meters' pages (the
 * money pages - bills, customers - need energy.bills; the screen also checks it) and the generator's pages. The screens draw these rows
 * (screens/infra-electricity.ts, screens/infra-generator.ts) through `infraPageTabs`, so `ui.tabs` (`infra.electricity`,
 * `infra.generator`) orders and hides them like every other row. */
export const INFRA_ELECTRICITY_PAGES: TabItem[] = [
  { id: 'meters', label: 'מונים', href: INFRA_METERS_HREF },
  { id: 'accounts', label: 'חשבונות', href: '#/infra/electricity/accounts' },
  { id: 'bills', label: 'חיובים', href: '#/infra/electricity/bills' },
  { id: 'customers', label: 'לקוחות', href: '#/infra/electricity/customers' },
];
/** The electricity pages that show money (energy.bills). */
export const INFRA_MONEY_PAGES: readonly string[] = ['bills', 'customers'];
// GENLOG092-295 (owner Q319): the run log is a registry page too, so the tab editor orders / hides it; the screen still shows it only while its switch is on
export const INFRA_GENERATOR_PAGES: TabItem[] = (['live', 'alerts', 'charts', 'history', 'log'] as const).map((id) => ({ id, get label() { return he.generator.pages[id]; }, href: `#/infra/generator/${id}` }));
/** CR-WATER78 sections 3 and 16: the water pages (level 2, `infra.water`). The money pages (חיובים, לקוחות) need water.bills, the settings
 * page water.manage or system.configure; the screen (screens/infra-water.ts) checks them again from the module's status. */
export const INFRA_WATER_PAGES: TabItem[] = [
  { id: 'meters', label: 'מונים', href: INFRA_WATER_HREF },
  { id: 'usage', label: 'צריכה', href: '#/infra/water/usage' },
  { id: 'alerts', label: 'התראות', href: '#/infra/water/alerts' },
  { id: 'accounts', label: 'חשבונות', href: '#/infra/water/accounts' },
  { id: 'bills', label: 'חיובים', href: '#/infra/water/bills' },
  { id: 'customers', label: 'לקוחות', href: '#/infra/water/customers' },
  { id: 'settings', label: 'הגדרות', href: '#/infra/water/settings' },
];
/** The water pages that show money (water.bills) and the managers' page. */
export const INFRA_WATER_MONEY_PAGES: readonly string[] = ['bills', 'customers'];
export const INFRA_WATER_MANAGE_PAGES: readonly string[] = ['settings'];

/** A screen's page row (`infra.electricity` / `infra.generator` / `infra.water`) shaped by `ui.tabs`: the configured order, the hidden pages left out
 * (never all of them), with a backend only - the static demo shows the defaults, like every other row. The caller passes only the pages
 * this user may open; the items keep their own shape (a count, a device query). */
export function infraPageTabs<T extends { id: string }>(section: 'infra.electricity' | 'infra.generator' | 'infra.water', items: T[], api: boolean): T[] {
  return api ? configureTabs(section, items) : items;
}

/** The page an infrastructure tab opens on: the first page of its configured row this user may open; while the row is not configured,
 * the built-in entry (null). Used for the area's tab row (`permittedTabs`) and the bare #/infra/electricity route. */
export function infraEntryHref(tabId: string, can?: Can): string | null {
  if (tabId === 'electricity' && isSectionConfigured('infra.electricity')) {
    const pages = INFRA_ELECTRICITY_PAGES.filter((p) => !INFRA_MONEY_PAGES.includes(p.id) || !can || can('energy.bills'));
    return configureTabs('infra.electricity', pages)[0]?.href ?? null;
  }
  if (tabId === 'generator' && isSectionConfigured('infra.generator')) return configureTabs('infra.generator', INFRA_GENERATOR_PAGES.filter((p) => p.id !== 'log' || GENERATOR_LOG_ON))[0]?.href ?? null;
  if (tabId === 'water' && isSectionConfigured('infra.water')) {
    const pages = INFRA_WATER_PAGES.filter((p) => (!INFRA_WATER_MONEY_PAGES.includes(p.id) || !can || can('water.bills')) && (!INFRA_WATER_MANAGE_PAGES.includes(p.id) || !can || can('water.manage') || can('system.configure')));
    return configureTabs('infra.water', pages)[0]?.href ?? null;
  }
  return null;
}

/** GENLOG092-295: whether the generator's run-log page is switched on (the devices list says so; default off). While off, the generator tab never
 * opens on it, wherever the tab editor placed it. */
let GENERATOR_LOG_ON = false;
export function applyGeneratorLog(on: boolean): void {
  GENERATOR_LOG_ON = on;
}

/** CR-031: the generator tab is hidden until a generator is detected (generator/access.ts); hidden = true until told otherwise. */
let INFRA_NO_GENERATOR = true;
export function applyInfraGenerator(show: boolean): void {
  const hide = !show;
  if (hide === INFRA_NO_GENERATOR) return;
  INFRA_NO_GENERATOR = hide;
  for (const l of tabsListeners) l();
}

/** CR-INFRA-ELEVATORS: the elevators tab is hidden until the server lists at least one elevator for the viewer; hidden = true until told otherwise. */
let INFRA_NO_ELEVATORS = true;
export function applyInfraElevators(show: boolean): void {
  const hide = !show;
  if (hide === INFRA_NO_ELEVATORS) return;
  INFRA_NO_ELEVATORS = hide;
  for (const l of tabsListeners) l();
}

/** CR-INFRA-TEMPERATURE 2.9.1: the temperatures tab is hidden until the viewer sees a unit or may manage them; hidden = true until told otherwise. */
let INFRA_NO_TEMPERATURE = true;
export function applyInfraTemperature(show: boolean): void {
  const hide = !show;
  if (hide === INFRA_NO_TEMPERATURE) return;
  INFRA_NO_TEMPERATURE = hide;
  for (const l of tabsListeners) l();
}

/** CR-INSIGHT215: the "סקירה ודוחות" tab (the building report and its door / waste drill-downs) is hidden until the server's status says at least
 * one part is on for this viewer (insights/access.ts). */
let REPORTS_HIDDEN = true;
export function applyInfraInsights(show: { report: boolean; doors: boolean; waste: boolean }): void {
  const hide = !(show.report || show.doors || show.waste);
  if (hide === REPORTS_HIDDEN) return;
  REPORTS_HIDDEN = hide;
  for (const l of tabsListeners) l();
}
const insightHiddenHref = (href: string | undefined): boolean => href === TICKETS_REPORTS_HREF && REPORTS_HIDDEN;
/** CR-WATER78 section 3: the water tab is offered only while the module is on AND the viewer may see water meters (GET /infra/water/status,
 * water/access.ts); hidden = true until told otherwise (the module is off by default). A stale deep link still opens the screen, which
 * shows the "module off" panel. */
let INFRA_NO_WATER = true;
export function applyInfraWater(show: boolean): void {
  const hide = !show;
  if (hide === INFRA_NO_WATER) return;
  INFRA_NO_WATER = hide;
  for (const l of tabsListeners) l();
}

/** CR-023: the area is offered to holders of energy.view only when the installation has meters or the user may manage them (an installation
 * without meters shows nothing). Filled by electricity/visibility.ts; true = no meters and no manage permission. */
let INFRA_NO_METERS = false;
export function applyInfraMeters(hasMetersOrManage: boolean): void {
  const hide = !hasMetersOrManage;
  if (hide === INFRA_NO_METERS) return;
  INFRA_NO_METERS = hide;
  for (const l of tabsListeners) l();
}

/** CR-038: the optional tickets area (#/tickets/*): its scope tabs, the full-screen detail (#/tickets/<id>) and its settings tab. Every
 * label that names the module is read through tickets/text.ts at render time (D33: the name is configurable - getters, never a copy). */
export const TICKETS_MINE_HREF = '#/tickets/mine';
export const TICKETS_DEPARTMENT_HREF = '#/tickets/department';
export const TICKETS_ALL_HREF = '#/tickets/all';
export const TICKETS_BOARD_HREF = '#/tickets/board'; // CR-038 slice 6
export const TICKETS_SETTINGS_HREF = '#/system/tickets';
export const TICKETS_HANDLERS_HREF = '#/tickets/handlers'; // owner request 2026-10-14: "מטפלים וספקים" (out of Settings)
export const TICKETS_ACCOUNTS_HREF = '#/tickets/accounts'; // TK258: the vendors account
export const TICKETS_RFQS_HREF = '#/tickets/rfqs'; // TKRFQ2 (2.6.1): requests for quotation (the manager UI)
export const TICKETS_MAINTENANCE_HREF = '#/tickets/maintenance'; // CR-MAINT215 slice 2: the maintenance section
export const TICKETS_OVERVIEW_HREF = '#/tickets/overview'; // MGRDASH (owner 2026-10-17): the manager overview, the area's first tab (managers only)
/** CR-INSIGHT215: the building report (#/tickets/reports/building) and its drill-downs (doors, waste) - a page of the section
 * "סקירה ודוחות" (SERVICEIA1-295, integrated at release/2150). */
export const TICKETS_REPORTS_HREF = '#/tickets/reports/building';
/** CR-MAINT215 x SERVICEIA1-295 (release/2150): the maintenance section's one page in the shell's rows. Its href names a page of the
 * screen (the ledger) so the section entry address `#/tickets/maintenance` stays redirect-only (legacyRedirect lands it here, query kept);
 * the screen draws its own page row (ledger, plans, rounds, log, tags). */
export const TICKETS_MAINTENANCE_PAGE_HREF = '#/tickets/maintenance/ledger';
const isMaintenanceHref = (href: string | undefined): boolean => href === TICKETS_MAINTENANCE_HREF || (href ?? '').startsWith(`${TICKETS_MAINTENANCE_HREF}/`);
// ---------------------------------------------------------------------------------------------
// SERVICEIA1-295 (owner decisions 24.10, docs/changes/SERVICE-IA-PROPOSAL.md, slice 1 = navigation only): the service-management area is
// organised in four job-based SECTIONS - בקשות · תחזוקה ובקרה · ספקים וכספים · סקירה ודוחות - the area's level-1 row (`ui.tabs` section
// `tickets`), each with its PAGES as the level-2 row (`tickets.<section>`), exactly the infrastructure electricity / generator pattern.
// No screen is merged, no page removed, no href renamed: every page keeps its href, its TAB_PERMISSIONS entry and its screen; the three
// scopes (שלי · המחלקה · הכול) stay pages of בקשות (merging them into the list's own scope segment is a later slice, after the parity check
// of its permission filter). A section is offered while at least one of its pages is, and opens on its first visible page. The section
// entry hrefs below are redirect-only addresses (legacyRedirect).
// ---------------------------------------------------------------------------------------------
export type TicketsSection = 'requests' | 'maintenance' | 'vendors' | 'reports';
export const TICKETS_SECTION_IDS: readonly TicketsSection[] = ['requests', 'maintenance', 'vendors', 'reports'];
/** The section entry addresses (new, redirect only: they land on the section's first visible page). */
export const TICKETS_SECTION_HREFS: Record<TicketsSection, string> = {
  requests: '#/tickets/requests',
  maintenance: '#/tickets/maintenance',
  vendors: '#/tickets/vendors',
  reports: '#/tickets/reports',
};
/** בקשות: the request list (page `list`: the scopes שלי · המחלקה · הכול are the list's own filter, SERVICEIA2-295) and the manager board (the
 * board stays a PAGE, owner 24.10). The static href is the built-in first scope; `visibleTabs` rewrites it to the first scope this user may open. */
export const TICKETS_REQUESTS_PAGES: TabItem[] = [
  { id: 'list', get label() { return tt('pageList'); }, href: TICKETS_MINE_HREF },
  { id: 'board', get label() { return bt('tabBoard'); }, href: TICKETS_BOARD_HREF }, // CR-038 slice 6: the manager board (spec 14.2: managers only)
];
/** SERVICEIA2-295: the scopes of the request list in their order, each with the permission entry that used to gate its level-1 tab
 * (TAB_PERMISSIONS keeps those entries): the list's scope segment offers exactly these. */
export const TICKETS_SCOPE_HREFS: Record<'mine' | 'department' | 'all', string> = { mine: TICKETS_MINE_HREF, department: TICKETS_DEPARTMENT_HREF, all: TICKETS_ALL_HREF };
/** SERVICEIA3-295: the scope segment of the request list as a configurable row (`ui.tabs` section `tickets.scopes`, level 2): the administrator
 * hides each scope separately and orders them, as he could when they were three tabs. Presentation only - `tabAllowed` still gates first. */
export const TICKETS_SCOPE_TABS: TabItem[] = [
  { id: 'mine', get label() { return tt('tabMine'); }, href: TICKETS_MINE_HREF },
  { id: 'department', get label() { return tt('tabDepartment'); }, href: TICKETS_DEPARTMENT_HREF },
  { id: 'all', get label() { return tt('tabAll'); }, href: TICKETS_ALL_HREF },
];
/** The scopes of the list this user is offered: those he may open (parity with the three tabs of the old row), minus the ones `ui.tabs`
 * hides, in the configured order (no backend = all, the demo). Never empty while one is permitted (configureTabs: hiding is not a lock-out). */
export function ticketsScopesAllowed(api: boolean, can?: Can): Array<'mine' | 'department' | 'all'> {
  const all = TICKETS_SCOPE_TABS.map((t) => t.id as 'mine' | 'department' | 'all');
  if (!api) return all;
  const permitted = TICKETS_SCOPE_TABS.filter((t) => tabAllowed(t.href ?? '', can));
  return configureTabs('tickets.scopes', permitted).map((t) => t.id as 'mine' | 'department' | 'all');
}
/** תחזוקה ובקרה (CR-MAINT215 slice 2): one page in the shell's rows - the screen draws its own page row (ledger, plans, rounds, log, tags).
 * Offered only with a backend, while the maintenance module is on (applyMaintenanceOn), to holders of maintenance.view; a section with one
 * page draws no level-2 row. */
export const TICKETS_MAINTENANCE_PAGES: TabItem[] = [
  { id: 'maintenance', get label() { return mt('section'); }, href: TICKETS_MAINTENANCE_PAGE_HREF },
];
/** ספקים וכספים: handlers and vendors, requests for quotation, the vendors account, external access (when placed here). */
export const TICKETS_VENDORS_PAGES: TabItem[] = [
  { id: 'handlers', get label() { return tt('hdTitle'); }, href: TICKETS_HANDLERS_HREF }, // handlers, employees, vendors, contacts
  { id: 'rfqs', get label() { return rt('navTitle'); }, href: TICKETS_RFQS_HREF }, // TKRFQ2: requests for quotation
  { id: 'accounts', get label() { return ct('vaTitle'); }, href: TICKETS_ACCOUNTS_HREF }, // TK258: "חשבון ספקים" (tickets.costs.view)
  // SHAREDID-293: "גישת חוץ" when the owner placed it under service management (access.external.placement tickets | both)
  { id: 'external', get label() { return xt('tab'); }, href: '#/tickets/external' },
];
/** סקירה ודוחות: the manager overview, then INSIGHT215's building report (with its door / energy drill-downs under the same page). */
export const TICKETS_REPORTS_PAGES: TabItem[] = [
  { id: 'overview', get label() { return ot('tab'); }, href: TICKETS_OVERVIEW_HREF }, // MGRDASH: managers only (TAB_PERMISSIONS + the board's server gate)
  { id: 'reports', get label() { return ix('pageBuilding'); }, href: TICKETS_REPORTS_HREF }, // CR-INSIGHT215: hidden until a part is on (applyInfraInsights)
];
export const TICKETS_PAGE_ROWS: Record<TicketsSection, TabItem[]> = {
  requests: TICKETS_REQUESTS_PAGES,
  maintenance: TICKETS_MAINTENANCE_PAGES,
  vendors: TICKETS_VENDORS_PAGES,
  reports: TICKETS_REPORTS_PAGES,
};
/** The area's level-1 row: the four sections (labels are getters - D33 and the document language; `short` is the phone label). The
 * static href is the section's built-in first page; `visibleTabs` rewrites it to the first page this user may open. */
export const TICKETS_TABS: TabItem[] = [
  { id: 'requests', get label() { return sectionLabel('requests'); }, get short() { return sectionLabel('requests', true); }, href: TICKETS_MINE_HREF },
  { id: 'maintenance', get label() { return sectionLabel('maintenance'); }, get short() { return sectionLabel('maintenance', true); }, href: TICKETS_SECTION_HREFS.maintenance },
  { id: 'vendors', get label() { return sectionLabel('vendors'); }, get short() { return sectionLabel('vendors', true); }, href: TICKETS_HANDLERS_HREF },
  { id: 'reports', get label() { return sectionLabel('reports'); }, get short() { return sectionLabel('reports', true); }, href: TICKETS_OVERVIEW_HREF },
];
/** Every page of the area, in the sections' order (the old flat list, regrouped): the parity reference of the specs. */
export function ticketsAllPages(): TabItem[] {
  return TICKETS_SECTION_IDS.flatMap((s) => TICKETS_PAGE_ROWS[s]);
}
/** The section a page id belongs to (null for an unknown id). */
export function ticketsSectionOfPage(pageId: string): TicketsSection | null {
  return TICKETS_SECTION_IDS.find((s) => TICKETS_PAGE_ROWS[s].some((p) => p.id === pageId)) ?? null;
}
const isTicketsAreaHref = (href: string) => href === '#/tickets' || href.startsWith('#/tickets/');

/** SERVICEIA1-295 (owner 24.10, item 11): whether the section row is drawn for a user who sees ONE section only - an installation setting
 * (`ui.tickets_section_row`: `hide_single`, the default, or `always`), edited in הגדרות › כללי › לשוניות. Read with the product settings. */
export type TicketsSectionRow = 'hide_single' | 'always';
let TICKETS_SECTION_ROW: TicketsSectionRow = 'hide_single';
export function ticketsSectionRow(): TicketsSectionRow {
  return TICKETS_SECTION_ROW;
}
export function normalizeTicketsSectionRow(v: unknown): TicketsSectionRow {
  return v === 'always' ? 'always' : 'hide_single';
}
/** Whether the level-1 row of the area is drawn for this many visible sections (two or more always; one only with `always`). */
export function ticketsSectionRowShown(visibleSections: number): boolean {
  return visibleSections > 1 || (visibleSections === 1 && TICKETS_SECTION_ROW === 'always');
}

/** RFQQUESTIONS: vendor questions waiting in the requests the user manages (tickets/rfq-questions-store.ts reports here). The "בקשות הצעת
 * מחיר" page entry carries the number as a badge (and a dropdown chip a dot); SERVICEIA1-295 (owner 24.10, item 57): the "ספקים וכספים"
 * section entry carries a dot; the tickets area icon a small count (unchanged). Navigation only. */
let RFQ_QUESTIONS = 0;
export function applyRfqQuestions(n: number): void {
  const next = Math.max(0, Math.floor(Number(n)) || 0);
  if (next === RFQ_QUESTIONS) return;
  RFQ_QUESTIONS = next;
  const t = TICKETS_VENDORS_PAGES.find((x) => x.id === 'rfqs');
  if (t) {
    t.badge = next || undefined;
    t.alert = next ? true : undefined;
  }
  const sec = TICKETS_TABS.find((x) => x.id === 'vendors');
  if (sec) {
    sec.dot = next ? true : undefined;
    sec.alert = next ? true : undefined;
  }
  for (const l of tabsListeners) l();
}
/** The count a rail / bottom-bar area shows (0 = none): the tickets area while the module is on. */
export function areaBadge(id: string): number {
  return id === 'tickets' && !TICKETS_OFF ? RFQ_QUESTIONS : 0;
}

/** CR-038 section 6: the module switch. The area (never its settings tab) is hidden until the session says the module is on (`/me` modules.tickets,
 * then `tickets.enabled` of the product settings, and at once after a switch in Settings) - hidden by default, so an operator never sees it flash. */
let TICKETS_OFF = true;
export function applyTicketsHidden(settings: Record<string, unknown> | null | undefined): boolean {
  const hidden = String(settings?.['tickets.enabled'] ?? 'false') !== 'true';
  if (hidden !== TICKETS_OFF) {
    TICKETS_OFF = hidden;
    for (const l of tabsListeners) l();
  }
  return hidden;
}
export function ticketsModuleOn(): boolean {
  return !TICKETS_OFF;
}

/** CR-MAINT215 slice 2: the maintenance module's switch as the session learned it (GET /maintenance/module; maintenance/access.ts). Off
 * until told otherwise. While on, the service-management area is offered even with the tickets module off - with this section only. */
let MAINTENANCE_ON = false;
export function applyMaintenanceOn(on: boolean): void {
  if (on === MAINTENANCE_ON) return;
  MAINTENANCE_ON = on;
  for (const l of tabsListeners) l();
}
export function maintenanceModuleOn(): boolean {
  return MAINTENANCE_ON;
}
/** CR-LIVEEVENT100: the live event mode (default OFF). The tab of the investigation section, its settings page under הגדרות › אבטחה,
 * and the open-incident state the shell draws (the "אירוע פעיל" pill beside the corner, the red dots on the security icon and the tab).
 * Filled by incidents/store.ts from `/me` modules.incidents and GET /incidents/summary. Navigation only: every route checks itself. */
export const INCIDENTS_HREF = '#/investigate/incidents';
export const INCIDENTS_SETTINGS_HREF = '#/system/security/incidents';
export const INCIDENTS_TAB: TabItem = { id: 'incidents', get label() { return incText('tab'); }, href: INCIDENTS_HREF };
let INCIDENTS_OFF = true;
let INCIDENTS_OPEN = 0;
let INCIDENTS_DOT: 'active' | 'off' = 'active';
/** The page (never its settings tab: that is where the module is switched on). */
const isIncidentsHref = (href: string) => href === INCIDENTS_HREF || href.startsWith(`${INCIDENTS_HREF}/`);
export function applyIncidents(on: boolean, open = 0, dot: 'active' | 'off' = 'active'): void {
  const off = !on;
  const n = off ? 0 : Math.max(0, Math.floor(Number(open)) || 0);
  if (off === INCIDENTS_OFF && n === INCIDENTS_OPEN && dot === INCIDENTS_DOT) return;
  INCIDENTS_OFF = off;
  INCIDENTS_OPEN = n;
  INCIDENTS_DOT = dot;
  INCIDENTS_TAB.alert = !off && n > 0 && dot !== 'off' ? true : undefined;
  INCIDENTS_TAB.dot = INCIDENTS_TAB.alert;
  for (const l of tabsListeners) l();
}
export function incidentsModuleOn(): boolean {
  return !INCIDENTS_OFF;
}
/** How many incidents the viewer may read are open (0 while the module is off). */
export function incidentsOpen(): number {
  return INCIDENTS_OFF ? 0 : INCIDENTS_OPEN;
}
/** The red dot of an area icon (the rail and the bottom bar): the security area while an incident is open and the dots are on. */
export function areaDot(id: string): boolean {
  return id === 'security' && !INCIDENTS_OFF && INCIDENTS_OPEN > 0 && INCIDENTS_DOT !== 'off';
}

// NOTICEADD-295: 'notices' is the rail entry of the notice board (NOTICES_AREA) - not a movable tab (NavTabId) and without a tab row
export type AreaId = 'security' | 'explore' | 'system' | 'wiskey' | 'devices' | 'multimedia' | 'infra' | 'tickets' | 'notices' | 'calendars';
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
  // CR-038: the optional tickets area, last (a new tab never moves a stored order); offered while the module is on to holders of tickets.view /
  // tickets.create. Its label is the module's configured plural (D33).
  { id: 'tickets', icon: 'ticket', get label() { return tt('area'); }, href: TICKETS_MINE_HREF },
];

/** The ids of the movable tabs, in the default order (the server keeps the same list: services/user_prefs.py). */
export type NavTabId = 'devices' | 'security' | 'explore' | 'multimedia' | 'wiskey' | 'infra' | 'tickets';
export const NAV_TAB_IDS: NavTabId[] = NAV_A.map((n) => n.id as NavTabId);

/** NOTICEADD-295 (owner decision 2026-10-24): while the notice board module is on, "לוח הודעות" is an entry of the rail and the bottom bar,
 * directly under "מולטימדיה" (or, without it, where מולטימדיה would stand in the user's order); hidden entirely while the module is off.
 * Its page stays #/devices/notices (route ids unchanged); `areaOf` names that route 'notices' so the entry lights. It is not one of the
 * movable tabs (NAV_TAB_IDS, the server's nav.order list): it follows מולטימדיה wherever the user put that. */
export const NOTICES_AREA: AreaEntry = { id: 'notices', icon: 'pin', label: 'לוח הודעות', href: '#/devices/notices' };

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
    /** CR-LIVEEVENT100: "אירוע חי" - one page per incident in progress; offered only while the module is on (applyIncidents), with a red
     * dot while an incident the viewer may read is open (the setting incident.red_dot can switch the dots off). */
    INCIDENTS_TAB,
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
  tickets: TICKETS_TABS,
  notices: [], // NOTICEADD-295: one page, no tab row
  calendars: [], // CALENDARS-UI-2310: the screen draws its own view tabs (the approved mock-up)
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
    // CR-READY96 slice 1: the installation readiness score and checklist (system.configure, installation scope: whoever configures the system only)
    { id: 'readiness', label: 'מוכנות', href: '#/system/readiness' },
    { id: 'setup', label: 'חיבורים', href: '#/system/setup' },
    // CR-036 S10: the access-control status, the intercom's action log, groups and fields (access.admin.read at any scope)
    { id: 'access-control', label: 'בקרת כניסה', href: ACCESS_CONTROL_SETTINGS_HREF },
    { id: 'entities', label: 'קטלוג התקנים', href: ENTITIES_SETTINGS_HREF },
    { id: 'schedules', label: 'תזמונים', href: SCHEDULES_SETTINGS_HREF },
    { id: 'wall', label: 'מסכי קיר', href: WALL_SETTINGS_HREF },
    // CR-NOTICE106: the notice board's switch, defaults and TV boards (system.configure / notices.boards)
    { id: 'notices', label: 'לוח הודעות', href: NOTICES_SETTINGS_HREF },
    // BUSTIMES-295: nearby public-transport times on the notice boards - the module switch, up to four stops and the general rules
    { id: 'transit', get label() { return trTab0('tab'); }, href: TRANSIT_SETTINGS_HREF },
    // CR-017: every option of the automations, scenes and scripts (system.configure, installation scope)
    { id: 'automations', label: 'אוטומציות', href: AUTOMATIONS_SETTINGS_HREF },
    // CR-015: the screens' approval, connections and the remote's defaults (system.configure, installation scope)
    { id: 'multimedia', label: 'מולטימדיה', href: MULTIMEDIA_SETTINGS_HREF },
    // CR-023: prices and VAT, business details, data retention of the electricity module (energy.manage, or system.configure for the retention)
    { id: 'infra', label: 'תשתיות', href: INFRA_SETTINGS_HREF },
    // CALENDARS-UI-2310: the calendars module's settings (calendar.configure) and its external connections (calendar.connect)
    { id: 'calendars', label: 'יומנים', href: CALENDARS_SETTINGS_HREF },
    { id: 'calendar-sync', label: 'חיבורי יומן', href: CALENDAR_SYNC_SETTINGS_HREF },
    // CR-038: the tickets module's settings (the switch and the display: system.configure; the name, departments and grants: tickets.configure)
    { id: 'tickets', get label() { return tt('settingsTab'); }, href: TICKETS_SETTINGS_HREF },
    // CR-038 S5a: which linked WhatsApp account sends for which use (installation-level; read system.configure, edit messaging.accounts.manage)
    { id: 'messaging-accounts', label: 'ערוץ ההודעות', href: '#/system/messaging-accounts' },
    // CR-FLEET215: the daily health report to SmplWise - the switch, what is sent, the last reports (system.configure + system administrator)
    { id: 'fleet-report', label: 'דיווח בריאות', href: '#/system/fleet-report' },
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
  if (r.mode === 'devices' && r.segments[1] === 'notices') return 'notices'; // NOTICEADD-295: the rail's notice board entry
  if (r.mode === 'calendars') return 'calendars'; // CALENDARS-UI-2310: the rail entry (the home tab's address stays in the home area)
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
      return s[1] === 'buildings' || s[1] === 'floors' ? 'floors' : s[1] === 'presence' ? 'presence' : 'sites';
    case 'system':
      return !s[1] || s[1] === 'diagnostics' ? 'general' : s[1];
    case 'wiskey':
      return wiskeyActiveTab(r);
    case 'devices':
      return s[1] === 'schedules' || s[1] === 'automations' ? 'automations' : s[1] === 'synoptic' ? 'synoptic' : s[1] === 'calendars' ? 'calendars' : 'building'; // 0.1.154: the schedules are a segment of קברניט
    case 'infra':
      return s[1] === 'generator' ? 'generator' : s[1] === 'elevators' ? 'elevators' : s[1] === 'temperature' ? 'temperature' : s[1] === 'water' ? 'water' : 'electricity';
    case 'tickets':
      // SERVICEIA1-295: the level-1 row is the SECTION (ticketsPageOf names the page); the full-screen detail (#/tickets/<id>) belongs to
      // the requests section with no page active
      return ticketsSectionOf(r);
    case 'multimedia':
      return s[1] === 'players' ? 'players' : s[1] === 'groups' ? 'groups' : 'screens';
    default:
      return '';
  }
}

/** SERVICEIA1-295: the section of a tickets route - a page's own section, a section entry address its section, anything else (the bare
 * area, the full-screen detail, an unknown segment the router sends on) the requests section. '' outside the area. */
export function ticketsSectionOf(r: RouteState | null): TicketsSection | '' {
  if (r?.mode !== 'tickets') return '';
  const seg = r.segments[1] ?? '';
  if ((TICKETS_SECTION_IDS as readonly string[]).includes(seg)) return seg as TicketsSection;
  if (seg in TICKETS_SCOPE_HREFS) return 'requests'; // SERVICEIA2-295: the scopes are the list's filter
  return ticketsSectionOfPage(seg) ?? 'requests';
}

/** SERVICEIA1-295: the page of a tickets route (the level-2 row's active item): a page id, `mine` for the bare area (as before), '' for the
 * full-screen detail, a section entry address and anything else. */
export function ticketsPageOf(r: RouteState | null): string {
  if (r?.mode !== 'tickets') return '';
  const seg = r.segments[1] ?? '';
  if (!seg || seg in TICKETS_SCOPE_HREFS) return 'list'; // SERVICEIA2-295: שלי · המחלקה · הכול are one page, the list
  return ticketsSectionOfPage(seg) ? seg : '';
}

/** Breadcrumb text for the SW A top bar: area › (section ›) page; in הגדרות › אבטחה the sub-page follows. */
export function crumbsOf(r: RouteState | null, api = false): string[] {
  const a = areaOf(r);
  if (!a) return [];
  // SERVICEIA1-295: service management › section › page (the system › security precedent)
  if (a === 'tickets') {
    const sec = ticketsSectionOf(r);
    const secTab = TICKETS_TABS.find((x) => x.id === sec);
    const page = sec ? TICKETS_PAGE_ROWS[sec].find((p) => p.id === ticketsPageOf(r)) : undefined;
    const area = NAV_A.find((n) => n.id === 'tickets');
    return [area?.label ?? '', secTab?.label ?? '', page && page.label !== secTab?.label ? page.label : ''].filter(Boolean);
  }
  const area = a === 'system' ? SYSTEM_AREA : a === 'notices' ? NOTICES_AREA : NAV_A.find((n) => n.id === a);
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
    label: `אבטחה ‹ ${s.label}`,
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
// CR-NOTICE106: the notice board tab until the session says the module is on; FIX2200: the same for the הכרזות tab (announce.enabled)
export const HIDDEN_HREFS = new Set<string>(['#/devices/notices', '#/devices/announce', '#/devices/calendars/cal']);

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
  '#/explore/presence': ['presence.view'], // WHOIN034-295: GET presence/people needs it (at any scope; the server filters by floor)
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
  [WALL_SETTINGS_HREF]: ['system.configure'],
  // CR-NOTICE106: the notice board page needs no entry (every signed-in user reads the notices of his audience; the server decides),
  // its settings page: the module switch and defaults need system.configure, the TV boards notices.boards (each part by its own right)
  [NOTICES_SETTINGS_HREF]: ['system.configure', 'notices.boards'],
  // CALENDARS-UI-2310: the module's settings (calendar.configure; holders of calendar.view read them) and its connections (calendar.connect)
  [CALENDARS_SETTINGS_HREF]: ['calendar.configure'],
  [CALENDAR_SYNC_SETTINGS_HREF]: ['calendar.connect'],
  [CALENDARS_HOME_HREF]: ['calendar.view'],
  [TRANSIT_SETTINGS_HREF]: ['system.configure', 'notices.boards'], // BUSTIMES-295: reading the stops; every write needs system.configure (the server decides)
  [SYNOPTIC_HREF]: ['devices.read'], // 2.29.0: the board reads devices/tree (the server narrows it to the caller's floors)
  [ANNOUNCE_HREF]: ['media.announce'], // ANNOUNCE-295: POST announcements needs it (installation scope on the server)
  // CR-036 S10: access.admin.read at ANY scope (a station-scoped administrator sees the status of their stations; the server narrows every read)
  [ACCESS_CONTROL_SETTINGS_HREF]: ['access.admin.read'],
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
  [INFRA_GENERATOR_HREF]: ['generator.view'],
  [INFRA_ELEVATORS_HREF]: ['devices.read'],
  [INFRA_TEMPERATURE_HREF]: ['devices.read'],
  // CR-INSIGHT215: the reports section is offered to a holder of either permission (each screen asks its own part's status and permission)
  [TICKETS_REPORTS_HREF]: ['reports.building', 'insights.read'],
  [INFRA_WATER_HREF]: ['water.view'], // CR-WATER78 section 3 (floor-scoped on the server: any scope)
  [INFRA_SETTINGS_HREF]: ['energy.manage', 'system.configure', 'generator.manage', 'infra.elevators.manage', 'infra.temperature.manage', 'insights.manage', 'water.manage'],
  // CR-038 (section 8): the tickets area - "שלי" for whoever may view or open tickets (a creator sees the tickets they opened), "המחלקה" for
  // tickets.view (the server lists the caller's departments), "הכול" for tickets.all_departments; held at ANY scope (the server's visibility rule
  // narrows every row by place and department). The settings tab: the switch and the display (system.configure) or the name, departments and
  // grants (tickets.configure), both at installation scope.
  [TICKETS_MINE_HREF]: ['tickets.view', 'tickets.create'],
  [TICKETS_DEPARTMENT_HREF]: ['tickets.view'],
  [TICKETS_ALL_HREF]: ['tickets.all_departments'],
  [TICKETS_OVERVIEW_HREF]: ['tickets.manage'], // MGRDASH: the manager overview (the server's board gate also needs a manager membership or all departments)
  [TICKETS_BOARD_HREF]: ['tickets.manage'], // slice 6: the manager board (the server also needs a manager membership or all departments)
  // "מטפלים וספקים": the directory's readers (tickets.configure edits; a department manager reads his departments' rows, masked phones)
  [TICKETS_HANDLERS_HREF]: ['tickets.configure', 'tickets.manage'],
  [TICKETS_ACCOUNTS_HREF]: ['tickets.costs.view'], // TK258: the server also checks it on every row's place
  // TKRFQ2: requests for quotation - whoever may open one (tickets.external) or decide on one (tickets.costs); the server's visibility rule narrows every row
  [TICKETS_RFQS_HREF]: ['tickets.external', 'tickets.costs'],
  [TICKETS_SETTINGS_HREF]: ['system.configure', 'tickets.configure'],
  // CR-MAINT215 slice 2: the maintenance section - maintenance.view at ANY scope (the server narrows every row by its place)
  [TICKETS_MAINTENANCE_PAGE_HREF]: ['maintenance.view'], // CR-MAINT215: the section's page (release/2150: the section address #/tickets/maintenance is redirect-only and has no permission of its own)
  // SHAREDID-293: the external-access screen - approvers (access.external.grant at any scope; the server narrows every grant to the
  // stations the caller may see). Station-scoped people readers keep their own screens: no new tab for them (clean operator screens).
  [EXTERNAL_WISKEY_HREF]: ['access.external.grant'],
  [EXTERNAL_TICKETS_HREF]: ['access.external.grant'],
  // CR-039 DOORWIN-295: door windows + emergency - any one of these at ANY scope (the server filters every door by its station chain)
  [DOOR_WINDOWS_HREF]: ['access.stations.read', 'access.windows.manage', 'access.windows.cancel', 'access.emergency.lock', 'access.emergency.open'],
  '#/system/messaging-accounts': ['system.configure', 'messaging.accounts.manage'], // CR-038 S5a (installation scope)
  '#/system/fleet-report': ['system.configure'], // CR-FLEET215 (installation scope; the server also requires a system administrator)
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
  [SECURITY_PUBLIC_HREF]: ['system.configure'], // SECFIX2-295
  [SECURITY_WISKEY_HREF]: ['system.configure'], // SWITCHUI-295 (GET /wiskey/switches: system.configure at installation scope + system administrator)
  [SECURITY_PRIVACY_MASKS_HREF]: ['system.configure'], // MASKUI-295 (GET /nvr/cameras); the write permission is shown on the page
  [SECURITY_SETTINGS_HREF]: [...ALARM_PERMISSIONS, 'sources.configure'],
  '#/investigate/events': ['events.read'],
  [INCIDENTS_HREF]: ['events.read'], // CR-LIVEEVENT100 (and the module switch: applyIncidents)
  [INCIDENTS_SETTINGS_HREF]: ['system.configure'], // CR-LIVEEVENT100: PUT /incidents/settings (installation scope)
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
  '#/system/readiness': ['system.configure'], // CR-READY96: GET /readiness needs system.configure at installation scope
  // CR-013: the screen catalogue (a design / support tool), for system administrators only
  '#/screens': ['system.configure'],
};

/** CR-036: a WisKey tab whose screen the owner switched to the native Arx one (`access.ui.<screen>` = smplwise) needs the NEW
 * permission of that screen, held at ANY scope (the access-control permissions are scoped by station, so a station-scoped
 * operator holds them below installation scope) - not `access.read` at installation scope. While the screen is the embedded
 * panel the tab keeps `access.read` (WisKey's own per-area permissions decide inside the frame). A viewer holding only
 * `access.read` is therefore not offered the native People tab, and a direct URL shows the screen's "not available to you" panel.
 * Each native slice adds its row (S7: people; S8: events). */
export const NATIVE_WISKEY_TABS: Record<string, { screen: WiskeyScreen; need: string[] }> = {
  '#/wiskey/people': { screen: 'people', need: ['access.people.read'] },
  '#/wiskey/events': { screen: 'events', need: ['access.events.read'] }, // S8: the entry log
  '#/wiskey/schedules': { screen: 'schedules', need: ['access.stations.read'] }, // S9: the door schedules (read only)
};

/** Tabs whose permission counts only when held at installation scope, because the screen and its API check it there
 * and nowhere else: WisKey stations are not mapped to sites or floors, so access.read is installation-wide by design
 * (CR-005). A floor-scoped viewer or a site-scoped site_admin would otherwise see the tab and land on "no permission". */
export const INSTALLATION_ONLY_HREFS = new Set<string>([...STATIC_WISKEY_TABS.map((t) => t.href ?? ''), '#/system/wizard', '#/system/readiness', '#/system/security/manage', SECURITY_CAMERAS_HREF, SECURITY_PUBLIC_HREF, SECURITY_WISKEY_HREF, SECURITY_PRIVACY_MASKS_HREF, ENTITIES_SETTINGS_HREF, SCHEDULES_SETTINGS_HREF, WALL_SETTINGS_HREF, AUTOMATIONS_SETTINGS_HREF, MULTIMEDIA_SETTINGS_HREF, UPDATE_SETTINGS_HREF, INFRA_METERS_HREF, INFRA_SETTINGS_HREF, TICKETS_SETTINGS_HREF, '#/system/messaging-accounts', '#/system/fleet-report', INCIDENTS_SETTINGS_HREF]); // the alarm management: routers/alarm.py `_configurer` checks system.configure at installation scope

/** `installationOnly`: the permission must be held at installation scope, not at any scope. */
export type Can = (permission: string, installationOnly?: boolean) => boolean;

export function tabAllowed(href: string, can?: Can): boolean {
  // every WisKey tab (the static ones and those built from the embed API catalog) needs access.read at installation scope
  const native = NATIVE_WISKEY_TABS[href];
  const isNative = !!native && WISKEY_UI[native.screen] === 'smplwise';
  const need = isNative ? native.need : (TAB_PERMISSIONS[href] ?? (isWiskeyHref(href) ? ['access.read'] : undefined));
  const installationOnly = !isNative && href !== EXTERNAL_WISKEY_HREF && href !== DOOR_WINDOWS_HREF && (INSTALLATION_ONLY_HREFS.has(href) || isWiskeyHref(href)); // SHAREDID-293: any scope
  return !need || !can || need.some((p) => can(p, installationOnly));
}

export function visibleTabs(items: TabItem[], api: boolean, can?: Can): TabItem[] {
  // SERVICEIA1-295: the tickets sections are derived from their pages - a section is offered while one of its pages is (with or without a
  // backend: a section without any page, תחזוקה ובקרה on this build, is never drawn) and opens on its first visible page
  if (items === TICKETS_TABS) return ticketsSections(api, can);
  // CR-016: the players / groups tabs are offered only when the installation has players / groups (applyMultimediaKinds),
  // with or without a backend
  const offered0 = items === TICKETS_VENDORS_PAGES && EXTERNAL_PLACEMENT === 'access' ? items.filter((t) => t.id !== 'external') : items === INFRA_TABS && !api ? items.filter((t) => t.id !== 'generator' && t.id !== 'elevators' && t.id !== 'temperature' && t.id !== 'water') : items === MULTIMEDIA_TABS ? items.filter((t) => t.id === 'screens' || (t.id === 'players' && MULTIMEDIA_KINDS.players) || (t.id === 'groups' && MULTIMEDIA_KINDS.groups)) : items;
  // CR-MAINT215: the maintenance section only with a backend and while that module is on (the static demo has no maintenance data)
  const offered = items === TICKETS_MAINTENANCE_PAGES && (!api || !MAINTENANCE_ON) ? [] : offered0;
  // permissions and the fixed rules decide what is offered; ui.tabs (order, hidden) then shapes it (with a backend only:
  // the static demo shows the defaults)
  // FIX2200: the הכרזות tab follows the announcements switch in the static demo too (OFF there, like the notice board)
  if (!api) return items === DEVICES_TABS && ANNOUNCE_OFF ? offered.filter((t) => t.href !== ANNOUNCE_HREF) : offered;
  const permitted = permittedTabs(offered, api, can);
  const shown = configureTabs(sectionIdOf(items), permitted);
  // 0.1.154: a stored `ui.tabs` entry that hides the old "אוטומציות" tab must not take the schedules segment away with it
  if (items === DEVICES_TABS) {
    const k = permitted.find((t) => t.id === 'automations');
    if (k && !shown.includes(k) && kavarnitSegments(api, can).schedules) return [...shown, k];
  }
  return shown;
}

/** SERVICEIA1-295: the area's sections this user is offered, each with the href of its first visible page (the pages' own gates and
 * `ui.tabs` page order decide), then shaped by `ui.tabs` section `tickets` (with a backend; the demo shows the defaults). The arrays are
 * never mutated: a section whose entry differs from its built-in href is a copy. */
function ticketsSections(api: boolean, can?: Can): TabItem[] {
  const list: TabItem[] = [];
  for (const sec of TICKETS_TABS) {
    const first = visibleTabs(TICKETS_PAGE_ROWS[sec.id as TicketsSection], api, can)[0];
    if (!first) continue;
    list.push(first.href === sec.href ? sec : { ...sec, label: sec.label, short: sec.short, href: first.href });
  }
  return api ? configureTabs('tickets', list) : list;
}

/** SERVICEIA1-295: the pages of one section this user is offered (the level-2 row the shell draws under the sections). */
export function ticketsPageTabs(section: TicketsSection | '', api: boolean, can?: Can): TabItem[] {
  return section ? visibleTabs(TICKETS_PAGE_ROWS[section], api, can) : [];
}

/** SERVICEIA1-295: where a section entry address (`#/tickets/<section>`) lands - the section's first visible page; a section this user is
 * not offered (or one without pages) lands on the area's first visible section; nothing at all = the built-in list. */
export function ticketsSectionTarget(section: string, api: boolean, can?: Can): string {
  const own = (TICKETS_SECTION_IDS as readonly string[]).includes(section) ? ticketsPageTabs(section as TicketsSection, api, can)[0]?.href : undefined;
  return own ?? visibleTabs(TICKETS_TABS, api, can)[0]?.href ?? TICKETS_MINE_HREF;
}

function permittedTabs(source: TabItem[], api: boolean, can?: Can): TabItem[] {
  // 0.1.154: the "קברניט" tab (id `automations`) stands for two gates: it is offered while its schedules or its automations segment is, and it
  // opens on the first one offered (the schedules)
  // SERVICEIA2-295: the list page stands for the three scopes - offered while one scope is, opening on the first one offered
  if (api && source === TICKETS_REQUESTS_PAGES) {
    const sc = ticketsScopesAllowed(api, can)[0];
    return source.flatMap((t) => (t.id !== 'list' ? (permittedTabs([t], api, can)) : sc && !TICKETS_OFF ? [{ ...t, href: TICKETS_SCOPE_HREFS[sc] }] : []));
  }
  const items = api && source === DEVICES_TABS ? source.flatMap((t) => {
    if (t.id !== 'automations') return [t];
    const seg = kavarnitSegments(api, can);
    return seg.schedules || seg.automations ? [{ ...t, href: seg.schedules ? SCHEDULES_HREF : AUTOMATIONS_HREF }] : [];
  }) : source;
  const shown = api ? items.filter((t) => !DEMO_ONLY_HREFS.has(t.href ?? '') && !HIDDEN_HREFS.has(t.href ?? '') && !(WISKEY_HIDDEN && isWiskeyHref(t.href ?? '')) && !capHiddenHref(t.href ?? '') && !(ALARM_PRESENT === false && ALARM_HREFS.has(t.href ?? '')) && !(INFRA_NO_METERS && t.href === INFRA_METERS_HREF) && !(INFRA_NO_GENERATOR && t.href === INFRA_GENERATOR_HREF) && !(INFRA_NO_ELEVATORS && t.href === INFRA_ELEVATORS_HREF) && !(INFRA_NO_TEMPERATURE && t.href === INFRA_TEMPERATURE_HREF) && !(INFRA_NO_WATER && t.href === INFRA_WATER_HREF) && !insightHiddenHref(t.href) && !(TICKETS_OFF && isTicketsAreaHref(t.href ?? '') && !isMaintenanceHref(t.href)) && !(!MAINTENANCE_ON && isMaintenanceHref(t.href)) && !(INCIDENTS_OFF && isIncidentsHref(t.href ?? '')) && (t.href !== SECURITY_SETTINGS_HREF || visibleTabs(SECURITY_SETTINGS_TABS, api, can).length > 0) && tabAllowed(t.href ?? '', can)).map((t) => (API_LABELS[t.href ?? ''] ? { ...t, label: API_LABELS[t.href ?? ''] } : t)) : items;
  // TABSET-293: an infrastructure tab opens on the first page of its configured page row (the owner's order is the default page);
  // decided after the gates above, which key on the built-in href
  if (!api || source !== INFRA_TABS) return shown;
  return shown.map((t) => {
    const entry = infraEntryHref(t.id, can);
    return entry && entry !== t.href ? { ...t, href: entry } : t;
  });
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
    // CR-038: the tickets area is OFF until switched on - in the static demo too (2.5.0 gate: an always-on eighth area did not fit
    // the 320 px phone bar and moved every demo screen); Settings › the module switches it on in the demo like on an installation
    if (n.id === 'tickets' && !ticketsModuleOn() && !MAINTENANCE_ON) return []; // CR-MAINT215: the maintenance section keeps the area
    if (n.id === 'security') return [n];
    return [{ ...n, href: entryHref(n.href, tabs, n.id) }];
  });
  // ui.tabs "areas": areas the admin hid leave the rail and the bottom bar (the order stays the user's)
  // answer 25: a viewer who cannot read the building's devices has no real home screen - a tenant of the calendars only
  return withCalendarsArea(withNoticesArea(api ? configureTabs('areas', list, false) : list, rank), api && !!can && !can('devices.read'));
}

/** CALENDARS-UI-2310: the rail entry "יומנים" right after ראשי (the approved mock-up, nav B) while the module is on and the installation puts
 * it on the rail (rail / both) - or, whatever the setting, for a tenant of the calendars only (owner answer 25: no home area, or a home
 * screen without devices.read, which shows him nothing). Not a movable tab. */
export function withCalendarsArea(list: AreaEntry[], tenant = false): AreaEntry[] {
  if (!CALENDARS_ON) return list;
  const home = list.findIndex((n) => n.id === 'devices');
  if (CALENDARS_PLACEMENT === 'home_tab' && home >= 0 && !tenant) return list;
  return [...list.slice(0, home + 1), CALENDARS_AREA, ...list.slice(home + 1)];
}

/** NOTICEADD-295: the notice board's rail entry joins while the module is on (applyNoticesHidden; the static demo keeps it off like the
 * module), right after מולטימדיה - or, when מולטימדיה is not in the list, before the first entry the user's order puts after it. */
export function withNoticesArea(list: AreaEntry[], rank: (id: string) => number = (id) => NAV_TAB_IDS.indexOf(id as NavTabId)): AreaEntry[] {
  if (!noticesModuleOn()) return list;
  const at = list.findIndex((n) => n.id === 'multimedia');
  const after = at >= 0 ? at + 1 : list.findIndex((n) => rank(n.id) > rank('multimedia'));
  const i = after < 0 ? list.length : after;
  return [...list.slice(0, i), NOTICES_AREA, ...list.slice(i)];
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
  const modes = ['live', 'explore', 'investigate', 'system', 'wiskey', 'devices', 'security', 'multimedia', 'infra', 'tickets'];
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
  /** SERVICEIA3-295: false while the product settings (`ui.tabs`: page order and hidden tabs) are still loading - the service-management entry
   * addresses wait for them (absent = loaded). */
  settings?: boolean;
}

/** SERVICEIA3-295: the service-management entry addresses whose landing page depends on `ui.tabs` (#/tickets/requests|maintenance|vendors|reports|list). */
export function isTicketsEntryAddress(r: RouteState | null): boolean {
  return r?.mode === 'tickets' && !r.segments[2] && ((TICKETS_SECTION_IDS as readonly string[]).includes(r.segments[1] ?? '') || r.segments[1] === 'list');
}

/** Old routes that moved (2026-09-30). Returns the new path (`/investigate/health?sort=...`) or null when the route
 * stays. Query parameters travel with the redirect (the alarm panel, the camera-health sort), so links written before the
 * move - the search result, the devices screens, notifications, bookmarks - keep working. Applies with and without a backend. */
export function legacyRedirect(r: RouteState | null, access?: LegacyAccess): string | null {
  // CR-MAINT215 slice 2: a scanned QR / NFC sticker (`#/m/<token>`, the short path printed on it) opens the maintenance section's scan page
  // (a signed-in person only; the server resolves the token for THIS person or answers the same 404)
  if (r && !r.mode && r.segments[0] === 'm' && /^[A-Za-z0-9_-]{16,64}$/.test(r.segments[1] ?? '')) return `/tickets/maintenance/scan/${r.segments[1]}`;
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
  // SERVICEIA1-295: the service-management section entry addresses (#/tickets/requests|maintenance|vendors|reports) land on the section's
  // first page this user may open (permission-aware; nothing decided while the session loads); the query travels. Every page keeps its href.
  // SERVICEIA2-295: #/tickets/list (the one list page) lands on the first scope of the list this user may open, as the requests section does
  if (r.mode === 'tickets' && !s[2] && ((TICKETS_SECTION_IDS as readonly string[]).includes(s[1] ?? '') || s[1] === 'list')) {
    if (access && (!access.ready || access.settings === false)) return null; // SERVICEIA3-295: and not before ui.tabs is known
    const target = ticketsSectionTarget(s[1] === 'list' ? 'requests' : s[1], access?.api ?? false, access?.api ? access.can : undefined);
    return `${target.slice(1)}${q}`;
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
  /** The card's name (a getter: read in the document language - i18n/tab-sections.ts). */
  readonly label: string;
  /** Where the section shows: the surface the owner recognises it by. */
  readonly where: string;
  /** Every tab of the section in its default order (not limited by permissions: the editor is for the whole installation). */
  tabs: () => TabItem[];
  /** The hierarchy level of its bar: 1 = the first bar of an area (the security sections, the tab row of home, map, multimedia, WisKey,
   * infrastructure, the tickets area and settings), 2 = the sub-tabs below it (the pages of לייב and חקירה, the page rows of the
   * infrastructure screens, the pages of הגדרות › אבטחה). */
  level: TabLevel;
  /** False for the rail / bottom bar: it has no tab-bar style. */
  bar?: boolean;
  /** TABSET-293: whether the editor lists the section right now (an optional area that is switched off is not listed; its stored
   * entry is kept untouched). Absent = always. */
  available?: () => boolean;
  /** TABSET-293: some of the section's tabs are offered only once the installation has something of their kind (multimedia players
   * and groups, the generator, elevators): the editor says so under the card. */
  offered?: boolean;
}

const plain = (items: readonly { id: string; label: string; href?: string }[]): TabItem[] => items.map((i) => ({ id: i.id, label: i.label, href: i.href }));

/** TABSET-293: one registry entry; label and where are read at render time (the document language, the tickets module's own name). */
function tabSection(id: string, label: () => string, where: () => string, tabs: () => TabItem[], level: TabLevel, extra: Partial<Pick<TabSectionDef, 'bar' | 'available' | 'offered'>> = {}): TabSectionDef {
  return { id, get label() { return label(); }, get where() { return where(); }, tabs, level, ...extra };
}

/** Every navigation section whose tabs the owner orders and hides (הגדרות › כללי › לשוניות). TABSET-293 (owner 2026-10-20): the
 * multimedia, infrastructure and tickets areas were missing - their rows never reached the editor nor `configureTabs` (sectionIdOf) -
 * and the infrastructure screens' page rows (electricity, generator) are level-2 sections now. A new tab added to one of the arrays
 * above (temperature, elevators, ...) appears here by itself, after the ones a stored order names. */
export const TAB_SECTIONS: TabSectionDef[] = [
  tabSection('areas', () => tst('areasLabel'), () => tst('areasWhere'), () => plain(NAV_A), 1, { bar: false }),
  tabSection('devices', () => tst('devicesLabel'), () => tst('devicesWhere'), () => plain(DEVICES_TABS), 1),
  tabSection('security', () => tst('securityLabel'), () => tst('securityWhere'), () => plain(SECURITY_SECTIONS), 1),
  tabSection('security.live', () => tst('securityLiveLabel'), () => tst('securityLiveWhere'), () => plain(SECTION_TABS.live), 2),
  tabSection('security.investigate', () => tst('securityInvestigateLabel'), () => tst('securityInvestigateWhere'), () => plain(SECTION_TABS.investigate), 2),
  tabSection('explore', () => tst('exploreLabel'), () => tst('exploreWhere'), () => plain(EXPLORE_TABS), 1),
  tabSection('multimedia', () => tst('multimediaLabel'), () => tst('multimediaWhere'), () => plain(MULTIMEDIA_TABS), 1, { offered: true }),
  tabSection('wiskey', () => tst('wiskeyLabel'), () => tst('wiskeyWhere'), () => plain(WISKEY_TABS), 1),
  tabSection('infra', () => tst('infraLabel'), () => tst('infraWhere'), () => plain(INFRA_TABS), 1, { offered: true }),
  tabSection('infra.electricity', () => tst('infraElectricityLabel'), () => tst('infraElectricityWhere'), () => plain(INFRA_ELECTRICITY_PAGES), 2),
  tabSection('infra.generator', () => tst('infraGeneratorLabel'), () => tst('infraGeneratorWhere'), () => plain(INFRA_GENERATOR_PAGES), 2),
  tabSection('infra.water', () => tst('infraWaterLabel'), () => tst('infraWaterWhere'), () => plain(INFRA_WATER_PAGES), 2), // CR-WATER78
  // SERVICEIA1-295: level 1 = the sections that have pages on this build; level 2 = the page rows of the sections with two pages or more
  tabSection('tickets', () => tt('area'), () => tst('ticketsWhere', { name: tt('area') }), () => plain(TICKETS_TABS.filter((t) => TICKETS_PAGE_ROWS[t.id as TicketsSection].length > 0)), 1, { available: () => ticketsModuleOn() }),
  ...TICKETS_CONFIGURABLE_SECTIONS.map((sec) => tabSection(`tickets.${sec}`, () => tst('ticketsSectionLabel', { name: tt('area'), section: sectionLabel(sec) }), () => tst('ticketsSectionWhere', { section: sectionLabel(sec) }),
    // SHAREDID-293: "גישת חוץ" only while it is placed under service management
    () => plain(TICKETS_PAGE_ROWS[sec].filter((t) => t.id !== 'external' || EXTERNAL_PLACEMENT !== 'access')), 2, { available: () => ticketsModuleOn() })),
  // SERVICEIA3-295: the scopes of the request list (שלי · המחלקה · הכול) - one card, each scope hidden separately
  tabSection('tickets.scopes', () => tst('ticketsScopesLabel', { name: tt('area') }), () => tst('ticketsScopesWhere'), () => plain(TICKETS_SCOPE_TABS), 2, { available: () => ticketsModuleOn() }),
  tabSection('system', () => tst('systemLabel'), () => tst('systemWhere'), () => plain(AREA_TABS.system), 1),
  tabSection('system.security', () => tst('systemSecurityLabel'), () => tst('systemSecurityWhere'), () => plain(SECURITY_SETTINGS_TABS), 2),
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
    [MULTIMEDIA_TABS, 'multimedia'], // TABSET-293: the multimedia, infrastructure and tickets rows follow ui.tabs too
    [INFRA_TABS, 'infra'],
    [TICKETS_TABS, 'tickets'],
    [TICKETS_REQUESTS_PAGES, 'tickets.requests'], // SERVICEIA1-295: the sections' page rows
    [TICKETS_VENDORS_PAGES, 'tickets.vendors'],
    [TICKETS_SCOPE_TABS, 'tickets.scopes'], // SERVICEIA3-295: the list's scope segment
    [AREA_TABS.system, 'system'],
    [SECURITY_SETTINGS_TABS, 'system.security'],
  ]);
  return ARRAY_SECTIONS.get(items) ?? null;
}

