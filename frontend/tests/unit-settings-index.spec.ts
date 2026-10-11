import { test, expect } from '@playwright/test';
import { AREA_TABS, SECURITY_SETTINGS_TABS } from '../src/shell/nav';
import { SETTINGS_GROUPS, activeEntry, routeHref, searchSettings, visibleGroups } from '../src/screens/system-index';
import { parseRoute } from '../src/router';

// SET-polish (2026-10-10): the settings index behind the navigation column and its search (screens/system-index.ts). Node-only:
//   npx playwright test tests/unit-settings-index.spec.ts --project=desktop

const all = SETTINGS_GROUPS.flatMap((g) => g.entries);

test('every top-level settings tab has an entry, every entry names an existing tab, deep links are unique', () => {
  const tabs = new Set(AREA_TABS.system.map((t) => t.id));
  for (const e of all) expect(tabs.has(e.tab), `${e.label} -> ${e.tab}`).toBe(true);
  for (const t of AREA_TABS.system) expect(all.some((e) => e.tab === t.id && !e.sub), `tab ${t.id} has a top-level entry`).toBe(true);
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
