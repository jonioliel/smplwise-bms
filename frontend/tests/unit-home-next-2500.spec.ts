import { expect, test } from '@playwright/test';
import { NOTICE_NEW_DEFAULT_H, isNewNotice, noticeAt, noticeNewHours, sharedNewHours } from '../src/home/wall-notice-logic';
import { URGENT_FRESH_MS, WALL_DEFAULTS, takeoverFor, urgentFreshMs, wallSettings, type NoticeLike } from '../src/home/wall-rest-logic';

// HOME-NEXT-2500 (owner 22.11, Q72 = the recommendation) in node: on a shared wall panel there is no "קראתי" - a notice is "new" for
// 48 hours after it was published (installation setting: 24 / 48 / 72 hours, a week, or "read" as before); on a person's own screen
// "new" stays "not read by me". The urgent-notice takeover follows the same "new" window.

const NOW = Date.parse('2026-11-24T10:00:00Z');
const H = 3600_000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const notice = (o: Partial<NoticeLike> = {}): NoticeLike => ({ id: 'n', title: 't', body: 'b', severity: 'info', read: false, published_at: iso(H), starts_at: null, ends_at: null, ...o });

test.describe('HOME-NEXT-2500 the "new" window of a wall panel', () => {
  test('the setting reads as hours: default 48, 0 = the panel\'s own "read", anything else falls back to 48', () => {
    expect(NOTICE_NEW_DEFAULT_H).toBe(48);
    expect(noticeNewHours(undefined)).toBe(48);
    expect(noticeNewHours({})).toBe(48);
    expect(noticeNewHours({ notice_new_h: 0 })).toBe(0);
    for (const h of [24, 48, 72, 168]) expect(noticeNewHours({ notice_new_h: h })).toBe(h);
    for (const bad of [-1, 1.5, '24', null, NaN, Infinity]) expect(noticeNewHours({ notice_new_h: bad }), String(bad)).toBe(48);
  });

  test('only a wall panel uses the window; a person\'s own screen keeps "not read by me"', () => {
    expect(sharedNewHours(true, { notice_new_h: 72 })).toBe(72);
    expect(sharedNewHours(true, undefined)).toBe(48); // a 2.48 server sends no `notice_new_h`: the owner's default
    expect(sharedNewHours(true, { notice_new_h: 0 })).toBe(0);
    expect(sharedNewHours(false, { notice_new_h: 72 })).toBe(0);
  });

  test('on a wall panel: new while younger than the window, whatever the panel account read', () => {
    expect(isNewNotice(notice({ read: true, published_at: iso(47 * H) }), NOW, 48)).toBe(true);
    expect(isNewNotice(notice({ read: false, published_at: iso(48 * H) }), NOW, 48)).toBe(false); // the exact boundary is no longer new
    expect(isNewNotice(notice({ read: false, published_at: iso(48 * H - 1) }), NOW, 48)).toBe(true);
    expect(isNewNotice(notice({ published_at: iso(30 * H) }), NOW, 24)).toBe(false);
    expect(isNewNotice(notice({ published_at: iso(160 * H) }), NOW, 168)).toBe(true);
    expect(isNewNotice(notice({ published_at: iso(-2 * H) }), NOW, 48)).toBe(true); // scheduled ahead of the clock
  });

  test('no published time: the start counts; neither = never new on a shared screen', () => {
    expect(noticeAt(notice({ published_at: null, starts_at: iso(H) }))).toBe(NOW - H);
    expect(isNewNotice(notice({ published_at: null, starts_at: iso(H) }), NOW, 48)).toBe(true);
    expect(isNewNotice(notice({ published_at: null, starts_at: iso(50 * H) }), NOW, 48)).toBe(false);
    expect(isNewNotice(notice({ published_at: null, starts_at: null }), NOW, 48)).toBe(false);
    expect(isNewNotice(notice({ published_at: 'not a time' }), NOW, 48)).toBe(false);
  });

  test('"read" mode and a person\'s own screen: new = not read, the age does not matter', () => {
    expect(isNewNotice(notice({ read: false, published_at: iso(500 * H) }), NOW, 0)).toBe(true);
    expect(isNewNotice(notice({ read: true, published_at: iso(H) }), NOW, 0)).toBe(false);
    expect(isNewNotice(notice({ read: undefined, published_at: null }), NOW, 0)).toBe(true);
  });
});

test.describe('HOME-NEXT-2500 the takeover follows the "new" window', () => {
  const urgent = (hoursAgo: number, id = 'u') => notice({ id, severity: 'critical', published_at: iso(hoursAgo * H) });

  test('the wall settings carry the window (default 48)', () => {
    expect(WALL_DEFAULTS.noticeNewH).toBe(48);
    expect(wallSettings({ notice_new_h: 24 }).noticeNewH).toBe(24);
    expect(wallSettings({ notice_new_h: 0 }).noticeNewH).toBe(0);
    expect(urgentFreshMs(wallSettings({ notice_new_h: 72 }))).toBe(72 * H);
    expect(urgentFreshMs(wallSettings({ notice_new_h: 0 }))).toBe(URGENT_FRESH_MS); // "read" mode keeps the 48 hours
    expect(urgentFreshMs(wallSettings(undefined))).toBe(48 * H);
  });

  test('an urgent notice older than the window does not take over; a longer window lets it', () => {
    const none = new Set<string>();
    const list = [urgent(30)];
    expect(takeoverFor('alarm_urgent', [], list, none, NOW, urgentFreshMs(wallSettings({ notice_new_h: 24 })))).toBeNull();
    expect(takeoverFor('alarm_urgent', [], list, none, NOW, urgentFreshMs(wallSettings({ notice_new_h: 48 })))?.key).toBe('notice:u');
    expect(takeoverFor('alarm_urgent', [], [urgent(100)], none, NOW, urgentFreshMs(wallSettings({ notice_new_h: 168 })))?.key).toBe('notice:u');
    expect(takeoverFor('alarm_urgent', [], [urgent(100)], none, NOW)).toBeNull(); // the default argument is still 48 hours
  });
});
