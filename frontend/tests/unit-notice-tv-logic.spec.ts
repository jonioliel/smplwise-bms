import { test, expect } from '@playwright/test';
import {
  autoTheme, bandNotice, clockIn, dimBrightness, gridPlan, heldIndex, netOf, nightDim, onPoll, playlist, remoteKey, slugFrom, takeoverNotice, ticks, tokenFrom, tx, whenText,
  type FeedNotice,
} from '../src/notice-tv/tv-logic';
import { audienceOf, inputOf, kpiCounts, matches, newDraft, seenState, suggestSlug, validate, windowText } from '../src/notices/model';
import type { Notice } from '../src/api/notices';
import { LOBBY_NOTICES, display } from './notice-tv-fixtures';

// CR-NOTICE106: the TV page's pure logic (tv-logic.ts) and the editing screens' model (notices/model.ts) - no browser page needed.
//   npx playwright test tests/unit-notice-tv-logic.spec.ts --project=desktop

const N = (p: Partial<FeedNotice>): FeedNotice => ({ id: 'x', title: 't', body: 'b', severity: 'info', starts_at: '2026-10-23T05:00:00Z', ends_at: '2026-10-24T05:00:00Z', ...p });

test('dwell: own dwell_s wins, else x2 for the urgent notice and a long body', () => {
  expect(ticks(N({ dwell_s: 24 }), 12)).toBe(2);
  expect(ticks(N({ dwell_s: 3 }), 12)).toBe(1);
  expect(ticks(N({ severity: 'critical' }), 12)).toBe(2);
  expect(ticks(N({ body: 'א'.repeat(111) }), 12)).toBe(2);
  expect(ticks(N({}), 12)).toBe(1);
});

test('playlist: the urgent notice first; the band takes it out of the rotation', () => {
  const list = [N({ id: 'a' }), N({ id: 'u', severity: 'critical' }), N({ id: 'b', severity: 'alert' })];
  expect(playlist(list, display()).map((x) => x.n.id)).toEqual(['u', 'a', 'b']);
  expect(playlist(list, display({ urgent: 'band' })).map((x) => x.n.id)).toEqual(['a', 'b']);
  expect(bandNotice(list, display({ urgent: 'band' }))?.id).toBe('u');
  expect(bandNotice(list, display())).toBeNull();
});

test('hold: an explicit hold, the urgent notice with "stays", never a missing notice', () => {
  const items = playlist(LOBBY_NOTICES, display());
  expect(heldIndex(items, display({ hold: 'n3' }))).toBe(3);
  expect(heldIndex(items, display({ hold: 'gone' }))).toBe(-1);
  expect(heldIndex(items, display({ urgent: 'stay' }))).toBe(0);
  expect(heldIndex(items, display())).toBe(-1);
});

test('all together: columns by the stage width and the count, pages when there are many', () => {
  expect(gridPlan(3, true, false)).toEqual({ per: 3, cols: 3, rows: 1, pages: 1 });
  expect(gridPlan(4, true, false)).toEqual({ per: 4, cols: 2, rows: 2, pages: 1 });
  expect(gridPlan(7, true, false)).toEqual({ per: 6, cols: 3, rows: 2, pages: 2 });
  expect(gridPlan(5, false, false)).toEqual({ per: 4, cols: 2, rows: 2, pages: 2 });
  expect(gridPlan(7, false, true)).toEqual({ per: 4, cols: 1, rows: 4, pages: 2 });
  expect(gridPlan(0, true, false).pages).toBe(1);
});

test('takeover: an urgent notice in its first minute only, never with the band', () => {
  const now = Date.parse('2026-10-23T06:12:30Z');
  const u = N({ severity: 'critical', published_at: '2026-10-23T06:12:00Z' });
  expect(takeoverNotice([u], display(), now)?.id).toBe('x');
  expect(takeoverNotice([u], display(), now + 60_000)).toBeNull();
  expect(takeoverNotice([u], display({ urgent: 'band' }), now)).toBeNull();
});

test('day / night: configured hours, else the sun (+/- 15 min), else 07-19', () => {
  const c = (h: number, m = 0) => ({ h, m, weekday: 5, y: 2026, mo: 10, d: 23 });
  expect(autoTheme(c(7, 30), '07:00-19:00')).toBe('day');
  expect(autoTheme(c(21), '07:00-19:00')).toBe('night');
  expect(autoTheme(c(6, 20), '', { rise: '06:15', set: '17:12' })).toBe('night'); // before sunrise + 15
  expect(autoTheme(c(6, 31), '', { rise: '06:15', set: '17:12' })).toBe('day');
  expect(autoTheme(c(17, 0), '', { rise: '06:15', set: '17:12' })).toBe('night'); // after sunset - 15
  expect(autoTheme(c(12), '')).toBe('day');
});

test('late-night dim crosses midnight; an urgent notice wakes the screen', () => {
  const c = (h: number) => ({ h, m: 0, weekday: 1, y: 2026, mo: 10, d: 23 });
  const d = display();
  expect(nightDim(d, c(23), false)).toBe(true);
  expect(nightDim(d, c(3), false)).toBe(true);
  expect(nightDim(d, c(7), false)).toBe(false);
  expect(nightDim(d, c(3), true)).toBe(false);
  expect(nightDim(display({ night: { enabled: false, from: '23:00', to: '06:00', dim: 0.5 } }), c(3), false)).toBe(false);
  expect(dimBrightness(0.5)).toBe(0.58);
  expect(dimBrightness(1)).toBe(1);
});

test('network: stale after 3 missed polls, offline after 10 minutes, gone on 404', () => {
  let s = onPoll({ lastOk: 0, misses: 0, gone: false }, 200, 1000);
  expect(netOf(s, 2000)).toBe('live');
  s = onPoll(onPoll(onPoll(s, 500, 3000), 0, 4000), 503, 5000);
  expect(netOf(s, 6000)).toBe('stale');
  expect(netOf(s, 1000 + 10 * 60_000)).toBe('offline');
  expect(netOf(onPoll(s, 304, 7000), 7001)).toBe('live');
  expect(netOf(onPoll(s, 404, 7000), 7001)).toBe('gone');
});

test('window wording: own text, urgent "until", one day with hours, a range', () => {
  const now = new Date('2026-10-23T06:00:00Z');
  expect(whenText(N({ when: 'קבוע' }), 'Asia/Jerusalem', now, 'he')).toBe('קבוע');
  expect(whenText(N({ severity: 'critical', ends_at: '2026-10-24T09:00:00Z' }), 'Asia/Jerusalem', now, 'he')).toBe('עד מחר 12:00');
  expect(whenText(N({ starts_at: '2026-10-27T05:00:00Z', ends_at: '2026-10-27T11:00:00Z' }), 'Asia/Jerusalem', now, 'he')).toMatch(/27\.10 · 07:00–13:00$/);
  expect(whenText(N({ starts_at: '2026-11-02T06:00:00Z', ends_at: '2026-11-05T15:00:00Z' }), 'Asia/Jerusalem', now, 'he')).toBe('02.11 – 05.11');
  expect(whenText(N({ ends_at: null }), 'Asia/Jerusalem', now, 'en')).toBe('Ongoing');
});

test('text: escaped, a numeric range is one left-to-right run', () => {
  expect(tx('<b>10:00–12:00</b>')).toBe('&lt;b&gt;<bdi dir="ltr" class="num">10:00–12:00</bdi>&lt;/b&gt;');
  expect(tx('02.11 – 05.11')).toContain('<bdi dir="ltr" class="num">02.11 – 05.11</bdi>');
});

test('link parts: the token from the fragment only, the slug from /b/<slug> or ?board=', () => {
  expect(tokenFrom('#t=k9Qw2Lr7Vt3pXa8MbN4cHd6FeJ1sYz0uRiGo5wTqBv')).toBe('k9Qw2Lr7Vt3pXa8MbN4cHd6FeJ1sYz0uRiGo5wTqBv');
  expect(tokenFrom('#t=short')).toBe('');
  expect(slugFrom('/api/hassio_ingress/x/b/lobby', '')).toBe('lobby');
  expect(slugFrom('/notice-tv.html', '?board=parking-2')).toBe('parking-2');
  expect(slugFrom('/notice-tv.html', '?board=../x')).toBe('');
});

test('remote keys: left = next in a right-to-left list', () => {
  expect(remoteKey('ArrowLeft')).toBe('next');
  expect(remoteKey('ArrowRight')).toBe('prev');
  expect(remoteKey('MediaPlayPause')).toBe('toggle');
  expect(remoteKey('a')).toBeNull();
});

test('clock in the installation zone', () => {
  const c = clockIn('Asia/Jerusalem', new Date('2026-10-23T06:12:00Z'));
  expect([c.h, c.m, c.weekday, c.d, c.mo]).toEqual([9, 12, 5, 23, 10]);
});

// ---------------------------------------------------------------- the editing screens' model

const notice = (p: Partial<Notice>): Notice => ({ id: 'a', title: 't', body: '', severity: 'info', starts_at: '2026-10-23T05:00:00Z', ends_at: '2026-10-30T05:00:00Z', pinned: false,
  state: 'active', dwell_s: null, when_text: null, published_at: null, updated_at: '', boards: [], ...p });

test('KPI counts and KPI-as-filter', () => {
  const list = [notice({ id: '1' }), notice({ id: '2', severity: 'critical' }), notice({ id: '3', state: 'scheduled' }), notice({ id: '4', state: 'draft' }), notice({ id: '5', state: 'expired' }), notice({ id: '6', read: false })];
  expect(kpiCounts(list)).toEqual({ all: 3, urgent: 1, scheduled: 1, expired: 1, drafts: 1, unread: 1 });
  expect(list.filter((n) => matches(n, 'all', 'all', '', false)).length).toBe(3);
  expect(list.filter((n) => matches(n, 'all', 'all', '', true)).length).toBe(6);
  expect(list.filter((n) => matches(n, 'drafts', 'all', '', true)).map((n) => n.id)).toEqual(['4']);
  expect(list.filter((n) => matches(n, 'all', 'tv', '', true)).length).toBe(0);
});

test('compose validation: title, the urgent end, the window order, the audience, the dwell', () => {
  const d = newDraft(new Date('2026-10-23T06:00:00Z'), 7, 'info');
  expect(validate(d)).toBe('fTitle');
  expect(validate({ ...d, title: 'x' })).toBeNull();
  expect(validate({ ...d, title: 'x', severity: 'critical', untilArchived: true })).toBe('criticalNeedsEnd');
  expect(validate({ ...d, title: 'x', to: d.from })).toBe('fTo');
  expect(validate({ ...d, title: 'x', aud: 'place' })).toBe('audPlace');
  expect(validate({ ...d, title: 'x', dwell: '2' })).toBe('fDwell');
  expect(audienceOf({ ...d, aud: 'tv' })).toEqual({});
  expect(inputOf({ ...d, title: ' x ', untilArchived: true }).until_archived).toBe(true);
  expect(windowText({ starts_at: '2026-10-24T05:00:00Z', ends_at: null })).toContain('עד לביטול');
});

test('boards: last-seen state and a free slug', () => {
  const now = Date.parse('2026-10-23T06:00:00Z');
  expect(seenState({ id: 'b', name: 'x', slug: 'x', enabled: true, last_seen_at: '2026-10-23T05:59:00Z' }, now)).toBe('online');
  expect(seenState({ id: 'b', name: 'x', slug: 'x', enabled: true, last_seen_at: null }, now)).toBe('never');
  expect(seenState({ id: 'b', name: 'x', slug: 'x', enabled: false }, now)).toBe('off');
  expect(suggestSlug('Lobby', ['lobby'])).toBe('lobby-2');
  expect(suggestSlug('לוח', [])).toBe('board');
});
