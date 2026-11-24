import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ApiError, type ApiErrorBody } from '../src/api/client';
import { calErrorText, conflictLine, conflictName, conflictsOf, conflictWhen } from '../src/calendars/conflict-hint';

// RESPONSE-HINTS-2480 (owner N57): a refused booking says WHAT holds the slot and when. The server names each row of
// `details.conflicts` (ADR-019: extra data under `details`): the title where the viewer may read it, null where it may not, no key
// at all from an older server. Pure logic, no browser page; the zone is the installation's (playwright.unit.config.ts: Asia/Jerusalem).

type Doc = { documentElement: { lang: string } };
const g = globalThis as unknown as { document?: Doc };
function withLang<T>(lang: string, fn: () => T): T {
  const prev = g.document;
  g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
}

const err = (code: string, details: Record<string, unknown>, status = 409, user_message = 'הזמן תפוס.') =>
  new ApiError(status, { code, user_message, retryable: false, correlation_id: 'c-1', details } satisfies ApiErrorBody);
const row = (title?: string | null, start = '2026-11-03T10:00:00Z', end = '2026-11-03T11:00:00Z') => ({
  event_id: 'evt_1', calendar_id: 'cal_1', start, end, state: 'confirmed', ...(title === undefined ? {} : { title }),
});
/** the time range is one left-to-right isolate (LRI ... PDI); the assertions below read the text without the two marks */
const plain = (s: string) => s.replace(/[⁦⁩]/g, '');

test('the time range is a left-to-right isolate, so it does not read reversed inside Hebrew', () => {
  expect(conflictWhen(row())).toBe('⁦03.11 12:00–13:00⁩');
});

test.describe('the conflict rows of a refusal', () => {
  test('read only from the conflict refusals, and only well-formed rows', () => {
    for (const code of ['conflict', 'maintenance_window', 'slot_held', 'displace_disabled']) expect(conflictsOf(err(code, { conflicts: [row('א')] }))).toHaveLength(1);
    expect(conflictsOf(err('stale', { conflicts: [row('א')] }))).toEqual([]);
    expect(conflictsOf(err('conflict', {}))).toEqual([]);
    expect(conflictsOf(err('conflict', { conflicts: 'x' }))).toEqual([]);
    expect(conflictsOf(err('conflict', { conflicts: [null, { start: 1 }, row('א')] }))).toHaveLength(1);
    expect(conflictsOf(new Error('boom'))).toEqual([]);
  });
});

test.describe('the hint names the entry and its time range', () => {
  test('a readable title in quotes, a hidden one as "another booking", an older server only the time', () => {
    withLang('he', () => {
      expect(conflictName({ title: 'ישיבת הנהלה' })).toBe('"ישיבת הנהלה"');
      expect(conflictName({ title: null })).toBe('הזמנה אחרת');
      expect(conflictName({})).toBe('');
      expect(plain(conflictWhen(row()))).toBe('03.11 12:00–13:00');
      expect(plain(conflictLine([row('ישיבת הנהלה')]))).toBe('מתנגש עם "ישיבת הנהלה" · 03.11 12:00–13:00');
      expect(plain(conflictLine([row(null)]))).toBe('מתנגש עם הזמנה אחרת · 03.11 12:00–13:00');
      expect(plain(conflictLine([row()]))).toBe('מתנגש עם המועד 03.11 12:00–13:00');
      expect(plain(conflictLine([row('א'), row('ב', '2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z')]))).toBe('מתנגש עם "א" · 03.11 12:00–13:00 (ועוד 1)');
      expect(plain(conflictLine([]))).toBe('');
    });
  });

  test('the error text: the server words, then the line; other errors unchanged; a screen may pass its own words', () => {
    withLang('he', () => {
      expect(plain(calErrorText(err('conflict', { conflicts: [row('ישיבת הנהלה')] })))).toBe('הזמן תפוס. מתנגש עם "ישיבת הנהלה" · 03.11 12:00–13:00');
      expect(plain(calErrorText(err('conflict', { conflicts: [row(null)] })))).toBe('הזמן תפוס. מתנגש עם הזמנה אחרת · 03.11 12:00–13:00');
      expect(plain(calErrorText(err('outside_hours', {}, 422, 'ההזמנה מחוץ לשעות הפתיחה של היומן.')))).toBe('ההזמנה מחוץ לשעות הפתיחה של היומן.');
      expect(plain(calErrorText(err('slot_held', { conflicts: [row('ראשון')] }), 'החלון כבר תפוס.'))).toBe('החלון כבר תפוס. מתנגש עם "ראשון" · 03.11 12:00–13:00');
    });
  });

  test('English reads the same line from the calendars table', () => {
    withLang('en', () => {
      expect(plain(conflictLine([row('Board meeting')]))).toBe('Clashes with "Board meeting" · 03.11 12:00–13:00');
      expect(plain(conflictLine([row(null)]))).toBe('Clashes with another booking · 03.11 12:00–13:00');
      expect(plain(conflictLine([row()]))).toBe('Clashes with the booking at 03.11 12:00–13:00');
    });
  });
});

test('the booking screens show the named refusal (drawer, grid, resident, maintenance, approvals) and the drawer preview names a hidden entry', () => {
  const src = (f: string) => readFileSync(new URL(`../src/calendars/${f}`, import.meta.url), 'utf8');
  for (const f of ['event-drawer.ts', 'view-calendar.ts', 'resident.ts', 'maint-drawer.ts', 'view-approvals.ts']) expect(src(f), f).toContain('calErrorText(');
  expect(src('event-drawer.ts')).toContain("conflicts[0].title ?? tr('הזמנה אחרת')");
  expect(src('view-calendar.ts')).toContain('title: c.title ?? other?.title ?? null');
});
