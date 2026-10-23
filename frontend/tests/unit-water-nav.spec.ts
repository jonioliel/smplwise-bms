import { test, expect } from '@playwright/test';
import { INFRA_TABS, INFRA_WATER_PAGES, activeAreaTab, applyInfraWater, applyTabsConfig, infraEntryHref, visibleTabs } from '../src/shell/nav';
import { accessOf, canSettings, tabOffered } from '../src/water/access';
import { lastNightWindow, nightFloor, nightRuleOff, buildWaterAreaTree, type Meter } from '../src/api/water';
import { WT_KEYS, WT_TABLES } from '../src/water/i18n';

// CR-WATER78 section 3: the water tab and its page row. Node-only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-water-nav.spec.ts

const ALL = () => true;
const only = (...p: string[]) => (x: string) => p.includes(x);
const ids = (t: { id: string }[]) => t.map((x) => x.id);

test('the water tab sits right after the electricity meters and is hidden until the module is on and the viewer may see it', () => {
  expect(ids(INFRA_TABS).slice(0, 2)).toEqual(['electricity', 'water']);
  expect(INFRA_TABS[1].href).toBe('#/infra/water/meters');
  expect(visibleTabs(INFRA_TABS, true, ALL).some((t) => t.id === 'water')).toBe(false); // off by default
  applyInfraWater(true);
  expect(visibleTabs(INFRA_TABS, true, ALL).some((t) => t.id === 'water')).toBe(true);
  expect(visibleTabs(INFRA_TABS, true, only('energy.view')).some((t) => t.id === 'water')).toBe(false); // water.view is needed
  expect(visibleTabs(INFRA_TABS, true, only('water.view')).map((t) => t.id)).toContain('water');
  expect(visibleTabs(INFRA_TABS, false).some((t) => t.id === 'water')).toBe(false); // the static demo keeps the built-in row
  applyInfraWater(false);
  expect(visibleTabs(INFRA_TABS, true, ALL).some((t) => t.id === 'water')).toBe(false);
  expect(activeAreaTab({ path: '/infra/water/usage', segments: ['infra', 'water', 'usage'], params: new URLSearchParams(), mode: 'infra' } as never)).toBe('water');
});

test('the status drives the gate: on + can_view offers the tab; money and settings pages follow their permissions', () => {
  const s = { enabled: true, can_view: true, can_manage: false, can_configure: false, can_ack: true, can_bills: false, meters: 3 };
  expect(tabOffered(accessOf(s))).toBe(true);
  expect(tabOffered(accessOf({ ...s, enabled: false }))).toBe(false);
  expect(tabOffered(accessOf({ ...s, can_view: false }))).toBe(false);
  expect(canSettings(accessOf(s))).toBe(false);
  expect(canSettings(accessOf({ ...s, can_configure: true }))).toBe(true);
  expect(ids(INFRA_WATER_PAGES)).toEqual(['meters', 'usage', 'alerts', 'accounts', 'bills', 'customers', 'settings']);
  applyTabsConfig({ 'ui.tabs': { 'infra.water': { order: ['bills', 'usage'], hidden: [] } } });
  expect(infraEntryHref('water', ALL)).toBe('#/infra/water/bills');
  expect(infraEntryHref('water', only('water.view'))).toBe('#/infra/water/usage'); // bills needs water.bills
  applyTabsConfig({});
});

test('night flow: the last night window, the floor of the hourly flow, the irrigation default', () => {
  const w = lastNightWindow({ night_from: '01:00', night_to: '05:00' }, new Date(2026, 9, 23, 9, 30));
  expect([w.from.getDate(), w.from.getHours(), w.to.getHours()]).toEqual([23, 1, 5]);
  const early = lastNightWindow({ night_from: '01:00', night_to: '05:00' }, new Date(2026, 9, 23, 0, 30));
  expect(early.from.getDate()).toBe(22);
  const running = lastNightWindow({ night_from: '01:00', night_to: '05:00' }, new Date(2026, 9, 23, 3, 0));
  expect([running.from.getHours(), running.to.getHours()]).toEqual([1, 3]); // a running window ends now
  expect(nightFloor([{ start: '', end: '', litres: 14 }, { start: '', end: '', litres: 9.04 }, { start: '', end: '', litres: null }])).toBe(9);
  expect(nightFloor([])).toBeNull();
  expect(nightRuleOff({ kind: 'irrigation' })).toBe(true);
  expect(nightRuleOff({ kind: 'irrigation', rules: { night_rule: true } })).toBe(false);
  expect(nightRuleOff({ kind: 'sub' })).toBe(false);
});

test('the areas tree groups by floor and area, a meter without an area keeps its own key', () => {
  const m = (id: string, floor: string | null, area: string | null) => ({ id, floor_id: floor, floor_name: floor, area_id: area, area_name: area }) as unknown as Meter;
  const t = buildWaterAreaTree([m('a', 'f1', 'x'), m('b', 'f1', 'x'), m('c', 'f1', null), m('d', null, null)]);
  expect(t.map((f) => [f.floor_id, f.count])).toEqual([['f1', 3], ['', 1]]);
  expect(t[0].areas.map((a) => [a.area_id, a.count])).toEqual([['x', 2], ['_none', 1]]);
});

test('the water words: Hebrew and English complete, no platform name on the operator screens', () => {
  for (const k of WT_KEYS) {
    expect(WT_TABLES.he[k], k).toBeTruthy();
    expect(WT_TABLES.en[k], k).toBeTruthy();
    expect(/Home Assistant|\bHA\b/.test(WT_TABLES.he[k] ?? ''), k).toBe(false);
    expect(/Home Assistant|\bHA\b/.test(WT_TABLES.en[k] ?? ''), k).toBe(false);
  }
});
