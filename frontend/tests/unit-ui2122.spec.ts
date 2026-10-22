import { test, expect } from '@playwright/test';
import { ApiError, describeError } from '../src/api/client';
import { closedErrorText, isPendingRestart } from '../src/api/closed-errors';
import { mt, problemText } from '../src/i18n/access-messaging';
import { wiskeyReasonKey } from '../src/messaging/pacing-model';
import { mp } from '../src/i18n/messaging-pacing';
import type { PacingAccount } from '../src/api/messaging-pacing';

// UI2122: closed error codes shown as plain, actionable text. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-ui2122.spec.ts

const err = (status: number, code: string, user_message = '', details: Record<string, unknown> = {}) =>
  new ApiError(status, { code, user_message, retryable: false, correlation_id: '', details });

test('account_not_covered has its own plain sentence, never the key', () => {
  const text = mt('service.account_not_covered');
  expect(text).not.toBe('service.account_not_covered');
  expect(text).not.toMatch(/account_not_covered|WisKey|תוסף/);
  expect(text.length).toBeGreaterThan(20);
});

test('recorder_pending_restart tells the operator to restart the add-on, in each language', () => {
  const he = closedErrorText('recorder_pending_restart', 'he')!;
  const en = closedErrorText('recorder_pending_restart', 'en')!;
  expect(he).toContain('הפעילו מחדש');
  expect(he).toContain('תוסף');
  expect(en).toMatch(/restart the add-on/i);
  expect(he).not.toMatch(/recorder_pending_restart/);
  expect(en).not.toMatch(/recorder_pending_restart/);
});

test('describeError uses the closed text even when the server message is empty or generic', () => {
  for (const msg of ['', 'שגיאה כללית']) {
    const text = describeError(err(409, 'recorder_pending_restart', msg, { recorder_id: 'r1', restart_required: true }));
    expect(text).toContain('הפעילו מחדש');
  }
  // other codes keep the server's words
  expect(describeError(err(409, 'something_else', 'מילים של השרת'))).toBe('מילים של השרת');
  expect(closedErrorText('something_else', 'he')).toBeNull();
});

test('isPendingRestart recognises only that code', () => {
  expect(isPendingRestart(err(409, 'recorder_pending_restart'))).toBe(true);
  expect(isPendingRestart(err(409, 'conflict'))).toBe(false);
  expect(isPendingRestart(new Error('x'))).toBe(false);
  expect(isPendingRestart(null)).toBe(false);
});

test('wiskeyReasonKey maps every closed reason and hides known accounts', () => {
  const acct = (w: Partial<PacingAccount['wiskey']>) => ({ account_key: 'entry:A', wiskey: { mapped: true, verified: false, unknown: false, charged: null, throttled_until: null, leases_active: 0, ...w } }) as unknown as PacingAccount;
  const unk = (reason: string | null, coverage: 'covered' | 'not_covered' | null = 'not_covered') => acct({ unknown: true, coverage, reason });
  expect(wiskeyReasonKey(acct({ coverage: 'covered', reason: null }))).toBeNull();
  const closed = ['discovery_unknown', 'api_incompatible', 'pacing_route_not_listed', 'route_error', 'envelope_invalid', 'schema_version_missing', 'schema_version_misplaced', 'schema_version_unsupported', 'coverage_inconsistent', 'not_read', 'stale', 'truncated', 'sender_absent', 'unverified', 'counters_incomplete', 'unreserved_unknown'];
  for (const r of closed) {
    const key = wiskeyReasonKey(unk(r))!;
    expect(key, r).not.toBe('reason_other');
    for (const lang of ['he', 'en', 'ar', 'ru'] as const) expect(mp(key, undefined, lang), `${lang}.${r}`).not.toMatch(/_/);
  }
  expect(wiskeyReasonKey(unk('something_new'))).toBe('reason_other');
  expect(wiskeyReasonKey(unk(null, null))).toBe('reason_other');
  expect(wiskeyReasonKey(acct({ coverage: 'not_covered', reason: 'sender_absent' }))).toBe('reason_absent');
});

test('a sender that is not covered shows a sentence in every language', () => {
  const a = { account_key: 'entry:A', wiskey: { mapped: true, verified: false, unknown: true, charged: null, throttled_until: null, leases_active: 0, coverage: 'not_covered', reason: 'sender_absent' } } as unknown as PacingAccount;
  const key = wiskeyReasonKey(a)!;
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) expect(mp(key, undefined, lang)).not.toMatch(/sender_absent|reason_/);
  expect(problemText('nothing')).toBeTruthy();
});
