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
  deepLinksFor,
  deepTarget,
  inCatalog,
  isDeepPlace,
  mayOpenPanel,
  targetHref,
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
      const hrefs = ids.map(deepLinkHref);
      expect(new Set(hrefs).size, place).toBe(hrefs.length);
    }
  });

  test('the addresses: a tool under #/wiskey/tools/<tool>; a tab that can be a native screen with ?classic=1; users is "people"', () => {
    expect(deepLinkHref('fleet_alerts')).toBe('#/wiskey/tools/fleet_alerts');
    expect(deepLinkHref('device_schedules')).toBe('#/wiskey/tools/schedules');
    expect(deepLinkHref('clock_settings')).toBe('#/wiskey/tools/clock_options');
    expect(deepLinkHref('profile_fields')).toBe('#/wiskey/tools/profile_options');
    expect(deepLinkHref('panel_permissions')).toBe('#/wiskey/tools/access_control');
    expect(deepLinkHref('sync')).toBe('#/wiskey/sync');
    expect(deepLinkHref('station_settings')).toBe('#/wiskey/devices?classic=1');
    expect(deepLinkHref('people_panel')).toBe('#/wiskey/people?classic=1');
    expect(deepLinkHref('events_report')).toBe('#/wiskey/events?classic=1');
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

  test('no panel, no link - in every place', () => {
    for (const place of Object.keys(PLACES) as DeepPlace[]) expect(deepLinksFor(place, { panel: false, admin: true })).toEqual([]);
  });

  test('the panel\'s administrator-only tools are offered to an access-control administrator only', () => {
    const ids = (admin: boolean) => deepLinksFor('settings-status', { panel: true, admin }).map((l) => l.id);
    expect(ids(true)).toEqual(['sync', 'fleet_alerts', 'health', 'clock_settings', 'operations_center', 'investigations', 'platform_center']);
    expect(ids(false)).toEqual(['sync', 'fleet_alerts', 'health', 'clock_settings', 'operations_center']);
    expect(deepLinksFor('settings-policy', { panel: true, admin: false }).map((l) => l.id)).toEqual(['permission_directory', 'media_options']);
  });

  test('with the panel\'s handshake catalog known, a link the panel would not open for this operator is not offered', () => {
    const catalog = { tabs: ['overview', 'users', 'sync', 'tools'].map((id) => ({ id })), tools: ['health', 'profile_options'].map((id) => ({ id })) };
    expect(inCatalog({ tab: 'devices', tool: null }, catalog)).toBe(false);
    expect(inCatalog({ tab: 'tools', tool: 'health' }, catalog)).toBe(true);
    expect(inCatalog({ tab: 'tools', tool: 'clock_options' }, catalog)).toBe(false);
    expect(inCatalog({ tab: 'devices', tool: null }, null)).toBe(true); // no catalog yet: the panel decides (and falls back by itself)
    expect(deepLinksFor('station', { ...ADMIN, catalog }).map((l) => l.id)).toEqual(['sync', 'health']);
    expect(deepLinksFor('people', { ...ADMIN, catalog }).map((l) => l.id)).toEqual(['people_panel', 'profile_fields']);
  });

  test('what each place offers an administrator (the order shown)', () => {
    const ids = (p: DeepPlace) => deepLinksFor(p, ADMIN).map((l) => `${l.id}=${l.href}`);
    expect(ids('station')).toEqual(['station_settings=#/wiskey/devices?classic=1', 'sync=#/wiskey/sync', 'health=#/wiskey/tools/health', 'clock_settings=#/wiskey/tools/clock_options']);
    expect(ids('stations')).toEqual(['station_settings=#/wiskey/devices?classic=1', 'sync=#/wiskey/sync', 'fleet_alerts=#/wiskey/tools/fleet_alerts', 'health=#/wiskey/tools/health']);
    expect(ids('people')).toEqual([
      'people_panel=#/wiskey/people?classic=1',
      'profile_fields=#/wiskey/tools/profile_options',
      'identity_lifecycle=#/wiskey/tools/identity_lifecycle',
      'access_reviews=#/wiskey/tools/access_reviews',
      'access_comparison=#/wiskey/tools/access_comparison',
      'data_quality=#/wiskey/tools/data_quality',
    ]);
    expect(ids('schedules')).toEqual(['device_schedules=#/wiskey/tools/schedules', 'station_settings=#/wiskey/devices?classic=1']);
    expect(ids('settings-audit')).toEqual(['panel_audit=#/wiskey/tools/audit', 'events_report=#/wiskey/events?classic=1']);
    expect(ids('settings-groups')).toEqual(['profile_fields=#/wiskey/tools/profile_options']);
    expect(ids('settings-messaging')).toEqual(['whatsapp_templates=#/wiskey/tools/whatsapp_templates']);
    expect(ids('settings-policy')).toEqual(['panel_permissions=#/wiskey/tools/access_control', 'permission_directory=#/wiskey/tools/permission_directory', 'media_options=#/wiskey/tools/media_options', 'workflow_center=#/wiskey/tools/workflow_center']);
  });
});
