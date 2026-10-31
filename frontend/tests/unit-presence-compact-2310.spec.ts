import { test, expect } from '@playwright/test';
import type { BuildingPresenceSettings, BuildingRoom, BuildingSnapshot } from '../src/api/building-presence';
import { areaPresence, cardOptions, compactView, presenceWidgetAvailable } from '../src/api/building-presence-logic';

// PRESENCE-COMPACT-2310: the compact home card (round-9 mockup, owner answers 31.10) - the settings defaults, which rooms the card shows,
// the "empty since" text and the area window's quiet line. Pure logic, no DOM.

const cfg: BuildingPresenceSettings = { enabled: true, hold_seconds: 60, empty_minutes: 10, retention_days: 30, home_display: 'card', map_tint: true };
const room = (id: string, name: string, status: BuildingRoom['status'], since: string | null = null, floor: string | null = null): BuildingRoom => ({ area_id: id, name, status, sensors: 1, empty_since: since, floor });
const snap = (rooms: BuildingRoom[], over: Partial<BuildingSnapshot> = {}, settings: Partial<BuildingPresenceSettings> = {}): BuildingSnapshot => {
  const occ = rooms.filter((r) => r.status === 'occupied').length;
  const status = rooms.some((r) => r.status === 'occupied') ? 'occupied' : rooms.length && rooms.every((r) => r.status === 'clear') ? 'clear' : 'unknown';
  return { configured: true, enabled: true, settings: { ...cfg, ...settings }, status, occupied_rooms: occ, rooms, at: '2026-10-31T12:06:00Z', ...over };
};
const READY = [
  room('a', 'לובי', 'occupied', null, 'קרקע'),
  room('b', 'אופן ספייס', 'occupied', null, 'קומה 2'),
  room('c', 'חדר ישיבות קטן', 'clear', '2026-10-31T11:28:00Z', 'קומה 2'),
  room('d', 'משרד מנהל', 'unknown', null, 'קומה 3'),
  room('e', 'מטבחון', 'clear', '2026-10-31T11:22:00Z', 'קומה 3'),
];
const EMPTY = [room('a', 'לובי', 'clear', '2026-10-31T11:58:00Z'), room('b', 'אופן ספייס', 'clear', '2026-10-31T11:52:00Z'), room('c', 'מטבחון', 'clear', '2026-10-31T10:10:00Z')];

test.describe('settings defaults (owner answers 31.10)', () => {
  test('an older server without the keys reads as strip / hide / hover / last', () => {
    expect(cardOptions(cfg)).toEqual({ style: 'strip', emptyRooms: 'hide', details: 'hover', allEmpty: 'last' });
    expect(cardOptions(undefined)).toEqual({ style: 'strip', emptyRooms: 'hide', details: 'hover', allEmpty: 'last' });
  });
  test('every option of the mockup is kept; a value the client does not know falls back to the default', () => {
    for (const style of ['strip', 'floors', 'quiet', 'off'] as const) expect(cardOptions({ ...cfg, card_style: style }).style).toBe(style);
    expect(cardOptions({ ...cfg, card_empty_rooms: 'show', card_details: 'inline', card_all_empty: 'count' })).toEqual({ style: 'strip', emptyRooms: 'show', details: 'inline', allEmpty: 'count' });
    expect(cardOptions({ ...cfg, card_style: 'neon' as never, card_details: 3 as never }).style).toBe('strip');
    expect(cardOptions({ ...cfg, card_details: 3 as never }).details).toBe('hover');
  });
  test('"no card, the map only" removes the widget; the other styles keep it', () => {
    expect(presenceWidgetAvailable(snap(READY))).toBe(true);
    expect(presenceWidgetAvailable(snap(READY, {}, { card_style: 'floors' }))).toBe(true);
    expect(presenceWidgetAvailable(snap(READY, {}, { card_style: 'quiet' }))).toBe(true);
    expect(presenceWidgetAvailable(snap(READY, {}, { card_style: 'off' }))).toBe(false);
    expect(presenceWidgetAvailable(snap(READY, {}, { home_display: 'chip' }))).toBe(false);
    expect(compactView(snap(READY, {}, { card_style: 'off' })).show).toBe(false);
  });
});

test.describe('which rooms the card shows', () => {
  test('default: the state word, "2 מתוך 5 חדרים" and ONLY the active rooms (sorted); no empty room is drawn', () => {
    const v = compactView(snap(READY), 'UTC');
    expect(v).toMatchObject({ show: true, tone: 'ok', word: 'פעיל', sub: '2 מתוך 5 חדרים', at: '12:06', of: 5 });
    expect(v.active.map((r) => r.name)).toEqual(['אופן ספייס', 'לובי']);
    expect(v.active.every((r) => r.tone === 'ok')).toBe(true);
    expect(v.others).toEqual([]);
  });
  test('"show empty rooms": the empty ones follow the active ones grey, the unknown ones last', () => {
    const v = compactView(snap(READY, {}, { card_empty_rooms: 'show' }), 'UTC');
    expect(v.others.map((r) => [r.name, r.tone])).toEqual([['חדר ישיבות קטן', 'neutral'], ['מטבחון', 'neutral'], ['משרד מנהל', 'unknown']]);
    expect(v.others[0].title).toBe('חדר ישיבות קטן · ריק מ־11:28');
  });
  test('details on hover (default): the time and the empty / unknown names are in the tooltip, not in the card', () => {
    const v = compactView(snap(READY), 'UTC');
    expect(v.rest).toBe('');
    expect(v.tip).toBe('עודכן 12:06\nריקים: חדר ישיבות קטן, מטבחון\nאין מידע: משרד מנהל');
  });
  test('details inline: one quiet line of the empty and unknown names (only while the empty rooms are not pills)', () => {
    expect(compactView(snap(READY, {}, { card_details: 'inline' }), 'UTC').rest).toBe('ריקים: חדר ישיבות קטן, מטבחון · אין מידע: משרד מנהל');
    expect(compactView(snap(READY, {}, { card_details: 'inline', card_empty_rooms: 'show' }), 'UTC').rest).toBe('');
  });
  test('the tooltip caps a long list with an honest +N', () => {
    const many = Array.from({ length: 30 }, (_, i) => room(`r${i}`, `משרד ${i + 1}`, i ? 'clear' : 'occupied', '2026-10-31T11:00:00Z'));
    const v = compactView(snap(many), 'UTC');
    expect(v.tip.split('\n')[1]).toMatch(/\+17$/);
  });
  test('one room and large counts read as words with group separators', () => {
    expect(compactView(snap([room('a', 'לובי', 'occupied')]), 'UTC').sub).toBe('החדר היחיד עם חיישן');
    const big = Array.from({ length: 1500 }, (_, i) => room(`r${i}`, `משרד ${i}`, i < 1234 ? 'occupied' : 'clear'));
    expect(compactView(snap(big), 'UTC').sub).toBe('1,234 מתוך 1,500 חדרים');
  });
  test('floors: a bar per floor (most active first), a room without a floor groups as "ללא קומה", a building without floors is one bar', () => {
    const v = compactView(snap([...READY, room('f', 'מחסן', 'clear', null, null)], {}, { card_style: 'floors' }), 'UTC');
    expect(v.floors).toEqual([{ name: 'קרקע', on: 1, of: 1 }, { name: 'קומה 2', on: 1, of: 2 }, { name: 'קומה 3', on: 0, of: 2 }, { name: 'ללא קומה', on: 0, of: 1 }]);
    const flat = compactView(snap(READY.map((r) => ({ ...r, floor: null })), {}, { card_style: 'floors' }), 'UTC');
    expect(flat.floors).toEqual([{ name: 'כל המבנה', on: 2, of: 5 }]);
  });
  test('unknown is never drawn as empty', () => {
    const v = compactView(snap(READY.map((r) => ({ ...r, status: 'unknown' as const, empty_since: null }))), 'UTC');
    expect(v).toMatchObject({ tone: 'unknown', word: 'אין מידע', sub: 'החיישנים לא מדווחים', last: '' });
    expect(v.active).toEqual([]);
  });
});

test.describe('"empty since" when every room is empty', () => {
  test('default: the room that emptied LAST, "<room> · ריק מ־HH:MM", instead of the pills', () => {
    const v = compactView(snap(EMPTY), 'UTC');
    expect(v).toMatchObject({ tone: 'clear', word: 'ריק', sub: 'כל 3 החדרים ריקים', last: 'לובי · ריק מ־11:58' });
    expect(v.others).toEqual([]);
  });
  test('"count only": no room line, the sentence alone', () => {
    const v = compactView(snap(EMPTY, {}, { card_all_empty: 'count' }), 'UTC');
    expect(v.last).toBe('');
    expect(v.sub).toBe('כל 3 החדרים ריקים');
  });
  test('"count only" with "show empty rooms": the grey pills come back', () => {
    expect(compactView(snap(EMPTY, {}, { card_all_empty: 'count', card_empty_rooms: 'show' }), 'UTC').others).toHaveLength(3);
  });
  test('no room with a time: no "last" line (nothing is invented); one room reads as words', () => {
    expect(compactView(snap(EMPTY.map((r) => ({ ...r, empty_since: null }))), 'UTC').last).toBe('');
    expect(compactView(snap([EMPTY[0]]), 'UTC').sub).toBe('החדר היחיד עם חיישן ריק');
    expect(compactView(snap(EMPTY, { at: 'garbage' }), 'UTC').at).toBe('');
  });
});

test.describe('the area window quiet line (answer 4)', () => {
  test('active / empty since / no data; nothing without tracking, a room or a sensor - and the map switch does not hide it', () => {
    const s = snap(READY);
    expect(areaPresence(s, 'a', 'UTC')).toEqual({ text: 'פעיל', tone: 'ok' });
    expect(areaPresence(s, 'c', 'UTC')).toEqual({ text: 'ריק מ־11:28', tone: 'clear' });
    expect(areaPresence(s, 'd', 'UTC')).toEqual({ text: 'אין מידע', tone: 'unknown' });
    expect(areaPresence(snap([room('x', 'x', 'clear')]), 'x', 'UTC')).toEqual({ text: 'ריק', tone: 'clear' });
    expect(areaPresence(s, 'zzz')).toBeNull();
    expect(areaPresence(s, null)).toBeNull();
    expect(areaPresence(null, 'a')).toBeNull();
    expect(areaPresence({ configured: false, enabled: false, settings: cfg }, 'a')).toBeNull();
    expect(areaPresence(snap(READY, {}, { map_tint: false }), 'a', 'UTC')).toEqual({ text: 'פעיל', tone: 'ok' });
  });
});
