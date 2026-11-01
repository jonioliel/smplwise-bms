import { test, expect } from '@playwright/test';
import { TV2_FACTORY, effectiveTv2, tv2DefaultsOf, tv2Of } from '../src/notice-tv/tv-logic';
import { v2NextText, v2Panel, v2Slide, v2Strip } from '../src/notice-tv/v2-transit';
import { NOW, digest } from './bustimes-fixtures';

// BOARDV2-297: the V2 board's option readers and its bus-times markup (pure logic, no page).
//   npx playwright test -c playwright.unit.config.ts tests/unit-boardv2-297.spec.ts

test('the V2 options: unknown or absent values read as the factory (the board as before), a board value wins over the default', () => {
  expect(TV2_FACTORY).toEqual({ design: 'classic', board_layout: 'side', co_size: 'auto', portrait_order: 'bus', next_row: 'show', live_bg: 'auto', systems_status: 'problems', urgent_screen: 'style' });
  expect(tv2DefaultsOf(undefined)).toEqual(TV2_FACTORY);
  expect(tv2DefaultsOf({ design: 'v3', board_layout: 'strip', co_size: 2 })).toEqual({ ...TV2_FACTORY, board_layout: 'strip' });
  expect(tv2Of({ design: 'v2' }, 'design')).toBe('v2');
  const dflt = { ...TV2_FACTORY, design: 'v2' as const, board_layout: 'slide' as const };
  expect(effectiveTv2({}, dflt)).toEqual(dflt);
  expect(effectiveTv2({ board_layout: 'strip', next_row: null }, dflt)).toEqual({ ...dflt, board_layout: 'strip' });
});

const ctx = { lang: 'he' as const, nowMs: NOW, next: true };

test('the "next arrivals" text: minutes under the clock threshold, clock times beyond it', () => {
  const d = digest({ specs: [{ line: '4', dest: 'א', mins: 9, more: [24, 70] }] });
  expect(v2NextText(d.items![0], d, NOW)).toMatch(/^24 · \d\d:\d\d$/);
  expect(v2NextText({ more: [] }, d, NOW)).toBe('');
});

test('the panel: a row per line, the "next" line only when the setting shows it, the legend', () => {
  const d = digest({ rows: 4, specs: [{ line: '4', dest: 'ת. מרכזית', mins: 9, more: [24, 39] }] });
  const on = v2Panel(d, ctx);
  expect(on).toContain('data-b2bus="panel"');
  expect(on).toContain('class="b2r"');
  expect(on).toContain('הבאים');
  expect(on).toContain('24 · 39');
  expect(on).toContain('לפי לוח זמנים');
  expect(v2Panel(d, { ...ctx, next: false })).not.toContain('b2nx');
});

test('every state draws into the same area: expired says unavailable, no digest yet keeps the header', () => {
  const exp = digest({ state: 'expired', items: [], overflow: 0 });
  for (const f of [(x: typeof exp | null) => v2Panel(x, ctx), (x: typeof exp | null) => v2Strip(x, ctx), (x: typeof exp | null) => v2Slide(x, ctx, true)]) {
    expect(f(exp)).toContain('data-bus-state="expired"');
    expect(f(exp)).toContain('נתוני התחבורה אינם זמינים כרגע');
    const wait = f(null);
    expect(wait).toContain('data-bus-state="wait"');
    expect(wait).toContain('תחבורה ציבורית');
  }
  expect(v2Slide(digest({}), ctx, true)).toMatch(/^<article class="it transit b2bus slide on"/);
});

test('cached data: clock times only, "not updated since" in the header', () => {
  const d = digest({ state: 'cached', updated_hm: '08:53', age_s: 900 });
  const s = v2Strip(d, ctx);
  expect(s).toContain('08:53');
  expect(s).not.toContain('<small>');
  expect(s).toContain('b2stale');
});
