import { test, expect } from '@playwright/test';
import { parseRoute } from '../src/router';
import { applyWiskeyUi, wiskeyRoute } from '../src/shell/nav';
import { CLASSIC_EDIT_HREF } from '../src/access-control/schedules-logic';
import {
  DEEP_LINKS,
  PANEL_TABS,
  PANEL_TOOLS,
  PLACES,
  ROOT,
  ROOT_HREF,
  deepLinkHref,
  BRIDGED,
  deepLinksFor,
  linkFor,
  deepTarget,
  inCatalog,
  isDeepPlace,
  mayOpenPanel,
  targetHref,
  type DeepLinkEntry,
  type DeepPlace,
} from '../src/wiskey/deep-links';

// WISKEY-DEEPLINKS-2382 (integration plan task T18): the one table of links from Arx places into the embedded intercom panel.
// Node only: the table, the fallback, the permission rule, and - through the shell's own router (shell/nav.ts `wiskeyRoute`) - that
// every link lands on exactly the panel tab / tool it names, whichever screens the owner switched to Arx.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-deeplinks.spec.ts

/** The router of WisKey 2.0.1-rc.10 (`custom_components/hikvision_intercom/frontend/panel.js`, read-only extract of
 * origin/codex/wiskey-mac-m12-policy-b-2026-11-02): top-level tabs and the management-tool ids its `br()` accepts. */
const RC10_TABS = ['overview', 'users', 'devices', 'events', 'sync', 'tools', 'camera_wall'];
const RC10_TOOLS = ['clock_options', 'media_options', 'whatsapp_templates', 'profile_options', 'permission_directory', 'workflow_center', 'platform_center', 'operations_center', 'investigations', 'camera_wall', 'identity_lifecycle', 'data_quality', 'access_reviews', 'access_comparison', 'guest_templates', 'visit_requests', 'fleet_alerts', 'users', 'devices', 'sync', 'audit', 'health', 'schedules', 'access_control'];
/** The rows of the plan's capability matrix this task must cover: every "embedded panel only" (E) row, and the missing operator actions
 * (M) the panel already has. Rows 13, 24 and 60 (M) have no panel screen either; X rows without a panel address are listed as gaps. */
const E_ROWS = [25, 27, 28, 29, 38, 45, 47, 49, 50, 51, 77, 80, 82, 89, 98];
const M_ROWS_IN_PANEL = [3, 34, 36];
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|\bHA\b/i;

const route = (href: string) => wiskeyRoute(parseRoute(href), true);
/** WISKEY-OPS-VIEWS-2400 (plan T11): the capabilities whose native screen is Settings › תפעול האינטרקום. */
const OPS_NATIVE_IDS = ['operations.center', 'operations.investigations', 'events.report', 'health.fleet', 'audit.panel'];
/** WISKEY-ACCESS-DIAG-2400 (plan task T10): the capabilities a native Arx screen took over ("אבחון הרשאות"), with its route. */
const NATIVE: Record<string, string> = {
  'access.reviews': '#/wiskey/access-diag?view=reviews',
  'access.compare': '#/wiskey/access-diag?view=compare',
  'people.quality': '#/wiskey/access-diag?view=quality',
  'access.scenario': '#/wiskey/access-diag',
  'stations.permission_audit': '#/wiskey/access-diag?view=audit',
};
const ADMIN = { panel: true, admin: true } as const;

test.describe('the deep-link table', () => {
  test.afterAll(() => applyWiskeyUi({}));

  test('every entry points at a tab or a tool the rc.10 panel router knows, a tool only under tools', () => {
    expect([...PANEL_TABS]).toEqual(RC10_TABS);
    for (const t of PANEL_TOOLS) expect(RC10_TOOLS).toContain(t);
    for (const [id, e] of Object.entries(DEEP_LINKS)) {
      expect(PANEL_TABS, id).toContain(e.target.tab);
      if (e.target.tool !== null) {
        expect(e.target.tab, id).toBe('tools');
        expect(PANEL_TOOLS, id).toContain(e.target.tool);
      } else {
        expect(e.target.tab, `${id}: a bare "tools" link would be the hub, not a capability`).not.toBe('tools');
      }
    }
  });

  test('the plan rows are covered: every E row and the M rows the panel already has', () => {
    const covered = new Set(Object.values(DEEP_LINKS).flatMap((e) => e.rows));
    for (const r of [...E_ROWS, ...M_ROWS_IN_PANEL]) expect(covered.has(r), `row ${r}`).toBe(true);
  });

  test('labels are Hebrew and never name the platform; every place lists known ids, each address once', () => {
    for (const [id, e] of Object.entries(DEEP_LINKS)) {
      expect(e.label, id).toMatch(/[֐-׿]/);
      expect(e.label, id).not.toMatch(BANNED);
    }
    for (const [place, ids] of Object.entries(PLACES)) {
      expect(isDeepPlace(place)).toBe(true);
      for (const id of ids) expect(DEEP_LINKS[id], `${place}: ${id}`).toBeTruthy();
      // WISKEY-CONFLICTS-2400: each place offers one link per DESTINATION (a native screen's address, else the panel's)
      const hrefs = ids.map((id) => linkFor(id));
      expect(new Set(hrefs).size, place).toBe(hrefs.length);
    }
  });

  test('the addresses: a tool under #/wiskey/tools/<tool>; a tab that can be a native screen with ?classic=1; users is "people"', () => {
    expect(deepLinkHref('alerts.act')).toBe('#/wiskey/tools/fleet_alerts');
    expect(deepLinkHref('schedules.edit')).toBe('#/wiskey/tools/schedules');
    expect(deepLinkHref('clock.settings')).toBe('#/wiskey/tools/clock_options');
    expect(deepLinkHref('profiles.edit')).toBe('#/wiskey/tools/profile_options');
    expect(deepLinkHref('permissions.panel')).toBe('#/wiskey/tools/access_control');
    expect(deepLinkHref('sync.run')).toBe('#/wiskey/sync');
    expect(deepLinkHref('stations.technical')).toBe('#/wiskey/devices?classic=1');
    expect(deepLinkHref('people.unmanaged')).toBe('#/wiskey/people?classic=1');
    expect(deepLinkHref('events.report')).toBe('#/wiskey/events?classic=1');
    expect(targetHref({ tab: 'camera_wall', tool: null })).toBe('#/wiskey/camera_wall');
    // the schedules screen's "edit" button uses the table: the schedules tool itself (it was the tools hub)
    expect(CLASSIC_EDIT_HREF).toBe('#/wiskey/tools/schedules');
  });

  test('an id the table does not know falls back to the panel root, never to a guessed address', () => {
    for (const id of ['', 'nope', 'tools', 'hold_open_v9', '__proto__', 'constructor', 'toString']) {
      expect(deepTarget(id), id).toEqual(ROOT);
      expect(deepLinkHref(id), id).toBe(ROOT_HREF);
    }
    expect(route(ROOT_HREF)).toEqual({ kind: 'embed', tab: 'overview', tool: null });
    expect(deepLinksFor('nowhere', ADMIN)).toEqual([]);
  });

  for (const ui of ['wiskey', 'smplwise'] as const) {
    test(`every link opens the embedded panel on exactly its tab / tool (Arx screens set to ${ui})`, () => {
      applyWiskeyUi({ 'access.ui.overview': ui, 'access.ui.events': ui, 'access.ui.people': ui, 'access.ui.stations': ui, 'access.ui.schedules': ui });
      for (const [id, e] of Object.entries(DEEP_LINKS)) {
        expect(route(deepLinkHref(id)), id).toEqual({ kind: 'embed', tab: e.target.tab, tool: e.target.tool });
      }
      applyWiskeyUi({});
    });
  }
});

test.describe('who gets the links', () => {
  test('the area rule: a backend, access.read at installation scope, and the area not hidden', () => {
    expect(mayOpenPanel({ api: true, accessReadInstallation: true, hidden: false })).toBe(true);
    expect(mayOpenPanel({ api: false, accessReadInstallation: true, hidden: false })).toBe(false);
    expect(mayOpenPanel({ api: true, accessReadInstallation: false, hidden: false })).toBe(false);
    expect(mayOpenPanel({ api: true, accessReadInstallation: true, hidden: true })).toBe(false);
  });

  test('no panel, no panel link - in every place; a native screen follows its own permission', () => {
    for (const place of Object.keys(PLACES) as DeepPlace[]) {
      expect(deepLinksFor(place, { panel: false, admin: true }).filter((l) => l.kind === 'panel'), place).toEqual([]);
      expect(deepLinksFor(place, { panel: false, admin: true, can: () => false }), place).toEqual([]);
    }
    // WISKEY-PROFILES-EDIT-2390 (2.39.0 train): the groups and fields editor is native - offered without the panel to whoever holds its permission
    const holds = (p: string) => p === 'access.people.manage';
    expect(deepLinksFor('settings-groups', { panel: false, admin: false, can: holds }).map((l) => `${l.id}:${l.kind}`)).toEqual(['profiles.edit:native']);
  });

  test('the panel\'s administrator-only tools are offered to an access-control administrator only', () => {
    const ids = (admin: boolean) => deepLinksFor('settings-status', { panel: true, admin }).map((l) => l.id);
    expect(ids(true)).toEqual(['sync.run', 'alerts.act', 'health.fleet', 'clock.settings', 'operations.center', 'operations.investigations', 'platform.center']);
    // WISKEY-OPS-VIEWS-2400: the investigations timeline is a native Arx view now (access.read): no longer the panel's administrator tool
    expect(ids(false)).toEqual(['sync.run', 'alerts.act', 'health.fleet', 'clock.settings', 'operations.center', 'operations.investigations']);
    expect(deepLinksFor('settings-policy', { panel: true, admin: false }).map((l) => l.id)).toEqual(['permissions.directory', 'media.settings']);
  });

  test('with the panel\'s handshake catalog known, a link the panel would not open for this operator is not offered', () => {
    const catalog = { tabs: ['overview', 'users', 'sync', 'tools'].map((id) => ({ id })), tools: ['health', 'profile_options'].map((id) => ({ id })) };
    expect(inCatalog({ tab: 'devices', tool: null }, catalog)).toBe(false);
    expect(inCatalog({ tab: 'tools', tool: 'health' }, catalog)).toBe(true);
    expect(inCatalog({ tab: 'tools', tool: 'clock_options' }, catalog)).toBe(false);
    expect(inCatalog({ tab: 'devices', tool: null }, null)).toBe(true); // no catalog yet: the panel decides (and falls back by itself)
    expect(deepLinksFor('station', { ...ADMIN, catalog }).map((l) => l.id)).toEqual(['sync.run', 'health.fleet']);
    // WISKEY-ACCESS-DIAG-2400: the native "אבחון הרשאות" links do not depend on the panel's catalog
    expect(deepLinksFor('people', { ...ADMIN, catalog }).map((l) => l.id)).toEqual(['people.unmanaged', 'profiles.edit', 'access.reviews', 'access.compare', 'people.quality']);
  });

  test('what each place offers an administrator (the order shown)', () => {
    const ids = (p: DeepPlace) => deepLinksFor(p, ADMIN).map((l) => `${l.id}=${l.href}`);
    expect(ids('station')).toEqual(['stations.technical=#/wiskey/devices?classic=1', 'sync.run=#/wiskey/sync', 'health.fleet=#/system/intercom-operations/capacity', 'clock.settings=#/wiskey/tools/clock_options']);
    expect(ids('stations')).toEqual(['stations.technical=#/wiskey/devices?classic=1', 'sync.run=#/wiskey/sync', 'conflicts.resolve=#/wiskey/conflicts', 'alerts.act=#/wiskey/alerts', 'health.fleet=#/system/intercom-operations/capacity',
      'access.scenario=#/wiskey/access-diag', 'stations.permission_audit=#/wiskey/access-diag?view=audit']);
    expect(ids('people')).toEqual([
      'people.unmanaged=#/wiskey/people?classic=1',
      'profiles.edit=#/wiskey/profiles', // native since WISKEY-PROFILES-EDIT-2390 (2.39.0 train)
      'people.lifecycle=#/wiskey/tools/identity_lifecycle',
      'access.reviews=#/wiskey/access-diag?view=reviews',
      'access.compare=#/wiskey/access-diag?view=compare',
      'people.quality=#/wiskey/access-diag?view=quality',
    ]);
    expect(ids('schedules')).toEqual(['schedules.edit=#/wiskey/tools/schedules', 'stations.technical=#/wiskey/devices?classic=1']);
    expect(ids('settings-audit')).toEqual(['audit.panel=#/system/intercom-operations/exports', 'events.report=#/system/intercom-operations/events']);
    expect(ids('settings-groups')).toEqual(['profiles.edit=#/wiskey/profiles']);
    expect(ids('settings-messaging')).toEqual(['messaging.templates=#/wiskey/tools/whatsapp_templates']);
    expect(ids('settings-policy')).toEqual(['permissions.panel=#/wiskey/tools/access_control', 'permissions.directory=#/wiskey/tools/permission_directory', 'media.settings=#/wiskey/tools/media_options', 'workflows.center=#/wiskey/tools/workflow_center']);
  });
});

test.describe('keyed by capability: a native screen replaces a link without touching the callers', () => {
  test('linkFor gives the native screen where one exists, else the panel link, the panel root for an unknown capability', () => {
    expect(linkFor('schedules.edit')).toBe('#/wiskey/tools/schedules');
    expect(linkFor('profiles.edit')).toBe('#/wiskey/profiles'); // WISKEY-PROFILES-EDIT-2390
    expect(deepLinkHref('profiles.edit')).toBe('#/wiskey/tools/profile_options'); // the panel address stays known
    expect(linkFor('no.such')).toBe(ROOT_HREF);
    for (const id of Object.keys(DEEP_LINKS)) expect(linkFor(id), id).toBe(DEEP_LINKS[id].native?.href ?? deepLinkHref(id));
    // WISKEY-CONFLICTS-2400: the fleet alerts and the conflicts
    expect(linkFor('alerts.act')).toBe('#/wiskey/alerts');
    expect(linkFor('conflicts.resolve')).toBe('#/wiskey/conflicts');
  });

  test('the temporary links of the owner Q4 / Q7 (native screens to come) are marked', () => {
    expect([...BRIDGED].sort()).toEqual(['clock.settings', 'platform.center', 'schedules.edit', 'stations.technical']);
    expect(DEEP_LINKS['schedules.edit'].bridge).toBe('Q4');
    expect(DEEP_LINKS['profiles.edit'].bridge).toBeUndefined(); // retired: the native screen exists (WISKEY-PROFILES-EDIT-2390)
    for (const id of ['clock.settings', 'platform.center', 'stations.technical']) expect(DEEP_LINKS[id].bridge, id).toBe('Q7');
    expect(DEEP_LINKS['profiles.edit'].native).toEqual({ href: '#/wiskey/profiles', need: ['access.people.manage'] });
    expect(DEEP_LINKS['profiles.edit'].rows).toEqual([26, 27]);
    const TRIAGE_NATIVE_IDS = ['alerts.act', 'conflicts.resolve']; // WISKEY-CONFLICTS-2400
    for (const id of TRIAGE_NATIVE_IDS) expect(DEEP_LINKS[id].native!.need).toEqual(['access.admin.read', 'access.stations.manage', 'system.configure']);
    for (const id of Object.keys(NATIVE)) expect(DEEP_LINKS[id].native?.href, id).toBe(NATIVE[id]); // WISKEY-ACCESS-DIAG-2400
    for (const id of Object.keys(DEEP_LINKS).filter((x) => x !== 'profiles.edit' && !OPS_NATIVE_IDS.includes(x) && !TRIAGE_NATIVE_IDS.includes(x) && !(x in NATIVE))) expect(DEEP_LINKS[id].native, id).toBeUndefined();
  });

  test('once an entry carries a native route: linkFor and every place follow; the panel rule and catalog no longer apply to it', () => {
    const table: Record<string, DeepLinkEntry> = { ...DEEP_LINKS, 'schedules.edit': { ...DEEP_LINKS['schedules.edit'], native: { href: '#/access/schedules/edit', need: ['access.schedules.manage'] } } };
    expect(linkFor('schedules.edit', table)).toBe('#/access/schedules/edit');
    const holds = (p: string) => p === 'access.schedules.manage';
    const links = deepLinksFor('schedules', { panel: true, admin: true, can: holds }, table);
    expect(links.map((l) => `${l.id}:${l.kind}=${l.href}`)).toEqual(['schedules.edit:native=#/access/schedules/edit', 'stations.technical:panel=#/wiskey/devices?classic=1']);
    // no panel for this caller: the native link stays, the panel link goes
    expect(deepLinksFor('schedules', { panel: false, admin: false, can: holds }, table).map((l) => l.id)).toEqual(['schedules.edit']);
    // the native screen's permission is not held: not offered
    expect(deepLinksFor('schedules', { panel: false, admin: false, can: () => false }, table)).toEqual([]);
  });
});

test.describe('WISKEY-OPS-VIEWS-2400: the operations views replace five panel links', () => {
  test('each of the five goes to its native view, behind access.read; the panel address stays in the entry', () => {
    const views: Record<string, string> = { 'operations.center': 'operations', 'operations.investigations': 'investigations', 'events.report': 'events', 'health.fleet': 'capacity', 'audit.panel': 'exports' };
    expect(Object.keys(views).sort()).toEqual([...OPS_NATIVE_IDS].sort());
    for (const [id, view] of Object.entries(views)) {
      expect(DEEP_LINKS[id].native, id).toEqual({ href: `#/system/intercom-operations/${view}`, need: ['access.read'], installation: true });
      expect(linkFor(id), id).toBe(`#/system/intercom-operations/${view}`);
      expect(route(deepLinkHref(id)).kind, id).toBe('embed'); // the panel address is still known (deepLinkHref)
    }
    const holds = (p: string) => p === 'access.read';
    const audit = deepLinksFor('settings-audit', { panel: false, admin: false, can: holds });
    expect(audit.map((l) => `${l.id}:${l.kind}`)).toEqual(['audit.panel:native', 'events.report:native']);
    expect(deepLinksFor('settings-audit', { panel: true, admin: true, can: () => false })).toEqual([]);
    // access.read held only on some station scope: the native views (installation-wide) are not offered
    expect(deepLinksFor('settings-audit', { panel: false, admin: false, can: holds, canInstallation: () => false })).toEqual([]);
    expect(deepLinksFor('settings-audit', { panel: false, admin: false, can: holds, canInstallation: holds }).map((l) => l.id)).toEqual(['audit.panel', 'events.report']);
  });
});
