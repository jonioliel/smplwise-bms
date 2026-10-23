import { test, expect } from '@playwright/test';
import { INCIDENTS_HREF, INCIDENTS_SETTINGS_HREF, INCIDENTS_TAB, SECTION_TABS, SECURITY_SETTINGS_TABS, TAB_PERMISSIONS, applyIncidents, areaDot, incidentsModuleOn, incidentsOpen, visibleTabs } from '../src/shell/nav';
import { IT_KEYS, IT_TABLES, it as itText } from '../src/i18n/incidents';
import { DEFAULT_BOUNDS, DEFAULT_SETTINGS, elapsed } from '../src/api/incidents';

// CR-LIVEEVENT100 F-01 (node-only): the "אירוע חי" tab, its settings tab, the red dots and the words. Fake data only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-incidents-nav.spec.ts

const ALL = () => true;
const only = (...p: string[]) => (perm: string) => p.includes(perm);
const ids = (items: { id: string }[]) => items.map((t) => t.id);

test.afterEach(() => applyIncidents(false));

test('the tab sits right after the event center and needs events.read', () => {
  expect(ids(SECTION_TABS.investigate).slice(0, 2)).toEqual(['events', 'incidents']);
  expect(INCIDENTS_TAB.href).toBe(INCIDENTS_HREF);
  expect(TAB_PERMISSIONS[INCIDENTS_HREF]).toEqual(['events.read']);
  expect(TAB_PERMISSIONS[INCIDENTS_SETTINGS_HREF]).toEqual(['system.configure']);
});

test('module OFF (the default): the tab is never offered with a backend; the settings tab always is (to an administrator)', () => {
  applyIncidents(false);
  expect(incidentsModuleOn()).toBe(false);
  expect(ids(visibleTabs(SECTION_TABS.investigate, true, ALL))).not.toContain('incidents');
  expect(ids(visibleTabs(SECURITY_SETTINGS_TABS, true, only('system.configure')))).toContain('incidents');
  expect(ids(visibleTabs(SECURITY_SETTINGS_TABS, true, only('alarm.view')))).not.toContain('incidents');
  expect(areaDot('security')).toBe(false);
  expect(incidentsOpen()).toBe(0);
});

test('module ON: offered to events.read only; the red dot follows the open count and the setting', () => {
  applyIncidents(true, 0);
  expect(ids(visibleTabs(SECTION_TABS.investigate, true, ALL))).toContain('incidents');
  expect(ids(visibleTabs(SECTION_TABS.investigate, true, only('video.playback')))).not.toContain('incidents');
  expect(INCIDENTS_TAB.dot).toBeFalsy();
  expect(areaDot('security')).toBe(false);
  applyIncidents(true, 2, 'active');
  expect(incidentsOpen()).toBe(2);
  expect(INCIDENTS_TAB.dot).toBe(true);
  expect(areaDot('security')).toBe(true);
  expect(areaDot('explore')).toBe(false);
  applyIncidents(true, 2, 'off'); // the setting switches the two dots off; the pill (incidentsOpen) stays
  expect(INCIDENTS_TAB.dot).toBeFalsy();
  expect(areaDot('security')).toBe(false);
  expect(incidentsOpen()).toBe(2);
  applyIncidents(false, 5);
  expect(incidentsOpen()).toBe(0);
});

test('the static demo shows the built-in tabs (no backend, nothing hidden)', () => {
  expect(visibleTabs(SECTION_TABS.investigate, false)).toBe(SECTION_TABS.investigate);
});

test('words: every Hebrew key has an English column; placeholders are filled', () => {
  const missing = IT_KEYS.filter((k) => !IT_TABLES.en[k]);
  expect(missing).toEqual([]);
  expect(itText('chainWaiting', { n: 2 }, 'he')).toBe('2 ממתינים');
  expect(itText('chainWaiting', { n: 2 }, 'en')).toBe('2 waiting');
  expect(itText('tab', undefined, 'he')).toBe('אירוע חי');
});

test('defaults are the owner decisions of 2026-10-24 and inside their bounds', () => {
  expect(DEFAULT_SETTINGS['incident.enabled']).toBe(false);
  expect(DEFAULT_SETTINGS['incident.auto_open.alarm']).toBe(false);
  expect(DEFAULT_SETTINGS['incident.merge_window_s']).toBe(300);
  expect(DEFAULT_SETTINGS['incident.max_live']).toBe(4);
  expect(DEFAULT_SETTINGS['incident.max_live_phone']).toBe(1);
  expect(DEFAULT_SETTINGS['incident.red_dot']).toBe('active');
  expect(DEFAULT_SETTINGS['incidents.retention_days']).toBe(365);
  for (const [k, b] of Object.entries(DEFAULT_BOUNDS)) {
    const v = DEFAULT_SETTINGS[k as keyof typeof DEFAULT_SETTINGS];
    if (b.kind === 'int') expect(v as number, k).toBeGreaterThanOrEqual(b.min);
    if (b.kind === 'int') expect(v as number, k).toBeLessThanOrEqual(b.max);
    expect(b.default, k).toEqual(v);
  }
});

test('elapsed time is hh:mm:ss and never negative', () => {
  const t0 = Date.parse('2026-10-24T10:00:00Z');
  expect(elapsed('2026-10-24T10:00:00Z', t0 + 252_000)).toBe('00:04:12');
  expect(elapsed('2026-10-24T10:00:00Z', t0 - 5000)).toBe('00:00:00');
});
