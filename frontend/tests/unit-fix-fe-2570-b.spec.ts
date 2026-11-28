import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { calSub } from '../src/calendars/ctx';

// FIX-FE-2570 (lead, 28.11): the FE-05 class in the calendars page (the download file name: unit-fix-fe-2570.spec.ts). Node only, no page:
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-fe-2570-b.spec.ts
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test.describe('the calendars sub-address', () => {
  test('a broken escape is kept as written; a valid one is decoded; both addresses of the module', () => {
    expect(calSub({ mode: 'calendars', segments: ['calendars', 'rooms', '50%'] })).toBe('50%');
    expect(calSub({ mode: 'devices', segments: ['devices', 'calendars', 'rooms', '%E0%A4%A'] })).toBe('%E0%A4%A');
    expect(calSub({ mode: 'calendars', segments: ['calendars', 'rooms', '%D7%97%D7%93%D7%A8'] })).toBe('חדר');
    expect(calSub({ mode: 'devices', segments: ['devices', 'calendars', 'cal'] })).toBe('');
    expect(calSub(null)).toBe('');
  });

  test('the calendars page reads its sub-address through calSub, never the throwing decoder', () => {
    const s = src('calendars/cal-page.ts');
    expect(s).not.toMatch(/decodeURIComponent\(/);
    expect(s).toMatch(/calSub\(this\.route\)/);
  });
});
