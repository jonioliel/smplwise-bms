import { test, expect } from '@playwright/test';
import { applyTranslation, canTranslate, editedMachine, partsWithMachine, reviewOk, sentMachine } from '../src/announce/model';
import { CRITICAL_CLOSE_DEFAULT_S, MACHINE_MARK, closeWaitMs, machineMark, overlayHtml, sizeOf, type ScreenAnnouncement } from '../src/announce/screen-overlay';
import { ANNOUNCE_TABLES } from '../src/i18n/announce';

// ANNOUNCE-297 (voice announcements, stage C): the pure rules of the automatic translation draft, the machine-translation mark on a screen and the
// wall display's close rule. Node only; nothing reaches a network.

const A = (o: Partial<ScreenAnnouncement> = {}): ScreenAnnouncement => ({
  id: 'a1', critical: false, until: '2026-10-27T10:00:30Z', texts: [{ language: 'he', text: 'המים יופסקו בשעה 10' }], ...o,
});
const T0 = Date.parse('2026-10-27T10:00:00Z');

test('the translate button needs the server switch and a Hebrew text within the limit', () => {
  expect(canTranslate(true, { he: 'שלום' })).toBe(true);
  expect(canTranslate(false, { he: 'שלום' })).toBe(false);
  expect(canTranslate(undefined, { he: 'שלום' })).toBe(false);
  expect(canTranslate(true, { he: '   ' })).toBe(false);
  expect(canTranslate(true, { en: 'Hello' })).toBe(false);
  expect(canTranslate(true, { he: 'א'.repeat(201) })).toBe(false);
});

test('a translation fills and selects its languages, marks them machine, keeps Hebrew, never touches he', () => {
  const r = applyTranslation({ he: 'שלום', en: 'typed' }, ['he'], new Set(), [
    { language: 'ar', text: 'مرحبا' }, { language: 'en', text: 'Hello' }, { language: 'he', text: 'IGNORED' }, { language: 'ru', text: '' },
  ]);
  expect(r.texts).toEqual({ he: 'שלום', en: 'Hello', ar: 'مرحبا' });
  expect(r.selected).toEqual(['he', 'en', 'ar']);
  expect([...r.machine].sort()).toEqual(['ar', 'en']);
});

test('an edited machine text stays marked; emptied it loses the mark; the parts carry machine only for non-Hebrew marked texts', () => {
  const mt = new Set<'he' | 'en' | 'ru' | 'ar'>(['en', 'ru']);
  expect([...editedMachine(mt, 'en', 'Hello (edited)')].sort()).toEqual(['en', 'ru']);
  expect([...editedMachine(mt, 'en', '  ')]).toEqual(['ru']);
  const texts = { he: 'שלום', en: 'Hello', ru: 'Привет' };
  expect(partsWithMachine(texts, ['he', 'en'], mt)).toEqual([{ language: 'he', text: 'שלום' }, { language: 'en', text: 'Hello', machine: true }]);
  expect(sentMachine(texts, ['he', 'en'], mt)).toEqual(['en']);
  expect(sentMachine(texts, ['he'], mt)).toEqual([]);
});

test('a machine-translated part is never sent unreviewed', () => {
  const mt = new Set<'he' | 'en' | 'ru' | 'ar'>(['ar']);
  expect(reviewOk({ he: 'א', ar: 'ب' }, ['he', 'ar'], mt, false)).toBe(false);
  expect(reviewOk({ he: 'א', ar: 'ب' }, ['he', 'ar'], mt, true)).toBe(true);
  expect(reviewOk({ he: 'א', ar: 'ب' }, ['he'], mt, false)).toBe(true);
  expect(reviewOk({ he: 'א' }, ['he'], new Set(), false)).toBe(true);
});

test('a machine block on the screen carries the mark in its own language, escaped, and counts toward the size so it still fits', () => {
  const a = A({ texts: [{ language: 'he', text: 'שלום' }, { language: 'ar', text: 'مرحبا <b>', machine: true }] });
  const html = overlayHtml(a, 'he');
  expect(html).toContain(`lang="ar" dir="rtl" data-machine="1">مرحبا &lt;b&gt;<span class="ann-mt">${MACHINE_MARK.ar}</span>`);
  expect(html).not.toContain(`lang="he" dir="rtl" data-machine`);
  expect(machineMark('ru')).toBe('Машинный перевод');
  const long = (machine: boolean) => A({ texts: [{ language: 'he', text: 'א'.repeat(60) }, { language: 'en', text: 'b'.repeat(55), machine }] });
  expect(sizeOf(long(false))).toBe('l');
  expect(sizeOf(long(true))).toBe('m');
  // four full-length languages (4 x 200, three of them translated) take the extra small step so they still fit one screen
  const full = A({ texts: (['he', 'ar', 'ru', 'en'] as const).map((language, i) => ({ language, text: 'x'.repeat(200), machine: i > 0 })) });
  expect(sizeOf(full)).toBe('xs');
  expect(sizeOf(A({ texts: [{ language: 'he', text: 'א'.repeat(400) }] }))).toBe('s');
});

test('the close rule: a normal one at once, an emergency only after the served seconds (default 15, clamped)', () => {
  expect(closeWaitMs(A(), T0, T0, 30)).toBe(0);
  expect(closeWaitMs(A({ critical: true }), T0, T0, 30)).toBe(30_000);
  expect(closeWaitMs(A({ critical: true }), T0, T0 + 29_000, 30)).toBe(1_000);
  expect(closeWaitMs(A({ critical: true }), T0, T0 + 31_000, 30)).toBe(0);
  expect(closeWaitMs(A({ critical: true }), T0, T0, 0)).toBe(0);
  expect(closeWaitMs(A({ critical: true }), T0, T0, undefined)).toBe(CRITICAL_CLOSE_DEFAULT_S * 1000);
  expect(closeWaitMs(A({ critical: true }), T0, T0, 99_999)).toBe(600_000);
  expect(closeWaitMs(null, T0, T0, 30)).toBe(0);
});

test('every new string exists in all four languages', () => {
  const keys = ['translate', 'translating', 'machineBadge', 'reviewed', 'translateCard', 'translateHint', 'translateEnabled', 'translateProvider', 'translateApprove',
    'translateApproveAction', 'translateApprovedBy', 'translateNotApproved', 'translateTargets', 'screensCriticalClose'] as const;
  for (const lang of ['he', 'en', 'ru', 'ar'] as const) for (const k of keys) expect(ANNOUNCE_TABLES[lang][k], `${lang}.${k}`).toBeTruthy();
});
