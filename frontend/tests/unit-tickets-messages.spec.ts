import { test, expect } from '@playwright/test';
import { assignLines, messageEventLine, messageLine, purposeLabel, visibleMessages, when } from '../src/tickets/message-lines';
import { MESSAGE_TEXT_EN_KEYS, MESSAGE_TEXT_KEYS, mtt } from '../src/tickets/messages-text';
import type { TicketEvent } from '../src/api/tickets';

// CR-038 slice 5b: the delivery lines of D14 (never "delivered" / "read"), the purpose labels, the rows the ticket page shows, the
// timeline lines of message / reply / link events and the catalogue. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-messages.spec.ts

const NOW = new Date(2026, 9, 14, 11, 30);
const at = (h: number, m: number, day = 14) => new Date(2026, 9, day, h, m).toISOString();
const msg = (over: Record<string, unknown>) => ({ state: 'sent', channel: 'whatsapp', held_reason: null, not_before: null, sent_at: at(11, 2), created_at: at(11, 0), ...over }) as Parameters<typeof messageLine>[0];
const ev = (kind: string, over: Partial<TicketEvent> = {}): TicketEvent => ({
  id: '1', at: at(11, 0), kind, actor: { kind: 'system', name: '', me: false }, from: null, to: null, body: null, data: {}, via: 'whatsapp', external: false, ...over,
});

test('a time today is HH:MM, another day carries the date', () => {
  expect(when(at(14, 2), NOW)).toBe('14:02');
  expect(when(at(7, 0, 15), NOW)).toBe('07:00 15/10');
  expect(when(null, NOW)).toBe('');
  expect(when('nonsense', NOW)).toBe('');
});

test('the D14 lines: sent says "delivery unknown", unknown says "maybe sent", failures say "not sent"', () => {
  expect(messageLine(msg({}), NOW)).toEqual({ text: 'נשלח בוואטסאפ - מסירה לא ידועה · 11:02', tone: 'ok' });
  expect(messageLine(msg({ channel: 'email' }), NOW).text).toBe('נשלח במייל - מסירה לא ידועה · 11:02');
  expect(messageLine(msg({ state: 'unknown' }), NOW)).toEqual({ text: 'ייתכן שנשלח · 11:02', tone: 'run' });
  for (const state of ['not_sent', 'refused']) expect(messageLine(msg({ state }), NOW)).toEqual({ text: 'לא נשלח', tone: 'bad' });
  expect(messageLine(msg({ state: 'queued' }), NOW).text).toBe('בתור לשליחה');
  expect(messageLine(msg({ state: 'sending' }), NOW).text).toBe('בשליחה');
});

test('held lines name the reason; the send hours say when it leaves (D4 / D29)', () => {
  expect(messageLine(msg({ state: 'held', held_reason: 'send_hours', not_before: at(7, 0, 15) }), NOW).text).toBe('ממתין לשעות השליחה · יישלח ב-07:00 15/10');
  expect(messageLine(msg({ state: 'held', held_reason: 'channel_down' }), NOW)).toEqual({ text: 'וואטסאפ לא מחובר - ממתין', tone: 'bad' });
  expect(messageLine(msg({ state: 'held', held_reason: 'account_unmapped' }), NOW).tone).toBe('bad');
  expect(messageLine(msg({ state: 'held', held_reason: 'module_off' }), NOW).text).toBe('ממתין');
});

test('no line ever claims delivery or reading', () => {
  for (const key of MESSAGE_TEXT_KEYS) {
    const text = mtt(key);
    expect(text, key).not.toMatch(/נמסר|נקרא|delivered|\bread\b/i);
  }
});

test('purpose labels, and the page shows at most six rows and never a test send', () => {
  expect(purposeLabel('assign')).toBe('הודעת שיוך');
  expect(purposeLabel('code')).toBe('קוד אימות');
  expect(purposeLabel('mystery')).toBe('mystery');
  const rows = Array.from({ length: 9 }, (_, i) => ({ purpose: i === 0 ? 'test' : 'assign', id: String(i) }));
  expect(visibleMessages(rows as { purpose: 'assign' | 'test'; id: string }[]).map((r) => r.id)).toEqual(['1', '2', '3', '4', '5', '6']);
  expect(visibleMessages(undefined)).toEqual([]);
});

test('timeline lines of the message, reply and link events (D14, 9.6)', () => {
  expect(messageEventLine(ev('link_sent', { data: { account: 'שירות ····0191' } }))?.text).toBe('נשלח בוואטסאפ - מסירה לא ידועה · מחשבון שירות ····0191');
  expect(messageEventLine(ev('link_sent', { via: 'email' }))?.text).toBe('נשלח במייל - מסירה לא ידועה');
  expect(messageEventLine(ev('message_unknown'))?.text).toBe('ייתכן שנשלח');
  expect(messageEventLine(ev('message_failed'))?.text).toBe('ההודעה לא נשלחה');
  expect(messageEventLine(ev('message_fallback', { data: { step: 'email' } }))?.text).toBe('וואטסאפ לא זמין - ההודעה תישלח במייל');
  expect(messageEventLine(ev('message_fallback', { data: { step: 'nobody' } }))?.text).toBe('לא היה ערוץ לשליחה - יש להעתיק את הקישור');
  expect(messageEventLine(ev('inbound'))?.text).toBe('תשובה בוואטסאפ (שולח לא מאומת)');
  expect(messageEventLine(ev('late_reply'))?.text).toBe('תשובה שהגיעה באיחור (שולח לא מאומת)');
  expect(messageEventLine(ev('link_opened'))?.text).toBe('הקישור נפתח');
  const inboundStatus = messageEventLine(ev('status', { actor: { kind: 'inbound', name: 'משה', me: false }, to: 'acknowledged' }));
  expect(inboundStatus?.text).toContain('דרך וואטסאפ (שולח לא מאומת)');
  expect(messageEventLine(ev('status', { actor: { kind: 'user', name: 'x', me: false }, to: 'acknowledged' }))).toBeNull();
  expect(messageEventLine(ev('created'))).toBeNull();
});

test('the assign dialog lines: channel and account, a warning only when the server says the account cannot send, the send hours (D29)', () => {
  const account = { key: 'entry:01JFAKE', label: 'שירות ····0191', state: 'connected', sendable: true };
  const open = { window: { from: '07:00', to: '21:00' }, open_now: true, next_opening: null, send_now_default: false };
  expect(assignLines({ channel: 'manual' }, NOW)).toBeNull();
  expect(assignLines({ channel: 'whatsapp', account, send_hours: open, fallback: 'email' }, NOW))
    .toEqual({ via: 'יישלח בוואטסאפ · שירות ····0191', down: '', hours: '', sendNowDefault: false });
  expect(assignLines({ channel: 'whatsapp', account: { ...account, state: 'disconnected', sendable: false }, fallback: 'email' }, NOW)?.down)
    .toBe('וואטסאפ לא זמין כרגע - אם לא יחזור, ההודעה תישלח במייל');
  expect(assignLines({ channel: 'whatsapp', account: null, fallback: 'manual' }, NOW)).toMatchObject({ via: 'יישלח בוואטסאפ', down: 'וואטסאפ לא זמין כרגע - אם לא יחזור, יהיה צריך להעתיק את הקישור' });
  expect(assignLines({ channel: 'whatsapp' }, NOW)?.down).toBe(''); // an older server: no account field, no warning
  expect(assignLines({ channel: 'email', send_hours: open }, NOW)?.via).toBe('יישלח במייל');
  const night = { ...open, open_now: false, next_opening: at(7, 0, 15), send_now_default: true };
  expect(assignLines({ channel: 'whatsapp', account, send_hours: night }, NOW)).toMatchObject({ hours: 'מחוץ לשעות השליחה · יישלח ב-07:00 15/10', sendNowDefault: true });
});

test('every Hebrew text has an English column', () => {
  expect([...MESSAGE_TEXT_EN_KEYS].sort()).toEqual([...MESSAGE_TEXT_KEYS].sort());
});
