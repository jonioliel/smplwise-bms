import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { alarmWord, callResult, clockOf, dayWord, daySpans, diaryWord, guestState, inSpans, playbackError } from '../src/home/home-v3-words';

// HOME-V3-P1-2430: the phase-1 screens' words and pure rules (src/home/home-v3-words.ts), and source checks over the new files: no platform
// name or internal term in what they show, the timeline is left to right, the guest code is never rendered, registration is per file.

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, '..', 'src', 'home', f), 'utf8');
const V3 = ['home-more.ts', 'home-recordings.ts', 'home-diary.ts', 'home-intercom.ts', 'home-alarm.ts', 'home-v3-words.ts', 'more-registry.ts', 'home-ext.ts'];

test('the diary speaks family words and leaves the technical events out', () => {
  expect(diaryWord('person', 'כניסה')).toEqual({ text: 'מישהו עבר בכניסה', icon: 'user', kind: 'cam' });
  expect(diaryWord('door', null)?.kind).toBe('door');
  for (const t of ['system', 'storage', 'coverage_gap', 'offline', 'tamper', 'other']) expect(diaryWord(t, 'x'), t).toBeNull();
});

test('a call result: who opened, who answered, missed', () => {
  const base = { outcome: null, answered_by_name: null, door_opened_by_name: null, door_opened_at: null };
  expect(callResult({ ...base, door_opened_by_name: 'נועה' })).toEqual({ text: 'הדלת נפתחה · נועה', tone: 'ok' });
  expect(callResult({ ...base, outcome: 'missed' }).tone).toBe('warn');
  expect(callResult({ ...base, outcome: 'answered', answered_by_name: 'יוסי' }).text).toBe('נענתה · יוסי');
});

test('a guest invitation state: waiting for approval, the number to confirm, live, ended', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  const g = { state: 'approved', confirmed: true, valid_from: '2026-11-11T11:00:00Z', valid_until: '2026-11-11T15:00:00Z' };
  expect(guestState(g, now)).toEqual({ text: 'בתוקף עכשיו', tone: 'ok', live: true });
  expect(guestState({ ...g, confirmed: false }, now).text).toBe('צריך לאמת את הטלפון של האורח');
  expect(guestState({ ...g, state: 'requested' }, now).tone).toBe('warn');
  expect(guestState({ ...g, valid_from: '2026-11-11T13:00:00Z' }, now).text).toBe('עוד לא התחיל');
  expect(guestState({ ...g, valid_until: '2026-11-11T11:30:00Z' }, now).live).toBe(false);
  expect(guestState({ ...g, state: 'revoked' }, now).live).toBe(false);
});

test('alarm words: green only for an armed house, danger for an alarm', () => {
  expect(alarmWord('disarmed').tone).toBe('neutral');
  expect(alarmWord('armed_away')).toEqual({ text: 'דרוכה: מלאה', tone: 'ok' });
  expect(alarmWord('triggered').tone).toBe('danger');
  expect(alarmWord('armed_home', false).text).toBe('לא זמינה כרגע');
});

test('the timeline spans, the clock and the day words', () => {
  expect(daySpans([{ startMin: 600, endMin: 700 }, { startMin: -20, endMin: 30 }, { startMin: 1400, endMin: 1500 }, { startMin: 50, endMin: 50 }])).toEqual([[0, 30], [600, 700], [1400, 1440]]);
  expect(inSpans([[0, 30]], 29.9)).toBe(true);
  expect(inSpans([[0, 30]], 30)).toBe(false);
  expect(clockOf(14 * 60 + 20.5)).toBe('14:20:30');
  expect(dayWord(0)).toBe('היום');
  expect(dayWord(2)).toBe('שלשום');
  expect(dayWord(9)).not.toMatch(/היום|אתמול|שלשום/);
  expect(playbackError('no_recording')).toBe('אין הקלטה בשעה הזו.');
  expect(playbackError('no_track')).not.toContain('track');
});

test('no phase-1 source names the platform or an internal term in what it shows', () => {
  for (const f of V3) {
    const text = src(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    const shown = [...text.matchAll(/[>'"`]([^<>'"`]*[֐-׿][^<>'"`]*)[<'"`]/g)].map((m) => m[1]).join(' ');
    for (const w of ['Home Assistant', 'go2rtc', 'NVR', 'WebRTC', 'WisKey', 'ישות', 'entity', 'RTSP', 'stream', 'relay', 'track']) expect(shown, `${f} shows ${w}`).not.toContain(w);
  }
});

test('the timeline is left to right; the guest code is never rendered; each screen registers itself', () => {
  const rec = src('home-recordings.ts');
  expect(rec).toContain('<div class="tl" dir="ltr">');
  expect(rec).not.toMatch(/scaleX\(-1\)|rotateY\(180/);
  const ic = src('home-intercom.ts');
  expect(ic).not.toMatch(/\bg\.code\b|\.pin\b|code_value/);
  for (const f of ['home-more.ts', 'home-recordings.ts', 'home-diary.ts', 'home-intercom.ts', 'home-alarm.ts']) expect(src(f), f).toContain('registerScreen(');
  const idx = src('home-v3-p1.ts');
  for (const f of ['home-more', 'home-recordings', 'home-diary', 'home-intercom', 'home-alarm']) expect(idx).toContain(`'./${f}'`);
});
