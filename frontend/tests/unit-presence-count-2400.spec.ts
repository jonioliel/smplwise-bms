import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_CHOICES, type BuildingPresenceSettings, type BuildingRoom, type BuildingSnapshot } from '../src/api/building-presence';
import { COUNT_FLOORS, COUNT_NAMES, TICK_CAP, cardOptions, compactView, countView, isolate } from '../src/api/building-presence-logic';

// PRESENCE-COUNT-2400: the home card "count and names" (round-16 direction A; owner round 18, Q25-27) - the number, the word, the names line,
// the "empty since" line, the tick bar (one tick a room up to 40, one share bar above), the large card's floor line, and the new default.
// Pure logic plus two source checks (green only in the lamp and the bar; the style is offered in Settings). No DOM, no browser.

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => fs.readFileSync(path.join(here, '..', 'src', rel), 'utf8');

const cfg: BuildingPresenceSettings = { enabled: true, hold_seconds: 60, empty_minutes: 10, retention_days: 30, home_display: 'card', map_tint: true };
const room = (id: string, name: string, status: BuildingRoom['status'], since: string | null = null, floor: string | null = null): BuildingRoom => ({ area_id: id, name, status, sensors: 1, empty_since: since, floor });
const snap = (rooms: BuildingRoom[], settings: Partial<BuildingPresenceSettings> = {}, over: Partial<BuildingSnapshot> = {}): BuildingSnapshot => {
  const occ = rooms.filter((r) => r.status === 'occupied').length;
  const status = occ ? 'occupied' : rooms.length && rooms.every((r) => r.status === 'clear') ? 'clear' : 'unknown';
  return { configured: true, enabled: true, settings: { ...cfg, ...settings }, status, occupied_rooms: occ, rooms, at: '2026-11-04T08:20:00Z', ...over };
};
const cv = (s: BuildingSnapshot) => countView(compactView(s, 'UTC'));

// the round-16 dataset: 2 of 5 active over three floors
const READY = [
  room('a', 'לובי', 'occupied', null, 'קרקע'),
  room('b', 'אופן ספייס', 'occupied', null, 'קומה 2'),
  room('c', 'חדר ישיבות קטן', 'clear', '2026-11-04T07:42:00Z', 'קומה 2'),
  room('d', 'משרד מנהל', 'unknown', null, 'קומה 3'),
  room('e', 'מטבחון', 'clear', '2026-11-04T06:45:00Z', 'קומה 3'),
];
const many = (n: number, active: number) => Array.from({ length: n }, (_, i) => room(`r${i}`, `משרד ${i + 1}`, i < active ? 'occupied' : 'clear', i < active ? null : '2026-11-04T07:00:00Z', `קומה ${1 + (i % 12)}`));

test.describe('the default and the settings (answer 26 א)', () => {
  test('"count" is the first choice, so a server without the key (or an unknown value) reads as count; every earlier style stays', () => {
    expect(CARD_CHOICES.card_style).toEqual(['count', 'strip', 'floors', 'quiet', 'off']);
    expect(cardOptions(cfg).style).toBe('count');
    expect(cardOptions({ ...cfg, card_style: 'strip' }).style).toBe('strip');
    expect(compactView(snap(READY)).opts.style).toBe('count');
  });
  test('Settings offers the style by name next to the others', () => {
    expect(src('screens/system-building-presence.ts')).toContain("count: BP.styleCount, strip: BP.styleStrip, floors: BP.styleFloors, quiet: BP.styleQuiet, off: BP.styleOff");
    expect(src('i18n/building-presence.ts')).toContain("styleCount: 'מונה ושמות'");
  });
});

test.describe('the count line (answer 25 א)', () => {
  test('ready: "2" over "/5", "חדרים פעילים", the active names as text (by name), nothing else', () => {
    const c = cv(snap(READY));
    expect(c).toMatchObject({ num: '2', of: '/5', word: 'חדרים פעילים', names: ['אופן ספייס', 'לובי'], more: 0, quiet: '', extra: '' });
    // one text run: each name isolated (what <bdi> does), so a Latin name keeps its place and the line ends in its own ellipsis
    expect(c.line).toBe(`${isolate('אופן ספייס')} · ${isolate('לובי')}`);
    expect(c.aria).toBe('2 מתוך 5 חדרים פעילים');
    // details on hover: the active names, then the update time and the empty / unknown names
    expect(c.title.split('\n')).toEqual(['אופן ספייס, לובי', 'עודכן 08:20', 'ריקים: חדר ישיבות קטן, מטבחון', 'אין מידע: משרד מנהל']);
  });
  test('one active room reads as words', () => {
    const c = cv(snap([room('a', 'לובי', 'occupied'), room('b', 'מטבחון', 'clear', '2026-11-04T07:00:00Z')]));
    expect(c.word).toBe('חדר פעיל');
    expect(c.aria).toBe('חדר פעיל אחד מתוך 2');
  });
  test('many active rooms: the first eight names are drawn and the rest count as "+N" (the line ends in an ellipsis on screen)', () => {
    const c = cv(snap(many(20, 12)));
    expect(c.names).toHaveLength(COUNT_NAMES);
    expect(c.more).toBe(12 - COUNT_NAMES);
    expect(c.line.endsWith(` · +${12 - COUNT_NAMES}`)).toBe(true);
    expect(c.title.split('\n')[0]).toContain('משרד 1');
  });
  test('"show empty rooms" or details inline add the empty / unknown names after the active ones, muted; the default does not', () => {
    expect(cv(snap(READY)).extra).toBe('');
    const want = 'ריקים: חדר ישיבות קטן, מטבחון · אין מידע: משרד מנהל';
    expect(cv(snap(READY, { card_empty_rooms: 'show' })).extra).toBe(want);
    expect(cv(snap(READY, { card_details: 'inline' })).extra).toBe(want);
  });
});

test.describe('all empty and no data (round 9 choices kept)', () => {
  const EMPTY = READY.map((r, i) => ({ ...r, status: 'clear' as const, empty_since: `2026-11-04T0${7 - (i % 3)}:${10 + i}:00Z` }));
  test('all empty: a grey "0", "המבנה ריק" and the room that emptied LAST, "<room> · ריק מ־HH:MM"', () => {
    const c = cv(snap(EMPTY));
    expect(c).toMatchObject({ num: '0', of: '/5', word: 'המבנה ריק', names: [], quiet: `${isolate('משרד מנהל')} · ריק מ־07:13` });
    expect(c.bar.ticks.every((t) => t.tone === 'off')).toBe(true);
  });
  test('all empty with "count only": the sentence instead of the room', () => {
    expect(cv(snap(EMPTY, { card_all_empty: 'count' })).quiet).toBe('כל 5 החדרים ריקים');
  });
  test('no data: "–" (never a 0), "אין מידע מהחיישנים", every tick hollow', () => {
    const c = cv(snap(READY.map((r) => ({ ...r, status: 'unknown' as const, empty_since: null }))));
    expect(c).toMatchObject({ num: '–', of: '/5', word: 'אין מידע מהחיישנים', quiet: 'החדרים יופיעו כשהחיישנים ידווחו', aria: 'אין מידע מהחיישנים' });
    expect(c.bar.ticks.map((t) => t.tone)).toEqual(['unk', 'unk', 'unk', 'unk', 'unk']);
  });
  test('no room with a sensor: no "/0", no bar', () => {
    const c = cv(snap([], {}, { status: 'clear' }));
    expect(c).toMatchObject({ num: '0', of: '', word: 'אין עדיין חדר עם חיישן' });
    expect(c.bar.kind).toBe('none');
  });
});

test.describe('the tick bar (answer 27 א)', () => {
  test('one tick a room: the active first, then no data, then empty; each tick names its room', () => {
    const b = cv(snap(READY)).bar;
    expect(b.kind).toBe('ticks');
    expect(b.ticks.map((t) => t.tone)).toEqual(['on', 'on', 'unk', 'off', 'off']);
    expect(b.ticks.map((t) => t.title)).toEqual(['אופן ספייס · פעיל', 'לובי · פעיל', 'משרד מנהל · אין מידע', 'חדר ישיבות קטן · ריק מ־07:42', 'מטבחון · ריק מ־06:45']);
  });
  test(`up to ${TICK_CAP} rooms a tick each; above that one share bar in percent`, () => {
    expect(cv(snap(many(TICK_CAP, 3))).bar).toMatchObject({ kind: 'ticks' });
    expect(cv(snap(many(TICK_CAP, 3))).bar.ticks).toHaveLength(TICK_CAP);
    const share = cv(snap(many(TICK_CAP + 1, 10))).bar;
    expect(share).toMatchObject({ kind: 'share', ticks: [], pct: 24 });
    expect(share.title).toBe('10 מתוך 41 חדרים פעילים (24%)');
  });
  test('500 rooms: the same card - a share bar, eight names and "+N", a grouped count', () => {
    const c = cv(snap(many(500, 167)));
    expect(c).toMatchObject({ num: '167', of: '/500', more: 167 - COUNT_NAMES });
    expect(c.bar).toMatchObject({ kind: 'share', pct: 33 });
    expect(cv(snap(many(1500, 1234))).num).toBe('1,234');
  });
});

test.describe('the large card floor line', () => {
  test('the floors in the server order with "active/rooms"', () => {
    const c = cv(snap(READY));
    expect(c.floors).toEqual([{ name: 'קרקע', on: 1, of: 1 }, { name: 'קומה 2', on: 1, of: 2 }, { name: 'קומה 3', on: 0, of: 2 }]);
    expect(c.floorLine).toBe(`${isolate('קרקע')} 1/1  ·  ${isolate('קומה 2')} 1/2  ·  ${isolate('קומה 3')} 0/2`);
  });
  test(`at most ${COUNT_FLOORS} floors, then "+N קומות"; a building without floors has no floor line`, () => {
    const c = cv(snap(many(24, 5)));
    expect(c.floors).toHaveLength(COUNT_FLOORS);
    expect(c.moreFloors).toBe(12 - COUNT_FLOORS);
    expect(c.floorLine.endsWith(`+${12 - COUNT_FLOORS} קומות`)).toBe(true);
    const flat = cv(snap(READY.map((r) => ({ ...r, floor: null }))));
    expect(flat.floors).toEqual([]);
    expect(flat.moreFloors).toBe(0);
    expect(flat.floorLine).toBe('');
  });
});

test('green lives only in the lamp and the bar (the number and the word are ink)', () => {
  const css = src('screens/building-presence-widget.ts');
  const block = css.slice(css.indexOf('PRESENCE-COUNT-2400 - count and names'), css.indexOf('`;', css.indexOf('PRESENCE-COUNT-2400 - count and names')));
  const green = block.split('\n').filter((l) => /--sw-success/.test(l));
  expect(green.length).toBeGreaterThan(0);
  for (const l of green) expect(l, l).toMatch(/\.pn-bar/);
  expect(block).toMatch(/\.pn-n b \{[^}]*color: var\(--sw-heading/);
});
