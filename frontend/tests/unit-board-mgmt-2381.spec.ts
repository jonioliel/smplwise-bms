import { test, expect } from '@playwright/test';
import { canResend, canResendDraft, resendOutcome, tvOnly } from '../src/notices/resend-model';
import { nt } from '../src/i18n/notices';
import type { Notice } from '../src/api/notices';

// BOARD-MGMT-2381 (owner answers 03.11): question 5 - "העתק קישור" never changes the link, "החלף קישור" asks with the owner's wording;
// question 6 - the manual "שלח שוב" (never automatic after an edit). Node only.

type Row = Pick<Notice, 'status' | 'state' | 'audience'>;
const live: Row = { status: 'published', state: 'active', audience: { everyone: true } };

test('a TV-only audience has nobody to send to', () => {
  expect(tvOnly(undefined)).toBe(true);
  expect(tvOnly({})).toBe(true);
  expect(tvOnly({ floors: [], groups: [] })).toBe(true);
  expect(tvOnly({ everyone: true })).toBe(false);
  expect(tvOnly({ floors: ['f2'] })).toBe(false);
  expect(tvOnly({ areas: ['a1'] })).toBe(false);
  expect(tvOnly({ roles: ['operator'] })).toBe(false);
});

test('"שלח שוב" is offered for a live published notice with recipients, to a writer with the push right only', () => {
  expect(canResend(live, true)).toBe(true);
  expect(canResend({ ...live, state: 'scheduled' }, true)).toBe(true);
  expect(canResend(live, false)).toBe(false);
  for (const state of ['draft', 'expired', 'archived'] as const) expect(canResend({ ...live, state }, true)).toBe(false);
  expect(canResend({ ...live, status: 'draft', state: 'draft' }, true)).toBe(false);
  expect(canResend({ ...live, audience: {} }, true)).toBe(false);
});

test('the compose dialog offers "שמירה ושליחה שוב" on a published, still-running notice only', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  const d = { status: 'published' as const, aud: 'all' as const, to: '2026-11-04T10:00', untilArchived: false };
  expect(canResendDraft(d, true, now)).toBe(true);
  expect(canResendDraft(d, false, now)).toBe(false);
  expect(canResendDraft({ ...d, status: 'draft' }, true, now)).toBe(false);
  expect(canResendDraft({ ...d, status: 'new' }, true, now)).toBe(false);
  expect(canResendDraft({ ...d, aud: 'tv' }, true, now)).toBe(false);
  expect(canResendDraft({ ...d, to: '2026-11-01T10:00' }, true, now)).toBe(false);
  expect(canResendDraft({ ...d, to: '' }, true, now)).toBe(true);
  expect(canResendDraft({ ...d, to: '2026-11-01T10:00', untilArchived: true }, true, now)).toBe(true);
});

test('the toast after a re-send', () => {
  expect(resendOutcome({ requested: true, sent: true, recipients: 4 })).toEqual({ key: 'resendDone', n: 4 });
  expect(resendOutcome({ requested: true, sent: false, recipients: 4, error: 'emit_failed' })).toEqual({ key: 'resendFailed', n: 0 });
  expect(resendOutcome(undefined).key).toBe('resendFailed');
  expect(nt('resendDone', { n: 4 }, 'he')).toBe('ההודעה נשלחה שוב ל־4 נמענים');
});

test('the owner\'s wording: copy and replace are two buttons, replace asks first', () => {
  expect(nt('copyLink', undefined, 'he')).toBe('העתק קישור');
  expect(nt('newLink', undefined, 'he')).toBe('החלף קישור');
  expect(nt('copyAsk2', undefined, 'he')).toBe('החלף קישור');
  expect(nt('copyAskBody', undefined, 'he')).toBe('טלוויזיות שמחוברות בקישור הנוכחי יתנתקו. להחליף?');
  expect(nt('copyAsk', { name: 'לובי' }, 'he')).toBe('החלפת הקישור של "לובי"');
  expect(nt('resend', undefined, 'he')).toBe('שלח שוב');
  // nothing says the link is shown once any more (it is stored and copied again), and the edit message says nothing was re-sent
  for (const k of ['linkSubNew', 'linkOnce'] as const) expect(nt(k, undefined, 'he')).not.toContain('פעם אחת');
  expect(nt('savedNoResend', undefined, 'he')).toContain('לא נשלחה שוב');
  for (const k of ['copyAsk', 'copyAskBody', 'copyAsk2', 'noStoredLink', 'resend', 'resendAsk', 'resendBody', 'resendDone', 'savedNoResend', 'saveResend', 'resendConfirmN'] as const) {
    expect(nt(k, { n: 1, name: 'x', title: 'y' }, 'en')).not.toBe(nt(k, { n: 1, name: 'x', title: 'y' }, 'he'));
  }
});
