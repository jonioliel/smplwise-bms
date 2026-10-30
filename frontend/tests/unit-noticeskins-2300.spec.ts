import { test, expect } from '@playwright/test';
import { DESIGNS, TV2_FACTORY, effectiveTv2, str, tv2DefaultsOf, tv2Of, type StrKey } from '../src/notice-tv/tv-logic';
import {
  BODY_PX, FS_MIN, FS_MIN_TAKE, bestScale, canvasOf, infoIcon, isEventWhen, isSkin, minBodyPx, queueMax, queueRows, slatCount, tickSeconds, weatherIcon,
} from '../src/notice-tv/skin-logic';

// NOTICEBOARD-STYLES-2300: the pure rules of the Ink and Sign notice-board styles (owner decisions 2026-10-30): both are values of the board
// `design` option, neither is a default, a long body shrinks to a readable floor, the "Up next" list, the canvas shapes.
//   npx playwright test -c playwright.unit.config.ts tests/unit-noticeskins-2300.spec.ts

test('the designs: classic, v2, ink, sign - and the factory stays classic (neither style is a default)', () => {
  expect(DESIGNS.slice(0, 4)).toEqual(['classic', 'v2', 'ink', 'sign']); // LOBBY-STYLES-2300 appended the six lobby styles
  expect(TV2_FACTORY.design).toBe('classic');
  expect(tv2Of({ design: 'ink' }, 'design')).toBe('ink');
  expect(tv2Of({ design: 'sign' }, 'design')).toBe('sign');
  expect(tv2Of({ design: 'Ink' }, 'design')).toBe('classic'); // an unknown value reads as the factory value
  expect(tv2DefaultsOf({ design: 'sign' }).design).toBe('sign');
  expect(effectiveTv2({}, { ...TV2_FACTORY, design: 'ink' }).design).toBe('ink'); // the installation default reaches a board that chose nothing
  expect(effectiveTv2({ design: 'v2' }, { ...TV2_FACTORY, design: 'ink' }).design).toBe('v2'); // a board's own value wins
  expect(isSkin('ink') && isSkin('sign')).toBe(true);
  expect(isSkin('v2') || isSkin('classic') || isSkin(undefined)).toBe(false);
});

test('shrink to fit: the largest scale that fits, never below the floor; 0 when even the floor does not fit', () => {
  expect(bestScale(() => true, FS_MIN)).toBe(1);
  expect(bestScale(() => false, FS_MIN)).toBe(0);
  const best = bestScale((s) => s <= 0.8, FS_MIN);
  expect(best).toBeGreaterThan(0.79);
  expect(best).toBeLessThanOrEqual(0.8);
  expect(bestScale((s) => s <= FS_MIN, FS_MIN)).toBeGreaterThanOrEqual(FS_MIN);
  expect(bestScale((s) => s <= 0.9, FS_MIN, 3)).toBeLessThanOrEqual(0.9); // fewer halvings: coarser, still a fitting scale
});

test('the readable floor: 28 px body or larger on the 1080 px canvas in both styles', () => {
  expect(FS_MIN).toBe(0.64);
  expect(minBodyPx('ink')).toBeGreaterThanOrEqual(28);
  expect(minBodyPx('sign')).toBeGreaterThanOrEqual(28);
  expect(BODY_PX).toEqual({ ink: 46, sign: 44 });
  expect(minBodyPx('ink', true)).toBe(25.8); // the take-over and the announcement (one screen, larger type) may go a little lower
  expect(FS_MIN_TAKE).toBeLessThan(FS_MIN);
});

test('"Up next": up to 4 rows (5 on a 16:10 tablet, 3 portrait), in rotation order wrapping, then "and N more"', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const q = queueRows(ids, 5, queueMax(false, false));
  expect(q.rows.map((r) => r.item)).toEqual(['g', 'a', 'b', 'c']);
  expect(q.rows.map((r) => r.pos)).toEqual([6, 0, 1, 2]);
  expect(q.more).toBe(2);
  expect(queueRows(ids, 0, queueMax(false, true)).rows).toHaveLength(5);
  expect(queueRows(ids, 0, queueMax(false, true)).more).toBe(1);
  expect(queueRows(ids, 0, queueMax(true, false)).rows).toHaveLength(3);
  expect(queueRows(['a', 'b', 'c'], 0, 4)).toEqual({ rows: [{ item: 'b', pos: 1 }, { item: 'c', pos: 2 }], more: 0 });
  expect(queueRows(['a'], 0, 4)).toEqual({ rows: [], more: 0 }); // one notice: no list
  expect(queueRows([], 0, 4)).toEqual({ rows: [], more: 0 });
});

test('the canvas: 1920x1080, 1920x1200 for 16:10, 1080x1920 and 1200x1920 portrait; a forced orientation keeps its own canvas', () => {
  expect(canvasOf(1920, 1080)).toMatchObject({ w: 1920, h: 1080, portrait: false, ratio10: false });
  expect(canvasOf(1280, 800)).toMatchObject({ w: 1920, h: 1200, portrait: false, ratio10: true });
  expect(canvasOf(1080, 1920)).toMatchObject({ w: 1080, h: 1920, portrait: true, ratio10: false });
  expect(canvasOf(800, 1280)).toMatchObject({ w: 1200, h: 1920, portrait: true, ratio10: true });
  expect(canvasOf(1920, 1080, 'portrait')).toMatchObject({ w: 1080, h: 1920, portrait: true });
  expect(canvasOf(1080, 1920, 'landscape')).toMatchObject({ w: 1920, h: 1080, portrait: false });
  expect(canvasOf(1280, 800, 'landscape')).toMatchObject({ w: 1920, h: 1200 }); // the shape already matches
  expect(slatCount(false)).toBe(8);
  expect(slatCount(true)).toBe(6);
});

test('the event frame (Ink): a date or a time window, not "ongoing" and not "until ..."', () => {
  expect(isEventWhen('יום שלישי 03.11 · 08:00–14:00', 'קבוע')).toBe(true);
  expect(isEventWhen('02.11 – 05.11', 'קבוע')).toBe(true);
  expect(isEventWhen('11.11 · 19:30', 'קבוע')).toBe(true);
  expect(isEventWhen('קבוע', 'קבוע')).toBe(false);
  expect(isEventWhen('', 'קבוע')).toBe(false);
  expect(isEventWhen('עד מחר 12:00', 'קבוע')).toBe(false);
  expect(isEventWhen('Until today 12:00', 'Ongoing')).toBe(false);
  expect(isEventWhen('Tuesday 03.11 · 08:00–14:00', 'Ongoing')).toBe(true);
});

test('icons: the feed kinds and the weather conditions the styles draw; anything else is a neutral icon', () => {
  expect(infoIcon('elevators')).toBe('elevator');
  expect(infoIcon('generator')).toBe('generator');
  expect(infoIcon('parking')).toBe('parking');
  expect(infoIcon('gym')).toBe('gym');
  expect(infoIcon('pool')).toBe('info');
  expect(weatherIcon('moon')).toBe('moon');
  expect(weatherIcon('fog')).toBe('cloud');
});

test('rotation: one tick is the board interval clamped to 6..60 s', () => {
  expect(tickSeconds(12)).toBe(12);
  expect(tickSeconds(2)).toBe(6);
  expect(tickSeconds(500)).toBe(60);
  expect(tickSeconds(undefined)).toBe(12);
});

test('the strings of the styles exist in Hebrew and English', () => {
  const keys: StrKey[] = ['next', 'ofN', 'slideWord', 'infoWord', 'annUrgent', 'annNormal', 'shownUntil', 'more', 'urgent', 'alert', 'empty', 'niceDay', 'news', 'offline', 'staleFrom', 'gone', 'goneHint'];
  for (const lang of ['he', 'en'] as const) {
    for (const k of keys) expect(str(lang, k, { n: 3, i: 1, t: '09:12' }).length).toBeGreaterThan(1);
    expect(str(lang, 'ofN', { i: 2, n: 6 })).toMatch(/2.*6/);
  }
  expect(str('he', 'next')).toBe('בהמשך');
  expect(str('en', 'next')).toBe('Up next');
  expect(str('he', 'more', { n: 2 })).toBe('ועוד 2 הודעות');
});
