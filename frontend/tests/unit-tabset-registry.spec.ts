import { test, expect } from '@playwright/test';
import {
  AREA_TABS,
  INFRA_ELECTRICITY_PAGES,
  INFRA_GENERATOR_PAGES,
  INFRA_METERS_HREF,
  INFRA_TABS,
  MULTIMEDIA_TABS,
  TAB_SECTIONS,
  TICKETS_REQUESTS_PAGES,
  TICKETS_TABS,
  TICKETS_VENDORS_PAGES,
  applyInfraElevators,
  applyGeneratorLog,
  applyInfraGenerator,
  applyInfraMeters,
  applyMultimediaKinds,
  applyExternalPlacement,
  applyTabsConfig,
  applyTicketsHidden,
  areaRowSection,
  infraEntryHref,
  infraPageTabs,
  sectionIdOf,
  tabStyleOf,
  visibleAreas,
  visibleTabs,
  type Can,
} from '../src/shell/nav';
import { TST_DEV_MARKED, TST_KEYS, TST_TABLES, tst } from '../src/i18n/tab-sections';

// TABSET-293 (owner 2026-10-20): הגדרות › כללי › לשוניות managed the security and WisKey rows but not the multimedia and infrastructure
// ones - their arrays were never in the tab registry (TAB_SECTIONS) nor in sectionIdOf, so the editor had no card for them and the shell
// never ran configureTabs on their rows. These are the pure rules (node only, the module the shell uses); the editor -> reload -> row
// round trip on a page is evidence-tabset-293.spec.ts.

const ALL: Can = () => true;
const only = (...perms: string[]): Can => (p) => perms.includes(p);
const ids = (items: { id: string }[]) => items.map((i) => i.id);
const SLUG = /^[a-z0-9][a-z0-9_.-]{0,47}$/;

test.beforeEach(() => {
  // the installation has everything of every kind: every infra and multimedia tab is offered
  applyInfraMeters(true);
  applyInfraGenerator(true);
  applyInfraElevators(true);
  applyMultimediaKinds({ screens: 1, players: 2, groups: 1 });
});

test.afterEach(() => {
  applyTabsConfig({});
  applyTicketsHidden({});
  applyInfraGenerator(false);
  applyInfraElevators(false);
  applyMultimediaKinds({});
});

test('every area with a tab row has a registry section, and every section row is found by sectionIdOf', () => {
  const sectionIds = TAB_SECTIONS.map((s) => s.id);
  for (const id of sectionIds) expect(id, id).toMatch(SLUG); // the backend's slug rule (routers/settings.py TABS_SLUG)
  expect(new Set(sectionIds).size).toBe(sectionIds.length);
  // every area whose row the shell draws (security draws its sections' rows) is configurable
  for (const area of Object.keys(AREA_TABS)) {
    if (area === 'security' || area === 'notices' || area === 'calendars') continue; // NOTICEADD-295: the notice board is a rail entry with one page and no tab row; CALENDARS-UI-2310: the calendars rail entry has no tab row either (the screen draws its own view tabs)
    expect(sectionIds, area).toContain(area);
    expect(sectionIdOf(AREA_TABS[area as keyof typeof AREA_TABS]), area).toBe(area);
    expect(areaRowSection(area as never, null), area).toBe(area);
  }
  expect(sectionIdOf(MULTIMEDIA_TABS)).toBe('multimedia');
  expect(sectionIdOf(INFRA_TABS)).toBe('infra');
  expect(sectionIdOf(TICKETS_TABS)).toBe('tickets');
  const byId = Object.fromEntries(TAB_SECTIONS.map((s) => [s.id, ids(s.tabs())]));
  expect(byId['multimedia']).toEqual(ids(MULTIMEDIA_TABS));
  expect(byId['infra']).toEqual(ids(INFRA_TABS)); // a tab added to INFRA_TABS (temperature, 2.9.2) is listed by itself
  expect(byId['infra.electricity']).toEqual(['meters', 'accounts', 'bills', 'customers']);
  expect(byId['infra.generator']).toEqual(['live', 'alerts', 'charts', 'history', 'log']); // GENLOG092-295: the run log is a registry page (the screen shows it only while switched on)
  expect(byId['infra.water']).toEqual(['meters', 'usage', 'alerts', 'accounts', 'bills', 'customers', 'settings']); // CR-WATER78
  // SERVICEIA1-295: level 1 = the sections that have pages on this build; level 2 = the requests and vendors page rows
  expect(byId['tickets']).toEqual(['requests', 'maintenance', 'vendors', 'reports']); // release/2150: תחזוקה ובקרה has its page (CR-MAINT215)
  expect(byId['tickets.requests']).toEqual(['list', 'board']); // SERVICEIA2-295: the scopes are the list's own filter
  expect(byId['tickets.scopes']).toEqual(['mine', 'department', 'all']); // SERVICEIA3-295: each scope of the list is hidden on its own
  expect(byId['tickets.vendors']).toEqual(['handlers', 'rfqs', 'accounts']); // SHAREDID-293: the external-access tab only while placed under tickets
  expect(sectionIdOf(TICKETS_REQUESTS_PAGES)).toBe('tickets.requests');
  expect(sectionIdOf(TICKETS_VENDORS_PAGES)).toBe('tickets.vendors');
  applyExternalPlacement({ 'access.external.placement': 'both' });
  expect(ids(TAB_SECTIONS.find((s) => s.id === 'tickets.vendors')!.tabs())).toContain('external');
  applyExternalPlacement({});
  for (const s of TAB_SECTIONS) {
    expect(s.label.trim(), s.id).not.toBe('');
    expect(s.where.trim(), s.id).not.toBe('');
  }
});

test('nothing configured: the multimedia, infrastructure and tickets rows are exactly the built-in ones (existing installations unchanged)', () => {
  expect(ids(visibleTabs(INFRA_TABS, true, ALL))).toEqual(['electricity', 'generator', 'elevators']);
  expect(visibleTabs(INFRA_TABS, true, ALL).map((t) => t.href)).toEqual(INFRA_TABS.filter((t) => t.id !== 'temperature' && t.id !== 'water').map((t) => t.href)); // the temperatures tab waits for a unit, the water tab for the module (not offered here)
  expect(ids(visibleTabs(MULTIMEDIA_TABS, true, ALL))).toEqual(['screens', 'players', 'groups']);
  applyTicketsHidden({ 'tickets.enabled': 'true' });
  expect(ids(visibleTabs(TICKETS_TABS, true, ALL))).toEqual(['requests', 'vendors', 'reports']); // SERVICEIA1-295: the sections with a page
  expect(ids(visibleTabs(TICKETS_VENDORS_PAGES, true, ALL))).toEqual(['handlers', 'rfqs', 'accounts']); // external access sits under access control by default
  expect(visibleAreas(true, ALL).find((a) => a.id === 'infra')?.href).toBe(INFRA_METERS_HREF);
  expect(tabStyleOf('infra')).toBe('pill');
  expect(tabStyleOf('multimedia')).toBe('pill');
  expect(tabStyleOf('infra.electricity')).toBe('underline-compact');
  expect(tabStyleOf('infra.generator')).toBe('underline-compact');
});

test('infrastructure: the saved order and hidden tabs shape the row, and the area lands on its first visible tab', () => {
  applyTabsConfig({ 'ui.tabs': { infra: { order: ['elevators', 'generator'], hidden: ['electricity'] } } });
  expect(ids(visibleTabs(INFRA_TABS, true, ALL))).toEqual(['elevators', 'generator']);
  expect(visibleAreas(true, ALL).find((a) => a.id === 'infra')?.href).toBe('#/infra/elevators');
  // the demo (no backend) keeps the built-in row
  expect(ids(visibleTabs(INFRA_TABS, false))).toEqual(['electricity']);
});

test('multimedia: the saved order and hidden tabs shape the row; a tab the installation does not offer stays out whatever the order says', () => {
  applyTabsConfig({ 'ui.tabs': { multimedia: { order: ['groups', 'players'], hidden: ['screens'] } } });
  expect(ids(visibleTabs(MULTIMEDIA_TABS, true, ALL))).toEqual(['groups', 'players']);
  expect(visibleAreas(true, ALL).find((a) => a.id === 'multimedia')?.href).toBe('#/multimedia/groups');
  applyMultimediaKinds({ screens: 1, players: 0, groups: 0 }); // no players, no groups: only the screens are offered
  expect(ids(visibleTabs(MULTIMEDIA_TABS, true, ALL))).toEqual(['screens']); // hiding the last offered tab is not a lock-out
});

test('permission-aware: a tab the user may not open never appears, whatever the order names first', () => {
  applyTabsConfig({ 'ui.tabs': { infra: { order: ['generator', 'elevators', 'electricity'], hidden: [] } } });
  // energy.view only: no generator.view, no devices.read
  expect(ids(visibleTabs(INFRA_TABS, true, only('energy.view')))).toEqual(['electricity']);
  expect(ids(visibleTabs(INFRA_TABS, true, only('energy.view', 'devices.read')))).toEqual(['elevators', 'electricity']);
});

test('the infrastructure page rows: order and hidden pages, and the infrastructure tab opens on the first configured page', () => {
  const pages = INFRA_ELECTRICITY_PAGES.map((p) => ({ id: p.id }));
  expect(infraPageTabs('infra.electricity', pages, true)).toBe(pages); // nothing configured: the same list
  expect(infraEntryHref('electricity', ALL)).toBeNull();
  applyTabsConfig({ 'ui.tabs': { 'infra.electricity': { order: ['bills', 'accounts'], hidden: ['meters'] }, 'infra.generator': { order: ['charts'], hidden: [] } } });
  expect(ids(infraPageTabs('infra.electricity', pages, true))).toEqual(['bills', 'accounts', 'customers']);
  expect(ids(infraPageTabs('infra.electricity', pages, false))).toEqual(['meters', 'accounts', 'bills', 'customers']); // the demo
  expect(ids(infraPageTabs('infra.generator', INFRA_GENERATOR_PAGES, true))).toEqual(['charts', 'live', 'alerts', 'history', 'log']);
  // the entry page: the first configured page this user may open (bills needs energy.bills)
  expect(infraEntryHref('electricity', ALL)).toBe('#/infra/electricity/bills');
  expect(infraEntryHref('electricity', only('energy.view'))).toBe('#/infra/electricity/accounts');
  expect(infraEntryHref('generator', ALL)).toBe('#/infra/generator/charts');
  const row = visibleTabs(INFRA_TABS, true, only('energy.view', 'generator.view'));
  expect(row.map((t) => [t.id, t.href])).toEqual([['electricity', '#/infra/electricity/accounts'], ['generator', '#/infra/generator/charts']]);
  // the static arrays are never mutated
  expect(INFRA_TABS[0].href).toBe(INFRA_METERS_HREF);
});

test('the tickets card is listed only while the tickets area is switched on', () => {
  const def = TAB_SECTIONS.find((s) => s.id === 'tickets')!;
  expect(def.available?.()).toBe(false);
  applyTicketsHidden({ 'tickets.enabled': 'true' });
  expect(def.available?.()).toBe(true);
  expect(def.label.trim()).not.toBe('');
  // SERVICEIA1-295: a value stored before the sections (the old page ids) is migrated on read - its pages keep their order and hidden state
  // SERVICEIA2-295: mine / department / all are one page (`list`), at the place of the first of them
  applyTabsConfig({ 'ui.tabs': { tickets: { order: ['board', 'all', 'mine'], hidden: ['department'] } } });
  expect(ids(visibleTabs(TICKETS_REQUESTS_PAGES, true, ALL))).toEqual(['board', 'list']);
  expect(ids(visibleTabs(TICKETS_TABS, true, ALL))[0]).toBe('requests');
  expect(visibleTabs(TICKETS_TABS, true, ALL)[0].href, 'the section opens on its first configured page').toBe('#/tickets/board');
  expect(TAB_SECTIONS.find((s) => s.id === 'tickets.requests')?.available?.()).toBe(true);
});

test('i18n: the registry words have he / en / ar / ru with the same keys and placeholders', () => {
  for (const lang of ['en', 'ar', 'ru'] as const) {
    const table = TST_TABLES[lang];
    expect(Object.keys(table).sort(), lang).toEqual([...TST_KEYS].sort());
    for (const k of TST_KEYS) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(table[k] ?? ''), `${lang}.${k}`).toEqual(ph(TST_TABLES.he[k] ?? ''));
      expect((table[k] ?? '').trim(), `${lang}.${k}`).not.toBe('');
    }
  }
  expect(TST_DEV_MARKED).toEqual(['ar', 'ru']);
  expect(tst('ticketsWhere', { name: 'קריאות' }, 'he')).toBe('לשוניות קריאות');
  // operator wording: no home-platform name in any column
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of TST_KEYS) expect(TST_TABLES[lang][k] ?? '', `${lang}.${k}`).not.toMatch(/home assistant|\bHA\b|ingress/i);
});

test('GENLOG092-295: the run log placed first in the editor is the generator entry page only while its switch is on', () => {
  applyTabsConfig({ 'ui.tabs': { 'infra.generator': { order: ['log', 'charts'], hidden: [] } } });
  applyGeneratorLog(false);
  expect(infraEntryHref('generator', ALL)).toBe('#/infra/generator/charts'); // off (the default): never lands on the run log
  applyGeneratorLog(true);
  expect(infraEntryHref('generator', ALL)).toBe('#/infra/generator/log');
  applyGeneratorLog(false);
  expect(ids(infraPageTabs('infra.generator', INFRA_GENERATOR_PAGES, true))).toEqual(['log', 'charts', 'live', 'alerts', 'history']); // the editor still lists it
  applyTabsConfig({});
});