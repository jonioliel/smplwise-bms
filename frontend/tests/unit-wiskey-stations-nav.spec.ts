import { test, expect } from '@playwright/test';
import { parseRoute } from '../src/router';
import { WISKEY_SCREENS, WISKEY_SCREEN_SEGMENT, WISKEY_STATIONS_LABEL, WISKEY_TABS, WISKEY_UI, applyWiskeyUi, setWiskeyEmbedNav, wiskeyRoute, wiskeyScreenOf } from '../src/shell/nav';

// CR-036 slice S6: the native stations screen is wired into the WisKey area's navigation only behind the per-screen switch
// (`access.ui.stations`, default the embedded panel) and takes the route segment of WisKey's own `devices` tab, so the tab keeps
// its place. `?classic=1` is the per-visit way back to the embedded panel ("talk in the classic panel"). Node only.
//   (`parseRoute` reads `window.location.hash` only when no hash is given: every call here passes one.)

const route = (hash: string) => parseRoute(hash);
const reset = () => applyWiskeyUi({});

test.describe('the stations screen in the WisKey area navigation', () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test('the screens with a switch; stations is WisKey\'s devices tab', () => {
    expect([...WISKEY_SCREENS]).toEqual(['overview', 'events', 'people', 'stations', 'schedules']); // S9 added the schedules
    expect(WISKEY_SCREEN_SEGMENT.stations).toBe('devices');
    expect(wiskeyScreenOf('devices')).toBe('stations');
    expect(wiskeyScreenOf('people')).toBe('people');
    expect(wiskeyScreenOf('sync')).toBeNull(); // only ever the embedded panel
    expect(wiskeyScreenOf('stations')).toBeNull(); // the screen id is not a route segment
  });

  test('the embedded panel is the default for the devices tab; the native screen only when the setting says smplwise', () => {
    expect(WISKEY_UI.stations).toBe('wiskey');
    expect(wiskeyRoute(route('#/wiskey/devices'), true)).toEqual({ kind: 'embed', tab: 'devices', tool: null });
    applyWiskeyUi({ 'access.ui.stations': 'smplwise' });
    expect(WISKEY_UI.stations).toBe('smplwise');
    expect(wiskeyRoute(route('#/wiskey/devices'), true)).toEqual({ kind: 'smplwise', screen: 'stations' });
    // the other screens are untouched by it
    expect(wiskeyRoute(route('#/wiskey/people'), true)).toEqual({ kind: 'embed', tab: 'users', tool: null });
    expect(wiskeyRoute(route('#/wiskey/sync'), true)).toEqual({ kind: 'embed', tab: 'sync', tool: null });
    // a value that is not "smplwise" is the embedded panel
    applyWiskeyUi({ 'access.ui.stations': 'garbage' });
    expect(WISKEY_UI.stations).toBe('wiskey');
  });

  test('without a backend (the static demo) the screen shows its demo data', () => {
    expect(wiskeyRoute(route('#/wiskey/devices'), false)).toEqual({ kind: 'smplwise', screen: 'stations' });
  });

  test('?classic=1 shows the embedded panel for this visit even when a screen is set to Arx - and changes no setting', () => {
    applyWiskeyUi({ 'access.ui.stations': 'smplwise', 'access.ui.overview': 'smplwise' });
    expect(wiskeyRoute(route('#/wiskey/overview?classic=1'), true)).toEqual({ kind: 'embed', tab: 'overview', tool: null });
    expect(wiskeyRoute(route('#/wiskey/devices?classic=1'), true)).toEqual({ kind: 'embed', tab: 'devices', tool: null });
    expect(wiskeyRoute(route('#/wiskey/overview'), true)).toEqual({ kind: 'smplwise', screen: 'overview' });
    expect(WISKEY_UI.overview).toBe('smplwise');
    expect(WISKEY_UI.stations).toBe('smplwise');
    // any other value of the flag is not an override
    expect(wiskeyRoute(route('#/wiskey/overview?classic=0'), true)).toEqual({ kind: 'smplwise', screen: 'overview' });
    // the demo has no embedded panel to override to
    expect(wiskeyRoute(route('#/wiskey/overview?classic=1'), false)).toEqual({ kind: 'smplwise', screen: 'overview' });
  });

  test('a station deep link keeps the screen: ?station= is not an override', () => {
    applyWiskeyUi({ 'access.ui.stations': 'smplwise' });
    expect(wiskeyRoute(route('#/wiskey/devices?station=gate'), true)).toEqual({ kind: 'smplwise', screen: 'stations' });
  });

  test('the tab keeps its place and takes the screen\'s own name only while the screen is native', () => {
    const labelOf = () => WISKEY_TABS.find((t) => t.id === 'devices')?.label;
    expect(labelOf()).toBe('עמדות'); // WisKey's own tab (the static list: no embed handshake yet)
    applyWiskeyUi({ 'access.ui.stations': 'smplwise' });
    expect(labelOf()).toBe(WISKEY_STATIONS_LABEL);
    expect(WISKEY_TABS.findIndex((t) => t.id === 'devices')).toBe(3); // the same place in the row
    applyWiskeyUi({ 'access.ui.stations': 'wiskey' });
    expect(labelOf()).toBe('עמדות'); // switching back restores WisKey's label (the shared tab objects are never edited)
  });

  test('with an embed catalog that lacks the devices tab, the native screen is added at its usual place', () => {
    setWiskeyEmbedNav({ catalog: { tabs: [{ id: 'overview', label: 'מרכז' }, { id: 'users', label: 'אנשים' }, { id: 'events', label: 'פעילות' }, { id: 'sync', label: 'סנכרון' }] } as never });
    expect(WISKEY_TABS.map((t) => t.id)).not.toContain('devices');
    applyWiskeyUi({ 'access.ui.stations': 'smplwise' });
    const ids = WISKEY_TABS.map((t) => t.id);
    expect(ids).toContain('devices');
    expect(ids.indexOf('devices')).toBeGreaterThan(ids.indexOf('events')); // after the screens before it in the static order, before sync
    expect(ids.indexOf('devices')).toBeLessThan(ids.indexOf('sync'));
    expect(WISKEY_TABS.find((t) => t.id === 'devices')?.label).toBe(WISKEY_STATIONS_LABEL);
    setWiskeyEmbedNav({ catalog: null });
  });
});
