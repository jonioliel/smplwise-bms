import { test, expect } from '@playwright/test';
import {
  ACTOR_FILTERS, DEFAULT_FILTERS, KIND_ICON, actorView, changedKey, clockOf, describeEvent, footnote, gapText, groupByDay, isFiltered, queryOf, stateLabel, trackedSince,
} from '../src/components/device-activity-logic';
import { ACTIVITY_KINDS, type ActivityItem } from '../src/api/device-activity';
import { demoActivity } from '../src/api/device-activity-mock';
import { LONG_PRESS_MS, MOVE_SLOP_PX, activityNodeOf, activityTag, exceedsSlop, parseTag, type PathNode } from '../src/components/device-activity-press';

// DEVHIST (CR-032): the pure parts of the device activity popup - wording per kind, before / after, who, day groups, filters, and the
// long-press path logic (which tile an event belongs to, what blocks a press). No DOM.

const item = (over: Partial<ActivityItem>): ActivityItem => ({ id: 'x', at: '2026-10-05T10:00:00Z', kind: 'power', actor: { type: 'person', name: 'דנה כהן' }, from: { state: 'on' }, to: { state: 'off' }, ...over });

test.describe('device activity logic', () => {
  test('every one of the twelve kinds has an icon', () => {
    expect(ACTIVITY_KINDS).toHaveLength(12);
    for (const k of ACTIVITY_KINDS) expect(KIND_ICON[k], k).toBeTruthy();
  });

  test('power events: light / switch / outlet / fan / heater / water heater use הדלקה and כיבוי', () => {
    for (const k of ['light', 'switch', 'outlet', 'fan', 'heater', 'water_heater'] as const) {
      expect(describeEvent(item({ to: { state: 'on' }, from: { state: 'off' } }), k)).toEqual({ verb: 'הדלקה', from: 'כבוי', to: 'דלוק' });
      expect(describeEvent(item({}), k).verb).toBe('כיבוי');
    }
  });

  test('cover, garage and valve: פתיחה / סגירה / עצירה', () => {
    for (const k of ['cover', 'garage_door', 'valve'] as const) {
      expect(describeEvent(item({ from: { state: 'closed' }, to: { state: 'open' } }), k)).toEqual({ verb: 'פתיחה', from: 'סגור', to: 'פתוח' });
      expect(describeEvent(item({ from: { state: 'open' }, to: { state: 'closed' } }), k).verb).toBe('סגירה');
      expect(describeEvent(item({ from: { state: 'opening' }, to: { state: 'stopped' } }), k).verb).toBe('עצירה');
    }
  });

  test('vacuum: התחלת ניקיון, חזרה לעגינה, עצירה', () => {
    expect(describeEvent(item({ from: { state: 'docked' }, to: { state: 'cleaning' } }), 'vacuum')).toEqual({ verb: 'התחלת ניקיון', from: 'בעגינה', to: 'מנקה' });
    expect(describeEvent(item({ from: { state: 'cleaning' }, to: { state: 'docked' } }), 'vacuum').verb).toBe('חזרה לעגינה');
    expect(describeEvent(item({ from: { state: 'cleaning' }, to: { state: 'paused' } }), 'vacuum').verb).toBe('עצירה');
  });

  test('climate turning on shows the mode; the generic kind says שינוי מצב', () => {
    expect(describeEvent(item({ from: { state: 'off' }, to: { state: 'cool' } }), 'climate')).toEqual({ verb: 'הדלקה', from: 'כבוי', to: 'קירור' });
    expect(describeEvent(item({ from: { state: 'on' }, to: { state: 'off' } }), 'generic').verb).toBe('שינוי מצב');
  });

  test('value events read the flat attributes: percent, degrees, Kelvin and named modes', () => {
    const v = (key: string, from: unknown, to: unknown) => describeEvent(item({ kind: 'value', changed: [key], from: { state: 'on', [key]: from }, to: { state: 'on', [key]: to } }), 'light');
    expect(v('brightness_pct', 100, 60)).toEqual({ verb: 'שינוי בהירות', from: '100%', to: '60%' });
    expect(v('current_position', 100, 40.5)).toEqual({ verb: 'שינוי מיקום', from: '100%', to: '40.5%' });
    expect(v('current_tilt_position', 0, 30)).toEqual({ verb: 'שינוי הטיה', from: '0%', to: '30%' });
    expect(v('temperature', 22, 24)).toEqual({ verb: 'שינוי יעד', from: '22°', to: '24°' });
    expect(v('color_temp_kelvin', 2700, 4000)).toEqual({ verb: 'שינוי גוון', from: '2700K', to: '4000K' });
    expect(v('fan_mode', 'auto', 'high')).toEqual({ verb: 'שינוי מאוורר', from: 'אוטו', to: 'גבוה' });
    expect(v('direction', 'forward', 'reverse')).toEqual({ verb: 'שינוי כיוון', from: 'קדימה', to: 'אחורה' });
    expect(v('percentage', 33, 66)).toEqual({ verb: 'שינוי מהירות', from: '33%', to: '66%' });
    expect(v('something_new', 1, 2).verb).toBe('שינוי ערך');
  });

  test('the key of a value row is the first known changed attribute; without `changed` it is derived', () => {
    expect(changedKey({ from: { state: 'on', brightness_pct: 1 }, to: { state: 'on', brightness_pct: 2 }, changed: ['brightness_pct'] })).toBe('brightness_pct');
    expect(changedKey({ from: { state: 'cool', fan_mode: 'a', temperature: 20 }, to: { state: 'cool', fan_mode: 'b', temperature: 22 } })).toBe('temperature');
    expect(changedKey({ from: { state: 'a' }, to: { state: 'b' } })).toBeNull();
  });

  test('a light switched on shows its brightness; a mode change of a running climate is a value row', () => {
    expect(describeEvent(item({ from: { state: 'off' }, to: { state: 'on', brightness_pct: 60 } }), 'light').to).toBe('דלוק 60%');
    expect(describeEvent(item({ kind: 'value', changed: ['state'], from: { state: 'heat' }, to: { state: 'cool' } }), 'climate')).toEqual({ verb: 'שינוי ערך', from: 'חימום', to: 'קירור' });
  });

  test('availability events say lost or back, never an invented cause', () => {
    expect(describeEvent(item({ kind: 'availability', from: { state: 'off' }, to: { state: 'unavailable' } }), 'light').verb).toBe('איבד זמינות');
    expect(describeEvent(item({ kind: 'availability', from: { state: 'unavailable' }, to: { state: 'off' } }), 'light')).toEqual({ verb: 'חזר לזמינות', from: 'לא זמין', to: 'כבוי' });
  });

  test('an unknown state string is shown as the server wrote it', () => {
    expect(stateLabel('weird_state')).toBe('weird_state');
    expect(stateLabel(null)).toBe('');
  });

  test('who: person, automation, schedule, scene, manual, system, unknown', () => {
    expect(actorView(item({}))).toMatchObject({ type: 'person', name: 'דנה כהן', initials: 'דכ', prefix: '' });
    expect(actorView(item({ actor: { type: 'person' } })).name).toBe('משתמש');
    expect(actorView(item({ actor: { type: 'automation', name: 'זריחה' } }))).toMatchObject({ prefix: 'אוטומציה', name: 'זריחה' });
    expect(actorView(item({ actor: { type: 'schedule' }, source: { type: 'schedule', name: 'תאורת ערב' } }))).toMatchObject({ prefix: 'תזמון', name: 'תאורת ערב' });
    expect(actorView(item({ actor: { type: 'scene', name: 'לילה טוב' } })).prefix).toBe('סצנה');
    expect(actorView(item({ actor: { type: 'automation' } }))).toMatchObject({ prefix: '', name: 'אוטומציה (ללא שם)' });
    expect(actorView(item({ actor: { type: 'script', name: 'שקיעה' } }))).toMatchObject({ prefix: 'סקריפט', name: 'שקיעה' });
    expect(actorView(item({ actor: { type: 'device' } }))).toMatchObject({ name: 'ידני בהתקן', qualifier: 'משוער' });
    expect(actorView(item({ actor: { type: 'system' } })).name).toBe('המערכת');
    expect(actorView(item({ actor: { type: 'unknown' } })).name).toBe('מקור לא ידוע');
  });

  test('day groups: today, yesterday, an older day; newest first order is kept', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    const g = groupByDay([item({ id: 'a', at: '2026-10-05T10:00:00Z' }), item({ id: 'b', at: '2026-10-05T08:00:00Z' }), item({ id: 'c', at: '2026-10-04T10:00:00Z' }), item({ id: 'd', at: '2026-10-02T10:00:00Z' })], now, 'Asia/Jerusalem');
    expect(g.map((x) => x.items.map((i) => i.id).join(''))).toEqual(['ab', 'c', 'd']);
    expect(g[0].label.startsWith('היום')).toBe(true);
    expect(g[1].label.startsWith('אתמול')).toBe(true);
    expect(g[2].label.startsWith('היום') || g[2].label.startsWith('אתמול')).toBe(false);
  });

  test('day grouping follows the local zone, not UTC', () => {
    const now = new Date('2026-10-05T21:30:00Z'); // 00:30 on the 6th in Jerusalem
    const g = groupByDay([item({ at: '2026-10-05T21:10:00Z' }), item({ at: '2026-10-05T10:00:00Z' })], now, 'Asia/Jerusalem');
    expect(g).toHaveLength(2);
    expect(g[0].label.startsWith('היום')).toBe(true);
    expect(g[1].label.startsWith('אתמול')).toBe(true);
  });

  test('clock text is HH:MM in the given zone', () => {
    expect(clockOf('2026-10-05T10:05:00Z', 'Asia/Jerusalem')).toBe('13:05');
  });

  test('filters: defaults, the query, and "filtered" detection', () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, actor: 'person' })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, period: 'month' })).toBe(true);
    const q = queryOf({ period: 'day', actor: 'schedule', kind: '' }, Date.parse('2026-10-05T12:00:00Z'), 'c1');
    expect(q).toEqual({ since: '2026-10-04T12:00:00.000Z', actor: 'schedule', kind: undefined, cursor: 'c1' });
    expect(ACTOR_FILTERS.map((a) => a.id)).toEqual(['', 'person', 'automation', 'script', 'schedule', 'scene', 'device', 'system']);
  });

  test('footnote, tracked-since and gap texts', () => {
    expect(footnote(90, true)).toBe('ידני בהתקן הוא משוער · נשמר 90 יום');
    expect(footnote(90, false)).toBe('נשמר 90 יום');
    expect(trackedSince('2026-10-04T05:00:00Z', 'Asia/Jerusalem')).toBe('מתועד מ־4.10');
    expect(trackedSince(null)).toBe('');
    expect(gapText({ from: '2026-10-05T00:10:00Z', to: '2026-10-05T00:42:00Z' }, 'UTC')).toBe('המערכת הייתה מנותקת 00:10 עד 00:42; ייתכן שחסרים אירועים');
  });
});

test.describe('device activity demo store', () => {
  test('filters, newest first, and a second page', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    const first = demoActivity('light.x', {}, now);
    expect(first.items.length).toBe(50);
    expect(first.next_cursor).toBe('50');
    expect(first.items[0].at >= first.items[1].at).toBe(true);
    const second = demoActivity('light.x', { cursor: first.next_cursor }, now);
    expect(second.items.length).toBeGreaterThan(0);
    expect(second.next_cursor).toBeNull();
    const people = demoActivity('light.x', { actor: 'person', limit: 10 }, now);
    expect(people.items.every((i) => i.actor.type === 'person')).toBe(true);
    expect(demoActivity('light.x', { kind: 'availability' }, now).items.every((i) => i.kind === 'availability')).toBe(true);
    expect(changedKey(demoActivity('cover.x', {}, now).items[0])).toBe('current_position');
  });
});

// ---------------------------------------------------------------- the press path logic

const node = (tag: string, attrs: Record<string, string> = {}, extra: Partial<PathNode> = {}): PathNode => ({
  tagName: tag.toUpperCase(),
  getAttribute: (n: string) => (n in attrs ? attrs[n] : null),
  hasAttribute: (n: string) => n in attrs,
  classList: { contains: (c: string) => (attrs.class ?? '').split(' ').includes(c) },
  getRootNode: () => 'light',
  ...extra,
});
const TAG = JSON.stringify({ id: 'light.a', kind: 'light', name: 'תאורה', state: 'דלוק' });

test.describe('device activity press', () => {
  test('constants follow the contract: 500 ms and 8 px', () => {
    expect(LONG_PRESS_MS).toBe(500);
    expect(MOVE_SLOP_PX).toBe(8);
    expect(exceedsSlop(5, 5)).toBe(false); // 7.07 px
    expect(exceedsSlop(6, 6)).toBe(true); // 8.49 px
    expect(exceedsSlop(0, 8)).toBe(false);
    expect(exceedsSlop(0, 9)).toBe(true);
  });

  test('the tag comes only from the server flag', () => {
    expect(activityTag({ entity_id: 'light.a', name: 'x' })).toBeUndefined();
    expect(activityTag({ entity_id: 'light.a', name: 'x', activity: false, activity_kind: 'light' })).toBeUndefined();
    expect(parseTag(activityTag({ entity_id: 'light.a', name: 'תאורה', activity: true, activity_kind: 'light' }, 'דלוק'))).toEqual({ id: 'light.a', kind: 'light', name: 'תאורה', state: 'דלוק' });
    expect(parseTag(activityTag({ entity_id: 'x.a', name: 'n', activity: true }))?.kind).toBe('generic');
    // a lock / alarm panel: only with one of the permissions the server names
    const lock = { entity_id: 'lock.a', name: 'דלת', activity: true, activity_kind: 'generic' as const, activity_permissions: ['door.unlock'] };
    expect(activityTag(lock, '', () => false)).toBeUndefined();
    expect(activityTag(lock, '', (p) => p === 'door.unlock')).toBeTruthy();
    expect(parseTag('not json')).toBeNull();
    expect(parseTag(null)).toBeNull();
  });

  test('a press on the tile body finds the tile; a path without a flagged tile finds nothing', () => {
    const tile = node('div', { 'data-activity': TAG });
    expect(activityNodeOf([node('span'), tile, node('body')])?.target.id).toBe('light.a');
    expect(activityNodeOf([node('span'), node('div', { 'data-entity': 'light.a' }), node('body')])).toBeNull();
  });

  test('a slider, a toggle, a button or a field between the pointer and the tile blocks the gesture', () => {
    const tile = node('div', { 'data-activity': TAG });
    for (const n of [node('input', { type: 'range' }), node('sw-vslider'), node('sw-toggle'), node('button'), node('a'), node('div', { role: 'slider' }), node('div', { 'data-no-activity': '' }), node('sw-dropdown')]) {
      expect(activityNodeOf([n, tile]), n.tagName).toBeNull();
    }
    // the menu key and Alt+Enter ignore the controls (the focus may be on the tile's own toggle)
    expect(activityNodeOf([node('sw-toggle'), tile], { anyControl: true })?.target.id).toBe('light.a');
  });

  test('inside the tile\'s own shadow tree a plain button is the tile body (a pill), a slider still blocks', () => {
    const shadow = {};
    const pill = node('sw-pill', { 'data-activity': TAG, role: 'slider' }, { shadowRoot: shadow });
    const inner = (tag: string, attrs: Record<string, string> = {}) => node(tag, attrs, { getRootNode: () => shadow });
    expect(activityNodeOf([inner('button'), pill])?.target.id).toBe('light.a');
    expect(activityNodeOf([inner('span'), pill])?.target.id).toBe('light.a');
    expect(activityNodeOf([inner('input'), pill])).toBeNull();
  });

  test('arrange mode: the drag wins, the menu still works', () => {
    const tile = node('div', { 'data-activity': TAG });
    const wrap = node('div', { class: 'lay-tile lay-tedit', 'data-lay-tpos': '0,1,m' });
    expect(activityNodeOf([node('span'), tile, wrap])).toBeNull();
    expect(activityNodeOf([node('span'), tile, wrap], { allowArrange: true })?.target.id).toBe('light.a');
  });
});
