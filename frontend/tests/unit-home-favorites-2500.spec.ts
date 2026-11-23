import { expect, test } from '@playwright/test';
import { addCandidates, armNeedsCode, cellArea, dropIndex, insertAt, layoutFavPages, moveTo, sceneSuggestions } from '../src/home/home-favgrid';
import type { Fav } from '../src/home/home-api';

// HOME-FAVORITES-2500 (owner 22.11 Q77 / Q78 / Q79, docs/changes/HOME-FAVORITES-2500.md): the pure logic of the favourites grid - the
// placement in the person's order, the "+ הוסף" holes, the drag's drop index, what "+ הוסף" offers, and what a scene suggests next.
// Node only.

type It = { n: string; w: number; h?: number };
const size = (x: It) => ({ w: x.w, h: x.h ?? 1 });
const names = (cells: { kind: string; item?: It; at?: number; w: number }[]) => cells.map((c) => (c.kind === 'fav' ? c.item!.n : `+${c.at}x${c.w}`));

test.describe('Q78: the grid keeps the order and fills holes with "+ הוסף"', () => {
  test('a wide tile that does not fit at a row end moves down and leaves a hole there (no dense back-fill)', () => {
    // 6 columns x 3 rows (the landscape tablet): a b c d e (one each), then W (2 wide) does not fit in the last cell of row 1
    const items: It[] = [{ n: 'a', w: 1 }, { n: 'b', w: 1 }, { n: 'c', w: 1 }, { n: 'd', w: 1 }, { n: 'e', w: 1 }, { n: 'W', w: 2 }, { n: 'f', w: 1 }];
    const [p] = layoutFavPages(items, size, 6, 3);
    expect(names(p.cells)).toEqual(['a', 'b', 'c', 'd', 'e', '+5x1', 'W', 'f', '+7x3']);
    // f stays after W (the dense flow put f into row 1's last cell, ahead of W)
    const f = p.favs.find((x) => x.item.n === 'f')!;
    expect([f.r, f.c]).toEqual([1, 2]);
    const hole = p.cells.find((x) => x.kind === 'hole')!;
    expect([hole.r, hole.c, hole.w]).toEqual([0, 5, 1]);
  });

  test('the trailing cells of the last row in use are one hole that appends; rows below stay empty', () => {
    const [p] = layoutFavPages([{ n: 'a', w: 2 }, { n: 'b', w: 1 }], size, 6, 3);
    expect(names(p.cells)).toEqual(['a', 'b', '+2x3']);
    expect(p.cells.every((c) => c.r === 0)).toBe(true);
  });

  test('a full row has no hole; an empty list is one empty page', () => {
    expect(names(layoutFavPages([{ n: 'a', w: 2 }, { n: 'b', w: 1 }], size, 3, 5)[0].cells)).toEqual(['a', 'b']);
    const empty = layoutFavPages([], size, 6, 3);
    expect(empty).toHaveLength(1);
    expect(empty[0].cells).toEqual([]);
  });

  test('a camera (two rows high) keeps its column; cells it covers are not holes', () => {
    // 3 columns (phone): cam (1x2) at 0,0; a b fill row 0; c d go to row 1 beside the camera
    const [p] = layoutFavPages([{ n: 'cam', w: 1, h: 2 }, { n: 'a', w: 1 }, { n: 'b', w: 1 }, { n: 'c', w: 1 }, { n: 'd', w: 1 }], size, 3, 5);
    expect(p.favs.map((x) => [x.item.n, x.r, x.c])).toEqual([['cam', 0, 0], ['a', 0, 1], ['b', 0, 2], ['c', 1, 1], ['d', 1, 2]]);
    expect(p.cells.filter((x) => x.kind === 'hole')).toEqual([]);
  });

  test('a tile that fits nowhere on the page starts the next one; the hole it leaves points to it', () => {
    // 6 x 3: five wide tiles fill rows 1-2 and two thirds of row 3; the sixth (2 wide) still fits; a seventh starts page 2
    const wide = Array.from({ length: 9 }, (_, i) => ({ n: 'w' + i, w: 2 }));
    const pages = layoutFavPages([...wide, { n: 'x', w: 1 }], size, 6, 3);
    expect(pages).toHaveLength(2);
    expect(pages[0].favs).toHaveLength(9);
    expect(names(pages[1].cells)).toEqual(['x', '+10x5']);
    // 6 x 3 with a 2-wide tile after 17 singles: the last cell of page 1 is a hole that inserts before the wide tile
    const singles = Array.from({ length: 17 }, (_, i) => ({ n: 's' + i, w: 1 }));
    const [p1, p2] = layoutFavPages([...singles, { n: 'W', w: 2 }], size, 6, 3);
    expect(p1.cells.at(-1)).toMatchObject({ kind: 'hole', at: 17, r: 2, c: 5, w: 1 });
    expect(p2.favs[0].item.n).toBe('W');
  });

  test('every page fits its grid (nothing ever overflows a no-scroll screen)', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ n: 'i' + i, w: 1 + (i % 3 === 0 ? 1 : 0), h: i % 7 === 0 ? 2 : 1 }));
    for (const [cols, rows] of [[6, 3], [3, 5], [4, 5]]) {
      const pages = layoutFavPages(items, size, cols, rows);
      expect(pages.flatMap((p) => p.favs).map((f) => f.ix)).toEqual(items.map((_, i) => i));
      for (const p of pages) {
        const seen = new Set<number>();
        for (const c of p.cells) {
          const h = c.kind === 'fav' ? c.h : 1;
          expect(c.c + c.w).toBeLessThanOrEqual(cols);
          expect(c.r + h).toBeLessThanOrEqual(rows);
          for (let y = c.r; y < c.r + h; y++) for (let x = c.c; x < c.c + c.w; x++) { expect(seen.has(y * cols + x)).toBe(false); seen.add(y * cols + x); }
        }
      }
    }
  });

  test('a width wider than the grid is clamped to the row', () => {
    const [p] = layoutFavPages([{ n: 'a', w: 9 }], size, 3, 5);
    expect(p.favs[0]).toMatchObject({ r: 0, c: 0, w: 3 });
  });

  test('the inline placement is 1-based CSS lines', () => {
    expect(cellArea({ r: 0, c: 5, w: 1 })).toBe('grid-area: 1 / 6 / span 1 / span 1');
    expect(cellArea({ r: 1, c: 0, w: 2, h: 2 })).toBe('grid-area: 2 / 1 / span 2 / span 2');
  });
});

test.describe('Q77: the drag reorders like the arrows, to any place', () => {
  const l = ['a', 'b', 'c', 'd', 'e'];
  test('dropped on a tile: it takes that tile\'s place', () => {
    expect(moveTo(l, 0, dropIndex(0, { kind: 'fav', ix: 3 }, 5))).toEqual(['b', 'c', 'd', 'a', 'e']);
    expect(moveTo(l, 4, dropIndex(4, { kind: 'fav', ix: 1 }, 5))).toEqual(['a', 'e', 'b', 'c', 'd']);
  });
  test('dropped on a hole: it goes in at the hole', () => {
    // a hole before "d" (at 3): from 0 it lands just before d; from 4 it lands at 3
    expect(moveTo(l, 0, dropIndex(0, { kind: 'hole', at: 3 }, 5))).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(moveTo(l, 4, dropIndex(4, { kind: 'hole', at: 3 }, 5))).toEqual(['a', 'b', 'c', 'e', 'd']);
    // the trailing hole (at = length): to the end
    expect(moveTo(l, 1, dropIndex(1, { kind: 'hole', at: 5 }, 5))).toEqual(['a', 'c', 'd', 'e', 'b']);
  });
  test('out of range or onto itself changes nothing, and the list is never mutated', () => {
    expect(moveTo(l, 2, 2)).toEqual(l);
    expect(moveTo(l, -1, 2)).toEqual(l);
    expect(moveTo(l, 1, 9)).toEqual(l);
    expect(l).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  test('"+ הוסף" inserts at the hole', () => {
    expect(insertAt(['a', 'b'], 1, 'x')).toEqual(['a', 'x', 'b']);
    expect(insertAt(['a', 'b'], 7, 'x')).toEqual(['a', 'b', 'x']);
  });
});

test.describe('what "+ הוסף" offers', () => {
  const world = {
    rooms: [
      { id: 'living', lights: [{ id: 'light.main', sw: false }, { id: 'switch.shelf', sw: true }], loads: [{ id: 'switch.heater' }], zones: [{ id: 'climate.living' }], shades: [{ id: 'cover.win' }], doors: [] },
      { id: 'entry', lights: [], loads: [], zones: [], shades: [], doors: [{ id: 'lock.front' }] },
    ],
    cameras: [{ id: 'cam1', room: 'entry' }, { id: 'cam2', room: 'living' }],
    scenes: [{ id: 'morning', rooms: [] }, { id: 'cinema', rooms: ['living'] }],
    hasEnergy: true,
  };
  test('a room: its own things first, then the house scenes; what is a favourite already is left out', () => {
    const cur: Fav[] = [{ t: 'light', id: 'light.main', w: 2 }];
    expect(addCandidates('living', world, cur)).toEqual([
      { t: 'scene', id: 'cinema' }, { t: 'light', id: 'switch.shelf', w: 1 }, { t: 'switch', id: 'switch.heater' }, { t: 'climate', id: 'climate.living' },
      { t: 'shade', id: 'cover.win' }, { t: 'cam', id: 'cam2' }, { t: 'scene', id: 'morning' },
    ]);
  });
  test('"הבית שלי": the house scenes, the whole-house tiles, cameras, doors, climate', () => {
    expect(addCandidates('home', world, [{ t: 'allLights' }])).toEqual([
      { t: 'scene', id: 'morning' }, { t: 'energy' }, { t: 'cam', id: 'cam1' }, { t: 'cam', id: 'cam2' }, { t: 'door', id: 'lock.front' }, { t: 'climate', id: 'climate.living' },
    ]);
  });
  test('an unknown room offers nothing', () => {
    expect(addCandidates('attic', world, [])).toEqual([]);
  });
});

test.describe('Q79: what a scene suggests', () => {
  const panel = (o: Partial<{ state: string; available: boolean; arm_modes: string[]; arm: boolean; code: string }> = {}) => ({
    entity_id: 'alarm_control_panel.house', state: o.state ?? 'disarmed', available: o.available ?? true, arm_modes: o.arm_modes ?? ['arm_away', 'arm_home', 'arm_night'],
    can: { arm: o.arm ?? true }, code: { arm: o.code ?? 'pin' },
  });
  const door = (id: string, o: Partial<{ locked: boolean; wiskey: boolean; can: boolean; ok: boolean; kind: 'door' | 'gate' }> = {}) => ({
    id, locked: o.locked ?? false, wiskey: o.wiskey ?? false, can: o.can ?? true, ok: o.ok ?? true, kind: o.kind ?? 'door',
  });

  test('only a leaving or a night scene suggests anything', () => {
    for (const icon of ['morning', 'evening', 'arrive', 'scenes']) expect(sceneSuggestions(icon, [panel()], [door('lock.back')])).toEqual([]);
    expect(sceneSuggestions('leave', [panel()], [door('lock.back')]).map((s) => s.kind)).toEqual(['lock', 'arm']);
  });

  test('the doors first: only unlocked doors that may be locked from here (not a WisKey door, not a gate, not unavailable)', () => {
    const ds = [door('lock.back'), door('lock.front', { locked: true }), door('lock.wk', { wiskey: true }), door('lock.gate', { kind: 'gate' }), door('lock.no', { can: false }), door('lock.off', { ok: false })];
    const [first] = sceneSuggestions('night', [], ds);
    expect(first.kind).toBe('lock');
    expect(first.kind === 'lock' && first.doors.map((d) => d.id)).toEqual(['lock.back']);
  });

  test('the alarm: leaving arms away, night arms night (else home); never when armed, unavailable, not allowed, or the code cannot be met', () => {
    const one = (icon: string, p = panel()) => sceneSuggestions(icon, [p], []);
    expect(one('leave')[0]).toMatchObject({ kind: 'arm', mode: 'arm_away' });
    expect(one('night')[0]).toMatchObject({ kind: 'arm', mode: 'arm_night' });
    expect(one('night', panel({ arm_modes: ['arm_away', 'arm_home'] }))[0]).toMatchObject({ kind: 'arm', mode: 'arm_home' });
    expect(one('night', panel({ arm_modes: ['arm_away'] }))).toEqual([]);
    expect(one('leave', panel({ state: 'armed_home' }))).toEqual([]);
    expect(one('leave', panel({ available: false }))).toEqual([]);
    expect(one('leave', panel({ arm: false }))).toEqual([]);
    expect(one('leave', panel({ code: 'pin_missing' }))).toEqual([]);
    expect(one('leave', panel({ code: 'unverifiable' }))).toEqual([]);
  });

  test('arming asks for the code whenever the panel does (the usual rule of the alarm screen)', () => {
    expect(armNeedsCode({ code: { arm: 'pin' } })).toBe(true);
    expect(armNeedsCode({ code: { arm: 'panel' } })).toBe(true);
    expect(armNeedsCode({ code: { arm: 'none' } })).toBe(false);
  });
});
