import { test, expect } from '@playwright/test';
import { ANNOUNCE_SCREEN_RANGE, type AnnounceScreenOption } from '../src/api/announcements';
import { channelFlags, clampScreenNumber, hasChannel, patchScreen, screenTargets } from '../src/announce/model';
import { closeLabel, dirOf, endsAt, headingOf, overlayHtml, overlayKey, pollMs, sizeOf, visibleNow, type ScreenAnnouncement } from '../src/announce/screen-overlay';
import { ANNOUNCE_TABLES } from '../src/i18n/announce';

// ANNOUNCEB-295 (voice announcements, stage B): the pure rules of the announcement overlay on a screen and of the screens settings. Node only.

const A = (o: Partial<ScreenAnnouncement> = {}): ScreenAnnouncement => ({
  id: 'a1', critical: false, until: '2026-10-25T10:00:30Z', texts: [{ language: 'he', text: 'המעלית בתחזוקה' }], ...o,
});
const T0 = Date.parse('2026-10-25T10:00:00Z');

test('visible only while its end is in the future; a closed id stays hidden; no text is no overlay', () => {
  expect(visibleNow(A(), T0)).toBe(true);
  expect(visibleNow(A(), T0 + 30_000)).toBe(false);
  expect(visibleNow(A(), T0 + 29_999)).toBe(true);
  expect(visibleNow(A(), T0, 'a1')).toBe(false);
  expect(visibleNow(A(), T0, 'other')).toBe(true);
  expect(visibleNow(A({ texts: [] }), T0)).toBe(false);
  expect(visibleNow(null, T0)).toBe(false);
  expect(visibleNow(A({ until: 'garbage' }), T0)).toBe(false);
  expect(endsAt(undefined)).toBe(0);
});

test('the type size follows the amount of text so it fits one screen: short single line huge, long multi-language small', () => {
  expect(sizeOf(A())).toBe('xl');
  expect(sizeOf(A({ texts: [{ language: 'he', text: 'א'.repeat(90) }] }))).toBe('l');
  expect(sizeOf(A({ texts: [{ language: 'he', text: 'א'.repeat(50) }, { language: 'en', text: 'b'.repeat(50) }] }))).toBe('l');
  expect(sizeOf(A({ texts: ['he', 'en', 'ru'].map((language) => ({ language: language as 'he', text: 'x'.repeat(80) })) }))).toBe('m');
  expect(sizeOf(A({ texts: [{ language: 'he', text: 'א'.repeat(400) }] }))).toBe('s');
});

test('every language is its own block with its own direction, the text is escaped, nothing is translated', () => {
  const a = A({ texts: [{ language: 'he', text: 'שלום <b>x</b> & "y"' }, { language: 'en', text: 'Hello' }, { language: 'ar', text: 'مرحبا' }] });
  const html = overlayHtml(a, 'he');
  expect(html).toContain('lang="he" dir="rtl"');
  expect(html).toContain('lang="en" dir="ltr"');
  expect(html).toContain('lang="ar" dir="rtl"');
  expect(html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;');
  expect(html).not.toContain('<b>');
  expect((html.match(/class="ann-t"/g) ?? []).length).toBe(3);
  expect(dirOf('ru')).toBe('ltr');
});

test('the heading is in the language of the screen, an emergency has its own heading', () => {
  expect(headingOf(A(), 'he')).toBe('הכרזה');
  expect(headingOf(A({ critical: true }), 'he')).toBe('הודעת חירום');
  expect(headingOf(A({ critical: true }), 'en')).toBe('Emergency notice');
  expect(headingOf(A(), 'xx')).toBe('הכרזה');
  expect(closeLabel('en')).toBe('Close');
});

test('the overlay is rebuilt only when what is drawn changes', () => {
  expect(overlayKey(A())).toBe(overlayKey(A({ until: '2026-10-25T10:05:00Z' })));
  expect(overlayKey(A())).not.toBe(overlayKey(A({ id: 'a2' })));
  expect(overlayKey(A())).not.toBe(overlayKey(A({ critical: true })));
  expect(overlayKey(null)).toBe('');
});

test('a screen asks every poll_s seconds, clamped to 2-30; a screen that is not an announcement screen keeps its own rhythm', () => {
  expect(pollMs(5, 30_000)).toBe(5000);
  expect(pollMs(1, 30_000)).toBe(2000);
  expect(pollMs(99, 30_000)).toBe(30_000);
  expect(pollMs(0, 30_000)).toBe(30_000);
  expect(pollMs(undefined, 30_000)).toBe(30_000);
  expect(pollMs(Number.NaN, 7)).toBe(7);
});

const OPTS: AnnounceScreenOption[] = [
  { key: 'board:b1', kind: 'board', name: 'לוח הלובי', area_id: null, device_key: null, allowed: false },
  { key: 'wall:w1', kind: 'wall', name: 'קבלה', area_id: 'living', device_key: null, allowed: true },
];

test('the settings list: allowing a screen, its room and its media screen produce the targets the server stores; unallowed screens are not sent', () => {
  expect(screenTargets(OPTS)).toEqual([{ key: 'wall:w1', area_id: 'living', device_key: null }]);
  const next = patchScreen(patchScreen(OPTS, 'board:b1', { allowed: true }), 'board:b1', { area_id: 'kitchen', device_key: 'dev-tv' });
  expect(screenTargets(next)).toEqual([{ key: 'board:b1', area_id: 'kitchen', device_key: 'dev-tv' }, { key: 'wall:w1', area_id: 'living', device_key: null }]);
  expect(OPTS[0].allowed).toBe(false); // the input is not mutated
  expect(screenTargets(patchScreen(next, 'wall:w1', { allowed: false })).map((t) => t.key)).toEqual(['board:b1']);
});

test('typed numbers stay inside what the server accepts; an empty or garbage entry leaves the field alone', () => {
  expect(ANNOUNCE_SCREEN_RANGE).toEqual({ seconds: [5, 600], critical_seconds: [10, 3600], poll_s: [2, 30], critical_close_s: [0, 600] }); // ANNOUNCE-297 added the close rule
  expect(clampScreenNumber('seconds', '45')).toBe(45);
  expect(clampScreenNumber('seconds', '1')).toBe(5);
  expect(clampScreenNumber('seconds', '9999')).toBe(600);
  expect(clampScreenNumber('critical_seconds', '4000')).toBe(3600);
  expect(clampScreenNumber('poll_s', '0')).toBe(2);
  expect(clampScreenNumber('poll_s', '')).toBeNull();
  expect(clampScreenNumber('poll_s', 'abc')).toBeNull();
});

test('the operator form: stage A body when screens are not on offer; chips decide the flags otherwise; at least one channel', () => {
  expect(channelFlags(true, true, false)).toEqual({});
  expect(channelFlags(true, true, true)).toEqual({ screens: true });
  expect(channelFlags(true, false, true)).toEqual({ screens: false });
  expect(channelFlags(false, true, true)).toEqual({ speakers: false, screens: true });
  expect(hasChannel(false, false, true)).toBe(false);
  expect(hasChannel(false, true, true)).toBe(true);
  expect(hasChannel(false, true, false)).toBe(false);
  expect(hasChannel(true, false, false)).toBe(true);
});

test('the new strings exist in all four languages and name no infrastructure product', () => {
  for (const l of ['he', 'en', 'ru', 'ar'] as const) {
    const t = ANNOUNCE_TABLES[l];
    for (const k of ['screens', 'screensHint', 'screensEnabled', 'screensDefault', 'screensSeconds', 'screensCriticalSeconds', 'screensPoll', 'screensList', 'screensArea', 'screensDevice', 'channels', 'channelSpeakers', 'channelScreens'] as const) {
      expect(t[k].trim(), `${l}.${k}`).not.toBe('');
      expect(t[k], `${l}.${k}`).not.toMatch(/home assistant|ingress|companion/i);
    }
  }
});
