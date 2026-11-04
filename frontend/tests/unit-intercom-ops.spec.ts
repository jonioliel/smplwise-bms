import { test, expect } from '@playwright/test';
import {
  ACTION_HE,
  ALERT_HE,
  OPS_TABS,
  T,
  alertTone,
  barPath,
  canCancel,
  compact,
  dayLabel,
  he,
  linePath,
  meterTone,
  nearest,
  niceMax,
  stackBars,
  stateTone,
  tabOf,
  ticks,
  trendPoints,
} from '../src/screens/intercom-ops-logic';
import type { JobRow } from '../src/api/intercom-ops';

// WISKEY-OPS-VIEWS-2400 (integration plan T11): the pure part of Settings › תפעול האינטרקום - tabs, words, tones and chart geometry.
//   npx playwright test -c playwright.unit.config.ts tests/unit-intercom-ops.spec.ts

const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|\bHA\b/i;

function strings(o: unknown, out: string[] = []): string[] {
  if (typeof o === 'string') out.push(o);
  else if (typeof o === 'function') {
    const v = (o as (...a: number[]) => unknown)(3, 5);
    if (typeof v === 'string') out.push(v);
  } else if (o && typeof o === 'object') for (const v of Object.values(o)) strings(v, out);
  return out;
}

test.describe('tabs and words', () => {
  test('six tabs; an unknown view is the overview', () => {
    expect([...OPS_TABS]).toEqual(['overview', 'operations', 'investigations', 'capacity', 'events', 'exports']);
    expect(tabOf('capacity')).toBe('capacity');
    for (const v of ['', 'nope', '__proto__', 'jobs']) expect(tabOf(v), v).toBe('overview');
    for (const t of OPS_TABS) expect(T.tabs[t]).toMatch(/[֐-׿]/);
  });

  test('every text is Hebrew and never names the platform', () => {
    for (const s of strings(T)) expect(s, s).not.toMatch(BANNED);
    for (const s of [...Object.values(ACTION_HE), ...Object.values(ALERT_HE)]) expect(s).toMatch(/[֐-׿]/);
    expect(T.people(1)).toBe('אדם אחד');
    expect(T.people(4)).toBe('4 אנשים');
    expect(T.downloaded(null)).toBe('הקובץ הורד.');
  });

  test('an unknown code is shown as itself, a missing one as a dash', () => {
    expect(he(ACTION_HE, 'users/update')).toBe('עדכון אדם');
    expect(he(ACTION_HE, 'bulk/something_new')).toBe('bulk/something_new');
    expect(he(ACTION_HE, null)).toBe('—');
  });
});

test.describe('tones', () => {
  test('capacity alerts, states and meters', () => {
    expect(alertTone('at_limit')).toBe('err');
    expect(alertTone('near_limit')).toBe('warn');
    expect(alertTone('growth_to_limit')).toBe('warn');
    expect(alertTone('observed')).toBe('ok');
    expect(alertTone('stale')).toBe('neutral');
    expect(stateTone('failed')).toBe('err');
    expect(stateTone('pending')).toBe('warn');
    expect(stateTone('verified')).toBe('ok');
    expect(stateTone('whatever')).toBe('neutral');
    expect(meterTone(null)).toBe('neutral');
    expect(meterTone(79.9)).toBe('ok');
    expect(meterTone(80)).toBe('warn');
    expect(meterTone(95)).toBe('err');
  });

  test('the cancel is offered only to an administrator, only where the intercom would take it', () => {
    const job = { cancellable: true, revision: 3 } as JobRow;
    expect(canCancel(job, true)).toBe(true);
    expect(canCancel(job, false)).toBe(false);
    expect(canCancel({ ...job, cancellable: false }, true)).toBe(false);
    expect(canCancel({ ...job, revision: null }, true)).toBe(false);
  });
});

test.describe('chart geometry', () => {
  test('clean axis maxima, ticks and compact labels', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(18)).toBe(20);
    expect(niceMax(21)).toBe(25);
    expect(niceMax(460)).toBe(500);
    expect(ticks(20)).toEqual([0, 5, 10, 15, 20]);
    expect(compact(1200)).toBe('1.2K');
    expect(compact(7.5)).toBe('7.5');
  });

  test('stacked columns: at most 24 px, a 2 px gap between segments, time running right to left in RTL', () => {
    const days = [
      { day: '2026-11-01', granted: 10, denied: 0 },
      { day: '2026-11-02', granted: 6, denied: 4 },
      { day: '2026-11-03', granted: 0, denied: 5 },
    ];
    const bars = stackBars(days, 300, 100, 10, true);
    expect(bars.map((b) => b.key)).toEqual(days.map((d) => d.day));
    for (const b of bars) expect(b.w).toBeLessThanOrEqual(24);
    expect(bars[0].x).toBeGreaterThan(bars[2].x); // the oldest day at the right
    expect(stackBars(days, 300, 100, 10, false)[0].x).toBeLessThan(stackBars(days, 300, 100, 10, false)[2].x);
    const both = bars[1];
    expect(both.granted.h).toBeCloseTo(60);
    expect(both.granted.y - (both.denied.y + both.denied.h)).toBeCloseTo(2); // the surface gap
    expect(both.denied.h + 2).toBeCloseTo(40);
    expect(bars[0].denied.h).toBe(0);
    expect(bars[2].granted.h).toBe(0);
    expect(bars[2].denied.h).toBeCloseTo(50); // a lone segment keeps its full height
    expect(stackBars([], 300, 100, 10)).toEqual([]);
  });

  test('a bar has a rounded data end and a square baseline', () => {
    const d = barPath(10, 20, 20, 50);
    expect(d.startsWith('M10,70V24Q10,20 14,20')).toBe(true);
    expect(d.endsWith('V70Z')).toBe(true);
    expect(barPath(0, 0, 10, 0)).toBe('');
    expect(barPath(0, 10, 10, 30, 0)).toBe('M0,40V10Q0,10 0,10H10Q10,10 10,10V40Z');
  });

  test('the trend: by instant, newest at the left in RTL; a missing count is skipped; the crosshair snaps to the nearest point', () => {
    const pts = trendPoints(
      [
        { at: '2026-11-01T00:00:00Z', users: 100, cards: null, max_users: 500, max_cards: null },
        { at: '2026-11-02T00:00:00Z', users: null, cards: null, max_users: 500, max_cards: null },
        { at: '2026-11-03T00:00:00Z', users: 200, cards: null, max_users: 500, max_cards: null },
      ],
      200,
      100,
      400,
      true,
    );
    expect(pts.map((p) => [p.x, p.y, p.v])).toEqual([
      [200, 75, 100],
      [0, 50, 200],
    ]);
    expect(linePath(pts)).toBe('M200,75L0,50');
    expect(nearest(pts, 30)).toBe(1);
    expect(nearest(pts, 170)).toBe(0);
    expect(nearest([], 5)).toBe(-1);
  });

  test('day labels are short and need no time-zone math', () => {
    expect(dayLabel('2026-11-03')).toBe('3.11');
    expect(dayLabel('nope')).toBe('nope');
  });
});
