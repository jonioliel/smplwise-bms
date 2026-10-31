import { test, expect } from '@playwright/test';
import { emptyColumns, normalizeXs, phoneColumns, synBoardColumns, synColumns, xsFromParams, xsMetrics, XS_DEFAULT, SYN_COLUMN_ORDER, type FloorSignal, type XsOptions } from '../src/xsection/xs-model';

// SYN-COLUMNS-2321 (owner request 2026-10-31): "an option to hide columns I have no data for". His building has no temperature sensors and,
// until switches count as lights, no lights - those columns were a stack of "-". Two options of ui.xs:
//   syn_hide_empty (default ON): a column with no SOURCE on any floor of the building is not drawn - a real 0 keeps its column;
//   syn_columns=custom + syn_custom: the columns ticked by hand (the presets all / few stay), always in the board's fixed order.

const sig = (id: string, extra: Partial<FloorSignal> = {}): FloorSignal => ({
  id, name: id, level: 0, cams: 2, shared: 0, items: 0, plan: true,
  temp: 22, target: 23, lit: 1, lights: 4, people: 3, doorsOpen: 0, alerts: null, nodata: false, ...extra,
});
const opts = (o: Partial<XsOptions> = {}): XsOptions => normalizeXs({ ...XS_DEFAULT, ...o });

/** The owner's building: no temperature, no lights; doors and cameras report. */
const OWNER = [sig('f2', { temp: null, target: null, lit: null, lights: null }), sig('f1', { temp: null, target: null, lit: null, lights: null, doorsOpen: 1 }), sig('f0', { temp: null, target: null, lit: null, lights: null })];

test('defaults: hide-empty is ON, the custom list holds all seven columns in the board order', () => {
  expect(XS_DEFAULT.syn_hide_empty).toBe(true);
  expect(XS_DEFAULT.syn_columns).toBe('all');
  expect(XS_DEFAULT.syn_custom).toEqual(['light', 'temp', 'presence', 'cameras', 'doors', 'alerts', 'fire']);
  expect(normalizeXs({}).syn_hide_empty).toBe(true);
});

test('normalize: custom keeps the fixed order, drops unknown names and duplicates, an empty list stays empty', () => {
  expect(normalizeXs({ syn_columns: 'custom', syn_custom: ['doors', 'light', 'kitchen', 'light'] }).syn_custom).toEqual(['light', 'doors']);
  expect(normalizeXs({ syn_custom: [] }).syn_custom).toEqual([]);
  expect(normalizeXs({ syn_custom: 'light' }).syn_custom).toEqual([...SYN_COLUMN_ORDER]);
  expect(normalizeXs({ syn_columns: 'weird' }).syn_columns).toBe('all');
  expect(normalizeXs({ syn_hide_empty: 'no' }).syn_hide_empty).toBe(true);
  // the default list is never shared (editing one answer does not change the next)
  normalizeXs({}).syn_custom.push('fire');
  expect(normalizeXs({}).syn_custom).toHaveLength(7);
});

test('route overrides of the demo: a comma list for syn_custom, 0/1 for syn_hide_empty', () => {
  const o = xsFromParams(XS_DEFAULT, new URLSearchParams('xs_syn_columns=custom&xs_syn_custom=temp,doors&xs_syn_hide_empty=0'));
  expect(o.syn_columns).toBe('custom');
  expect(o.syn_custom).toEqual(['temp', 'doors']);
  expect(o.syn_hide_empty).toBe(false);
});

test('emptyColumns: no source on any floor, never a real 0', () => {
  expect(emptyColumns(OWNER)).toEqual(['light', 'temp', 'alerts']);
  // 0 lights on, 0 people, 0 open doors are real values: the columns stay
  expect(emptyColumns([sig('a', { lit: 0, people: 0, doorsOpen: 0 }), sig('b', { lit: 0, people: 0, doorsOpen: 0 })])).toEqual(['alerts']);
  // one floor with a reading keeps the column for the whole building
  expect(emptyColumns([sig('a', { temp: null, target: null }), sig('b', { temp: 21.5 })])).not.toContain('temp');
  // a target alone (climate unit, no room sensor) is a source of the temperature column
  expect(emptyColumns([sig('a', { temp: null, target: 24 })])).not.toContain('temp');
  // presence: no count anywhere = no source; cameras: no camera at all, own or shared
  expect(emptyColumns([sig('a', { people: null }), sig('b', { people: null })])).toContain('presence');
  expect(emptyColumns([sig('a', { cams: 0 }), sig('b', { cams: 0 })])).toContain('cameras');
  expect(emptyColumns([sig('a', { cams: 0, shared: 1 }), sig('b', { cams: 0 })])).not.toContain('cameras');
  // an alert count (when a source exists) keeps the column
  expect(emptyColumns([sig('a', { alerts: 0 })])).not.toContain('alerts');
});

test('emptyColumns: an outage is not a missing source - floors without data do not hide light / temp / doors', () => {
  const off = [sig('a', { nodata: true, temp: null, target: null, lit: null, lights: null, doorsOpen: null }), sig('b', { nodata: true, temp: null, target: null, lit: null, lights: null, doorsOpen: null })];
  expect(emptyColumns(off)).toEqual(['alerts']);
  // with one linked floor, the others' outage does not count: that floor decides
  const mixed = [off[0], sig('c', { temp: null, target: null, lit: null, lights: null })];
  expect(emptyColumns(mixed)).toEqual(['light', 'temp', 'alerts']);
  expect(emptyColumns([])).toEqual([]);
});

test('synColumns with hide-empty: the owner building draws presence, cameras and doors; the note lists the rest', () => {
  const r = synBoardColumns(opts(), true, false, OWNER);
  expect(r.cols).toEqual(['presence', 'cameras', 'doors']);
  expect(r.hiddenEmpty).toEqual(['light', 'temp', 'alerts']);
  // off: every chosen column again, nothing listed
  expect(synBoardColumns(opts({ syn_hide_empty: false }), true, false, OWNER)).toEqual({ cols: ['light', 'temp', 'presence', 'cameras', 'doors', 'alerts'], hiddenEmpty: [] });
  // without the floors (old callers) nothing is hidden
  expect(synColumns(opts(), true, false)).toEqual(['light', 'temp', 'presence', 'cameras', 'doors', 'alerts']);
  // presence off: not drawn and not listed as "empty" (the module, not the data)
  expect(synBoardColumns(opts(), false, false, OWNER)).toEqual({ cols: ['cameras', 'doors'], hiddenEmpty: ['light', 'temp', 'alerts'] });
});

test('presets stay: few = temperature, lighting, alerts; the fire column follows its own option, never the hide-empty rule', () => {
  const full = [sig('a', { alerts: 0 })];
  expect(synColumns(opts({ syn_columns: 'few' }), true, false, full)).toEqual(['temp', 'light', 'alerts']);
  expect(synColumns(opts({ syn_columns: 'few', fire_ui: true, fire_column: 'dashed' }), true, false, OWNER)).toEqual(['fire']);
  expect(synBoardColumns(opts({ syn_columns: 'few' }), true, false, OWNER).hiddenEmpty).toEqual(['temp', 'light', 'alerts']);
  expect(synColumns(opts({ fire_ui: false, fire_column: 'dashed' }), true, true, full)).not.toContain('fire');
  expect(synColumns(opts({ fire_ui: true }), true, true, full)).toContain('fire');
});

test('custom: the ticked columns in the fixed order, and the hide-empty rule still applies', () => {
  const full = [sig('a', { alerts: 2 })];
  expect(synColumns(opts({ syn_columns: 'custom', syn_custom: ['doors', 'temp'] }), true, false, full)).toEqual(['temp', 'doors']);
  expect(synColumns(opts({ syn_columns: 'custom', syn_custom: ['alerts', 'cameras', 'light'] }), true, false, full)).toEqual(['light', 'cameras', 'alerts']);
  expect(synColumns(opts({ syn_columns: 'custom', syn_custom: [] }), true, false, full)).toEqual([]);
  // the owner ticks temperature and doors: temperature has no source and is hidden (and named in the note); doors stay
  expect(synBoardColumns(opts({ syn_columns: 'custom', syn_custom: ['temp', 'doors'] }), true, false, OWNER)).toEqual({ cols: ['doors'], hiddenEmpty: ['temp'] });
  // fire ticked only shows with the alarm UI on; unticked, it is not drawn even when connected
  expect(synColumns(opts({ syn_columns: 'custom', syn_custom: ['fire'] }), true, true, full)).toEqual([]);
  expect(synColumns(opts({ syn_columns: 'custom', syn_custom: ['fire'], fire_ui: true }), true, true, full)).toEqual(['fire']);
  expect(synColumns(opts({ syn_columns: 'custom', syn_custom: ['light'], fire_ui: true }), true, true, full)).toEqual(['light']);
});

test('phone columns: at most three signals, lighting / temperature / alerts first, then doors, presence, cameras; fire always', () => {
  expect(phoneColumns(['light', 'temp', 'presence', 'cameras', 'doors', 'alerts'])).toEqual(['light', 'temp', 'alerts']);
  expect(phoneColumns(['presence', 'cameras', 'doors'])).toEqual(['presence', 'cameras', 'doors']);
  expect(phoneColumns(['light', 'presence', 'cameras', 'doors', 'fire'])).toEqual(['light', 'presence', 'doors', 'fire']);
  expect(phoneColumns([])).toEqual([]);
});

test('cross-section metrics follow the same rule', () => {
  expect(xsMetrics(OWNER, XS_DEFAULT)).toEqual({ temp: false, light: false });
  expect(xsMetrics(OWNER, { syn_hide_empty: false })).toEqual({ temp: true, light: true });
  expect(xsMetrics([sig('a')], XS_DEFAULT)).toEqual({ temp: true, light: true });
  expect(xsMetrics([sig('a', { lit: null, lights: null })], XS_DEFAULT)).toEqual({ temp: true, light: false });
});
