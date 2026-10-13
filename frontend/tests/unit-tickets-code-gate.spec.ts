import { test, expect } from '@playwright/test';
import {
  GATE_TEXT, INITIAL, cleanCode, controls, fromView, gateText, minutesLeft, onSendAnswer, onSendStart, onVerifyAnswer, onVerifyStart,
  statusLine, type GateLang,
} from '../src/tickets-public/code-gate';
import { LOCK_TEXT, codeLockCard, lockText } from '../src/tickets/code-lock-model';

// CR-038 slice 7 (option B, spec 10.5 / 10.7): the code gate of the handler page and the manager's code-lock card - pure logic.
// Node only:  npx playwright test -c playwright.unit.config.ts tests/unit-tickets-code-gate.spec.ts

const NOW = 1_800_000_000_000;
const LANGS: GateLang[] = ['he', 'en', 'ar', 'ru'];

test('the view decides the first phase: no code needed, locked, or ask for a code', () => {
  expect(fromView({ code_required: false }, INITIAL, NOW).phase).toBe('done');
  expect(fromView({ code_required: true, code_ok: true }, INITIAL, NOW).phase).toBe('done');
  const locked = fromView({ code_required: true, code_ok: false, code_locked_s: 1200 }, INITIAL, NOW);
  expect(locked.phase).toBe('locked');
  expect(locked.waitUntil).toBe(NOW + 1_200_000);
  expect(fromView({ code_required: true, code_ok: false, code_locked_s: 0 }, INITIAL, NOW).phase).toBe('idle');
  // a reload while a sent code is still valid keeps the field open
  const sent = onSendAnswer(onSendStart(INITIAL), { status: 200, body: { sent: true, channel: 'whatsapp', expires_in_s: 600 } }, NOW);
  expect(fromView({ code_required: true, code_ok: false }, sent, NOW + 60_000).phase).toBe('sent');
  expect(fromView({ code_required: true, code_ok: false }, sent, NOW + 601_000).phase).toBe('idle');
});

test('sending: the channel line, the limits, the lock, the D6 refusal, a gone link', () => {
  let s = onSendStart(INITIAL);
  expect(controls(s)).toEqual({ send: 'send', field: false, busy: true });
  s = onSendAnswer(s, { status: 200, body: { sent: true, channel: 'email', expires_in_s: 300 } }, NOW);
  expect(s.phase).toBe('sent');
  expect(s.expiresAt).toBe(NOW + 300_000);
  expect(statusLine(s, 'he', NOW)).toBe('הקוד נשלח במייל');
  expect(controls(s)).toEqual({ send: 'resend', field: true, busy: false });
  const limited = onSendAnswer(s, { status: 429, body: { code: 'rate_limited', retry_after_s: 42 } }, NOW);
  expect(limited.phase).toBe('sent');
  expect(statusLine(limited, 'he', NOW)).toBe('אפשר לבקש קוד חדש בעוד 42 שניות');
  const locked = onSendAnswer(s, { status: 429, body: { code: 'code_locked', retry_after_s: 1800 } }, NOW);
  expect(locked.phase).toBe('locked');
  expect(controls(locked)).toEqual({ send: null, field: false, busy: false });
  expect(statusLine(locked, 'he', NOW)).toBe('יותר מדי ניסיונות. נסו שוב בעוד 30 דקות');
  const unavailable = onSendAnswer(onSendStart(INITIAL), { status: 503, body: { code: 'code_unavailable' } }, NOW);
  expect(unavailable.phase).toBe('unavailable');
  expect(statusLine(unavailable, 'he', NOW)).toBe('לא ניתן לשלוח קוד כרגע. פנו למנהל');
  expect(onSendAnswer(s, { status: 404, body: { code: 'link_unavailable' } }, NOW).phase).toBe('gone');
  expect(onSendAnswer(onSendStart(INITIAL), { status: 0, body: {} }, NOW)).toMatchObject({ phase: 'idle', notice: 'error' });
  expect(onSendAnswer(onSendStart(INITIAL), { status: 429, body: { code: 'busy' } }, NOW)).toMatchObject({ phase: 'idle', notice: 'busy' });
});

test('verifying: a session, the attempts left, an expired or replaced code, the lock', () => {
  const sent = onSendAnswer(onSendStart(INITIAL), { status: 200, body: { sent: true, channel: 'whatsapp', expires_in_s: 600 } }, NOW);
  const v = onVerifyStart(sent);
  expect(controls(v).busy).toBe(true);
  expect(onVerifyAnswer(v, { status: 200, body: { session: 's'.repeat(43), expires_in_s: 43200 } }, NOW)).toMatchObject({ phase: 'done', session: 's'.repeat(43) });
  const bad = onVerifyAnswer(v, { status: 422, body: { code: 'code_invalid', attempts_left: 3 } }, NOW);
  expect(bad).toMatchObject({ phase: 'sent', attemptsLeft: 3 });
  expect(statusLine(bad, 'he', NOW)).toBe('הקוד שגוי. נותרו 3 ניסיונות');
  expect(statusLine(bad, 'en', NOW)).toBe('Wrong code. 3 attempts left');
  expect(onVerifyAnswer(v, { status: 422, body: { code: 'code_expired' } }, NOW)).toMatchObject({ phase: 'idle', notice: 'code_expired' });
  expect(onVerifyAnswer(v, { status: 422, body: { code: 'code_missing' } }, NOW)).toMatchObject({ phase: 'idle', notice: 'code_missing' });
  const locked = onVerifyAnswer(v, { status: 429, body: { code: 'code_locked', retry_after_s: 1800 } }, NOW);
  expect(locked.phase).toBe('locked');
  expect(locked.session).toBeNull();
  expect(onVerifyAnswer(v, { status: 404, body: {} }, NOW).phase).toBe('gone');
});

test('the code field reads what people type, like the server does', () => {
  expect(cleanCode('123456')).toBe('123456');
  expect(cleanCode(' 123 456 ')).toBe('123456');
  expect(cleanCode('123-456')).toBe('123456');
  expect(cleanCode('١٢٣٤٥٦')).toBe('123456');
  expect(cleanCode('۱۲۳۴۵۶')).toBe('123456');
  expect(cleanCode('１２３４５６')).toBe('123456');
  for (const bad of ['12345', '1234567', '12a456', '', '+123456', '12.3456']) expect(cleanCode(bad)).toBeNull();
});

test('minutes round up and never show zero', () => {
  expect(minutesLeft(NOW + 1000, NOW)).toBe(1);
  expect(minutesLeft(NOW + 61_000, NOW)).toBe(2);
  expect(minutesLeft(NOW - 5000, NOW)).toBe(1);
});

test('the four page languages are complete and never use the old item noun or the module name', () => {
  const keys = Object.keys(GATE_TEXT.he).sort();
  for (const lang of LANGS) {
    expect(Object.keys(GATE_TEXT[lang]).sort()).toEqual(keys);
    for (const k of keys) {
      const t = gateText(lang, k as keyof typeof GATE_TEXT.he);
      expect(t.length).toBeGreaterThan(0);
      expect(t).not.toMatch(/קריא[הות]/); // owner decision 2026-10-14: the old noun never appears
      expect(t).not.toMatch(/Home Assistant|\bHA\b|Arx/);
    }
  }
  expect(gateText('he', 'code_invalid', { n: 2 })).toBe('הקוד שגוי. נותרו 2 ניסיונות');
  for (const lang of ['he', 'en'] as const) {
    for (const t of Object.values(LOCK_TEXT[lang])) expect(t).not.toMatch(/קריא[הות]/);
  }
});

test('the manager card: shown for the current link while locked or while the ticket waits because of a lock', () => {
  const base = { id: 't1', waiting_on: 'assignee' as const, waiting_reason: null };
  const link = (over: Record<string, unknown> = {}) => ({
    state: 'live', current: true, generation: 1, require_code: true, code_locked: true,
    code_locked_until: new Date(NOW + 600_000).toISOString(), can: { copy: true, new: true, revoke: true, resend: false }, ...over,
  });
  expect(codeLockCard({ ...base }, NOW)).toEqual({ show: false, until: null, canNew: false });
  expect(codeLockCard({ ...base, link: null }, NOW).show).toBe(false);
  const on = codeLockCard({ ...base, link: link() }, NOW);
  expect(on).toEqual({ show: true, until: new Date(NOW + 600_000).toISOString(), canNew: true });
  expect(codeLockCard({ ...base, link: link({ current: false }) }, NOW).show).toBe(false);
  const ended = codeLockCard({ ...base, waiting_on: 'manager', waiting_reason: 'code_locked', link: link({ code_locked: false, code_locked_until: null }) }, NOW);
  expect(ended).toEqual({ show: true, until: null, canNew: true });
  expect(codeLockCard({ ...base, link: link({ can: { copy: false, new: false, revoke: false, resend: false } }) }, NOW).canNew).toBe(false);
  expect(lockText('newLink', undefined, 'he')).toBe('שלח קישור חדש');
  expect(lockText('until', { when: '14:30' }, 'en')).toBe('Locked until 14:30');
});
