import type { IconName } from '../components/sw-icon';
import type { TabItem } from '../components/sw-tabs';
import type { RouteState } from '../router';

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

/** The WisKey area's tabs, shared by both designs. The first three are the screens SMPLWISE built (CR-005 phase 1b and
 * 2); each renders either that screen or WisKey's own Home Assistant panel embedded as-is, by הגדרות › בקרות כניסה
 * (CR-005 recorded decision 2026-09-28, embedded panel - the embed is the default). The rest exist only in WisKey's
 * panel and are always embedded, deep-linked to the panel's own tab (WISKEY_PANEL_TABS). */
export const WISKEY_TABS: TabItem[] = [
  { id: 'overview', label: 'מרכז הכניסה', href: '#/wiskey/overview' },
  { id: 'events', label: 'פעילות', href: '#/wiskey/events' },
  { id: 'people', label: 'אנשים', href: '#/wiskey/people' },
  { id: 'devices', label: 'עמדות', href: '#/wiskey/devices' },
  { id: 'sync', label: 'סנכרון', href: '#/wiskey/sync' },
  { id: 'health', label: 'בריאות', href: '#/wiskey/health' },
  { id: 'audit', label: 'יומן שינויים', href: '#/wiskey/audit' },
  { id: 'tools', label: 'ניהול', href: '#/wiskey/tools' },
];

/** The SMPLWISE screens with a choice in הגדרות › בקרות כניסה (settings keys `access.ui.<screen>`). */
export type WiskeyScreen = 'overview' | 'events' | 'people';
export type WiskeyUi = 'wiskey' | 'smplwise';
export const WISKEY_SCREENS: WiskeyScreen[] = ['overview', 'events', 'people'];

/** The owner's choice per screen; 'wiskey' (the embedded panel) until the product settings say otherwise. Filled by the
 * shell once the settings load and by the settings screen after a save. */
export const WISKEY_UI: Record<WiskeyScreen, WiskeyUi> = { overview: 'wiskey', events: 'wiskey', people: 'wiskey' };

export function applyWiskeyUi(settings: Record<string, unknown> | null | undefined): void {
  for (const s of WISKEY_SCREENS) WISKEY_UI[s] = String(settings?.[`access.ui.${s}`] ?? 'wiskey') === 'smplwise' ? 'smplwise' : 'wiskey';
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
 * the panel tab to deep-link. Without a backend (the static demo) there is no Home Assistant to embed, so the three
 * built screens show their demo data. */
export function wiskeyRoute(segment: string | undefined, api: boolean): { kind: 'smplwise'; screen: WiskeyScreen } | { kind: 'embed'; tab: string } {
  const seg = segment && WISKEY_PANEL_TABS[segment] ? segment : 'overview';
  if ((WISKEY_SCREENS as string[]).includes(seg) && (!api || WISKEY_UI[seg as WiskeyScreen] === 'smplwise')) return { kind: 'smplwise', screen: seg as WiskeyScreen };
  return { kind: 'embed', tab: WISKEY_PANEL_TABS[seg] };
}

export const GROUP_TABS: Record<NavGroup, TabItem[]> = {
  overview: [],
  /** The building tree (CR-007 slice 1); an area screen is a drill-down of it (#/devices/areas/<id>), not a tab.
   * Later slices (screens and remotes, layouts) add tabs here the way `wiskey` grew. */
  devices: [{ id: 'building', label: 'המבנה', href: '#/devices/building' }],
  sites: [
    { id: 'sites', label: 'אתרים ומבנים', href: '#/explore/sites' },
    { id: 'floors', label: 'מפת קומה', href: '#/explore/floors/f0' },
    { id: 'entities', label: 'ישויות HA', href: '#/explore/entities' },
  ],
  /** Entry Center, Activity and People (CR-005 phase 1b), plus WisKey's own screens as embedded tabs (2026-09-28). */
  wiskey: WISKEY_TABS,
  cameras: [
    { id: 'wall', label: 'כל המצלמות', href: '#/live/wall' },
    { id: 'views', label: 'תצוגות שמורות', href: '#/live/views' },
    { id: 'devices', label: 'בריאות מצלמות', href: '#/system/devices' },
  ],
  events: [
    { id: 'events', label: 'מרכז אירועים', href: '#/investigate/events' },
    { id: 'reviews', label: 'Review', href: '#/investigate/reviews' },
    { id: 'search', label: 'חיפוש', href: '#/investigate/search' },
    { id: 'cases', label: 'תיקים', href: '#/investigate/cases' },
    { id: 'rules', label: 'חוקים והתראות', href: '#/investigate/rules' },
    { id: 'exports', label: 'ייצוא', href: '#/investigate/exports' },
  ],
  playback: [
    { id: 'playback', label: 'הקלטות', href: '#/investigate/playback' },
    { id: 'sync', label: 'ניגון מסונכרן', href: '#/investigate/playback/sync' },
    { id: 'history', label: 'מפה היסטורית', href: '#/investigate/floors/f0/history' },
  ],
  settings: [
    { id: 'general', label: 'כללי', href: '#/system/diagnostics' },
    { id: 'access', label: 'משתמשים והרשאות', href: '#/system/access' },
    { id: 'audit', label: 'אודיט', href: '#/system/audit' },
    { id: 'storage', label: 'אחסון', href: '#/system/storage' },
    { id: 'setup', label: 'אשף התקנה', href: '#/system/setup' },
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
      return s[1] === 'devices' ? 'cameras' : 'settings';
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
      return s[1] ?? 'overview';
    case 'devices':
      return 'building';
    case 'cameras':
      return r.mode === 'system' ? 'devices' : s[1] === 'views' ? 'views' : 'wall';
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
// ---------------------------------------------------------------------------------------------
export type AreaId = 'live' | 'explore' | 'investigate' | 'system' | 'wiskey' | 'devices';

export interface AreaEntry {
  id: AreaId;
  icon: IconName;
  label: string;
  href: string;
}

/** WisKey (0.1.103): owner override 2026-09-27 - a genuine top-level area, a peer of live/explore/
 * investigate/system, not nested under explore/מפה as phase 1a had it. Own top-level route namespace
 * (#/wiskey/...), matching how the other three areas each own their prefix. */
export const NAV_A: AreaEntry[] = [
  { id: 'live', icon: 'camera', label: 'לייב', href: '#/live' },
  { id: 'explore', icon: 'map', label: 'מפה', href: '#/explore/sites' },
  { id: 'investigate', icon: 'search', label: 'חקירה', href: '#/investigate/events' },
  /** CR-007 (2026-09-28): "חשמל והתקנים", a 6th area - the short rail label; the page heading carries the full name. */
  { id: 'devices', icon: 'bolt', label: 'חשמל', href: '#/devices/building' },
  { id: 'wiskey', icon: 'door', label: 'WisKey', href: '#/wiskey/overview' },
  { id: 'system', icon: 'system', label: 'מערכת', href: '#/system/diagnostics' },
];

export const AREA_TABS: Record<AreaId, TabItem[]> = {
  devices: [{ id: 'building', label: 'המבנה', href: '#/devices/building' }],
  live: [
    { id: 'overview', label: 'תמונת מצב', href: '#/live' },
    { id: 'wall', label: 'כל המצלמות', href: '#/live/wall' },
    { id: 'views', label: 'תצוגות שמורות', href: '#/live/views' },
    { id: 'devices', label: 'בריאות מצלמות', href: '#/system/devices' },
  ],
  explore: [
    { id: 'sites', label: 'אתרים ומבנים', href: '#/explore/sites' },
    { id: 'floors', label: 'מפת קומה', href: '#/explore/floors/f0' },
    { id: 'entities', label: 'ישויות HA', href: '#/explore/entities' },
  ],
  /** Entry Center/overview, Activity/events and People/people (CR-005 phase 1b), plus WisKey's own screens as embedded
   * tabs (CR-005 recorded decision 2026-09-28) - the same list as GROUP_TABS.wiskey. */
  wiskey: WISKEY_TABS,
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
  ],
  system: [
    { id: 'general', label: 'כללי', href: '#/system/diagnostics' },
    { id: 'access', label: 'משתמשים והרשאות', href: '#/system/access' },
    { id: 'audit', label: 'אודיט', href: '#/system/audit' },
    { id: 'storage', label: 'אחסון', href: '#/system/storage' },
    { id: 'setup', label: 'אשף התקנה', href: '#/system/setup' },
  ],
};

export function areaOf(r: RouteState | null): AreaId | null {
  if (!r?.mode) return null;
  if (r.mode === 'system' && r.segments[1] === 'devices') return 'live';
  return r.mode;
}

export function activeAreaTab(r: RouteState | null): string {
  const a = areaOf(r);
  if (!a || !r) return '';
  const s = r.segments;
  switch (a) {
    case 'live':
      return r.mode === 'system' ? 'devices' : s[1] === 'views' ? 'views' : s[1] === 'wall' || s[1] === 'cameras' ? 'wall' : 'overview';
    case 'explore':
      return s[1] === 'buildings' || s[1] === 'floors' ? 'floors' : s[1] === 'entities' ? 'entities' : 'sites';
    case 'investigate':
      return s[1] === 'floors' ? 'history' : s[1] === 'playback' ? (s[2] === 'sync' ? 'sync' : 'playback') : (s[1] ?? 'events');
    case 'system':
      return !s[1] || s[1] === 'diagnostics' ? 'general' : s[1];
    case 'wiskey':
      return s[1] ?? 'overview';
    case 'devices':
      return 'building';
    default:
      return '';
  }
}

/** Breadcrumb text for the SW A top bar: area › page. */
export function crumbsOf(r: RouteState | null, api = false): string[] {
  const a = areaOf(r);
  if (!a) return [];
  const area = NAV_A.find((n) => n.id === a);
  const tab = AREA_TABS[a].find((x) => x.id === activeAreaTab(r));
  const label = tab ? (api && API_LABELS[tab.href ?? ''] ? API_LABELS[tab.href ?? ''] : tab.label) : '';
  return [area?.label ?? '', label].filter(Boolean);
}

/** Screens that still show demo data only. With a real backend they are hidden from the tab bars until they are
 * built for real (live review 2026-09-17, F1 F3 F4 F5 F6 F7); the shell also redirects their routes. Empty since
 * T054: the access slot became the real WisKey entry center (CR-005). */
export const DEMO_ONLY_HREFS = new Set<string>();

/** Tabs whose real screen has a different name than the design's demo screen. */
export const API_LABELS: Record<string, string> = { '#/investigate/reviews': 'Review · חלונות', '#/investigate/playback/sync': 'ניגון מסונכרן', '#/system/setup': 'חיבורים' };

/** Tabs the owner hid in the settings (0.1.61: the AI search); filled by the shell once the product settings load. */
export const HIDDEN_HREFS = new Set<string>();

/** הגדרות › מסך פתיחה (0.1.68): the route the UI lands on when the address carries none. */
export const START_ROUTES: Record<string, string> = { explore: '/explore/floors/f0', live: '/live', wall: '/live/wall', events: '/investigate/events', playback: '/investigate/playback' };
/** The map area's entries, hidden for everyone with הגדרות › הסתרת המפה (0.1.68). */
export const MAP_HREFS = ['#/explore/sites', '#/explore/floors/f0', '#/explore/entities'];

/** What a tab needs before the shell shows it: any one of the listed permissions, at any scope (owner decision
 * 2026-09-22, 0.1.81 - a viewer used to see every category and land on "אין הרשאה"). Tabs without an entry are
 * always shown; the mapping follows what each screen's first request requires. */
export const TAB_PERMISSIONS: Record<string, string[]> = {
  '#/live/wall': ['video.live'],
  '#/live/views': ['video.live'],
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
};

/** Tabs whose permission counts only when held at installation scope, because the screen and its API check it there
 * and nowhere else: WisKey stations are not mapped to sites or floors, so access.read is installation-wide by design
 * (CR-005). A floor-scoped viewer or a site-scoped site_admin would otherwise see the tab and land on "no permission". */
export const INSTALLATION_ONLY_HREFS = new Set<string>(WISKEY_TABS.map((t) => t.href ?? ''));

/** `installationOnly`: the permission must be held at installation scope, not at any scope. */
export type Can = (permission: string, installationOnly?: boolean) => boolean;

export function tabAllowed(href: string, can?: Can): boolean {
  const need = TAB_PERMISSIONS[href];
  const installationOnly = INSTALLATION_ONLY_HREFS.has(href);
  return !need || !can || need.some((p) => can(p, installationOnly));
}

export function visibleTabs(items: TabItem[], api: boolean, can?: Can): TabItem[] {
  return api ? items.filter((t) => !DEMO_ONLY_HREFS.has(t.href ?? '') && !HIDDEN_HREFS.has(t.href ?? '') && tabAllowed(t.href ?? '', can)).map((t) => (API_LABELS[t.href ?? ''] ? { ...t, label: API_LABELS[t.href ?? ''] } : t)) : items;
}

/** The rail entries the user gets: an area stays while one of its tabs is visible (the live area always - the
 * overview needs nothing), and it opens on its first visible tab when its default page is not one of them. An area is
 * not dropped because its own default page is hidden: with הסתרת המפה the map area used to keep the WisKey tab
 * for this reason (T054); since 0.1.103 WisKey is its own top-level area (not an explore tab) and MAP_HREFS does not
 * name it, so הסתרת המפה has no effect on it at all - moot, confirmed, not stale logic. */
export function visibleAreas(api: boolean, can?: Can): AreaEntry[] {
  return NAV_A.flatMap((n) => {
    const tabs = visibleTabs(AREA_TABS[n.id], api, can);
    if (api && n.id !== 'live' && !tabs.length) return [];
    const first = tabs[0]?.href;
    return [first && !tabs.some((t) => t.href === n.href) ? { ...n, href: first } : n];
  });
}

/** Design B's flat entries (seven since 0.1.103, see the NAV comment), by the same rule as visibleAreas: a group
 * stays while one of its tabs is visible (the overview always) and opens on its first visible tab - it used to be
 * filtered by its own default page only, so a hidden map left "אתרים" pointing at a hidden page. WisKey is now its
 * own group, not a sites sub-tab, so הסתרת המפה no longer interacts with it at all. */
export function visibleGroups(api: boolean, can?: Can): NavEntry[] {
  return NAV.flatMap((n) => {
    if (n.id === 'overview') return [n];
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

