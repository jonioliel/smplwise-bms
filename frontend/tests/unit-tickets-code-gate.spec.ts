import { test, expect } from '@playwright/test';
import { LOCK_TEXT, codeLockCard, lockText } from '../src/tickets/code-lock-model';

// CR-038 slice 7 (option B, spec 10.5): the manager's code-lock card ("נעילת קוד" + one-tap "שלח קישור חדש") - pure logic. The
// handler page's own code states are slice 4's (src/public-ticket/state.ts). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-code-gate.spec.ts

const NOW = 1_800_000_000_000;

test('the manager card: shown for the current link while locked or while the ticket waits because of a lock', () => {
  const base = { id: 't1', waiting_on: 'assignee' as const, waiting_reason: null };
  const link = (over: Record<string, unknown> = {}) => ({
    state: 'live', current: true, generation: 1, require_code: true, code_locked: true,
    code_locked_until: new Date(NOW + 600_000).toISOString(), can: { copy: true, new: true, revoke: true, resend: false }, ...over,
  });
  expect(codeLockCard({ ...base }, NOW)).toEqual({ show: false, until: null, canNew: false });
  expect(codeLockCard({ ...base, link: null }, NOW).show).toBe(false);
  expect(codeLockCard({ ...base, link: link() }, NOW)).toEqual({ show: true, until: new Date(NOW + 600_000).toISOString(), canNew: true });
  expect(codeLockCard({ ...base, link: link({ current: false }) }, NOW).show).toBe(false);
  const ended = codeLockCard({ ...base, waiting_on: 'manager', waiting_reason: 'code_locked', link: link({ code_locked: false, code_locked_until: null }) }, NOW);
  expect(ended).toEqual({ show: true, until: null, canNew: true });
  expect(codeLockCard({ ...base, link: link({ code_locked_until: new Date(NOW - 1000).toISOString() }) }, NOW).until).toBeNull();
  expect(codeLockCard({ ...base, link: link({ can: { copy: false, new: false, revoke: false, resend: false } }) }, NOW).canNew).toBe(false);
});

test('the card texts: Hebrew and English, never the old item noun, never the module name', () => {
  expect(lockText('newLink', undefined, 'he')).toBe('שלח קישור חדש');
  expect(lockText('title', undefined, 'he')).toBe('נעילת קוד');
  expect(lockText('until', { when: '14:30' }, 'en')).toBe('Locked until 14:30');
  expect(Object.keys(LOCK_TEXT.en).sort()).toEqual(Object.keys(LOCK_TEXT.he).sort());
  for (const lang of ['he', 'en'] as const) {
    for (const t of Object.values(LOCK_TEXT[lang])) expect(t).not.toMatch(/קריא[הות]|ניהול השירות|בקש(ת|ות) שירות/);
  }
});
