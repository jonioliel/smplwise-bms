import { test, expect } from '@playwright/test';
import { parseRoute } from '../src/router';
import { NATIVE_WISKEY_TABS, WISKEY_SCHEDULES_LABEL, WISKEY_SCREEN_SEGMENT, WISKEY_TABS, WISKEY_UI, applyWiskeyUi, setWiskeyEmbedNav, tabAllowed, wiskeyRoute, wiskeyScreenOf, type Can } from '../src/shell/nav';

// CR-036 slice S9: the read-only schedules screen ("לוחות זמנים") is a NATIVE-ONLY tab - the embedded panel has no top-level tab for
// it - so with its switch off (the default, `access.ui.schedules` = wiskey) nothing in the row changes for anyone; switched to Arx the
// tab appears after "תחנות ודלתות" and needs `access.stations.read` at any scope. Node only.
//   (`parseRoute` reads `window.location.hash` only when no hash is given: every call here passes one.)

const route = (hash: string) => parseRoute(hash);
const reset = () => {
  setWiskeyEmbedNav({ catalog: null });
  applyWiskeyUi({});
};
const person = (installation: string[], any: string[] = installation): Can => (permission, installationOnly = false) => (installationOnly ? installation : any).includes(permission);
const ids = () => WISKEY_TABS.map((t) => t.id);
const SCHEDULES = '#/wiskey/schedules';

test.describe('the schedules screen in the WisKey area navigation', () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test('its own segment, and the switch is off by default: no tab, the row is exactly as before', () => {
    expect(WISKEY_SCREEN_SEGMENT.schedules).toBe('schedules');
    expect(wiskeyScreenOf('schedules')).toBe('schedules');
    expect(WISKEY_UI.schedules).toBe('wiskey');
    expect(ids()).toEqual(['overview', 'events', 'people', 'devices', 'sync', 'health', 'audit', 'tools']);
    // a typed address with the switch off is the embedded panel (the panel shows its default for an id it does not know)
    expect(wiskeyRoute(route('#/wiskey/schedules'), true)).toEqual({ kind: 'embed', tab: 'schedules', tool: null });
  });

  test('switched to Arx: the tab appears after the stations, labelled for what it shows, and routes to the native screen', () => {
    applyWiskeyUi({ 'access.ui.schedules': 'smplwise' });
    expect(WISKEY_UI.schedules).toBe('smplwise');
    expect(ids()).toEqual(['overview', 'events', 'people', 'devices', 'schedules', 'sync', 'health', 'audit', 'tools']);
    const tab = WISKEY_TABS.find((t) => t.id === 'schedules');
    expect(tab).toEqual({ id: 'schedules', label: WISKEY_SCHEDULES_LABEL, href: SCHEDULES });
    expect(wiskeyRoute(route('#/wiskey/schedules'), true)).toEqual({ kind: 'smplwise', screen: 'schedules' });
    expect(wiskeyRoute(route('#/wiskey/schedules?door=entry-a:1'), true)).toEqual({ kind: 'smplwise', screen: 'schedules' });
    // the per-visit classic override still shows the embedded panel
    expect(wiskeyRoute(route('#/wiskey/schedules?classic=1'), true).kind).toBe('embed');
    // switching back removes it again
    applyWiskeyUi({ 'access.ui.schedules': 'wiskey' });
    expect(ids()).not.toContain('schedules');
  });

  test('a value that is not "smplwise" keeps the switch off', () => {
    applyWiskeyUi({ 'access.ui.schedules': 'native' });
    expect(WISKEY_UI.schedules).toBe('wiskey');
    expect(ids()).not.toContain('schedules');
  });

  test('with an embed catalog the tab is added at its place (after the stations, before the panel\'s own tabs)', () => {
    setWiskeyEmbedNav({ catalog: { tabs: [{ id: 'overview', label: 'מרכז' }, { id: 'users', label: 'אנשים' }, { id: 'devices', label: 'עמדות' }, { id: 'sync', label: 'סנכרון' }, { id: 'tools', label: 'ניהול' }] } as never });
    expect(ids()).not.toContain('schedules');
    applyWiskeyUi({ 'access.ui.schedules': 'smplwise' });
    const row = ids();
    expect(row.indexOf('schedules')).toBe(row.indexOf('devices') + 1);
    expect(row.indexOf('schedules')).toBeLessThan(row.indexOf('sync'));
  });

  test('the tab needs access.stations.read at ANY scope while native (the server decides per station)', () => {
    applyWiskeyUi({ 'access.ui.schedules': 'smplwise' });
    expect(NATIVE_WISKEY_TABS[SCHEDULES]).toEqual({ screen: 'schedules', need: ['access.stations.read'] });
    expect(tabAllowed(SCHEDULES, person(['access.read', 'access.stations.read']))).toBe(true); // operator
    expect(tabAllowed(SCHEDULES, person([], ['access.read', 'access.stations.read']))).toBe(true); // scoped to one station
    expect(tabAllowed(SCHEDULES, person(['access.read']))).toBe(false); // a viewer is not offered a tab that would say "not available"
    expect(tabAllowed(SCHEDULES, person([]))).toBe(false);
  });

  test('without a backend (the static demo) the screen shows its demo data', () => {
    expect(wiskeyRoute(route('#/wiskey/schedules'), false)).toEqual({ kind: 'smplwise', screen: 'schedules' });
  });
});
