import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AreaPresence } from '../src/api/building-presence';
import { AREA_LINE_NAMES, areaLineView } from '../src/api/building-presence-logic';

// AREA-PRESENCE-LINE-2351: the devices area screen's presence line - what it draws from GET presence/area/{id} (switch, permissions as the
// server applied them, names vs counts, the sensor word) and the two structural rules of the screen: the line is read with the area (part of
// the first paint, so it never pushes the screen down when it appears) and it is one fixed-height, non-wrapping line. Pure logic + source.

const base = (over: Partial<AreaPresence> = {}): AreaPresence => ({ area_id: 'a_lobby', line: true, sensors: null, people: null, ...over });
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

test.describe('areaLineView', () => {
  test('nothing while switched off, unanswered, or with no part the caller may see', () => {
    expect(areaLineView(null).show).toBe(false);
    expect(areaLineView(undefined).show).toBe(false);
    expect(areaLineView(base({ line: false, sensors: { status: 'occupied', empty_since: null, sensors: 1 } })).show).toBe(false);
    expect(areaLineView(base()).show).toBe(false);
  });

  test('the sensor word: active, empty since HH:MM, no data (never read as empty)', () => {
    const occ = areaLineView(base({ sensors: { status: 'occupied', empty_since: null, sensors: 2 } }), 'UTC');
    expect(occ).toMatchObject({ show: true, tone: 'ok', room: 'פעיל', people: '' });
    const clear = areaLineView(base({ sensors: { status: 'clear', empty_since: '2026-11-02T14:20:00Z', sensors: 1 } }), 'UTC');
    expect(clear).toMatchObject({ show: true, tone: 'quiet', room: 'ריק מ־14:20' });
    expect(areaLineView(base({ sensors: { status: 'clear', empty_since: null, sensors: 1 } })).room).toBe('ריק');
    expect(areaLineView(base({ sensors: { status: 'unknown', empty_since: null, sensors: 1 } }))).toMatchObject({ room: 'אין מידע', tone: 'quiet' });
  });

  test('names only when the server sent them, capped inline with "ועוד N"; the tooltip has every name', () => {
    const two = areaLineView(base({ people: { count: 2, names: ['דנה', 'Yossi'], more: 0 } }));
    expect(two).toMatchObject({ show: true, tone: 'ok', names: ['דנה', 'Yossi'], rest: 0, people: 'דנה, Yossi' });
    const many = areaLineView(base({ people: { count: 5, names: ['א', 'ב', 'ג', 'ד', 'ה'], more: 0 } }));
    expect(many.names).toHaveLength(AREA_LINE_NAMES);
    expect(many.rest).toBe(2);
    expect(many.people).toBe('א, ב, ג ועוד 2');
    expect(many.title).toBe('א, ב, ג, ד, ה');
    // the server caps the names it sends: the rest still counts
    const capped = areaLineView(base({ people: { count: 60, names: Array.from({ length: 50 }, (_, i) => `n${i}`), more: 10 } }));
    expect(capped.rest).toBe(57);
    expect(capped.title.endsWith('ועוד 10')).toBe(true);
  });

  test('counts only (names null): a number, never a name; one person reads as words', () => {
    expect(areaLineView(base({ people: { count: 1, names: null, more: 0 } }))).toMatchObject({ people: 'אדם אחד', names: [], tone: 'ok' });
    expect(areaLineView(base({ people: { count: 1284, names: null, more: 0 } })).people).toBe('1,284 אנשים');
  });

  test('nobody: said only when the people part stands alone; beside a sensor word it is left out', () => {
    expect(areaLineView(base({ people: { count: 0, names: [], more: 0 } }))).toMatchObject({ show: true, people: 'אין נוכחים', tone: 'quiet' });
    const both = areaLineView(base({ sensors: { status: 'clear', empty_since: null, sensors: 1 }, people: { count: 0, names: null, more: 0 } }));
    expect(both).toMatchObject({ room: 'ריק', people: '', tone: 'quiet' });
  });

  test('both parts: the room word then the people; green while either says someone is there', () => {
    const v = areaLineView(base({ sensors: { status: 'clear', empty_since: null, sensors: 1 }, people: { count: 1, names: ['דנה'], more: 0 } }));
    expect(v).toMatchObject({ room: 'ריק', people: 'דנה', tone: 'ok', title: 'ריק · דנה' });
  });
});

test.describe('the area screen', () => {
  const screen = readFileSync(path.join(SRC, 'screens/devices-area.ts'), 'utf8');

  test('the line is read together with the area (part of the first paint: no layout shift when it appears)', () => {
    expect(screen).toMatch(/Promise\.all\(\[getDevicesArea\(id\), this\.readPresence\(id\)/);
  });

  test('the line is one fixed-height, non-wrapping row drawn from tokens only', () => {
    const css = screen.slice(screen.indexOf('.pres-line {'), screen.indexOf('/* HOMEFABLE-297: the security strip'));
    expect(css).toContain('block-size: 28px');
    expect(css).toContain('white-space: nowrap');
    expect(css).toContain('text-overflow: ellipsis');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  test('nothing is asked without a presence permission', () => {
    expect(screen).toMatch(/canAnywhere\('presence\.building\.view'\) \|\| canAnywhere\('presence\.view'\)/);
  });
});
