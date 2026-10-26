import { test, expect } from '@playwright/test';
import {
  TRANSIT_SCREEN_DEFAULTS, ahead, badgeWide, effective, etaOf, hasPanel, minsUntil, noneText, slideWanted, transitOf, transitTick, ts, windowChip, windowWords,
} from '../src/notice-tv/transit-logic';
import { slidePanel, sidePanel, stopsTitle, stripPanel } from '../src/notice-tv/transit-view';
import { withTransit, type Item } from '../src/notice-tv/tv-logic';
import { WINDOWS, canAdd, clampInt, moveStop, screenAfter, stopsBody, toggleStop, windowLabel, windowMode } from '../src/transit/model';
import { TR_KEYS, tr } from '../src/i18n/transit';
import { distanceText, refreshMs } from '../src/notice-tv/transit-logic';
import { estimateLine } from '../src/notice-tv/transit-view';
import { NOW, columns, digest, item } from './bustimes-fixtures';

// BUSTIMES-295: the bus-times logic of the TV page (transit-logic.ts), its markup (transit-view.ts), the settings screens' model (transit/model.ts)
// and the words. Node only - no browser page.
//   npx playwright test -c playwright.unit.config.ts tests/unit-bustimes-295.spec.ts

const AT = (m: number) => new Date(NOW + m * 60_000).toISOString();

test('minutes are whole minutes to the instant and never negative', () => {
  expect(minsUntil(AT(4), NOW)).toBe(4);
  expect(minsUntil(AT(4.9), NOW)).toBe(4);
  expect(minsUntil(AT(-3), NOW)).toBe(0);
  expect(minsUntil('nonsense', NOW)).toBe(0);
});

test('time wording: "now" under 2 minutes, minutes up to the limit, then the clock; cached data is always the clock', () => {
  const fresh = { state: 'fresh' as const, clock_after_min: 60 };
  expect(etaOf(AT(0.5), '09:12', fresh, NOW)).toEqual({ kind: 'now', text: '' });
  expect(etaOf(AT(1.9), '09:14', fresh, NOW)).toEqual({ kind: 'now', text: '' });
  expect(etaOf(AT(2), '09:14', fresh, NOW)).toEqual({ kind: 'min', text: '2' });
  expect(etaOf(AT(59), '10:11', fresh, NOW)).toEqual({ kind: 'min', text: '59' });
  expect(etaOf(AT(60), '10:12', fresh, NOW)).toEqual({ kind: 'clock', text: '10:12' });
  expect(etaOf(AT(30), '09:42', { state: 'fresh', clock_after_min: 0 }, NOW)).toEqual({ kind: 'clock', text: '09:42' });
  expect(etaOf(AT(90), '10:42', { state: 'fresh', clock_after_min: 120 }, NOW)).toEqual({ kind: 'min', text: '90' });
  // a stale snapshot has no countdown: the minutes of an old digest would lie
  expect(etaOf(AT(5), '09:17', { state: 'cached', clock_after_min: 60 }, NOW)).toEqual({ kind: 'clock', text: '09:17' });
  expect(etaOf(AT(0), '09:12', { state: 'cached', clock_after_min: 60 }, NOW).kind).toBe('clock');
});

test('rows that left are dropped (a 15 s grace), the rest stay in order', () => {
  const rows = [{ at: AT(-1) }, { at: AT(-0.1) }, { at: AT(2) }];
  expect(ahead(rows, NOW).map((r) => r.at)).toEqual([AT(-0.1), AT(2)]);
});

test('the digest ages on the stopwatch when the building is offline: fresh -> cached after 3 minutes -> expired after the grace', () => {
  const d = digest({ age_s: 20 });
  expect(effective(d, 60_000)?.state).toBe('fresh');
  expect(effective(d, 170_000)?.state).toBe('cached'); // 20 + 170 s > 180 s
  expect(effective(d, 29 * 60_000)?.state).toBe('cached');
  const e = effective(d, 31 * 60_000)!;
  expect(e.state).toBe('expired');
  expect(e.items).toEqual([]);
  expect(effective(digest({ state: 'cached', age_s: 400 }), 0)?.state).toBe('cached');
  expect(effective({ state: 'off' }, 1e9)?.state).toBe('off');
  expect(effective(null, 5)).toBeNull();
  const g0 = digest({ stale_grace_min: 0, age_s: 0 });
  expect(effective(g0, 181_000)?.state).toBe('expired'); // grace 0: no last-known data at all
  const long = digest({ stale_grace_min: 120, age_s: 0 });
  expect(effective(long, 100 * 60_000)?.state).toBe('cached');
});

test('the redraw key changes with the minute, the state and the poll - and is "off" without a digest', () => {
  const d = digest();
  expect(transitTick(d, NOW)).toBe(transitTick(d, NOW + 10_000));
  expect(transitTick(d, NOW)).not.toBe(transitTick(d, NOW + 60_000));
  expect(transitTick(d, NOW)).not.toBe(transitTick({ ...d, state: 'cached' }, NOW));
  expect(transitTick(null, NOW)).toBe('off');
  expect(transitTick({ state: 'off' }, NOW)).toBe('off');
});

test('panel and slide rules: expired still shows a panel (it says unavailable) but the rotation skips the slide', () => {
  expect(hasPanel(digest())).toBe(true);
  expect(hasPanel(digest({ state: 'expired' }))).toBe(true);
  expect(hasPanel({ state: 'off' })).toBe(false);
  expect(hasPanel(null)).toBe(false);
  expect(slideWanted(digest())).toBe(true);
  expect(slideWanted(digest({ state: 'cached' }))).toBe(true);
  expect(slideWanted(digest({ state: 'expired' }))).toBe(false);
  expect(slideWanted(null)).toBe(false);
});

test('the slide joins the rotation once, at the end, with its own dwell in ticks of the board interval', () => {
  const base: Item[] = [{ n: { id: 'a', title: 'a', body: '', severity: 'info', starts_at: '', ends_at: null }, dwell: 1 }];
  expect(withTransit(base, false, 15, 12)).toBe(base);
  const out = withTransit(base, true, 24, 12);
  expect(out.map((x) => x.n.id)).toEqual(['a', 'transit']);
  expect(out[1].transit).toBe(true);
  expect(out[1].dwell).toBe(2);
  expect(withTransit([], true, 15, 12)[0].dwell).toBe(1);
});

test('a board saved before this feature reads the defaults; a partial block is completed', () => {
  expect(transitOf(undefined)).toEqual(TRANSIT_SCREEN_DEFAULTS);
  expect(transitOf({}).enabled).toBe(false);
  expect(transitOf({ transit: { enabled: true, layout: 'strip' } })).toEqual({ ...TRANSIT_SCREEN_DEFAULTS, enabled: true, layout: 'strip' });
});

test('window wording in both languages', () => {
  expect(windowWords('he', 30)).toBe('ב-30 הדקות הקרובות');
  expect(windowWords('he', 60)).toBe('בשעה הקרובה');
  expect(windowWords('he', 120)).toBe('ב-2 השעות הקרובות');
  expect(noneText('he', 30)).toBe('אין אוטובוסים ב-30 הדקות הקרובות');
  expect(noneText('en', 60)).toBe('No buses in the next hour');
  expect(noneText('en', 45)).toBe('No buses in the next 45 minutes');
  expect(windowChip('he', 15)).toBe("15 דק'");
  expect(windowChip('he', 60)).toBe('שעה');
  expect(windowChip('en', 180)).toBe('3 hours');
  expect(badgeWide('947')).toBe(false);
  expect(badgeWide('1234')).toBe(true);
});

// ---------------------------------------------------------------- the markup

test('the side panel: line badge, destination, minutes; the stop name only when several stops are mixed; the legend says "scheduled"', () => {
  const one = sidePanel(digest({ specs: [{ line: '25', dest: 'בית גיל הזהב/השקד', mins: 8 }] }), { lang: 'he', nowMs: NOW });
  expect(one).toContain('data-bus="side"');
  expect(one).toContain('<span class="ln">25</span>');
  expect(one).toContain('בית גיל הזהב/השקד');
  expect(one).toContain('<b class="num">8</b>');
  expect(one).not.toContain('<small>שדרות');
  expect(one).toContain('לפי לוח זמנים');
  const many = sidePanel(digest({ nstops: 2, multi: true }), { lang: 'he', nowMs: NOW });
  expect(many).toContain('<small>שדרות חיים וייצמן/הרצל</small>');
  expect(many).toContain('ועוד 1'); // the title: the first stop and one more
});

test('a row of 4 characters uses the narrow badge; a grouped row shows the next arrivals', () => {
  const g = item({ line: '1234', dest: 'x', mins: 5, more: [35, 65] });
  const html = sidePanel(digest({ items: [g], overflow: 0, grouped: true }), { lang: 'he', nowMs: NOW });
  expect(html).toContain('class="ln w4"');
  expect(html).toContain('class="emore num"');
  expect(html).toMatch(/emore num">[^<]*·/);
});

test('states: cached = clock times + "not updated since", expired = unavailable and no rows, empty = message + the next bus', () => {
  const ctx = { lang: 'he' as const, nowMs: NOW };
  const cached = sidePanel(digest({ state: 'cached', updated_hm: '08:53', specs: [{ line: '25', dest: 'ד', mins: 12 }] }), ctx);
  expect(cached).toContain('לא מעודכן מ-08:53');
  expect(cached).toContain('class="num cl"');
  expect(cached).not.toContain('<small>דק');
  const expired = sidePanel(digest({ state: 'expired', items: [] }), ctx);
  expect(expired).toContain('data-bus-state="expired"');
  expect(expired).toContain('נתוני התחבורה אינם זמינים כרגע');
  expect(expired).not.toContain('class="brow');
  const next = item({ line: '28', dest: 'קניון', mins: 95 });
  const empty = sidePanel(digest({ items: [], overflow: 0, window_min: 30, next }), ctx);
  expect(empty).toContain('אין אוטובוסים ב-30 הדקות הקרובות');
  expect(empty).toContain('הבא לפי לוח זמנים:');
  expect(empty).toContain(next.hm);
  const emptyEn = sidePanel(digest({ items: [], overflow: 0, window_min: 30, next }), { lang: 'en', nowMs: NOW });
  expect(emptyEn).toContain('No buses in the next 30 minutes');
});

test('the strip carries the total for the fit step; the slide has a column per stop and the clock', () => {
  const ctx = { lang: 'he' as const, nowMs: NOW };
  const strip = stripPanel(digest({ overflow: 2 }), ctx);
  expect(strip).toContain('data-bus="strip"');
  expect(strip).toMatch(/data-total="7"/);
  expect(strip.match(/class="bcard"/g)?.length).toBe(5);
  const slide = slidePanel(digest({ layout: 'slide', nstops: 3, multi: true, columns: columns(3) }), ctx, '<div class="clk num" data-time>09:12</div>');
  expect(slide).toContain('class="it transit"');
  expect(slide).toContain('data-n="3"');
  expect((slide.match(/data-bus="col"/g) ?? []).length).toBe(3);
  expect(slide).toContain('data-time');
});

test('no inline style and no external reference anywhere in the markup (the TV page runs under style-src self)', () => {
  const ctx = { lang: 'he' as const, nowMs: NOW };
  const all = [sidePanel(digest(), ctx), stripPanel(digest(), ctx), slidePanel(digest({ columns: columns(2), nstops: 2 }), ctx, ''), sidePanel(digest({ state: 'expired', items: [] }), ctx)].join('');
  expect(all).not.toMatch(/\sstyle=/);
  expect(all).not.toMatch(/https?:\/\//);
  expect(all).not.toMatch(/<script|onclick|onerror/i);
});

test('text from the server is escaped', () => {
  const evil = item({ line: '<b>1</b>', dest: '"><img src=x onerror=alert(1)>', mins: 5 });
  const html = sidePanel(digest({ items: [evil] }), { lang: 'he', nowMs: NOW });
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<b>1</b>');
  expect(html).toContain('&lt;img');
  expect(stopsTitle(digest({ nstops: 1 }), 'en')).toBe('שדרות חיים וייצמן/הרצל');
});

test('English strings exist for every Hebrew one of the TV panel', () => {
  for (const k of ['title', 'now', 'min', 'more', 'none', 'next', 'nextAt', 'sched', 'stale', 'expiredTitle', 'expiredHint'] as const) {
    expect(ts('en', k, { n: 3, w: 'x', l: '1', d: 'd', t: '08:00' })).not.toBe(ts('he', k, { n: 3, w: 'x', l: '1', d: 'd', t: '08:00' }));
  }
});

// ---------------------------------------------------------------- the settings model and words

test('stop list rules: at most 4, no duplicates, reorder', () => {
  const s = [{ code: 1 }, { code: 2 }, { code: 3 }];
  expect(canAdd(s, 9, 4)).toBe('ok');
  expect(canAdd(s, 2, 4)).toBe('dup');
  expect(canAdd([...s, { code: 4 }], 9, 4)).toBe('full');
  expect(moveStop(s, 0, 1).map((x) => x.code)).toEqual([2, 1, 3]);
  expect(moveStop(s, 0, -1)).toBe(s);
  expect(moveStop(s, 2, 1)).toBe(s);
  expect(stopsBody([{ code: 7, name: '  א ' }, { code: 8, name: '' }])).toEqual([{ code: 7, name: 'א' }, { code: 8, name: '' }]);
});

test('the window is a list value or a free one; numbers are clamped', () => {
  for (const w of WINDOWS) expect(windowMode(w)).toBe('list');
  expect(windowMode(45)).toBe('free');
  expect(windowMode(240)).toBe('free');
  expect(clampInt('3', 5, 240, 60)).toBe(5);
  expect(clampInt('999', 5, 240, 60)).toBe(240);
  expect(clampInt('abc', 5, 240, 60)).toBe(60);
  expect(clampInt(' 45 ', 5, 240, 60)).toBe(45);
  expect(windowLabel(60, 'he')).toBe('שעה');
  expect(windowLabel(120, 'he')).toBe('שעתיים');
  expect(windowLabel(180, 'en')).toBe('3 hours');
  expect(windowLabel(30, 'en')).toBe('30 min');
});

test('a screen block after a change is validated and only keeps configured stops', () => {
  const cur = { ...TRANSIT_SCREEN_DEFAULTS, enabled: true };
  const next = screenAfter(cur, { window_min: 999, rows: 1, dwell_s: 2, stops: [1, 99] }, [1, 2]);
  expect(next).toMatchObject({ window_min: 240, rows: 3, dwell_s: 6, stops: [1] });
  expect(screenAfter(cur, { window_min: 45, layout: 'strip', group: 'never' }, [1])).toMatchObject({ window_min: 45, layout: 'strip', group: 'never' });
});

test('picking stops: an empty pick means all; unchecking narrows; the last one cannot be unchecked; all checked folds back to empty', () => {
  const conf = [10, 20, 30];
  expect(toggleStop([], 20, conf)).toEqual([10, 30]);
  expect(toggleStop([10, 30], 20, conf)).toEqual([]);
  expect(toggleStop([10], 10, conf)).toEqual([10]);
  expect(toggleStop([30], 10, conf)).toEqual([10, 30]);
});

test('every Hebrew key has an English twin and placeholders match', () => {
  const missing: string[] = [];
  for (const k of TR_KEYS) {
    const h = tr(k, undefined, 'he');
    const e = tr(k, undefined, 'en');
    if (h === e) missing.push(k);
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    expect(ph(e), k).toBe(ph(h));
  }
  expect(missing).toEqual([]);
});

test('real time vs scheduled: a live estimate gets the broadcast icon and the legend; the timetable and a stale estimate the clock', () => {
  const ctx = { lang: 'he' as const, nowMs: NOW };
  const rt = { ...item({ line: '25', dest: 'א', mins: 6 }), quality: 'realtime' as const, scheduled_time: AT(10), estimated_time: AT(6) };
  const sc = { ...item({ line: '28', dest: 'ב', mins: 12 }), quality: 'scheduled' as const };
  const stale = { ...item({ line: '31', dest: 'ג', mins: 15 }), quality: 'stale' as const, estimated_time: AT(5) };
  const live = sidePanel(digest({ items: [rt, sc, stale], realtime: true }), ctx);
  expect((live.match(/class="mk rt"/g) ?? []).length).toBe(1);
  expect((live.match(/class="mk sc"/g) ?? []).length).toBe(2);
  expect(live).toContain('הערכה');
  const none = sidePanel(digest({ items: [sc], realtime: false }), ctx);
  expect(none).not.toContain('הערכה');
  // while the source is down nothing is "live": cached shows clocks and no legend entry
  const cached = sidePanel(digest({ state: 'cached', items: [rt], realtime: true }), ctx);
  expect(cached).not.toContain('class="mk rt"');
  expect(cached).not.toContain('הערכה');
  expect(stripPanel(digest({ items: [rt, sc] }), ctx)).toContain('class="mk rt"');
});

// ---- the estimate wording: distance first, then the estimate (owner 26.10)
const est = (mins: number, dist: number, posAge = 60) => item({ line: '25', dest: 'א', mins, dist, posAge });

test('the estimate line is "distance - estimate in N min", distance first, in both languages', () => {
  const d = digest({ specs: [] });
  const he = { lang: 'he' as const, nowMs: NOW, elapsedMs: 0 };
  const en = { lang: 'en' as const, nowMs: NOW, elapsedMs: 0 };
  const strip = (h: string) => h.replace(/<[^>]+>/g, '');
  expect(strip(estimateLine(est(3, 800), d, he))).toBe('800 מ׳ מהתחנה · הערכה בעוד 3 דק׳');
  expect(strip(estimateLine(est(3, 800), d, en))).toBe('800 m away · est. in 3 min');
  expect(strip(estimateLine(est(3, 1200), d, he))).toBe('1.2 ק״מ מהתחנה · הערכה בעוד 3 דק׳');
  expect(strip(estimateLine(est(3, 1200), d, en))).toBe('1.2 km away · est. in 3 min');
  expect(estimateLine(est(3, 800), d, he).indexOf('מהתחנה')).toBeLessThan(estimateLine(est(3, 800), d, he).indexOf('הערכה')); // DOM order = reading order (RTL flows right to left by itself)
  expect(strip(estimateLine(est(1, 400), d, he))).toBe('400 מ׳ מהתחנה · הערכה: עכשיו');
});

test('from clock_after_min on the estimate is a clock time', () => {
  const d = digest({ specs: [], clock_after_min: 60 });
  const line = estimateLine(est(75, 3000), d, { lang: 'he', nowMs: NOW, elapsedMs: 0 }).replace(/<[^>]+>/g, '');
  expect(line).toMatch(/^3\.0 ק״מ מהתחנה · הערכה ב-\d\d:\d\d$/);
  expect(estimateLine(est(75, 3000), d, { lang: 'en', nowMs: NOW }).replace(/<[^>]+>/g, '')).toMatch(/^3\.0 km away · est\. at \d\d:\d\d$/);
});

test('no distance for a scheduled or stale row, a cached digest, a switched-off screen or an old position', () => {
  const ctx = { lang: 'he' as const, nowMs: NOW, elapsedMs: 0 };
  const sched = { ...item({ line: '28', dest: 'ב', mins: 12 }), distance_m: 500, quality: 'scheduled' as const };
  const stale = { ...est(5, 500), quality: 'stale' as const };
  expect(estimateLine(sched, digest(), ctx)).toBe('');
  expect(estimateLine(stale, digest(), ctx)).toBe('');
  expect(estimateLine(est(5, 500), digest({ state: 'cached' }), ctx)).toBe('');
  expect(estimateLine(est(5, 500), digest({ show_distance: false }), ctx)).toBe('');
  // the position keeps ageing on the stopwatch between two fetches: 250 s old + 60 s > the 300 s limit
  expect(estimateLine(est(5, 500, 250), digest(), { ...ctx, elapsedMs: 60_000 })).toBe('');
  expect(estimateLine(est(5, 500, 250), digest(), { ...ctx, elapsedMs: 20_000 })).not.toBe('');
  expect(distanceText('he', { quality: 'realtime', distance_m: 0 }, { state: 'fresh' }, 0)).toBe('');
});

test('only an estimate row prints the line in the markup; the three layouts carry it and the scheduled rows do not', () => {
  const ctx = { lang: 'he' as const, nowMs: NOW, elapsedMs: 0 };
  const specs = [{ line: '25', dest: 'א', mins: 3, dist: 800 }, { line: '28', dest: 'ב', mins: 12 }];
  const d = digest({ specs });
  for (const html of [sidePanel(d, ctx), stripPanel(d, ctx)]) {
    expect((html.match(/class="est"/g) ?? []).length).toBe(1);
    expect(html).toContain('800 מ׳ מהתחנה');
    expect(html).toContain('הערכה בעוד 3 דק׳');
  }
  const slide = slidePanel(digest({ layout: 'slide', nstops: 2, columns: columns(2).map((c) => ({ ...c, items: [est(3, 800)] })) }), ctx, '<div></div>');
  expect((slide.match(/800 מ׳ מהתחנה/g) ?? []).length).toBe(2);
  expect(sidePanel(digest({ show_distance: false, specs }), ctx)).not.toContain('מהתחנה');
});

test('the screen asks for the digest at the cadence the server gave, 10-120 s, 20 s before the first answer', () => {
  expect(refreshMs(null)).toBe(20_000);
  expect(refreshMs(digest({ refresh_s: 30 }))).toBe(30_000);
  expect(refreshMs(digest({ refresh_s: 3 }))).toBe(10_000);
  expect(refreshMs(digest({ refresh_s: 999 }))).toBe(120_000);
});

test('the fresh window follows the poll cadence (fresh_s) when the building is offline', () => {
  const d = digest({ fresh_s: 360, age_s: 0 });
  expect(effective(d, 300_000)?.state).toBe('fresh');
  expect(effective(d, 400_000)?.state).toBe('cached');
  expect(effective(digest({ age_s: 0 }), 190_000)?.state).toBe('cached');
});

test('screen block: refresh_s and show_distance default to the installation (null), validated 10-120', () => {
  expect(TRANSIT_SCREEN_DEFAULTS.refresh_s).toBeNull();
  expect(TRANSIT_SCREEN_DEFAULTS.show_distance).toBeNull();
  const cur = transitOf(null);
  expect(screenAfter(cur, { refresh_s: 5 }, []).refresh_s).toBe(10);
  expect(screenAfter(cur, { refresh_s: 500 }, []).refresh_s).toBe(120);
  expect(screenAfter(cur, { refresh_s: null }, []).refresh_s).toBeNull();
  expect(screenAfter(cur, { show_distance: false }, []).show_distance).toBe(false);
});
