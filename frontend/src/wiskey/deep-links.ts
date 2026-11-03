/**
 * WISKEY-DEEPLINKS-2382 (plan task T18, "no dead end"): the ONE table that maps an access-control capability Arx has no native
 * screen for to the exact place in the embedded intercom panel (embed API v1 `tab` / `tool`), and the Arx places that offer each
 * link. Pure: no DOM, no session, no network - the component `components/wk-deep-links.ts` supplies who is asking and the panel's
 * handshake catalog; `tests/unit-wiskey-deeplinks.spec.ts` runs this file in node.
 *
 * Where the ids come from: the panel's router on WisKey 2.0.1-rc.10 (`frontend/panel.js`, top-level tabs `overview users devices
 * events sync tools camera_wall`; management tools `clock_options media_options whatsapp_templates profile_options
 * permission_directory workflow_center platform_center operations_center investigations camera_wall identity_lifecycle data_quality
 * access_reviews access_comparison guest_templates visit_requests fleet_alerts users devices sync audit health schedules
 * access_control`), and the embed contract (`WISKEY_EMBED_API_V1.md` section 2). WisKey promises no stability for them yet (the
 * contract says "use the installed instance's ready catalog"): that ask is Q-WK-8 of the integration plan. So:
 *   - a link is built from this table, never from free text;
 *   - an id this table does not know falls back to the panel root (`ROOT`), never to a guessed address;
 *   - once the panel's handshake catalog is known in this session, a link whose tab / tool is not in it is not offered (WisKey would
 *     only fall back to its default screen: the operator may not open it there).
 *
 * The address is Arx's own route of the embedded panel (`#/wiskey/<segment>[/<tool>]`, shell/nav.ts `wiskeyRoute`): a tool lives
 * under `tools`; a top-level tab that can also be a native Arx screen (overview, events, people, devices) carries `?classic=1`, the
 * per-visit way to the embedded panel that changes no setting. The panel itself is opened from the ORIGIN by the embed (never the
 * Ingress path) - nothing here builds a Home Assistant address.
 */

/** A place in the embedded panel: a top-level tab, or a management tool under `tools`. */
export interface DeepTarget {
  readonly tab: string;
  readonly tool: string | null;
}

/** Where a link is offered. */
export type DeepPlace =
  | 'station' // the station drawer, its technical section
  | 'stations' // the stations and doors screen
  | 'people' // the people screen
  | 'schedules' // the schedules screen
  | 'settings-status' // Settings › בקרת כניסה, the status segment
  | 'settings-audit'
  | 'settings-groups'
  | 'settings-policy'
  | 'settings-messaging';

export interface DeepLinkEntry {
  readonly target: DeepTarget;
  /** What the link says (Hebrew; no platform name: the panel is "חלון האינטרקום" on every operator screen). */
  readonly label: string;
  /** The rows of the capability matrix (WISKEY_FULL_INTEGRATION_PLAN_2026-11-03 section 2) this link serves. */
  readonly rows: readonly number[];
  /** The panel opens it only for its own administrators (panel.js `tabAvailable`: workflow_center, platform_center, investigations,
   * access_control). Arx offers such a link only to a caller holding `access.admin.read` at installation scope. */
  readonly panelAdmin?: boolean;
}

/** The panel root: its default screen (the overview), the same address as the drawer's "פתיחה בחלון האינטרקום". */
export const ROOT: DeepTarget = Object.freeze({ tab: 'overview', tool: null });
export const ROOT_HREF = '#/wiskey/overview?classic=1';

/** The panel's top-level tabs (embed contract section 2). */
export const PANEL_TABS: readonly string[] = ['overview', 'users', 'devices', 'events', 'sync', 'tools', 'camera_wall'];
/** The tools this table points at (a subset of the rc.10 router's list). */
export const PANEL_TOOLS: readonly string[] = [
  'clock_options',
  'media_options',
  'whatsapp_templates',
  'profile_options',
  'permission_directory',
  'workflow_center',
  'platform_center',
  'operations_center',
  'investigations',
  'identity_lifecycle',
  'data_quality',
  'access_reviews',
  'access_comparison',
  'guest_templates',
  'visit_requests',
  'fleet_alerts',
  'audit',
  'health',
  'schedules',
  'access_control',
];
/** Arx route segment of a top-level tab (`users` has always been `people` in Arx). */
const SEGMENT: Record<string, string> = { users: 'people' };
/** Tabs that can also be a native Arx screen: the link adds `?classic=1` so it always lands in the panel. */
const CLASSIC: readonly string[] = ['overview', 'events', 'users', 'devices'];

const tab = (t: string): DeepTarget => Object.freeze({ tab: t, tool: null });
const tool = (t: string): DeepTarget => Object.freeze({ tab: 'tools', tool: t });

/**
 * capability id -> the place in the panel. Every row the plan marks "embedded panel only" (E), the missing operator actions the
 * panel already has (M rows 3, 34, 36) and the installer tools kept in the panel (X rows reachable as E) has an entry. Where the panel
 * has no address finer than a tab (a station's own settings dialog, a person's details, the conflict review, the import of unmanaged
 * users) the link opens that tab - the finer address is a WisKey ask (docs/changes/WISKEY-DEEPLINKS-2382.md, "gaps").
 */
export const DEEP_LINKS: Readonly<Record<string, DeepLinkEntry>> = Object.freeze({
  // ---- stations, doors (the station settings dialog of the devices tab: technical, door programs, hold-open, public codes, rescan, clock)
  station_settings: { target: tab('devices'), label: 'הגדרות העמדה: טכני, תוכניות דלת, קודים, סריקה ושעון', rows: [34, 36, 45, 46, 47] },
  // ---- synchronisation (the sync tab: sync now per person / station / all, the conflict review and resolve, the diagnostics file)
  sync: { target: tab('sync'), label: 'סנכרון עכשיו ופתרון התנגשויות', rows: [3, 36, 38] },
  // ---- health, alerts, clock
  health: { target: tool('health'), label: 'בריאות, קיבולת ובדיקת קבלה', rows: [34, 82, 98] },
  fleet_alerts: { target: tool('fleet_alerts'), label: 'טיפול בהתראות', rows: [77] },
  clock_settings: { target: tool('clock_options'), label: 'שעון ו־NTP', rows: [51] },
  // ---- people
  people_panel: { target: tab('users'), label: 'משתמשים לא מנוהלים ובדיקת "האם יכול לפתוח"', rows: [25, 29] },
  profile_fields: { target: tool('profile_options'), label: 'עריכת קבוצות ושדות פרופיל', rows: [27] },
  identity_lifecycle: { target: tool('identity_lifecycle'), label: 'מחזור חיים וחידושים', rows: [28] },
  access_reviews: { target: tool('access_reviews'), label: 'סקירות הרשאה תקופתיות', rows: [29] },
  access_comparison: { target: tool('access_comparison'), label: 'השוואת הרשאות', rows: [29] },
  data_quality: { target: tool('data_quality'), label: 'איכות נתונים', rows: [29] },
  visit_requests: { target: tool('visit_requests'), label: 'בקשות ביקור', rows: [30] },
  guest_templates: { target: tool('guest_templates'), label: 'תבניות אורחים', rows: [30] },
  // ---- schedules
  device_schedules: { target: tool('schedules'), label: 'עריכת לוחות זמנים במכשירים', rows: [49] },
  // ---- logs, operations, platform
  panel_audit: { target: tool('audit'), label: 'יומן שינויים, ייצוא וביקורת הרשאות עמדה', rows: [79, 89] },
  events_report: { target: tab('events'), label: 'דוח והדפסת אירועים', rows: [79] },
  operations_center: { target: tool('operations_center'), label: 'מרכז תפעול ומשימות', rows: [80] },
  investigations: { target: tool('investigations'), label: 'חקירות', rows: [80], panelAdmin: true },
  platform_center: { target: tool('platform_center'), label: 'מרכז הפלטפורמה', rows: [50, 82], panelAdmin: true },
  workflow_center: { target: tool('workflow_center'), label: 'מרכז תהליכים', rows: [84], panelAdmin: true },
  // ---- messaging, media, permissions
  whatsapp_templates: { target: tool('whatsapp_templates'), label: 'תבניות הודעה של חלון האינטרקום', rows: [75] },
  media_options: { target: tool('media_options'), label: 'וידאו, שמע והכרזות', rows: [52] },
  permission_directory: { target: tool('permission_directory'), label: 'מדריך הרשאות', rows: [87] },
  panel_permissions: { target: tool('access_control'), label: 'מי רשאי לפתוח את חלון האינטרקום', rows: [87], panelAdmin: true },
});

/** Which links each place offers, in the order shown. A place lists only what an operator there would look for. */
export const PLACES: Readonly<Record<DeepPlace, readonly string[]>> = Object.freeze({
  station: ['station_settings', 'sync', 'health', 'clock_settings'],
  stations: ['station_settings', 'sync', 'fleet_alerts', 'health'],
  people: ['people_panel', 'profile_fields', 'identity_lifecycle', 'access_reviews', 'access_comparison', 'data_quality'],
  schedules: ['device_schedules', 'station_settings'],
  'settings-status': ['sync', 'fleet_alerts', 'health', 'clock_settings', 'operations_center', 'investigations', 'platform_center'],
  'settings-audit': ['panel_audit', 'events_report'],
  'settings-groups': ['profile_fields'],
  'settings-policy': ['panel_permissions', 'permission_directory', 'media_options', 'workflow_center'],
  'settings-messaging': ['whatsapp_templates'],
});

export const isDeepPlace = (p: string): p is DeepPlace => Object.prototype.hasOwnProperty.call(PLACES, p);

/** The place in the panel for a capability id; an unknown id is the panel root. */
export function deepTarget(id: string): DeepTarget {
  return Object.prototype.hasOwnProperty.call(DEEP_LINKS, id) ? DEEP_LINKS[id].target : ROOT;
}

/** Arx's route of a place in the embedded panel. */
export function targetHref(t: DeepTarget): string {
  if (t.tab === 'tools' && t.tool) return `#/wiskey/tools/${encodeURIComponent(t.tool)}`;
  const seg = `#/wiskey/${encodeURIComponent(SEGMENT[t.tab] ?? t.tab)}`;
  return CLASSIC.includes(t.tab) ? `${seg}?classic=1` : seg;
}

/** The link of a capability id: its precise address, or the panel root for an id this table does not know. */
export function deepLinkHref(id: string): string {
  return Object.prototype.hasOwnProperty.call(DEEP_LINKS, id) ? targetHref(DEEP_LINKS[id].target) : ROOT_HREF;
}

/** The panel's handshake catalog (embed API v1 `wiskey:ready`), as far as this table needs it. */
export interface CatalogLike {
  readonly tabs: readonly { readonly id: string }[];
  readonly tools: readonly { readonly id: string }[];
}

/** Whether the panel would open the target for this operator: true while no catalog is known (the panel then decides and falls
 * back to its default screen by itself); with a catalog, the tab - and under `tools` the tool - must be listed. */
export function inCatalog(t: DeepTarget, catalog: CatalogLike | null | undefined): boolean {
  if (!catalog) return true;
  if (!catalog.tabs.some((x) => x.id === t.tab)) return false;
  return !(t.tab === 'tools' && t.tool) || catalog.tools.some((x) => x.id === t.tool);
}

/** Who is asking: whether they may open the panel at all, and whether they are an access-control administrator. */
export interface DeepLinkViewer {
  /** `access.read` at installation scope, a backend, and the WisKey area not hidden (`ui.hide_wiskey`) - the rule of the area's tabs. */
  readonly panel: boolean;
  /** `access.admin.read` at installation scope (for the panel's administrator-only tools). */
  readonly admin: boolean;
  readonly catalog?: CatalogLike | null;
}

/** The rule of the WisKey area's navigation (shell/nav.ts `tabAllowed` + `ui.hide_wiskey`), as one boolean. */
export function mayOpenPanel(o: { api: boolean; accessReadInstallation: boolean; hidden: boolean }): boolean {
  return o.api && o.accessReadInstallation && !o.hidden;
}

export interface DeepLink {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly target: DeepTarget;
}

/** The links a place offers this viewer: none at all when they may not open the panel. */
export function deepLinksFor(place: string, viewer: DeepLinkViewer): DeepLink[] {
  if (!viewer.panel || !isDeepPlace(place)) return [];
  const out: DeepLink[] = [];
  for (const id of PLACES[place]) {
    const e = DEEP_LINKS[id];
    if (!e || (e.panelAdmin && !viewer.admin) || !inCatalog(e.target, viewer.catalog)) continue;
    const href = targetHref(e.target);
    if (out.some((l) => l.href === href)) continue; // one link per address in a place
    out.push({ id, label: e.label, href, target: e.target });
  }
  return out;
}
