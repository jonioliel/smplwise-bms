import { test, expect } from '@playwright/test';
import type { Notice } from '../src/api/notices';
import { configOf, defaultConfig, resolveWidgets, WIDGET_IDS, WIDGET_NAME, type HomeData } from '../src/api/home-config';
import { noticeSubline, noticesWidgetAvailable, noticesWidgetOffered, widgetNotices } from '../src/notices/home-widget-model';
import { PLACE_ALL, buildPlaces, inPlace, visibleNodes } from '../src/notices/places-model';
import { readAtText, readsView } from '../src/notices/reads-model';
import { NT_KEYS, nt } from '../src/i18n/notices';

// NOTICEPAGE-295: the places tree, the "מי קרא" sheet and the home widget - the pure logic. Node only.

const note = (id: string, o: Partial<Notice> = {}): Notice => ({
  id, title: 'הודעה ' + id, body: 'שורה ראשונה\nשנייה', severity: 'info', starts_at: '2026-10-24T06:00:00Z', ends_at: null, pinned: false, state: 'active', dwell_s: null, when_text: null,
  published_at: null, updated_at: '2026-10-24T06:00:00Z', boards: [], read: true, audience: { everyone: true }, ...o,
});
const FLOORS = [{ id: 'f1', name: 'קומה 1', building: 'מבנה א' }, { id: 'f2', name: 'קומה 2', building: 'מבנה א' }];
const AREAS = [{ id: 'z1', name: 'לובי', floor: 'f1' }, { id: 'z2', name: 'חדר כושר', floor: 'f2' }];

test('places: the whole building, then floors with their areas; counts follow the audience', () => {
  const list = [
    note('a'), // everyone: the whole building only
    note('b', { audience: { floors: ['f1'] }, severity: 'alert' }),
    note('c', { audience: { areas: ['z1'] }, severity: 'critical' }), // an area counts for its floor too
    note('d', { audience: { floors: ['f2'] } }),
  ];
  const nodes = buildPlaces(list, FLOORS, AREAS);
  expect(nodes.map((n) => [n.id, n.count])).toEqual([[PLACE_ALL, 4], ['f:f1', 2], ['a:z1', 1], ['f:f2', 1], ['a:z2', 0]]);
  expect(nodes.find((n) => n.id === 'f:f1')).toMatchObject({ kind: 'floor', depth: 0, foldable: true });
  expect(nodes.find((n) => n.id === 'a:z1')).toMatchObject({ kind: 'area', depth: 1, look: 'alarm', parent: 'f:f1' });
  expect(nodes.find((n) => n.id === 'a:z2')?.look).toBeUndefined();
});

test('places: a filter keeps the notices tagged to the node, "all" keeps everything', () => {
  const b = note('b', { audience: { floors: ['f1'] } });
  const c = note('c', { audience: { areas: ['z1'] } });
  const a = note('a');
  expect([a, b, c].filter((n) => inPlace(n, PLACE_ALL, FLOORS, AREAS)).length).toBe(3);
  expect([a, b, c].filter((n) => inPlace(n, 'f:f1', FLOORS, AREAS)).map((n) => n.id)).toEqual(['b', 'c']);
  expect([a, b, c].filter((n) => inPlace(n, 'a:z1', FLOORS, AREAS)).map((n) => n.id)).toEqual(['c']);
  expect(inPlace(note('t', { audience: {} }), 'f:f2', FLOORS, AREAS)).toBe(false);
});

test('places: several buildings add a building level; folding hides every descendant', () => {
  const floors = [...FLOORS, { id: 'f9', name: 'חניון', building: 'מבנה ב' }];
  const nodes = buildPlaces([note('x', { audience: { floors: ['f9'] } })], floors, AREAS);
  expect(nodes.map((n) => [n.id, n.depth])).toEqual([[PLACE_ALL, 0], ['b:מבנה א', 0], ['f:f1', 1], ['a:z1', 2], ['f:f2', 1], ['a:z2', 2], ['b:מבנה ב', 0], ['f:f9', 1]]);
  expect(nodes.find((n) => n.id === 'b:מבנה ב')?.count).toBe(1);
  expect(inPlace(note('x', { audience: { floors: ['f9'] } }), 'b:מבנה ב', floors, AREAS)).toBe(true);
  expect(visibleNodes(nodes, new Set(['b:מבנה א'])).map((n) => n.id)).toEqual([PLACE_ALL, 'b:מבנה א', 'b:מבנה ב', 'f:f9']);
  expect(visibleNodes(nodes, new Set(['f:f1'])).map((n) => n.id)).not.toContain('a:z1');
  expect(visibleNodes(nodes, new Set(['f:f1'])).map((n) => n.id)).toContain('a:z2');
});

test('reads: counts, percentage and both lists when the names are on', () => {
  const v = readsView({
    audience: 4, read: 2,
    users: [{ user_id: 'u1', name: 'דני כהן', place: 'קומה 4', read_at: '2026-10-24T05:41:00Z' }, { user_id: 'u2', name: 'רונית לוי', read_at: '2026-10-24T05:52:00Z' }],
    unread: [{ user_id: 'u4', name: 'תמר', place: 'חניון' }, { user_id: 'u3', name: 'אבי', place: '' }],
  });
  expect(v).toMatchObject({ read: 2, unread: 2, total: 4, pct: 50, named: true });
  expect(v.rows.read.map((r) => r.name)).toEqual(['רונית לוי', 'דני כהן']); // newest first
  expect(v.rows.unread.map((r) => r.name)).toEqual(['אבי', 'תמר']); // by name
  expect(v.rows.read[1].place).toBe('קומה 4');
  expect(v.rows.read[0].place).toBe('');
});

test('reads: counts only when the installation hides the names; an empty audience is 0 %', () => {
  expect(readsView({ audience: 118, read: 84 })).toMatchObject({ read: 84, unread: 34, total: 118, pct: 71, named: false, rows: { read: [], unread: [] } });
  expect(readsView({ audience: 0, read: 0 })).toMatchObject({ total: 0, pct: 0 });
  expect(readAtText('2026-10-24T08:41:00')).toBe('24.10 08:41');
  expect(readAtText('x')).toBe('');
});

test('widget: active only, urgent first, at most three, the server order inside a group', () => {
  const list = [
    note('1', { severity: 'info' }), note('2', { severity: 'alert' }), note('3', { severity: 'critical' }), note('4', { severity: 'critical' }),
    note('5', { state: 'scheduled', severity: 'critical' }), note('6', { state: 'draft' }),
  ];
  expect(widgetNotices(list).map((n) => n.id)).toEqual(['3', '4', '2']);
  expect(widgetNotices(null)).toEqual([]);
  expect(noticeSubline({ severity: 'critical', ends_at: '2026-10-25T09:00:00' })).toBe('דחוף · עד 25.10');
  expect(noticeSubline({ severity: 'info', ends_at: null })).toBe('רגיל');
});

test('widget: absent unless the module is on and the read worked; the last widget; the default config keeps it on', () => {
  // the board setting: with no active notice the widget is absent (the default) or shows one line
  expect(noticesWidgetAvailable({ notices: [], emptyMode: 'hide' }, true)).toBe(false);
  expect(noticesWidgetAvailable({ notices: [note('d', { state: 'draft' })], emptyMode: 'hide' }, true)).toBe(false);
  expect(noticesWidgetAvailable({ notices: [], emptyMode: 'line' }, true)).toBe(true);
  expect(noticesWidgetAvailable({ notices: [note('a')], emptyMode: 'hide' }, true)).toBe(true);
  expect(noticesWidgetAvailable({ notices: null, emptyMode: 'line' }, true)).toBe(false);
  expect(noticesWidgetAvailable({ notices: [note('a')], emptyMode: 'line' }, false)).toBe(false);
  // the editor and the personal list still offer it while the board is empty (so it can be placed)
  expect(noticesWidgetOffered({ notices: [], emptyMode: 'hide' }, true)).toBe(true);
  expect(noticesWidgetOffered({ notices: null, emptyMode: 'hide' }, true)).toBe(false);
  expect(noticesWidgetOffered({ notices: [], emptyMode: 'hide' }, false)).toBe(false);
  // PRESENCE-2280 (db39f1e7c): the building presence widget is appended after notices (absent unless the module is on), so notices is second to last
  expect(WIDGET_IDS[WIDGET_IDS.length - 2]).toBe('notices');
  expect(WIDGET_IDS[WIDGET_IDS.length - 1]).toBe('presence');
  expect(WIDGET_NAME.notices).toBe('לוח הודעות');
  const cfg = defaultConfig();
  expect(cfg.notices).toMatchObject({ on: true, sizes: { a: 'm', b: 's', c: 'm' } });
  // a saved order from before the widget existed keeps its look: the widget lands at the end (just before presence)
  const old = configOf({ order: ['quick', 'clock'] });
  expect(old.order[old.order.length - 2]).toBe('notices');
  const data = { weather: null, sensors: {}, names: {} } as unknown as HomeData;
  const ids = (opts: { noticesAvailable?: boolean }) => resolveWidgets(cfg, 'a', data, { generatorsAvailable: false, ...opts }).map((w) => w.id);
  expect(ids({})).not.toContain('notices');
  expect(ids({ noticesAvailable: false })).not.toContain('notices');
  expect(ids({ noticesAvailable: true })).toContain('notices');
  expect(resolveWidgets(cfg, 'a', data, { editing: true }).map((w) => w.id)).not.toContain('notices'); // no ghost in the editor
});

test('words: the new strings exist in Hebrew and English, with their placeholders', () => {
  for (const k of ['places', 'allPlaces', 'readsOf', 'colName', 'colPlace', 'colReadAt', 'widgetAll', 'widgetEmpty', 'widgetNew', 'widgetUntil', 'dHomeEmpty', 'dHomeEmptyHide', 'dHomeEmptyLine', 'segReadShort', 'segUnreadShort'] as const) {
    expect(NT_KEYS).toContain(k);
    expect(nt(k, { title: 'x', d: 'y', name: 'z' }, 'en')).not.toBe(nt(k, { title: 'x', d: 'y', name: 'z' }, 'he'));
  }
  expect(nt('readsOf', { title: 'מים' }, 'he')).toBe('מי קרא: מים');
});
