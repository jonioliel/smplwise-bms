import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOARD_HREF, autoCloseLine, boardHref, floorChips, floorsLayout, fmtDur, groupingOn, nestTree, parseBoardRoute, sections, stripItems, stuckChip, waitingLabel,
} from '../src/tickets/board-model';
import { BOARD_TEXT_EN_KEYS, BOARD_TEXT_KEYS, boardTemplate, bt } from '../src/tickets/board-text';
import { tt } from '../src/tickets/text';
import { boardUiOf, type BoardItem, type TreeNode } from '../src/api/tickets-board';
import { setTicketNames } from '../src/tickets/naming';
import { eventLine } from '../src/tickets/model';
import { TICKETS_REQUESTS_PAGES, TICKETS_TABS, TAB_PERMISSIONS, activeAreaTab, areaOf, ticketsPageOf } from '../src/shell/nav';
import { CATEGORY_LABEL, CATEGORY_ORDER, TICKET_SOURCES, VISIBILITY_PERMISSION } from '../src/api/notifications';
import type { TicketEvent } from '../src/api/tickets';

// CR-038 slice 6: the pure logic of the manager board - the address, D20 grouping, the D21 state strip, the D19 / D30 floors layout, the
// tree nesting, the reasons on a card, the board catalogue (D33: tokens only, he + en complete), the timeline rows of the monitor, the
// board tab and the notification category of the module. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-board.spec.ts

test.beforeEach(() => setTicketNames(null));

test('the address: state, department, place, text, drawer, create - defaults left out, junk refused', () => {
  expect(parseBoardRoute(new URLSearchParams(''))).toEqual({ state: 'all', dept: '', place: '', q: '', ticketId: '', creating: false });
  const r = parseBoardRoute(new URLSearchParams('state=stuck&dept=d1&place=floor:f-1&q=מזגן&t=0000000000000a01&new=1'));
  expect(r).toEqual({ state: 'stuck', dept: 'd1', place: 'floor:f-1', q: 'מזגן', ticketId: '0000000000000a01', creating: true });
  expect(parseBoardRoute(new URLSearchParams('state=bogus&place=room:1&t=x')).state).toBe('all');
  expect(parseBoardRoute(new URLSearchParams('place=<script>')).place).toBe('');
  expect(boardHref({})).toBe(BOARD_HREF);
  expect(boardHref({ state: 'waiting', dept: 'd1', place: 'none', q: ' x ' }, { t: 'abc' })).toBe('#/tickets/board?state=waiting&dept=d1&place=none&q=x&t=abc');
  expect(boardHref({ state: 'all' }, { create: true })).toBe('#/tickets/board?new=1');
});

test('D20 grouping: always / only without a state filter / never; the closed list is never grouped', () => {
  expect(groupingOn('no_status_filter', 'all')).toBe(true);
  expect(groupingOn('no_status_filter', 'stuck')).toBe(false);
  expect(groupingOn('always', 'waiting')).toBe(true);
  expect(groupingOn('always', 'closed')).toBe(false);
  expect(groupingOn('never', 'all')).toBe(false);
});

test('D21 state strip: the last item is this week / all closed / nothing', () => {
  const c = { all: 10, waiting: 4, stuck: 3, unassigned: 2, closed_week: 1, closed_all: 7 };
  expect(stripItems('all', c).map((s) => [s.id, s.count])).toEqual([['all', 10], ['waiting', 4], ['stuck', 3], ['unassigned', 2], ['closed', 7]]);
  expect(stripItems('week', c).at(-1)).toEqual({ id: 'closed', label: 'נסגרו השבוע', count: 1 });
  expect(stripItems('all', c).at(-1)?.label).toBe('סגורות (הכול)');
  expect(stripItems('hidden', c).map((s) => s.id)).toEqual(['all', 'waiting', 'stuck', 'unassigned']);
});

test('D19 / D30 floors layout: tree (hideable per user), chips (the tree fully off), chips + tree behind the filter; phone = chips', () => {
  expect(floorsLayout('tree', false, false)).toEqual({ tree: true, chips: false, treeInFilter: false, toggle: true });
  expect(floorsLayout('tree', true, false)).toEqual({ tree: false, chips: true, treeInFilter: false, toggle: true });
  expect(floorsLayout('chips', false, false)).toEqual({ tree: false, chips: true, treeInFilter: false, toggle: false });
  expect(floorsLayout('chips_tree', false, false)).toEqual({ tree: false, chips: true, treeInFilter: true, toggle: false });
  for (const mode of ['tree', 'chips', 'chips_tree'] as const) expect(floorsLayout(mode, false, true).tree).toBe(false);
});

const N = (key: string, kind: TreeNode['kind'], name: string, parent: string | null, count: number, order = 0): TreeNode => ({ key, kind, name, parent, count, order });

test('the tree nests by parent, lifts a lone building, keeps "no place" last; chips are the floors', () => {
  const nodes = [N('building:b', 'building', 'ראשי', null, 5), N('floor:1', 'floor', 'קומה 1', 'building:b', 3, 1), N('floor:0', 'floor', 'קרקע', 'building:b', 2, 0),
    N('zone:102', 'zone', 'חדר 102', 'floor:1', 1), N('none', 'none', '', null, 4, 1 << 30)];
  const t = nestTree(nodes);
  expect(t.map((b) => b.node.key)).toEqual(['floor:1', 'floor:0', 'none']);
  expect(t[0].children.map((b) => b.node.key)).toEqual(['zone:102']);
  const two = nestTree([N('building:a', 'building', 'א', null, 1), N('building:b', 'building', 'ב', null, 1)]);
  expect(two.map((b) => b.node.key)).toEqual(['building:a', 'building:b']);
  expect(floorChips(nodes).map((n) => n.key)).toEqual(['floor:1', 'floor:0', 'none']);
});

test('the reasons a manager reads on a card', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  expect(fmtDur(40 * 60_000)).toBe('40 ד׳');
  expect(fmtDur((5 * 60 + 12) * 60_000)).toBe('5 ש׳ 12 ד׳');
  expect(fmtDur((3 * 24 + 0) * 3_600_000)).toBe('3 ימ׳ 0 ש׳');
  const item = { stuck: { kind: 'unopened' as const, level: 1, reminders: 1, since: '2026-10-12T08:00:00Z' } };
  expect(stuckChip(item, now)).toBe('תקועה · הקישור לא נפתח 1 ימ׳ 2 ש׳');
  expect(stuckChip({ stuck: null }, now)).toBe('');
  expect(waitingLabel('not_mine')).toBe('לא שלי');
  expect(waitingLabel('done')).toBe('ממתין לסגירה');
  expect(waitingLabel('question')).toBe('שאלה מהמטפל');
  expect(waitingLabel('something_new')).toBe('');
  expect(autoCloseLine(null)).toBe('');
  expect(autoCloseLine('2026-10-16T05:00:00Z')).toMatch(/^תיסגר אוטומטית \d\d:\d\d 16\/10$/);
});

test('the sections follow the server group of each item', () => {
  const it = (id: string, group: BoardItem['group']) => ({ id, group }) as BoardItem;
  const s = sections([it('a', 'waiting'), it('b', 'handling'), it('c', 'stuck'), it('d', 'waiting')]);
  expect([s.waiting.map((x) => x.id), s.stuck.map((x) => x.id), s.handling.map((x) => x.id)]).toEqual([['a', 'd'], ['c'], ['b']]);
});

test('the board ui from GET /tickets/module: defaults for missing or unknown values', () => {
  expect(boardUiOf(null)).toEqual({ board_floors: 'tree', grouping: 'no_status_filter', closed_strip: 'all' });
  const m = { enabled: true, public_ready: false, name: {} as never, name_revision: 0, ui: { detail: 'drawer', new_ticket: 'sheet', board_floors: 'chips', grouping: 'bogus' } } as never;
  expect(boardUiOf(m)).toEqual({ board_floors: 'chips', grouping: 'no_status_filter', closed_strip: 'all' });
});

test('the board catalogue: every Hebrew text has an English one, none writes the default name, a rename and gender reach it', () => {
  expect(BOARD_TEXT_KEYS.filter((k) => !BOARD_TEXT_EN_KEYS.includes(k))).toEqual([]);
  for (const k of BOARD_TEXT_KEYS) for (const lang of ['he', 'en'] as const) expect(boardTemplate(k, lang), `${lang}.${k}`).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b/);
  expect(bt('stStuck')).toBe('תקועות');
  setTicketNames({ he: { one: 'דיווח', many: 'דיווחים', gender: 'm' } });
  expect(bt('stStuck')).toBe('תקועים');
  expect(bt('emptyBoard')).toBe('אין דיווחים פתוחים במחלקות שלך');
  expect(bt('openTicket')).toBe('פתיחת הדיווח');
});

test('the timeline rows the SLA monitor writes', () => {
  const ev = (kind: string, data: Record<string, unknown> = {}): TicketEvent => ({ id: '1', at: '2026-10-13T10:00:00Z', kind, actor: { kind: 'system', name: '', me: false }, from: null, to: null, body: null, data, via: 'system', external: false });
  expect(eventLine(ev('stuck', { kind: 'ack' })).text).toBe('נתקעה: לא אושרה קבלה');
  expect(eventLine(ev('reminder', { n: 2 })).text).toBe('נשלחה תזכורת למטפל (2)');
  expect(eventLine(ev('manager_alerted')).text).toBe('המנהלים קיבלו התראה');
  expect(eventLine(ev('auto_closed')).text).toBe('נסגרה אוטומטית');
  expect(eventLine(ev('note', { question: true })).text).toBe('שאלה למנהל'); // CR-038 18A: the handler's question
  expect(eventLine(ev('note', {})).text).toBe('הערה');
  expect(eventLine(ev('link_expired')).icon).toBe('x');
});

test('the board page: after "המחלקה" in the requests section, for tickets.manage, active on #/tickets/board', () => {
  // SERVICEIA1-295 (owner 24.10): the area's row is the four sections; the board stays a PAGE of בקשות, in its old place after "המחלקה"
  expect(TICKETS_TABS.map((t) => t.id)).toEqual(['requests', 'maintenance', 'vendors', 'reports']);
  expect(TICKETS_REQUESTS_PAGES.map((t) => t.id)).toEqual(['list', 'board']); // SERVICEIA2-295: the scopes are the list's filter
  expect(TICKETS_REQUESTS_PAGES.find((t) => t.id === 'board')?.label).toBe('לוח מנהל');
  expect(TAB_PERMISSIONS['#/tickets/board']).toEqual(['tickets.manage']);
  const r = { path: '/tickets/board', mode: 'tickets', segments: ['tickets', 'board'], params: new URLSearchParams() } as never;
  expect(areaOf(r)).toBe('tickets');
  expect(activeAreaTab(r)).toBe('requests');
  expect(ticketsPageOf(r)).toBe('board');
});

test('the notification category and subject kind of the module (spec 13.4)', () => {
  expect(CATEGORY_ORDER.at(-3)).toBe('tickets'); // CR-MAINT215: the maintenance category follows, then NOTICEPUSH-295's 'building'
  expect(CATEGORY_LABEL.tickets).toBe(tt('area')); // a getter: the configured plural (whatever the default is)
  setTicketNames({ he: { one: 'פנייה', many: 'פניות', gender: 'f' } });
  expect(CATEGORY_LABEL.tickets).toBe('פניות');
  expect(VISIBILITY_PERMISSION.ticket).toBe('tickets.view');
  expect(TICKET_SOURCES.map((s) => s.key)).toEqual(['ticket.new_unassigned', 'ticket.assigned', 'ticket.status_update', 'ticket.comment_added', 'ticket.reminder', 'ticket.stuck', 'ticket.returned', 'ticket.question', 'ticket.done',
    'ticket.reply_unmatched', 'ticket.send_failed', 'ticket.contact_changed', 'ticket.channel_down', 'ticket.cost_submitted', 'ticket.cost_missing']);
  for (const s of TICKET_SOURCES) expect(s.label).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b/);
});

test('the backend catalogue and the client catalogue of the ticket sources agree (keys and labels)', () => {
  const py = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../smplwise_vms/backend/smplwise/services/tickets/notify_sources.py'), 'utf8');
  for (const s of TICKET_SOURCES) expect(py, s.key).toContain(`{"key": "${s.key}", "label": "${s.label}"`);
});
