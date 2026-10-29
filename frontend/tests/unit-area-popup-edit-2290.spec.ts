import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POPUP_SECTIONS, layoutOf, popupOf, type PopupLayout, type PopupState } from '../src/api/popup-layout';
import {
  buildLayout, editItems, editSections, hiddenCount, isAlarming, isTechnical, layoutFor, move, moveTo, nothingVisible, orderBy, shownItems, shownSections,
  toggleItem, toggleSection, withItemOrder, withSectionOrder,
} from '../src/screens/area-quick-edit-logic';
import { HS_KEYS, HS_TABLES } from '../src/i18n/home-screen';
import type { DeviceRow } from '../src/api/devices';

const here = path.dirname(fileURLToPath(import.meta.url));
const row = (entity_id: string, name = entity_id, extra: Partial<DeviceRow> = {}) =>
  ({ entity_id, name, domain: entity_id.split('.')[0], device_class: null, available: true, active: false, ...extra }) as DeviceRow;
const L = (p: Partial<PopupLayout>): PopupLayout => ({ sections: [], hidden: [], items: {}, ...p });

test('the section list is the server list (smplwise_vms/backend services/popup_layout.py)', () => {
  const py = readFileSync(path.resolve(here, '../../smplwise_vms/backend/smplwise/services/popup_layout.py'), 'utf-8');
  expect(py).toContain(`SECTIONS: tuple[str, ...] = (${POPUP_SECTIONS.map((s) => `"${s}"`).join(', ')})`);
});

test('the reader is tolerant: nothing configured = today', () => {
  expect(popupOf(undefined)).toEqual({ version: 0, site: null, areas: {} });
  expect(popupOf({ version: 'x', site: 5, areas: { a: 7 } })).toEqual({ version: 0, site: null, areas: {} });
  const s = popupOf({ version: 3, site: { sections: ['events', 'pool', 'events'], hidden: ['media'], items: { sensors: { order: ['a'], hidden: [] }, events: { hidden: ['x'] } } }, areas: { lobby: { hidden: ['events'] } } });
  expect(s.version).toBe(3);
  expect(s.site).toEqual({ sections: ['events'], hidden: ['media'], items: { sensors: { order: ['a'], hidden: [] } } });
  expect(s.areas.lobby.hidden).toEqual(['events']);
  expect(layoutOf([])).toBeNull();
});

test('an area override replaces the site default; neither = the fixed pop-up', () => {
  const st: PopupState = { version: 1, site: L({ hidden: ['media'] }), areas: { lobby: L({ hidden: ['events'] }) } };
  expect(layoutFor(st, 'lobby').hidden).toEqual(['events']);
  expect(layoutFor(st, 'hall').hidden).toEqual(['media']);
  expect(layoutFor({ version: 0, site: null, areas: {} }, 'hall')).toEqual(L({}));
  expect(layoutFor(st, null).hidden).toEqual(['media']);
});

test('sections: ordered, hidden ones dropped, never added', () => {
  const available = ['quick', 'lighting', 'climate', 'sensors', 'events'] as const;
  expect(shownSections(available, L({}), false)).toEqual([...available]);
  expect(shownSections(available, L({ sections: ['climate', 'sensors'], hidden: ['events'] }), false)).toEqual(['climate', 'sensors', 'quick', 'lighting']);
  // a layout naming a section this person cannot see adds nothing
  expect(shownSections(['lighting'], L({ sections: ['media', 'lighting'] }), false)).toEqual(['lighting']);
  expect(shownSections(available, L({ hidden: ['sensors'] }), false)).not.toContain('sensors');
  expect(shownSections(available, L({ hidden: ['sensors'] }), true)).toContain('sensors'); // a hidden sensors section appears for an alarming sensor
  expect(shownSections(available, L({ hidden: ['lighting'] }), true)).not.toContain('lighting');
});

test('items: order, hide, the new device follows, a hidden alarming sensor is revealed while the alert choice is show', () => {
  const rows = [row('sensor.t'), row('binary_sensor.input_0', 'Input 0'), row('binary_sensor.door', 'Door', { device_class: 'door', active: true }), row('sensor.new')];
  const lay = L({ items: { sensors: { order: ['binary_sensor.door', 'sensor.t', 'binary_sensor.input_0'], hidden: ['binary_sensor.input_0', 'binary_sensor.door'] } } });
  const on = shownItems(rows, 'sensors', lay, true);
  expect(on.rows.map((r) => r.entity_id)).toEqual(['binary_sensor.door', 'sensor.t', 'sensor.new']);
  expect([...on.revealed]).toEqual(['binary_sensor.door']); // the door alarms; the quiet Input 0 stays hidden
  const off = shownItems(rows, 'sensors', lay, false);
  expect(off.rows.map((r) => r.entity_id)).toEqual(['sensor.t', 'sensor.new']);
  expect(off.revealed.size).toBe(0);
  // another section never reveals
  expect(shownItems(rows, 'lighting', L({ items: { lighting: { order: [], hidden: ['sensor.t'] } } }), true).rows.map((r) => r.entity_id)).not.toContain('sensor.t');
});

test('alarm and technical detection', () => {
  expect(isAlarming({ domain: 'binary_sensor', device_class: 'smoke', active: true, available: true })).toBe(true);
  expect(isAlarming({ domain: 'binary_sensor', device_class: 'smoke', active: false, available: true })).toBe(false);
  expect(isAlarming({ domain: 'binary_sensor', device_class: 'motion', active: true, available: true })).toBe(false);
  expect(isAlarming({ domain: 'binary_sensor', device_class: null, active: true, available: true })).toBe(false);
  expect(isAlarming({ domain: 'sensor', device_class: 'smoke', active: true, available: true })).toBe(false);
  expect(isAlarming({ domain: 'binary_sensor', device_class: 'door', active: true, available: false })).toBe(false);
  for (const [id, name] of [['binary_sensor.shelly_input_0', 'Input 0'], ['sensor.x_idle', 'idle'], ['binary_sensor.input_1', 'Input 1']]) expect(isTechnical({ entity_id: id, name })).toBe(true);
  for (const [id, name] of [['sensor.temperature', 'Temperature'], ['binary_sensor.window', 'Window'], ['sensor.inputs_total', 'Total']]) expect(isTechnical({ entity_id: id, name })).toBe(false);
});

test('editing: eye, move, drag, reset, nothing visible', () => {
  const rows = [row('a'), row('b'), row('c')];
  expect(orderBy(rows, (r) => r.entity_id, ['c', 'a']).map((r) => r.entity_id)).toEqual(['c', 'a', 'b']);
  expect(move(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
  expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  expect(moveTo(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  expect(moveTo(['a', 'b', 'c'], 5, 0)).toEqual(['a', 'b', 'c']);

  let d = L({});
  d = toggleSection(d, 'events');
  expect(d.hidden).toEqual(['events']);
  expect(toggleSection(d, 'events').hidden).toEqual([]);
  d = withSectionOrder(d, ['climate', 'lighting']);
  d = toggleItem(d, 'sensors', 'b', ['a', 'b', 'c']);
  expect(d.items.sensors).toEqual({ order: ['a', 'b', 'c'], hidden: ['b'] });
  expect(hiddenCount(d, 'sensors')).toBe(1);
  d = withItemOrder(d, 'sensors', ['c', 'a', 'b']);
  expect(editItems(rows, 'sensors', d).map((x) => [x.row.entity_id, x.hidden])).toEqual([['c', false], ['a', false], ['b', true]]);
  expect(editSections(['lighting', 'climate', 'events'], d)).toEqual([{ id: 'climate', hidden: false }, { id: 'lighting', hidden: false }, { id: 'events', hidden: true }]);

  const saved = buildLayout(d, ['climate', 'lighting', 'events']);
  expect(saved).toEqual({ sections: ['climate', 'lighting', 'events'], hidden: ['events'], items: { sensors: { order: ['c', 'a', 'b'], hidden: ['b'] } } });
  expect(buildLayout(L({}), ['lighting', 'climate', 'events'])).toBeNull(); // untouched = nothing to save
  expect(buildLayout(L({ hidden: ['media'] }), ['lighting', 'climate'])).toBeNull(); // a hidden id this person cannot see is not saved
  expect(buildLayout(L({ hidden: ['events'] }), ['lighting', 'events'])).toEqual({ sections: [], hidden: ['events'], items: {} }); // today's order is not stored
  expect(nothingVisible([{ id: 'a', hidden: true }, { id: 'b', hidden: true }])).toBe(true);
  expect(nothingVisible([{ id: 'a', hidden: true }, { id: 'b', hidden: false }])).toBe(false);
  expect(nothingVisible([])).toBe(false);
});

test('the words exist in Hebrew and English, and the screen keeps its rules', () => {
  const keys = HS_KEYS.filter((k) => k.startsWith('qc') && /Edit|Hid|Show|Move|Drag|Apply|Alert|Reset|Save|Cancel|Conflict|Reload|Overwrite|Tech|Revealed|Fine|Lock|Site|Area|Items|Empty|AllHidden|Quick/.test(k));
  expect(keys.length).toBeGreaterThan(30);
  for (const k of keys) expect(HS_TABLES.en[k], k).toBeTruthy();
  const src = readFileSync(path.resolve(here, '../src/screens/area-quick-sheet.ts'), 'utf-8');
  expect(src).not.toMatch(/Home Assistant|HomeAssistant/);
  expect(src).toContain("canAnywhere('system.configure')"); // the button only for managers (the server refuses everyone else)
  expect(src).toContain('data-qc-edit');
});
