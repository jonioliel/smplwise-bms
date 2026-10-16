import { test, expect } from '@playwright/test';
import { elapsedMinutes, elapsedMs, elapsedView, formatElapsed, oldestOpenText, type ElapsedInput } from '../src/tickets/elapsed-model';
import { setTicketNames } from '../src/tickets/naming';

// The running clock (owner 2026-10-16): open time, frozen as the total handling time once closed. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-elapsed.spec.ts
const NOW = new Date(2026, 9, 16, 12, 0, 0);
const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;
const open = (ms: number, o: Partial<ElapsedInput> = {}): ElapsedInput => ({ status: 'in_progress', created_at: at(ms), ...o });

test.afterEach(() => setTicketNames(null));

test('the format: boundaries 59 s, 1 h, 24 h, 2 d 3 h; zero parts are left out', () => {
  expect(formatElapsed(0)).toBe('פחות מדקה');
  expect(formatElapsed(59 * S)).toBe('פחות מדקה');
  expect(formatElapsed(M)).toBe('1 ד׳');
  expect(formatElapsed(59 * M + 59 * S)).toBe('59 ד׳');
  expect(formatElapsed(H)).toBe('1 ש׳');
  expect(formatElapsed(3 * H + 12 * M)).toBe('3 ש׳ 12 ד׳');
  expect(formatElapsed(D - S)).toBe('23 ש׳ 59 ד׳');
  expect(formatElapsed(D)).toBe('1 יום');
  expect(formatElapsed(2 * D + 3 * H + 40 * M)).toBe('2 ימים 3 ש׳');
  expect(formatElapsed(2 * D)).toBe('2 ימים');
  expect(formatElapsed(-5 * H)).toBe('פחות מדקה'); // clock skew: negative clamps to 0
});

test('open: counts to now; the text reads "פתוחה ..."', () => {
  expect(elapsedView(open(3 * H + 12 * M), NOW)).toMatchObject({ text: 'פתוחה 3 ש׳ 12 ד׳', frozen: false, tone: '' });
  expect(elapsedMinutes(open(3 * H + 12 * M), NOW)).toBe(192);
});

test('closed: frozen at the close time - later "now" changes nothing; cancelled reads its own word', () => {
  const t = open(10 * H, { status: 'closed', closed_at: at(10 * H - (5 * H + 40 * M)) });
  const v = elapsedView(t, NOW);
  expect(v).toMatchObject({ text: 'טופלה תוך 5 ש׳ 40 ד׳', frozen: true, tone: '' });
  expect(elapsedView(t, new Date(NOW.getTime() + 9 * D))?.text).toBe(v?.text);
  expect(elapsedView({ ...t, status: 'cancelled' }, NOW)?.text).toBe('בוטלה אחרי 5 ש׳ 40 ד׳');
});

test('closed without closed_at: falls back to the last activity; closed before opened clamps to 0; a bad date has no clock', () => {
  expect(elapsedMs({ status: 'closed', created_at: at(4 * H), last_activity_at: at(1 * H) }, NOW)).toBe(3 * H);
  expect(elapsedMs({ status: 'closed', created_at: at(1 * H), closed_at: at(3 * H) }, NOW)).toBe(0);
  expect(elapsedMs(open(-2 * H), NOW)).toBe(0); // opened "in the future" (skew)
  expect(elapsedView({ status: 'new', created_at: 'garbage' }, NOW)).toBeNull();
  expect(elapsedMinutes({ status: 'new', created_at: 'garbage' }, NOW)).toBeNull();
});

test('colour: only the existing SLA state (near / crossed) tints the clock; nothing for a limited viewer (sla null) or a closed request', () => {
  const sla = (min: number) => ({ ack_due_at: null, stuck_due_at: null, resolve_due_at: new Date(NOW.getTime() + min * M).toISOString() });
  expect(elapsedView(open(H, { sla: sla(120) }), NOW)?.tone).toBe('warn');
  expect(elapsedView(open(H, { sla: sla(-30) }), NOW)?.tone).toBe('bad');
  expect(elapsedView(open(H, { sla: sla(60 * 40) }), NOW)?.tone).toBe('');
  expect(elapsedView(open(H, { sla: null }), NOW)?.tone).toBe('');
  expect(elapsedView(open(H, { sla: sla(-30), status: 'closed', closed_at: at(0) }), NOW)?.tone).toBe('');
});

test('the oldest open request of a set (the board strip tooltip); closed ones are ignored; empty = nothing', () => {
  expect(oldestOpenText([open(H), open(2 * D + 3 * H), open(50 * D, { status: 'closed', closed_at: at(0) })], NOW)).toBe('הוותיקה פתוחה 2 ימים 3 ש׳');
  expect(oldestOpenText([], NOW)).toBe('');
});
