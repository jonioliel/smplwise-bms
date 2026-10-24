import { test, expect } from '@playwright/test';
import { playlist, withSlides, type Item } from '../src/notice-tv/tv-logic';
import { LOBBY_NOTICES, display } from './notice-tv-fixtures';

// NOTICESLIDES-295: the promo slides join the rotation after the notices, in the rotation mode only (pure logic).
//   npx playwright test tests/unit-noticeslides-295.spec.ts --project=desktop

const SLIDES = [
  { id: 's1', title: 'חדר הכושר פתוח', text: 'כל יום 06:00-23:00' },
  { id: 's2', title: 'אפליקציית הבניין', text: 'הודעות ותקלות', seconds: 30, image: 'api/v1/notices/display/lobby/slide/s2?v=abc' },
];

const base = (): Item[] => playlist(LOBBY_NOTICES, display());

test('slides come after the notices, with the board interval or their own seconds', () => {
  const list = withSlides(base(), SLIDES, display({ blocks: { promo: true } as never }));
  expect(list.length).toBe(LOBBY_NOTICES.length + 2);
  const tail = list.slice(-2);
  expect(tail.map((x) => x.n.id)).toEqual(['slide:s1', 'slide:s2']);
  expect(tail.map((x) => x.dwell)).toEqual([1, 3]); // 12 s default = 1 tick; 30 s = 3 ticks of 12 s (rounded)
  expect(tail[1].slide?.image).toContain('/slide/s2');
  expect(list.slice(0, LOBBY_NOTICES.length).every((x) => !x.slide)).toBe(true);
});

test('no slides when the promo block is off, the mode is not the rotation, or the feed has none', () => {
  const l = base();
  expect(withSlides(l, SLIDES, display({ blocks: { promo: false } as never }))).toBe(l);
  expect(withSlides(l, SLIDES, display({ mode: 'all', blocks: { promo: true } as never }))).toBe(l);
  expect(withSlides(l, SLIDES, display({ mode: 'focus', blocks: { promo: true } as never }))).toBe(l);
  expect(withSlides(l, [], display({ blocks: { promo: true } as never }))).toBe(l);
  expect(withSlides(l, undefined, display({ blocks: { promo: true } as never }))).toBe(l);
});

test('a slide never carries a severity that could take over the screen', () => {
  const list = withSlides([], SLIDES, display({ blocks: { promo: true } as never }));
  expect(list.every((x) => x.n.severity === 'info')).toBe(true);
});
