import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { emergencyAfterFailure, scopeForKind } from '../src/door-windows/logic';
import { DWT_TABLES } from '../src/i18n/door-windows';

// LOWS-FRONTEND-2550: the low findings of the 2.52 deep review on the door screens (SCR-41, SCR-42). Node only, no page:
//   npx playwright test -c playwright.unit.config.ts tests/unit-lows-frontend-2550-doors.spec.ts
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

const sc = (scope_type: string, scope_id: string, doors = 1) => ({ scope_type, scope_id, name: `${scope_type}:${scope_id}`, doors });

test.describe('SCR-41 the emergency sheet scope', () => {
  test('a scope only one kind has never falls back to the other kind\'s first scope (the whole installation)', () => {
    const lock = [sc('building', 'b1', 4)];
    const open = [sc('installation', '*', 40), sc('building', 'b2', 6)];
    expect(scopeForKind(lock, 'building:b1')).toEqual(lock[0]);
    expect(scopeForKind(open, 'building:b1')).toBeUndefined(); // was open[0] = the whole installation
    expect(scopeForKind(open, 'building:b2')).toEqual(open[1]);
    expect(scopeForKind([], 'installation:*')).toBeUndefined();
  });

  test('the sheet asks only the chosen scope and shows the other kind disabled, saying why', () => {
    const em = src('door-windows/emergency.ts');
    expect(em).toMatch(/return scopeForKind\(this\.scopes\(kind\), this\.scopeKey\);/);
    expect(em).not.toMatch(/\?\? this\.scopes\(kind\)\[0\]/);
    expect(em).toMatch(/data-em-kind="lock_secure"[^>]*\?disabled=\$\{!lock\}/);
    expect(em).toMatch(/\?disabled=\$\{!openUsable \|\| !open\}/);
    for (const lang of ['he', 'en', 'ar', 'ru'] as const) expect(DWT_TABLES[lang].emScopeOtherKind, lang).toBeTruthy();
    expect(DWT_TABLES.en.emScopeOtherKind).toBe('Not available for the chosen scope');
  });
});

test.describe('SCR-42 the door screen emergency strip', () => {
  test('a failed read keeps the strip; only a refusal (403 / 404) hides it', () => {
    const shown = { active: [{ id: 'inc-1' }] };
    expect(emergencyAfterFailure(shown, null)).toBe(shown); // no answer (no connection, time-out)
    expect(emergencyAfterFailure(shown, 502)).toBe(shown);
    expect(emergencyAfterFailure(shown, 500)).toBe(shown);
    expect(emergencyAfterFailure(shown, 403)).toBeNull();
    expect(emergencyAfterFailure(shown, 404)).toBeNull();
    expect(emergencyAfterFailure(null, 502)).toBeNull(); // nothing was shown: nothing appears
  });

  test('the screen uses it (no blanket null on every error)', () => {
    const s = src('screens/door-windows.ts');
    expect(s).toMatch(/this\.em = emergencyAfterFailure\(this\.em, err instanceof ApiError \? err\.status : null\);/);
  });
});
