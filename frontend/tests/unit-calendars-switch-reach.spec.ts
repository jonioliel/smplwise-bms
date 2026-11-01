import { test, expect } from '@playwright/test';
import { AREA_TABS, CALENDARS_SETTINGS_HREF, CALENDAR_SYNC_SETTINGS_HREF, HIDDEN_HREFS, applyCalendarsNav, onTabsConfig, visibleTabs, type Can } from '../src/shell/nav';
import { searchSettings, visibleGroups } from '../src/screens/system-index';

// CAL-SWITCH-REACH-2321 (owner 2026-10-31): Settings › "יומנים" holds the calendars module's ON switch, so the entry is offered to a holder of
// calendar.configure whatever the module state; only "חיבורי יומן" waits for the module. 2.31.0 hid both while off - nobody could switch it on.
// Node only - the same modules the shell and the settings column use.

const only = (...perms: string[]): Can => (p) => perms.includes(p);
const hrefs = (api: boolean, can?: Can) => visibleTabs(AREA_TABS.system, api, can).map((t) => t.href);
const ADMIN = only('system.configure', 'calendar.configure', 'calendar.connect');

test.afterEach(() => applyCalendarsNav(false, 'rail'));

test('module off: "יומנים" is offered to calendar.configure, "חיבורי יומן" is not (api mode)', () => {
  applyCalendarsNav(false, 'rail');
  expect(HIDDEN_HREFS.has(CALENDARS_SETTINGS_HREF)).toBe(false);
  expect(HIDDEN_HREFS.has(CALENDAR_SYNC_SETTINGS_HREF)).toBe(true);
  const h = hrefs(true, ADMIN);
  expect(h).toContain(CALENDARS_SETTINGS_HREF);
  expect(h).not.toContain(CALENDAR_SYNC_SETTINGS_HREF);
});

test('module off: without calendar.configure the entry is not offered (the permission still decides)', () => {
  applyCalendarsNav(false, 'rail');
  expect(hrefs(true, only('system.configure', 'calendar.view'))).not.toContain(CALENDARS_SETTINGS_HREF);
});

test('module on: both entries are offered', () => {
  applyCalendarsNav(true, 'rail');
  expect(HIDDEN_HREFS.has(CALENDARS_SETTINGS_HREF)).toBe(false);
  expect(HIDDEN_HREFS.has(CALENDAR_SYNC_SETTINGS_HREF)).toBe(false);
  const h = hrefs(true, ADMIN);
  expect(h).toContain(CALENDARS_SETTINGS_HREF);
  expect(h).toContain(CALENDAR_SYNC_SETTINGS_HREF);
});

test('static demo: "יומנים" stays, "חיבורי יומן" follows the module', () => {
  applyCalendarsNav(false, 'rail');
  expect(hrefs(false)).toContain(CALENDARS_SETTINGS_HREF);
  expect(hrefs(false)).not.toContain(CALENDAR_SYNC_SETTINGS_HREF);
  applyCalendarsNav(true, 'rail');
  expect(hrefs(false)).toContain(CALENDAR_SYNC_SETTINGS_HREF);
});

test('module off: the settings column and its search find "יומנים" (and not "חיבורי יומן")', () => {
  applyCalendarsNav(false, 'rail');
  const groups = visibleGroups(true, ADMIN);
  const all = groups.flatMap((g) => g.entries.map((e) => e.href));
  expect(all).toContain(CALENDARS_SETTINGS_HREF);
  expect(all).not.toContain(CALENDAR_SYNC_SETTINGS_HREF);
  const hits = searchSettings(groups, 'יומנים').map((r) => r.entry.href);
  expect(hits[0]).toBe(CALENDARS_SETTINGS_HREF);
  expect(searchSettings(groups, 'סנכרון').map((r) => r.entry.href)).not.toContain(CALENDAR_SYNC_SETTINGS_HREF);
});

test('the navigation hears a module switch once, and not a repeat of the same state', () => {
  applyCalendarsNav(false, 'rail');
  let n = 0;
  const off = onTabsConfig(() => n++);
  try {
    applyCalendarsNav(false, 'rail');
    expect(n).toBe(0);
    applyCalendarsNav(true, 'rail');
    expect(n).toBe(1);
    applyCalendarsNav(true, 'rail');
    expect(n).toBe(1);
    applyCalendarsNav(false, 'rail');
    expect(n).toBe(2);
  } finally {
    off();
  }
});
