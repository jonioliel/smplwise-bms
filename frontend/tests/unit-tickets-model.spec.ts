import { test, expect } from '@playwright/test';
import {
  NO_FILTERS, STATUS_LINE, chipLabel, eventLine, isWaitingPart, lineStatus, menuMoves, waitingToggle, isTicketId, listHref, marksInternal, moveTo, parseTicketsRoute, priorityTone, relTime, runLine, shortDateTime, sideMoves,
  statusLabel, statusTone, ticketHref, whereLine,
} from '../src/tickets/model';
import { setTicketNames } from '../src/tickets/naming';
import { activeAreaTab, areaOf, ticketsPageOf } from '../src/shell/nav';
import type { TicketEvent, TicketStatus } from '../src/api/tickets';

// CR-038 slice 1: the pure logic of the tickets screens (routes and filters in the address, status / priority presentation, relative
// times, the timeline lines, the moves the strip offers). Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-model.spec.ts

const params = (q: string) => new URLSearchParams(q);
const route = (path: string) => {
  const [p, q = ''] = path.split('?');
  const segments = p.split('/').filter(Boolean);
  return { path: p, segments, params: params(q), mode: segments[0] as 'tickets' };
};

test.afterEach(() => setTicketNames(null));

test('the address: scopes, the drawer, the create form, the full screen; an unknown scope reads as "mine"', () => {
  expect(parseTicketsRoute(['tickets', 'department'], params('status=closed&dept=dept-x&q=מזגן&t=0123456789abcdef'))).toEqual({
    kind: 'list', scope: 'department', filters: { status: 'closed', department: 'dept-x', q: 'מזגן' }, ticketId: '0123456789abcdef', creating: false,
  });
  expect(parseTicketsRoute(['tickets', 'all'], params('new=1&status=bogus&t=../x'))).toEqual({ kind: 'list', scope: 'all', filters: NO_FILTERS, ticketId: '', creating: true });
  expect(parseTicketsRoute(['tickets', 'board'], params('')).scope).toBe('mine');
  expect(parseTicketsRoute(['tickets', 'fedcba9876543210'], params(''))).toMatchObject({ kind: 'detail', ticketId: 'fedcba9876543210' });
  expect(isTicketId('0123456789abcdef')).toBe(true);
  for (const bad of ['mine', '0123456789ABCDEF', '0123', '0123456789abcdefg', undefined]) expect(isTicketId(bad), String(bad)).toBe(false);
});

test('listHref leaves the defaults out and round-trips through parseTicketsRoute', () => {
  expect(listHref('mine')).toBe('#/tickets/mine');
  const f = { status: 'unassigned' as const, department: 'dept-maintenance', q: ' שער ' };
  const href = listHref('department', f, { t: '0123456789abcdef' });
  expect(href).toBe('#/tickets/department?status=unassigned&dept=dept-maintenance&q=%D7%A9%D7%A2%D7%A8&t=0123456789abcdef');
  const r = route(href.slice(1));
  expect(parseTicketsRoute(r.segments, r.params)).toMatchObject({ scope: 'department', filters: { status: 'unassigned', department: 'dept-maintenance', q: 'שער' }, ticketId: '0123456789abcdef' });
  expect(listHref('all', NO_FILTERS, { create: true })).toBe('#/tickets/all?new=1');
  expect(ticketHref('0123456789abcdef')).toBe('#/tickets/0123456789abcdef');
});

test('the shell: the tickets routes are their own area; the scope page is active in the requests section, the full screen has no page', () => {
  // SERVICEIA1-295: the area row is the section (activeAreaTab), the page row the page (ticketsPageOf)
  expect(areaOf(route('/tickets/mine'))).toBe('tickets');
  for (const p of ['/tickets/department', '/tickets/all?status=closed', '/tickets', '/tickets/0123456789abcdef']) expect(activeAreaTab(route(p)), p).toBe('requests');
  expect(ticketsPageOf(route('/tickets/department'))).toBe('department');
  expect(ticketsPageOf(route('/tickets/all?status=closed'))).toBe('all');
  expect(ticketsPageOf(route('/tickets'))).toBe('mine');
  expect(ticketsPageOf(route('/tickets/0123456789abcdef'))).toBe('');
});

test('2.5.6: "waiting for a part" is a sub-state of "in progress", not a step of the flow', () => {
  expect(STATUS_LINE.map(statusLabel)).toEqual(['חדש', 'שויך', 'התקבל', 'בטיפול', 'הסתיים', 'סגור']);
  expect(STATUS_LINE).not.toContain('waiting_part');
  expect(isWaitingPart('waiting_part')).toBe(true);
  expect(isWaitingPart('in_progress')).toBe(false);
  expect(lineStatus('waiting_part')).toBe('in_progress');
  expect(lineStatus('done')).toBe('done');
  expect(chipLabel('waiting_part')).toBe('בטיפול · ממתין לחלק');
  expect(chipLabel('in_progress')).toBe('בטיפול');
  const mv = (...to: TicketStatus[]) => to.map((x) => ({ to: x, note_required: false }));
  // the toggle: mark from a handled step that may move there, return from the sub-state
  expect(waitingToggle({ status: 'in_progress', transitions: mv('waiting_part', 'done') })).toEqual({ to: 'waiting_part', label: 'סמן: ממתין לחלק' });
  expect(waitingToggle({ status: 'acknowledged', transitions: mv('in_progress', 'waiting_part') })?.to).toBe('waiting_part');
  expect(waitingToggle({ status: 'waiting_part', transitions: mv('in_progress', 'done') })).toEqual({ to: 'in_progress', label: 'חזרה לטיפול' });
  expect(waitingToggle({ status: 'assigned', transitions: mv('in_progress') })).toBeNull();
  expect(waitingToggle({ status: 'in_progress', transitions: mv('done') })).toBeNull();
  expect(waitingToggle({ status: 'done', transitions: mv('in_progress') })).toBeNull();
  // the menus: no separate "waiting" status; leaving the sub-state reads "back to in progress"
  expect(menuMoves('in_progress', mv('waiting_part', 'done', 'closed')).map((m) => m.label)).toEqual(['הסתיים', 'סגור']);
  expect(menuMoves('waiting_part', mv('in_progress', 'done')).map((m) => m.label)).toEqual(['חזרה לטיפול', 'הסתיים']);
});

test('statuses and priorities: labels and chip tones', () => {
  const all: TicketStatus[] = ['new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned', 'closed', 'cancelled'];
  expect(all.map(statusLabel)).toEqual(['חדש', 'שויך', 'התקבל', 'בטיפול', 'ממתין לחלק', 'הסתיים', 'הוחזר', 'סגור', 'בוטל']);
  expect(all.map(statusTone)).toEqual(['', 'info', 'info', 'info', 'warn', 'ok', 'warn', '', '']);
  expect(priorityTone({ key: 'urgent', severity: 'critical' })).toBe('bad');
  expect(priorityTone({ key: 'high', severity: 'alert' })).toBe('warn');
  expect(priorityTone({ key: 'normal', severity: 'alert' })).toBe('info');
  expect(priorityTone({ key: 'low', severity: 'info' })).toBe('');
  expect(priorityTone({ key: 'custom', severity: 'critical' })).toBe('bad');
  expect(priorityTone(null)).toBe('');
});

test('relative times and the compact date', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  expect(relTime('2026-10-13T11:59:40Z', now)).toBe('עכשיו');
  expect(relTime('2026-10-13T11:35:00Z', now)).toBe('לפני 25 דק׳');
  expect(relTime('2026-10-13T07:00:00Z', now)).toBe('לפני 5 שע׳');
  expect(relTime('2026-10-12T10:00:00Z', now)).toBe('אתמול');
  expect(relTime('2026-10-09T10:00:00Z', now)).toBe('לפני 4 ימים');
  expect(relTime(null, now)).toBe('');
  expect(relTime('garbage', now)).toBe('');
  expect(shortDateTime('2026-10-11T04:42:00Z')).toMatch(/^\d{2}:\d{2} \d{2}\/\d{2}$/);
});

test('the card lines: where (department and category until slice 3 anchors a place) and the run line', () => {
  expect(whereLine({ place_text: '', device_name: '', department: { id: 'd', key: 'k', name: 'אחזקה', icon: null, color: null }, category: { id: 'c', name: 'מיזוג' } })).toEqual({ strong: 'אחזקה', rest: 'מיזוג' });
  expect(whereLine({ place_text: 'קומה 1 · חדר 102', device_name: 'מזגן 102', department: null, category: null })).toEqual({ strong: 'קומה 1 · חדר 102', rest: 'מזגן 102' });
  const now = new Date('2026-10-13T12:00:00Z');
  expect(runLine({ last_activity_at: '2026-10-13T09:00:00Z', assignee: null }, now)).toEqual({ text: 'עודכן לפני 3 שע׳ · ללא מטפל', tone: 'bad' });
  expect(runLine({ last_activity_at: '2026-10-13T09:00:00Z', assignee: { kind: 'user', id: 'u', name: 'אבי', since: null, acknowledged_at: null } }, now).tone).toBe('run');
});

test('timeline lines for every event kind, with the configured name (D33)', () => {
  setTicketNames({ he: { one: 'תקלה', many: 'תקלות', gender: 'f' } });
  const ev = (kind: string, extra: Partial<TicketEvent> = {}): TicketEvent => ({ id: 'e', at: '2026-10-13T10:00:00Z', kind, actor: { kind: 'user', name: 'דנה', me: false }, from: null, to: null, body: null, data: {}, via: 'ui', external: false, ...extra });
  expect(eventLine(ev('created')).text).toBe('התקלה נפתחה');
  expect(eventLine(ev('edited', { data: { fields: ['title', 'priority_id'] } })).text).toBe('עודכנו: כותרת, עדיפות');
  expect(eventLine(ev('edited', { data: { fields: ['department_id'], to_department: 'd2' } }), { d2: 'ניקיון' }).text).toBe('התקלה הועברה למחלקה ניקיון');
  expect(eventLine(ev('status', { to: 'in_progress' })).text).toBe('מצב: בטיפול');
  expect(eventLine(ev('status', { to: 'done', data: { on_behalf: true } })).text).toBe('מצב: הסתיים (בשם המטפל)');
  expect(eventLine(ev('closed')).text).toBe('התקלה נסגרה');
  expect(eventLine(ev('cancelled', { data: { duplicate_of: { id: 'x', number: 1042 } } })).text).toBe('התקלה בוטלה · כפילות של #1042');
  expect(eventLine(ev('reopened')).text).toBe('התקלה נפתחה מחדש');
  expect(eventLine(ev('assigned', { data: { assignee: 'אבי כהן' } })).text).toBe('שיוך לאבי כהן');
  expect(eventLine(ev('reassigned', { data: { assignee: 'משה' } })).text).toBe('שיוך מחדש למשה');
  expect(eventLine(ev('returned', { data: { kind: 'not_mine' } })).text).toBe('הוחזר: לא שלי');
  expect(eventLine(ev('returned', { data: { kind: 'cannot_handle' } })).text).toBe('הוחזר: המטפל לא יכול לטפל');
  expect(eventLine(ev('note')).text).toBe('הערה');
  expect(eventLine(ev('note', { data: { absorbed: true } })).text).toBe('דיווח חוזר מאותו מקור');
  expect(eventLine(ev('eta', { data: { eta_at: null } })).text).toBe('הצפי בוטל');
  expect(eventLine(ev('photo')).text).toBe('נוספה תמונה');
  expect(eventLine(ev('photo_removed')).text).toBe('תמונה הוסרה');
  expect(eventLine(ev('duplicate', { data: { number: 1050 } })).text).toBe('#1050 סומנה ככפילות');
  setTicketNames({ he: { one: 'אירוע', many: 'אירועים', gender: 'm' } });
  expect(eventLine(ev('closed')).text).toBe('האירוע נסגר');
});

test('the strip offers what the server allows; cancel and reopen are side moves; internal marks wait for an outside handler', () => {
  const t = { status: 'in_progress' as TicketStatus, transitions: [{ to: 'waiting_part' as TicketStatus, note_required: false }, { to: 'closed' as TicketStatus, note_required: true }, { to: 'cancelled' as TicketStatus, note_required: true }] };
  expect(moveTo(t, 'waiting_part')).toEqual({ allowed: true, noteRequired: false });
  expect(moveTo(t, 'closed')).toEqual({ allowed: true, noteRequired: true });
  expect(moveTo(t, 'done')).toEqual({ allowed: false, noteRequired: false });
  expect(sideMoves(t)).toEqual({ cancel: true, reopen: false });
  expect(sideMoves({ status: 'closed', transitions: [{ to: 'new', note_required: false }] })).toEqual({ cancel: false, reopen: true });
  expect(marksInternal({ assignments: [] })).toBe(false);
  const asg = { id: 'a', name: 'x', channel: 'inapp', assigned_at: '', assigned_by_name: '', acknowledged_at: null, ended_at: null, end_reason: null, return_kind: null, return_reason: null };
  expect(marksInternal({ assignments: [{ ...asg, kind: 'user' }] })).toBe(false);
  expect(marksInternal({ assignments: [{ ...asg, kind: 'contact' }] })).toBe(true);
});
