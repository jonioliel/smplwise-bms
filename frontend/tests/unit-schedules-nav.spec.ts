import { test, expect } from '@playwright/test';
import {
  AREA_TABS,
  AUTOMATIONS_HREF,
  DEVICES_TABS,
  HIDDEN_HREFS,
  INSTALLATION_ONLY_HREFS,
  SCHEDULES_HREF,
  SCHEDULES_SETTINGS_HREF,
  TAB_SECTIONS,
  activeAreaTab,
  applySchedulesHidden,
  applyTabsConfig,
  crumbsOf,
  isHomeEditRoute,
  landingTarget,
  onTabsConfig,
  sectionIdOf,
  settingsEntry,
  tabAllowed,
  visibleAreas,
  visibleTabs,
  type Can,
} from '../src/shell/nav';
import type { RouteState } from '../src/router';

// CR-014: the home area's two tabs ("מבט על" | "תזמונים"), their permission gate, the `schedules.enabled` setting, ui.tabs and the
// layout editor's `?edit=1` rule. Node only - the same module the shell uses.

const only = (...perms: string[]): Can => (p) => perms.includes(p);
const ids = (items: { id: string }[]) => items.map((i) => i.id);

function route(path: string): RouteState {
  const [p, q] = path.replace(/^#/, '').split('?');
  const segments = p.split('/').filter(Boolean);
  return { path: p, segments, params: new URLSearchParams(q ?? ''), mode: segments[0] as RouteState['mode'] };
}

test.afterEach(() => {
  applyTabsConfig({});
  applySchedulesHidden({});
});

test('the home area has one tab array; its hrefs and the section registry', () => {
  expect(AREA_TABS.devices).toBe(DEVICES_TABS);
  // CR-017: "אוטומציות" is the third tab (its gate and setting are tested in unit-automations-list.spec.ts)
  expect(DEVICES_TABS.map((t) => t.href)).toEqual(['#/devices/building', SCHEDULES_HREF, AUTOMATIONS_HREF]);
  expect(DEVICES_TABS.map((t) => t.label)).toEqual(['מבט על', 'תזמונים', 'אוטומציות']);
  expect(sectionIdOf(DEVICES_TABS)).toBe('devices');
  const def = TAB_SECTIONS.find((s) => s.id === 'devices');
  expect(def?.label).toBe('ראשי');
  expect(ids(def!.tabs())).toEqual(['building', 'schedules', 'automations']);
  expect(ids(AREA_TABS.system)).toContain('schedules');
});

test('the schedules tab needs schedule.view or schedule.manage at any scope; the settings tab system.configure at the installation', () => {
  expect(ids(visibleTabs(DEVICES_TABS, true, only('devices.read')))).toEqual(['building']);
  expect(ids(visibleTabs(DEVICES_TABS, true, only('devices.read', 'schedule.view')))).toEqual(['building', 'schedules']);
  expect(ids(visibleTabs(DEVICES_TABS, true, only('devices.read', 'schedule.manage')))).toEqual(['building', 'schedules']);
  expect(ids(visibleTabs(DEVICES_TABS, true, only('schedule.view')))).toEqual(['schedules']); // no devices.read: only the schedules
  expect(ids(visibleTabs(DEVICES_TABS, true, only('schedule.sensitive')))).toEqual([]); // sensitive alone reads nothing
  expect(tabAllowed(SCHEDULES_SETTINGS_HREF, only('system.configure'))).toBe(true);
  expect(tabAllowed(SCHEDULES_SETTINGS_HREF, only('schedule.manage'))).toBe(false);
  expect(INSTALLATION_ONLY_HREFS.has(SCHEDULES_SETTINGS_HREF)).toBe(true);
  // a floor-scoped holder of system.configure does not get the settings tab (installation-wide only)
  const scoped: Can = (p, inst) => p === 'system.configure' && !inst;
  expect(tabAllowed(SCHEDULES_SETTINGS_HREF, scoped)).toBe(false);
  expect(visibleTabs(AREA_TABS.system, true, only('system.configure')).some((t) => t.id === 'schedules')).toBe(true);
  expect(settingsEntry(true, only('schedule.manage'))).toBeNull();
});

test('the static demo shows every tab whatever the permissions', () => {
  expect(ids(visibleTabs(DEVICES_TABS, false))).toEqual(['building', 'schedules', 'automations']);
});

test('a user without schedule rights sees one tab (so no tab row): the home screen exactly as before', () => {
  expect(visibleTabs(DEVICES_TABS, true, only('devices.read')).length).toBe(1);
});

test('the home area stays in the rail and opens on the schedules when they are the only tab', () => {
  const can = only('schedule.manage');
  const area = visibleAreas(true, can).find((a) => a.id === 'devices');
  expect(area?.href).toBe(SCHEDULES_HREF);
  expect(visibleAreas(true, only('devices.read')).find((a) => a.id === 'devices')?.href).toBe('#/devices/building');
  // nothing of the home area at all: the area leaves the rail
  expect(visibleAreas(true, only('video.live')).some((a) => a.id === 'devices')).toBe(false);
  // the landing target follows: the start screen is not visible to this user, so their first area opens
  expect(landingTarget('/devices/building', true, can, ['devices', 'security', 'explore', 'wiskey'])).toBe('/devices/schedules');
});

test('schedules.enabled = false hides the tab for everyone (HIDDEN_HREFS) and back; the navigation hears each change once', () => {
  let heard = 0;
  const stop = onTabsConfig(() => (heard += 1));
  const can = only('devices.read', 'schedule.view');
  expect(applySchedulesHidden({ 'schedules.enabled': 'false' })).toBe(true);
  expect(HIDDEN_HREFS.has(SCHEDULES_HREF)).toBe(true);
  expect(ids(visibleTabs(DEVICES_TABS, true, can))).toEqual(['building']);
  applySchedulesHidden({ 'schedules.enabled': 'false' }); // unchanged: nobody is told again
  expect(heard).toBe(1);
  expect(applySchedulesHidden({ 'schedules.enabled': 'true' })).toBe(false);
  expect(ids(visibleTabs(DEVICES_TABS, true, can))).toEqual(['building', 'schedules']);
  expect(heard).toBe(2);
  expect(applySchedulesHidden(undefined)).toBe(false); // absent = on
  expect(applySchedulesHidden({ 'schedules.enabled': false })).toBe(true); // a stored boolean reads like the string
  stop();
});

test('ui.tabs `devices`: order and hidden; "תזמונים" becomes the entry when "מבט על" is hidden', () => {
  const can = only('devices.read', 'schedule.view');
  applyTabsConfig({ 'ui.tabs': { devices: { order: ['schedules', 'building'], hidden: [] } } });
  expect(ids(visibleTabs(DEVICES_TABS, true, can))).toEqual(['schedules', 'building']);
  expect(visibleAreas(true, can).find((a) => a.id === 'devices')?.href).toBe(SCHEDULES_HREF);
  applyTabsConfig({ 'ui.tabs': { devices: { order: [], hidden: ['building'] } } });
  expect(ids(visibleTabs(DEVICES_TABS, true, can))).toEqual(['schedules']);
  expect(visibleAreas(true, can).find((a) => a.id === 'devices')?.href).toBe(SCHEDULES_HREF);
  // hiding both never empties the row: the permitted tabs are shown after all
  applyTabsConfig({ 'ui.tabs': { devices: { order: [], hidden: ['building', 'schedules'] } } });
  expect(ids(visibleTabs(DEVICES_TABS, true, can))).toEqual(['building', 'schedules']);
  // hiding is presentation only: a hidden tab's permission is not touched
  applyTabsConfig({ 'ui.tabs': { devices: { order: [], hidden: ['schedules'] } } });
  expect(tabAllowed(SCHEDULES_HREF, can)).toBe(true);
});

test('the active tab and the crumbs of the schedule routes (list, drawer, editor)', () => {
  for (const p of ['/devices/schedules', '/devices/schedules/3f9a1c', '/devices/schedules/trash', '/devices/schedules/3f9a1c/edit', '/devices/schedules/new/edit?template=a']) {
    expect(activeAreaTab(route(p)), p).toBe('schedules');
  }
  for (const p of ['/devices/building', '/devices/areas/a1']) {
    expect(activeAreaTab(route(p)), p).toBe('building');
  }
  expect(crumbsOf(route('/devices/schedules'))).toEqual(['ראשי', 'תזמונים']);
  expect(crumbsOf(route('/devices/building'))).toEqual(['ראשי', 'מבט על']);
  expect(crumbsOf(route('/system/schedules'))).toEqual(['מערכת', 'תזמונים']);
});

test('"עריכת המסך הראשי": ?edit=1 on the overview tab (and only there) is the layout editor', () => {
  expect(isHomeEditRoute(route('/devices/building?edit=1'))).toBe(true);
  expect(isHomeEditRoute(route('/devices/building'))).toBe(false);
  expect(isHomeEditRoute(route('/devices/building?edit=0'))).toBe(false);
  expect(isHomeEditRoute(route('/devices/schedules?edit=1'))).toBe(false);
  expect(isHomeEditRoute(route('/explore/sites?edit=1'))).toBe(false);
  expect(isHomeEditRoute(null)).toBe(false);
});
