/**
 * WISKEY-DEEPLINKS-2382 (plan task T18, "no dead end"): the ONE table, keyed by CAPABILITY (`schedules.edit`, `profiles.edit` ...),
 * that says where an access-control capability lives - its native Arx screen when one exists, else the exact place in the embedded
 * intercom panel (embed API v1 `tab` / `tool`) - and the Arx places that offer each link. Callers ask `linkFor(capability)` /
 * `deepLinksFor(place)` and never build an address themselves, so a native screen that lands later replaces a panel link by filling
 * the entry's `native` route here, without touching any caller. Pure: no DOM, no session, no network - the component
 * `components/wk-deep-links.ts` supplies who is asking and the panel's handshake catalog; `tests/unit-wiskey-deeplinks.spec.ts` runs
 * this file in node.
 *
 * Where the panel ids come from: the router of WisKey 2.0.1-rc.10 (`frontend/panel.js`, top-level tabs `overview users devices
 * events sync tools camera_wall`; management tools `clock_options media_options whatsapp_templates profile_options
 * permission_directory workflow_center platform_center operations_center investigations camera_wall identity_lifecycle data_quality
 * access_reviews access_comparison guest_templates visit_requests fleet_alerts users devices sync audit health schedules
 * access_control`), and the embed contract (`WISKEY_EMBED_API_V1.md` section 2). WisKey promises no stability for them yet (the
 * contract says "use the installed instance's ready catalog"): that ask is Q-WK-8 of the integration plan. So:
 *   - a link is built from this table, never from free text;
 *   - a capability this table does not know falls back to the panel root (`ROOT_HREF`), never to a guessed address;
 *   - once the panel's handshake catalog is known in this session, a panel link whose tab / tool is not in it is not offered (WisKey
 *     would only fall back to its default screen: the operator may not open it there).
 *
 * The panel address is Arx's own route of the embedded panel (`#/wiskey/<segment>[/<tool>]`, shell/nav.ts `wiskeyRoute`): a tool
 * lives under `tools`; a top-level tab that can also be a native Arx screen (overview, events, people, devices) carries `?classic=1`,
 * the per-visit way to the embedded panel that changes no setting. The panel itself is opened from the ORIGIN by the embed (never
 * the Ingress path) - nothing here builds a Home Assistant address.
 *
 * Temporary links (owner answers 2026-11-03, corrected): Q4 "א" - device schedules and groups / profile fields get full editing in
 * Arx; Q7 "ג" - the installer tools (platform, clock, station technical settings, lifecycle) become native. Their entries carry
 * `bridge: 'Q4' | 'Q7'`: the panel link is the bridge until the native screen sets `native`.
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

/** A native Arx screen that took a capability over: its route and the permission(s) it needs (any one, at any scope). */
export interface NativeRoute {
  readonly href: string;
  readonly need?: readonly string[];
}

export interface DeepLinkEntry {
  /** Where the capability lives in the embedded panel (the bridge while there is no native screen). */
  readonly target: DeepTarget;
  /** What the link says (Hebrew; no platform name: the panel is "חלון האינטרקום" on every operator screen). */
  readonly label: string;
  /** The rows of the capability matrix (WISKEY_FULL_INTEGRATION_PLAN_2026-11-03 section 2) this link serves. */
  readonly rows: readonly number[];
  /** The panel opens it only for its own administrators (panel.js `tabAvailable`: workflow_center, platform_center, investigations,
   * access_control). Arx offers such a panel link only to a caller holding `access.admin.read` at installation scope. */
  readonly panelAdmin?: boolean;
  /** The owner decided this capability becomes a native Arx screen (Q4 / Q7): the panel link is temporary. */
  readonly bridge?: 'Q4' | 'Q7';
  /** The native Arx screen, once it exists: set here and every place that offers the capability follows. */
  readonly native?: NativeRoute;
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
 * capability -> where it lives. Every row the plan marks "embedded panel only" (E), the missing operator actions the panel already has
 * (M rows 3, 34, 36) and the installer tools kept in the panel (X rows reachable as E) has an entry. Where the panel has no address
 * finer than a tab (a station's own settings dialog, a person's details, the conflict review, the import of unmanaged users) the link
 * opens that tab - the finer address is a WisKey ask (docs/changes/WISKEY-DEEPLINKS-2382.md, "gaps").
 */
export const DEEP_LINKS: Readonly<Record<string, DeepLinkEntry>> = Object.freeze({
  // ---- stations, doors (the station settings dialog of the devices tab: technical, door programs, hold-open, public codes, rescan, clock)
  'stations.technical': { target: tab('devices'), label: 'הגדרות העמדה: טכני, תוכניות דלת, קודים, סריקה ושעון', rows: [34, 36, 45, 46, 47], bridge: 'Q7' },
  // ---- synchronisation (the sync tab: sync now per person / station / all, the conflict review and resolve, the diagnostics file)
  'sync.run': { target: tab('sync'), label: 'סנכרון עכשיו ופתרון התנגשויות', rows: [3, 36, 38] },
  // ---- health, alerts, clock
  'health.fleet': { target: tool('health'), label: 'בריאות, קיבולת ובדיקת קבלה', rows: [34, 82, 98] },
  'alerts.act': { target: tool('fleet_alerts'), label: 'טיפול בהתראות', rows: [77] },
  'clock.settings': { target: tool('clock_options'), label: 'שעון ו־NTP', rows: [51], bridge: 'Q7' },
  // ---- people
  'people.unmanaged': { target: tab('users'), label: 'משתמשים לא מנוהלים ובדיקת "האם יכול לפתוח"', rows: [25, 29] },
  // WISKEY-PROFILES-EDIT-2390 (2.39.0 train): the native "קבוצות ושדות" screen took rows 26 / 27 over (the Q4 bridge retired); the
  // screen itself requires access.people.manage at installation scope, the link needs it somewhere
  'profiles.edit': { target: tool('profile_options'), label: 'עריכת קבוצות ושדות פרופיל', rows: [26, 27], native: { href: '#/wiskey/profiles', need: ['access.people.manage'] } },
  'people.lifecycle': { target: tool('identity_lifecycle'), label: 'מחזור חיים וחידושים', rows: [28] },
  'access.reviews': { target: tool('access_reviews'), label: 'סקירות הרשאה תקופתיות', rows: [29] },
  'access.compare': { target: tool('access_comparison'), label: 'השוואת הרשאות', rows: [29] },
  'people.quality': { target: tool('data_quality'), label: 'איכות נתונים', rows: [29] },
  'visits.requests': { target: tool('visit_requests'), label: 'בקשות ביקור', rows: [30] },
  'visits.templates': { target: tool('guest_templates'), label: 'תבניות אורחים', rows: [30] },
  // ---- schedules
  'schedules.edit': { target: tool('schedules'), label: 'עריכת לוחות זמנים במכשירים', rows: [49], bridge: 'Q4' },
  // ---- logs, operations, platform
  'audit.panel': { target: tool('audit'), label: 'יומן שינויים, ייצוא וביקורת הרשאות עמדה', rows: [79, 89] },
  'events.report': { target: tab('events'), label: 'דוח והדפסת אירועים', rows: [79] },
  'operations.center': { target: tool('operations_center'), label: 'מרכז תפעול ומשימות', rows: [80] },
  'operations.investigations': { target: tool('investigations'), label: 'חקירות', rows: [80], panelAdmin: true },
  'platform.center': { target: tool('platform_center'), label: 'מרכז הפלטפורמה', rows: [50, 82], panelAdmin: true, bridge: 'Q7' },
  'workflows.center': { target: tool('workflow_center'), label: 'מרכז תהליכים', rows: [84], panelAdmin: true },
  // ---- messaging, media, permissions
  'messaging.templates': { target: tool('whatsapp_templates'), label: 'תבניות הודעה של חלון האינטרקום', rows: [75] },
  'media.settings': { target: tool('media_options'), label: 'וידאו, שמע והכרזות', rows: [52] },
  'permissions.directory': { target: tool('permission_directory'), label: 'מדריך הרשאות', rows: [87] },
  'permissions.panel': { target: tool('access_control'), label: 'מי רשאי לפתוח את חלון האינטרקום', rows: [87], panelAdmin: true },
});

/** Which capabilities each place offers, in the order shown. A place lists only what an operator there would look for. */
export const PLACES: Readonly<Record<DeepPlace, readonly string[]>> = Object.freeze({
  station: ['stations.technical', 'sync.run', 'health.fleet', 'clock.settings'],
  stations: ['stations.technical', 'sync.run', 'alerts.act', 'health.fleet'],
  people: ['people.unmanaged', 'profiles.edit', 'people.lifecycle', 'access.reviews', 'access.compare', 'people.quality'],
  schedules: ['schedules.edit', 'stations.technical'],
  'settings-status': ['sync.run', 'alerts.act', 'health.fleet', 'clock.settings', 'operations.center', 'operations.investigations', 'platform.center'],
  'settings-audit': ['audit.panel', 'events.report'],
  'settings-groups': ['profiles.edit'],
  'settings-policy': ['permissions.panel', 'permissions.directory', 'media.settings', 'workflows.center'],
  'settings-messaging': ['messaging.templates'],
});

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
export const isDeepPlace = (p: string): p is DeepPlace => has(PLACES, p);

/** The place in the panel for a capability; an unknown capability is the panel root. */
export function deepTarget(capability: string): DeepTarget {
  return has(DEEP_LINKS, capability) ? DEEP_LINKS[capability].target : ROOT;
}

/** Arx's route of a place in the embedded panel. */
export function targetHref(t: DeepTarget): string {
  if (t.tab === 'tools' && t.tool) return `#/wiskey/tools/${encodeURIComponent(t.tool)}`;
  const seg = `#/wiskey/${encodeURIComponent(SEGMENT[t.tab] ?? t.tab)}`;
  return CLASSIC.includes(t.tab) ? `${seg}?classic=1` : seg;
}

/** The panel link of a capability: its precise address in the panel, or the panel root for a capability this table does not know. */
export function deepLinkHref(capability: string): string {
  return has(DEEP_LINKS, capability) ? targetHref(DEEP_LINKS[capability].target) : ROOT_HREF;
}

/** Where a capability's link goes: its native Arx screen when one exists, else the panel link (else the panel root). This is the
 * call a screen uses - e.g. `linkFor('schedules.edit')` - so the caller does not change when the native screen lands. `table` is
 * for tests only. */
export function linkFor(capability: string, table: Readonly<Record<string, DeepLinkEntry>> = DEEP_LINKS): string {
  if (!has(table, capability)) return ROOT_HREF;
  return table[capability].native?.href || targetHref(table[capability].target);
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

/** Who is asking: whether they may open the panel at all, whether they are an access-control administrator, and (for native
 * screens) what they hold. */
export interface DeepLinkViewer {
  /** `access.read` at installation scope, a backend, and the WisKey area not hidden (`ui.hide_wiskey`) - the rule of the area's tabs. */
  readonly panel: boolean;
  /** `access.admin.read` at installation scope (for the panel's administrator-only tools). */
  readonly admin: boolean;
  readonly catalog?: CatalogLike | null;
  /** A permission at any scope (a native screen's `need`); absent = a native link is offered without a permission check here. */
  readonly can?: (permission: string) => boolean;
}

/** The rule of the WisKey area's navigation (shell/nav.ts `tabAllowed` + `ui.hide_wiskey`), as one boolean. */
export function mayOpenPanel(o: { api: boolean; accessReadInstallation: boolean; hidden: boolean }): boolean {
  return o.api && o.accessReadInstallation && !o.hidden;
}

export interface DeepLink {
  /** The capability. */
  readonly id: string;
  readonly label: string;
  readonly href: string;
  /** `native` = an Arx screen; `panel` = the embedded panel at `target`. */
  readonly kind: 'native' | 'panel';
  readonly target: DeepTarget;
  readonly bridge?: 'Q4' | 'Q7';
}

/** The links a place offers this viewer. A panel link needs the panel rule (and, for the panel's administrator tools,
 * `access.admin.read`) and must be in the catalog once one is known; a native link needs its screen's permission. */
export function deepLinksFor(place: string, viewer: DeepLinkViewer, table: Readonly<Record<string, DeepLinkEntry>> = DEEP_LINKS): DeepLink[] {
  if (!isDeepPlace(place)) return [];
  const out: DeepLink[] = [];
  for (const id of PLACES[place]) {
    const e = has(table, id) ? table[id] : undefined;
    if (!e) continue;
    let link: DeepLink;
    if (e.native) {
      if (e.native.need?.length && viewer.can && !e.native.need.some((p) => viewer.can!(p))) continue;
      link = { id, label: e.label, href: e.native.href, kind: 'native', target: e.target, bridge: e.bridge };
    } else {
      if (!viewer.panel || (e.panelAdmin && !viewer.admin) || !inCatalog(e.target, viewer.catalog)) continue;
      link = { id, label: e.label, href: targetHref(e.target), kind: 'panel', target: e.target, bridge: e.bridge };
    }
    if (out.some((l) => l.href === link.href)) continue; // one link per address in a place
    out.push(link);
  }
  return out;
}

/** The capabilities whose panel link is temporary (the owner's Q4 / Q7: a native screen will take them over). */
export const BRIDGED: readonly string[] = Object.keys(DEEP_LINKS).filter((id) => !!DEEP_LINKS[id].bridge);
