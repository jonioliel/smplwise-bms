import { test, expect } from '@playwright/test';
import { AREA_TABS, SECURITY_SETTINGS_TABS } from '../src/shell/nav';
import { SETTINGS_GROUPS, activeEntry, navTree, routeHref, searchSettings, visibleGroups } from '../src/screens/system-index';
import { parseRoute } from '../src/router';

// SET-polish (2026-10-10): the settings index behind the navigation column and its search (screens/system-index.ts). Node-only:
//   npx playwright test tests/unit-settings-index.spec.ts --project=desktop

const all = SETTINGS_GROUPS.flatMap((g) => g.entries);

test('every top-level settings tab has an entry, every entry names an existing tab, deep links are unique', () => {
  const tabs = new Set(AREA_TABS.system.map((t) => t.id));
  for (const e of all) expect(tabs.has(e.tab), `${e.label} -> ${e.tab}`).toBe(true);
  // owner decision 402 (the column never scrolls): the operations views (WISKEY-OPS-VIEWS-2400) are search-only sub-entries under the
  // access-control screen; the tab row and the deep links lead to them. The installer tools are a row of the "בקרת כניסה" group (owner 04.11, Q2 = ג).
  const SEARCH_ONLY = ['intercom-operations'];
  for (const t of AREA_TABS.system) {
    if (SEARCH_ONLY.includes(t.id)) expect(all.some((e) => e.tab === t.id) && all.filter((e) => e.tab === t.id).every((e) => e.sub), `tab ${t.id}: search-only entries`).toBe(true);
    else expect(all.some((e) => e.tab === t.id && !e.sub), `tab ${t.id} has a top-level entry`).toBe(true);
  }
  const hrefs = all.map((e) => e.href);
  expect(new Set(hrefs).size).toBe(hrefs.length);
  for (const e of all) expect(e.href.startsWith('#/'), e.href).toBe(true);
});

test('security sub-entries name the security settings tabs', () => {
  const ids = new Set(SECURITY_SETTINGS_TABS.map((t) => t.id));
  for (const e of all.filter((x) => x.tab === 'security' && x.sub)) expect(ids.has(e.href.split('/').pop() ?? ''), e.href).toBe(true);
});

test('demo mode offers the demo tabs; a permission-less api user gets only what the tab row offers', () => {
  const demo = visibleGroups(false);
  expect(demo.flatMap((g) => g.entries).some((e) => e.href === '#/system/diagnostics?tab=backup')).toBe(true);
  const none = visibleGroups(true, () => false);
  const hrefs = none.flatMap((g) => g.entries).map((e) => e.href);
  expect(hrefs).not.toContain('#/system/access');
  expect(hrefs).not.toContain('#/system/wizard');
});

test('search: every word must match; a label hit outranks a keyword hit; sub-pages are found through their keywords', () => {
  const groups = visibleGroups(false);
  const r1 = searchSettings(groups, 'גיבוי');
  expect(r1[0].entry.href).toBe('#/system/diagnostics?tab=backup');
  const r2 = searchSettings(groups, 'webrtc');
  expect(r2.some((r) => r.entry.href === '#/system/diagnostics?tab=media')).toBe(true);
  expect(searchSettings(groups, 'גיבוי webrtc')).toEqual([]);
  expect(searchSettings(groups, '   ')).toEqual([]);
  const r3 = searchSettings(groups, 'תפקידים');
  expect(r3[0].entry.href).toBe('#/system/access?tab=roles');
});

test('the route maps to its deep link, and the active entry falls back to the screen for an unlisted sub-page', () => {
  const groups = visibleGroups(false);
  expect(routeHref(parseRoute('#/system/diagnostics?tab=backup'))).toBe('#/system/diagnostics?tab=backup');
  expect(routeHref(parseRoute('#/system/diagnostics?tab=general'))).toBe('#/system/diagnostics');
  expect(routeHref(parseRoute('#/system'))).toBe('#/system/diagnostics');
  expect(routeHref(parseRoute('#/system/access?tab=users'))).toBe('#/system/access');
  expect(routeHref(parseRoute('#/system/security/manage'))).toBe('#/system/security/manage');
  expect(routeHref(parseRoute('#/devices'))).toBe('');
  expect(activeEntry(groups, parseRoute('#/system/access?tab=roles'))?.label).toBe('תפקידים');
  expect(activeEntry(groups, parseRoute('#/system/security/nvr'))?.label).toBe('אבטחה'); // the NVR page is reached from the security tabs, not listed
  expect(activeEntry(groups, parseRoute('#/system/infra/prices'))?.label).toBe('תשתיות');
  expect(activeEntry(groups, parseRoute('#/live'))).toBeNull();
  expect(routeHref(parseRoute('#/system/diagnostics?tab=devices&section=device-types'))).toBe('#/system/diagnostics?tab=devices&section=device-types');
  expect(activeEntry(groups, parseRoute('#/system/diagnostics?tab=devices&section=device-types'))?.label).toBe('סוגי התקנים');
  expect(activeEntry(groups, parseRoute('#/system/diagnostics?tab=devices&section=other'))?.label).toBe('חשמל והתקנים');
});

// WISKEY-INSTALL-ANSWERS-2400 (owner answer 04.11, round 18 Q2 = ג): the installer tools are a row of the group "בקרת כניסה" in the column -
// not search-only, not a row of "מערכת ותשתית". The group holds the access-control screen, the installer row and the entrance-screen switches.
test('the group "בקרת כניסה" shows the access-control screen, the installer tools and the entrance-screen switches as rows', () => {
  const ac = SETTINGS_GROUPS.find((g) => g.id === 'access-control')!;
  expect(ac.label).toBe('בקרת כניסה');
  expect(navTree(ac, null).map((e) => e.href)).toEqual(['#/system/access-control', '#/system/intercom-installer', '#/system/diagnostics?tab=access-control']);
  const installer = ac.entries.find((e) => e.href === '#/system/intercom-installer')!;
  expect(installer.sub).toBeFalsy();
  expect(installer.ownTabs).toBe(true);
  // its four tools and the operations views stay search results (their screens draw their own tab strips)
  expect(ac.entries.filter((e) => e.tab === 'intercom-installer' && e.sub).length).toBe(4);
  for (const active of [null, installer]) expect(navTree(ac, active).filter((e) => e.sub)).toEqual([]);
  const system = SETTINGS_GROUPS.find((g) => g.id === 'system')!;
  expect(system.entries.some((e) => ['access-control', 'intercom-installer', 'intercom-operations'].includes(e.tab))).toBe(false);
  expect(system.entries.some((e) => e.href === '#/system/diagnostics?tab=access-control')).toBe(false);
  // the column rows of the longest group went down by two (the fit budget of owner decision 402), the group count up by one
  expect(navTree(system, null).length).toBe(17);
  expect(SETTINGS_GROUPS.length).toBe(6);
  // the route of a tool marks the installer row; the search finds the tools under "בקרת כניסה"
  const groups = visibleGroups(false);
  expect(activeEntry(groups, parseRoute('#/system/intercom-installer/clock'))?.href).toBe('#/system/intercom-installer');
  const hit = searchSettings(groups, 'שעון האינטרקום')[0];
  expect(hit.entry.href).toBe('#/system/intercom-installer/clock');
  expect(hit.group.id).toBe('access-control');
});
