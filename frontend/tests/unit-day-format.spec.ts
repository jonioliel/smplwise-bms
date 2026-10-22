import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dayText, dayTimeText } from '../src/api/day-format';

// DOCSUX-295 (UX audit 2026-10-20, finding 18): one date format - "30.09.2026" / "30.09.2026 14:05", two-digit day and month - instead of
// "30.9.2026" next to "14.10.2026" (toLocaleDateString('he-IL')) and a raw ISO payment date.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

test('dayText pads day and month and uses dots', () => {
  expect(dayText('2026-09-30')).toBe('30.09.2026');
  expect(dayText('2026-10-04')).toBe('04.10.2026');
  expect(dayText(new Date(2026, 0, 5, 12, 0))).toBe('05.01.2026');
  expect(dayText('2026-09-30T10:00:00')).toBe('30.09.2026');
});

test('a bare calendar day is a local day (never the day before)', () => {
  expect(dayText('2026-01-01')).toBe('01.01.2026');
  expect(dayText('2026-12-31')).toBe('31.12.2026');
});

test('dayTimeText adds a 24-hour clock', () => {
  expect(dayTimeText(new Date(2026, 9, 14, 7, 5))).toBe('14.10.2026 07:05');
  expect(dayTimeText(new Date(2026, 9, 14, 23, 59))).toBe('14.10.2026 23:59');
});

test('empty and invalid values give an empty string', () => {
  for (const v of [null, undefined, '', 'nope', '2026-13-45x']) expect(dayText(v as string | null | undefined), String(v)).toBe('');
  expect(dayTimeText(null)).toBe('');
});

test('the screens that formatted with toLocale*String(he-IL) now use the helper', () => {
  for (const f of ['components/sw-passkeys.ts', 'components/sw-second-factor.ts', 'components/media-ma-connection.ts', 'screens/system-messaging-accounts.ts', 'screens/system-presence.ts', 'tickets/quote-model.ts', 'tickets/ticket-cost-card.ts']) {
    const src = readFileSync(path.join(SRC, f), 'utf8');
    expect(src, f).toMatch(/api\/day-format/);
    expect(src, f).not.toMatch(/toLocale(Date)?String\('he-IL'/);
  }
});
