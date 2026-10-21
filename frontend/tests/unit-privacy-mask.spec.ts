import { test, expect } from '@playwright/test';
import {
  MIN_SIDE,
  clampRect,
  defaultRect,
  dragCorner,
  draftOf,
  invalidOf,
  isChanged,
  itemOf,
  keyEdit,
  rectOf,
  rectPoints,
  spanRect,
  undoableChange,
  type Draft,
} from '../src/screens/privacy-mask-logic';
import { PM_DEV_MARKED, PM_KEYS, PM_TABLES, pm, pmError } from '../src/i18n/privacy-mask';

// MASKUI-295: the pure logic of the privacy-mask editor and its words. Runs in Node (no page):
//   npx playwright test tests/unit-privacy-mask.spec.ts --project=desktop

const F = { width: 704, height: 576 };

test('every key exists in all four languages, none names the home platform or offers a ticket action', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    expect(Object.keys(PM_TABLES[lang]).sort()).toEqual([...PM_KEYS].sort());
    for (const k of PM_KEYS) {
      expect(PM_TABLES[lang][k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(PM_TABLES[lang][k]).not.toMatch(/Home Assistant|\bHA\b|Ingress|ticket|קריאת שירות|service request/i);
    }
    // placeholders survive translation
    for (const k of PM_KEYS) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(PM_TABLES[lang][k]), `${lang}.${k}`).toBe(ph(PM_TABLES.he[k]));
    }
  }
  expect(PM_DEV_MARKED).toEqual(['ar', 'ru']);
  expect(pm('regions_count', { n: 2, max: 4 }, 'en')).toBe('2 of 4 regions');
  expect(pmError('stale', 'en')).toContain('changed');
  expect(pmError('something_new', 'en')).toBe(PM_TABLES.en.e_generic);
});

test('a four-point region is a rectangle only when axis-aligned; a free shape stays as the device holds it', () => {
  expect(rectOf(rectPoints({ x: 10, y: 20, w: 30, h: 40 }))).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  expect(rectOf([[0, 0], [10, 2], [10, 10], [0, 10]])).toBeNull();
  expect(rectOf([[0, 0], [10, 0], [10, 10]])).toBeNull();
  const d = draftOf(true, [{ id: '1', points: rectPoints({ x: 1, y: 1, w: 20, h: 20 }) }, { id: '2', points: [[60, 400], [200, 380], [230, 520], [40, 540]] }]);
  expect(d.regions.map((r) => !!r.rect)).toEqual([true, false]);
  // a free shape is sent back unchanged
  expect(itemOf('cam', d).regions[1].points).toEqual([[60, 400], [200, 380], [230, 520], [40, 540]]);
});

test('clamping: inside the frame, never below the minimum side, whole units', () => {
  expect(clampRect({ x: -5, y: 700, w: 2, h: 1000 }, F)).toEqual({ x: 0, y: 0, w: MIN_SIDE, h: F.height });
  expect(clampRect({ x: 690, y: 10, w: 50, h: 50 }, F)).toEqual({ x: 654, y: 10, w: 50, h: 50 });
  expect(spanRect(10, 10, 12, 100, F)).toBeNull();
  expect(spanRect(100, 100, 20, 30, F)).toEqual({ x: 20, y: 30, w: 80, h: 70 });
});

test('keyboard: arrows move, Shift+arrows resize, Ctrl is ten times larger; left is always a smaller x (never mirrored)', () => {
  const r = { x: 100, y: 100, w: 50, h: 50 };
  expect(keyEdit(r, 'ArrowLeft', false, F)).toEqual({ x: 93, y: 100, w: 50, h: 50 });
  expect(keyEdit(r, 'ArrowRight', false, F)).toEqual({ x: 107, y: 100, w: 50, h: 50 });
  expect(keyEdit(r, 'ArrowDown', true, F)).toEqual({ x: 100, y: 100, w: 50, h: 56 });
  expect(keyEdit(r, 'ArrowRight', false, F, true)).toEqual({ x: 170, y: 100, w: 50, h: 50 });
  expect(keyEdit({ x: 0, y: 0, w: 5, h: 5 }, 'ArrowLeft', true, F)).toEqual({ x: 0, y: 0, w: MIN_SIDE, h: 5 }); // cannot shrink below the minimum
  expect(keyEdit({ x: 0, y: 0, w: 5, h: 5 }, 'ArrowUp', false, F).y).toBe(0);
});

test('dragging a corner keeps the opposite corner and the minimum side', () => {
  const r = { x: 100, y: 100, w: 100, h: 100 };
  expect(dragCorner(r, 'br', 260, 250, F)).toEqual({ x: 100, y: 100, w: 160, h: 150 });
  expect(dragCorner(r, 'tl', 50, 60, F)).toEqual({ x: 50, y: 60, w: 150, h: 140 });
  expect(dragCorner(r, 'br', 90, 90, F)).toEqual({ x: 90, y: 90, w: 10, h: 10 }); // dragged past the anchor: the rectangle flips, it does not vanish
  const tiny = dragCorner(r, 'br', 101, 101, F);
  expect(tiny.w).toBeGreaterThanOrEqual(MIN_SIDE);
  expect(tiny.h).toBeGreaterThanOrEqual(MIN_SIDE);
  expect(dragCorner(r, 'br', 9999, 9999, F)).toEqual({ x: 100, y: 100, w: 604, h: 476 });
});

test('a new region is inside the frame and the next one does not sit on top of it', () => {
  const a = defaultRect(F, 0);
  const b = defaultRect(F, 1);
  expect(b).not.toEqual(a);
  for (const r of [a, b, defaultRect(F, 9)]) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(F.width);
    expect(r.y + r.h).toBeLessThanOrEqual(F.height);
  }
});

test('changed means a different mask: the order and the point order do not count', () => {
  const orig = draftOf(true, [{ id: '1', points: rectPoints({ x: 10, y: 10, w: 40, h: 40 }) }, { id: '2', points: rectPoints({ x: 100, y: 10, w: 40, h: 40 }) }]);
  const same: Draft = { enabled: true, regions: [...orig.regions].reverse().map((r) => ({ ...r, points: [...r.points].reverse() })) };
  expect(isChanged(orig, same)).toBe(false);
  expect(isChanged(orig, { ...orig, enabled: false })).toBe(true);
  const moved = { enabled: true, regions: [orig.regions[0], { ...orig.regions[1], rect: { x: 101, y: 10, w: 40, h: 40 } }] };
  expect(isChanged(orig, moved)).toBe(true);
});

test('validation mirrors the server: an active mask needs a region, at most the device limit, no region below the minimum', () => {
  const none: Draft = { enabled: true, regions: [] };
  expect(invalidOf(none, 4, F)).toBe('need_region');
  expect(invalidOf({ enabled: false, regions: [] }, 4, F)).toBeNull(); // switching a mask off with no region is fine
  const five = draftOf(true, Array.from({ length: 5 }, (_, i) => ({ id: String(i), points: rectPoints({ x: i * 20, y: 0, w: 10, h: 10 }) })));
  expect(invalidOf(five, 4, F)).toBe('too_many');
  expect(invalidOf(draftOf(true, [{ id: '1', points: rectPoints({ x: 0, y: 0, w: 2, h: 10 }) }]), 4, F)).toBe('too_small');
  expect(invalidOf(draftOf(true, [{ id: '1', points: rectPoints({ x: 0, y: 0, w: 10, h: 10 }) }]), 4, F)).toBeNull();
});

test('the request item carries the draft; the etag only when the preview gave one', () => {
  const d = draftOf(true, [{ id: '1', points: rectPoints({ x: 1, y: 2, w: 30, h: 40 }) }]);
  expect(itemOf('cam-1', d)).toEqual({ camera_id: 'cam-1', enabled: true, regions: [{ points: [[1, 2], [31, 2], [31, 42], [1, 42]] }] });
  expect(itemOf('cam-1', d, 'abc').etag).toBe('abc');
});

test('the undo is offered only on the newest applied write that was not itself an undo', () => {
  const row = (id: string, status: string, rollback_of: string | null = null) => ({ id, kind: 'privacy_mask', status, rollback_of });
  expect(undoableChange([row('b', 'applied'), row('a', 'applied')])?.id).toBe('b');
  expect(undoableChange([row('c', 'applied', 'b'), row('b', 'rolled_back'), row('a', 'rolled_back')])).toBeNull();
  expect(undoableChange([row('b', 'failed'), row('a', 'applied')])).toBeNull();
  expect(undoableChange([])).toBeNull();
  expect(undoableChange([{ id: 'x', kind: 'stream_encoding', status: 'applied', rollback_of: null }])).toBeNull();
});
