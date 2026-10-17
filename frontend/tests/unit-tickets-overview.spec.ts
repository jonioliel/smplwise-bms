import { test, expect } from '@playwright/test';
import {
  agenda, busyThreshold, dayKey, deptComparison, foldedOf, handlerRows, kpiDeltas, lanes, overdueRows, OVERVIEW_DEFAULTS, overviewSettingsOf, ownNumbers,
  parseBusyInput, parseKpiStore, paymentDates, prevDayKey, rollKpis, showsOwnNumbers, splitVendors, stuckPlaces, stuckReasonCounts, workStart, PHONE_FOLDED,
  type Kpis,
} from '../src/tickets/overview-model';
import { OVERVIEW_TEXT_EN_KEYS, OVERVIEW_TEXT_KEYS, overviewTemplate, ot } from '../src/tickets/overview-text';
import { ASSIGNEE_RE, boardHref, parseBoardRoute } from '../src/tickets/board-model';
import { TAB_PERMISSIONS, TICKETS_OVERVIEW_HREF, TICKETS_TABS, activeAreaTab, tabAllowed } from '../src/shell/nav';
import { setTicketNames } from '../src/tickets/naming';
import type { BoardItem, TreeNode } from '../src/api/tickets-board';
import type { RfqDetail, RfqSummary } from '../src/api/tickets-rfq';
import type { TicketItem } from '../src/api/tickets';

// MGRDASH phase 1: the pure rules of the manager overview (tickets/overview-model.ts), its text catalogue, the tab and the board's new
// handler filter. Node only:  npx playwright test -c playwright.unit.config.ts tests/unit-tickets-overview.spec.ts

test.beforeEach(() => setTicketNames(null));

const NOW = new Date(2026, 9, 17, 12, 0, 0); // local noon, 17.10.2026
const H = 3_600_000;
const iso = (offsetH: number) => new Date(NOW.getTime() + offsetH * H).toISOString();

let seq = 0;
function item(p: Partial<BoardItem> & { a?: string; kind?: 'user' | 'contact'; dept?: string } = {}): BoardItem {
  seq += 1;
  const a = p.a;
  const kind = p.kind ?? 'user';
  return {
    id: p.id ?? `t${String(seq).padStart(15, '0')}`, number: p.number ?? 1000 + seq, title: p.title ?? `req ${seq}`, excerpt: '', status: p.status ?? 'in_progress', origin: 'app',
    department: { id: p.dept ?? 'maint', key: p.dept ?? 'maint', name: p.dept ?? 'maint', icon: null, color: null }, category: null, priority: null,
    place_text: p.place_text ?? '', device_name: '', created_by: { id: 'u0', name: 'x' }, created_at: p.created_at ?? iso(-48), last_activity_at: p.last_activity_at ?? iso(-2),
    assignee: a ? { kind, id: a, name: `name-${a}`, since: null, acknowledged_at: null } : null, last_assignee_name: null, eta_at: p.eta_at ?? null,
    waiting_on: p.waiting_on ?? 'none', waiting_reason: p.waiting_reason ?? null, reopen_count: 0, external_stale: false, closed_at: null, revision: 1, view: 'full',
    group: p.group ?? 'handling', stuck: p.stuck ?? null, sla_cell: p.sla_cell ?? null, place_keys: p.place_keys ?? ['none'],
    assignee_key: a ? `${kind}:${a}` : 'none', auto_close_at: null, manager: true,
  } as BoardItem;
}
const stuck = (kind: NonNullable<BoardItem['stuck']>['kind']) => ({ kind, level: 1, reminders: 0, since: iso(-5) });

test('the settings: the owner\'s defaults, a bad value reads as its default, per-department thresholds', () => {
  expect(overviewSettingsOf(null)).toEqual(OVERVIEW_DEFAULTS);
  expect(OVERVIEW_DEFAULTS).toEqual({ handlerNumbers: 'own', vendors: 'tagged', busy: 8, busyByDept: {}, compare: 'below_numbers' });
  const s = overviewSettingsOf({ dash_handler_numbers: 'all', dash_vendors: 'separate', dash_busy: 0, dash_busy_departments: { maint: 3, clean: 120, x: '4' }, dash_compare: 'top' });
  expect(s).toEqual({ handlerNumbers: 'own', vendors: 'separate', busy: 8, busyByDept: { maint: 3 }, compare: 'top' });
  expect(busyThreshold(s, 'maint')).toBe(3);
  expect(busyThreshold(s, 'clean')).toBe(8);
  expect(busyThreshold(s, '')).toBe(8);
  expect(parseBusyInput('')).toBeNull();
  expect(parseBusyInput(' 12 ')).toBe(12);
  for (const bad of ['0', '100', '1.5', '-3', 'abc', '007']) expect(parseBusyInput(bad), bad).toBeUndefined();
});

test('a handler\'s own numbers: a manager always, a handler unless the setting says managers only', () => {
  const own = overviewSettingsOf({ dash_handler_numbers: 'own' });
  const managers = overviewSettingsOf({ dash_handler_numbers: 'managers' });
  const everyone = overviewSettingsOf({ dash_handler_numbers: 'everyone' });
  expect(showsOwnNumbers(own, false)).toBe(true);
  expect(showsOwnNumbers(everyone, false)).toBe(true);
  expect(showsOwnNumbers(managers, false)).toBe(false);
  expect(showsOwnNumbers(managers, true)).toBe(true);
});

test('own numbers count only the open requests assigned to the viewer (not the ones he opened, not another handler\'s)', () => {
  const t = (p: Partial<TicketItem>) => ({ ...item(), ...p }) as TicketItem;
  const me = { kind: 'user' as const, id: 'me', name: 'me', since: null, acknowledged_at: null };
  const rows = [
    t({ assignee: me, waiting_on: 'assignee' }),
    t({ assignee: me, sla: { ack_due_at: null, stuck_due_at: null, resolve_due_at: iso(-1) } }),
    t({ assignee: me, eta_at: iso(2) }),
    t({ assignee: me, status: 'done' }),
    t({ assignee: me, status: 'closed' }),
    t({ assignee: { ...me, id: 'other' } }),
    t({ assignee: null }),
    t({ assignee: { ...me, kind: 'contact' } }),
  ];
  expect(ownNumbers(rows, 'me', NOW)).toEqual({ open: 3, waiting: 1, overdue: 1, visitsToday: 1 });
});

test('where stuck: reasons counted, places nested with the most first, a reason chip filters rows and counts', () => {
  const tree: TreeNode[] = [
    { key: 'building:b', kind: 'building', name: 'B', parent: null, count: 10, order: 0 },
    { key: 'floor:f1', kind: 'floor', name: 'F1', parent: 'building:b', count: 4, order: 0 },
    { key: 'floor:f2', kind: 'floor', name: 'F2', parent: 'building:b', count: 6, order: 1 },
    { key: 'zone:z', kind: 'zone', name: 'Z', parent: 'floor:f2', count: 3, order: 0 },
    { key: 'none', kind: 'none', name: '', parent: null, count: 1, order: 99 },
  ];
  const items = [
    item({ stuck: stuck('unopened'), place_keys: ['building:b', 'floor:f1'] }),
    item({ stuck: stuck('ack'), place_keys: ['building:b', 'floor:f2', 'zone:z'] }),
    item({ stuck: stuck('ack'), place_keys: ['building:b', 'floor:f2', 'zone:z'] }),
    item({ stuck: stuck('stuck'), place_keys: ['building:b', 'floor:f2'] }),
    item({ stuck: stuck('overdue'), place_keys: ['none'] }),
    item({ place_keys: ['building:b', 'floor:f1'] }),
  ];
  expect(stuckReasonCounts(items)).toEqual({ unopened: 1, ack: 2, stuck: 1, waiting: 0, overdue: 1, unassigned: 0 });
  const rows = stuckPlaces(items, tree);
  // the single building is lifted: the floors are the top level; F2 (3) before F1 (1); "no place" last
  expect(rows.map((r) => [r.key, r.level, r.count])).toEqual([['floor:f2', 0, 3], ['zone:z', 1, 2], ['floor:f1', 0, 1], ['none', 0, 1]]);
  expect(rows[0].why).toEqual({ ack: 2, stuck: 1 });
  expect(rows[0].open).toBe(6);
  const ack = stuckPlaces(items, tree, 'ack');
  expect(ack.map((r) => [r.key, r.count])).toEqual([['floor:f2', 2], ['zone:z', 2]]);
  expect(stuckPlaces(items, tree, 'waiting')).toEqual([]);
  expect(stuckPlaces([item()], tree)).toEqual([]);
});

test('handler load: per-department busy threshold (default 8), the meter, vendors tagged / separate / hidden, busy first', () => {
  const vendors = new Set(['v1']);
  const items = [
    ...Array.from({ length: 8 }, () => item({ a: 'u1', dept: 'maint' })),
    ...Array.from({ length: 5 }, () => item({ a: 'u2', dept: 'maint', waiting_on: 'assignee' })),
    ...Array.from({ length: 4 }, () => item({ a: 'u2', dept: 'clean' })),
    item({ a: 'v1', kind: 'contact', stuck: stuck('unopened'), created_at: iso(-200) }),
    item({ a: 'u3', status: 'closed' }),
    item(),
  ];
  const rows = handlerRows(items, vendors, OVERVIEW_DEFAULTS);
  expect(rows.map((r) => r.key)).toEqual(['user:u1', 'user:u2', 'contact:v1']);
  const [u1, u2, v1] = rows;
  expect(u1.busy).toBe(true); // 8 open in one department = the default threshold
  expect(u1.meter).toBe(4);
  expect(u2.open).toBe(9);
  expect(u2.busy).toBe(false); // 5 + 4 in two departments: measured per department
  expect(u2.waiting).toBe(5);
  expect(v1.vendor).toBe(true);
  expect(v1.stuck).toBe(1);
  expect(v1.oldestAt).toBe(iso(-200));
  expect(v1.meter).toBe(1);
  // a department with its own threshold
  const s = overviewSettingsOf({ dash_busy_departments: { clean: 4 } });
  expect(handlerRows(items, vendors, s).find((r) => r.key === 'user:u2')?.busy).toBe(true);
  // handled counts are merged when available
  expect(handlerRows(items, vendors, OVERVIEW_DEFAULTS, { 'user:u1': 3 }).map((r) => r.handled)).toEqual([3, 0, 0]);
  expect(handlerRows(items, vendors, OVERVIEW_DEFAULTS)[0].handled).toBeUndefined();
  expect(splitVendors(rows, 'tagged')).toEqual({ staff: rows, vendors: [] });
  expect(splitVendors(rows, 'separate')).toEqual({ staff: [u1, u2], vendors: [v1] });
  expect(splitVendors(rows, 'hidden')).toEqual({ staff: [u1, u2], vendors: [] });
});

test('who waits for whom: me / employees / vendors, the oldest, the two most common reasons; no lane "for the requester"', () => {
  const vendors = new Set(['v1']);
  const items = [
    item({ waiting_on: 'manager', waiting_reason: 'done', last_activity_at: iso(-30) }),
    item({ waiting_on: 'manager', waiting_reason: 'done' }),
    item({ waiting_on: 'manager', waiting_reason: 'not_mine' }),
    item({ a: 'u1', waiting_on: 'assignee', stuck: stuck('ack') }),
    item({ a: 'u1', waiting_on: 'assignee' }),
    item({ a: 'v1', kind: 'contact', waiting_on: 'assignee', stuck: stuck('unopened'), last_activity_at: iso(-50) }),
    item({ a: 'u1', waiting_on: 'manager', status: 'closed' }),
  ];
  const ls = lanes(items, vendors);
  expect(ls.map((l) => l.id)).toEqual(['me', 'staff', 'vendors']);
  expect(ls[0]).toEqual({ id: 'me', count: 3, oldestAt: iso(-30), reasons: [{ key: 'done', n: 2 }, { key: 'not_mine', n: 1 }] });
  expect(ls[1].count).toBe(2);
  expect(ls[1].reasons).toEqual([{ key: 'ack', n: 1 }]);
  expect(ls[2]).toEqual({ id: 'vendors', count: 1, oldestAt: iso(-50), reasons: [{ key: 'unopened', n: 1 }] });
});

test('overdue: a crossed target (red after a day), a passed arrival without an update, a passed RFQ deadline; worst first; once per request', () => {
  const items = [
    item({ id: 'a'.repeat(16), sla_cell: { kind: 'overdue', at: iso(-30), over: true }, eta_at: iso(-40) }),
    item({ id: 'b'.repeat(16), sla_cell: { kind: 'ack', at: iso(-2), over: true } }),
    item({ id: 'c'.repeat(16), eta_at: iso(-5), last_activity_at: iso(-6) }),
    item({ id: 'd'.repeat(16), eta_at: iso(-5), last_activity_at: iso(-1) }), // updated after the arrival time: not late
    item({ id: 'e'.repeat(16), eta_at: iso(-5), status: 'done' }),
    item({ id: 'f'.repeat(16), sla_cell: { kind: 'stuck', at: iso(3), over: false } }),
  ];
  const rfqs = [
    { id: 'r1', ref: 'RFQ-08', title: 'windows', state: 'due_passed', due_at: iso(-24), internal_owner: { id: 'u', name: 'owner' } },
    { id: 'r2', ref: 'RFQ-09', title: 'paint', state: 'collecting', due_at: iso(10), internal_owner: { id: 'u', name: 'owner' } },
    { id: 'r3', ref: 'RFQ-10', title: 'done', state: 'awarded', due_at: iso(-100), internal_owner: { id: 'u', name: 'owner' } },
  ] as unknown as RfqSummary[];
  const rows = overdueRows(items, rfqs, NOW);
  expect(rows.map((r) => [r.kind, r.id, r.tone])).toEqual([
    ['sla', 'a'.repeat(16), 'bad'], ['rfq', 'r1', 'warn'], ['eta', 'c'.repeat(16), 'warn'], ['sla', 'b'.repeat(16), 'warn'],
  ]);
  expect(rows[1].who).toBe('owner');
  expect(rows[0].late).toBe(30 * H);
});

test('the next two weeks: arrivals (vendor / employee), work starts, quote deadlines and payment-schedule dates, by local day', () => {
  const vendors = new Set(['v1']);
  const items = [
    item({ a: 'v1', kind: 'contact', eta_at: iso(2), number: 1042 }),
    item({ a: 'u1', eta_at: iso(24), number: 1049 }),
    item({ a: 'u1', eta_at: iso(-1) }), // passed
    item({ a: 'u1', eta_at: iso(24 * 20) }), // beyond two weeks
    item({ eta_at: iso(3) }), // nobody assigned
  ];
  const rfqs = [
    { id: 'r1', ref: 'RFQ-07', title: 'ac', state: 'collecting', due_at: iso(2.5), work_from: null, place_text: null },
    { id: 'r2', ref: 'RFQ-05', title: 'paint', state: 'awarded', due_at: iso(-50), work_from: iso(24 * 3), place_text: 'stairs' },
    { id: 'r3', ref: 'RFQ-04', title: 'old', state: 'due_passed', due_at: iso(-2), work_from: null, place_text: null },
  ] as unknown as RfqSummary[];
  const detail = {
    id: 'r2', ref: 'RFQ-05', title: 'paint', vendors: [{ id: 'rv1', contact: { id: 'c', name: 'n', company: 'Paint Co' } }],
    awards: [{ state: 'approved', vendor_id: 'rv1', order: { work_from: iso(24 * 2) }, terms: { schedule: { items: [
      { index: 0, kind: 'advance', due: 'date', date: dayKey(new Date(NOW.getTime() + 24 * 5 * H)) },
      { index: 1, kind: 'final', due: 'completion', date: null },
      { index: 2, kind: 'progress', due: 'date', date: '2026-12-31' },
    ] } } }],
  } as unknown as RfqDetail;
  const pays = paymentDates([detail]);
  expect(pays.map((p) => [p.ref, p.vendor])).toEqual([['RFQ-05', 'Paint Co'], ['RFQ-05', 'Paint Co']]);
  expect(workStart(rfqs[1], detail)).toBe(iso(48)); // the work order's date wins over the request's window
  expect(workStart(rfqs[1], undefined)).toBe(iso(72));
  const days = agenda(items, rfqs, new Map([['r2', detail]]), pays, vendors, NOW);
  expect(days.map((d) => [d.offset, d.entries.map((e) => e.kind)])).toEqual([
    [0, ['visit_vendor', 'rfq_due']],
    [1, ['visit_staff']],
    [2, ['work_start']],
    [5, ['payment']],
  ]);
  expect(days[0].entries[0].ref).toBe('#1042');
  expect(days[3].entries[0].timed).toBe(false);
});

test('the arrow against yesterday: kept per day, shown only for a number that changed', () => {
  const k = (open: number, stuckN = 2): Kpis => ({ open, stuck: stuckN, waiting: 1, overdue: 0, approval: null });
  const today = dayKey(NOW);
  const yday = prevDayKey(today);
  expect(prevDayKey('2026-03-01')).toBe('2026-02-28');
  expect(prevDayKey('2026-01-01')).toBe('2025-12-31');
  // first visit ever: nothing to compare
  let r = rollKpis(null, k(10), today);
  expect(r.yesterday).toBeNull();
  // yesterday's last numbers become the comparison
  r = rollKpis({ cur: { day: yday, k: k(7) } }, k(10), today);
  expect(r.yesterday).toEqual(k(7));
  expect(r.store).toEqual({ cur: { day: today, k: k(10) }, prev: { day: yday, k: k(7) } });
  // later the same day: still compared with yesterday
  r = rollKpis(r.store, k(12), today);
  expect(r.yesterday).toEqual(k(7));
  // an older value is not "yesterday"
  expect(rollKpis({ cur: { day: '2026-10-01', k: k(1) } }, k(10), today).yesterday).toBeNull();
  expect(kpiDeltas(k(10, 2), k(7, 2))).toEqual({ open: 3 });
  expect(kpiDeltas(k(7, 1), k(7, 2))).toEqual({ stuck: -1 });
  expect(kpiDeltas(k(7), k(7))).toEqual({});
  expect(kpiDeltas(k(7), null)).toEqual({});
  expect(parseKpiStore('{bad')).toBeNull();
  expect(parseKpiStore(JSON.stringify({ cur: { day: today, k: k(1) }, prev: 5 }))).toEqual({ cur: { day: today, k: k(1) } });
});

test('the department comparison: counted from the board, the department in trouble first', () => {
  const items = [
    item({ dept: 'maint', stuck: stuck('ack') }), item({ dept: 'maint', sla_cell: { kind: 'overdue', at: iso(-3), over: true } }), item({ dept: 'maint', waiting_on: 'manager' }),
    item({ dept: 'clean' }), item({ dept: 'clean' }), item({ dept: 'clean' }), item({ dept: 'clean' }),
    ...Array.from({ length: 8 }, () => item({ dept: 'hr', a: 'h1' })),
  ];
  const rows = deptComparison(items, [{ id: 'clean', name: 'Clean' }, { id: 'maint', name: 'Maint' }, { id: 'hr', name: 'HR' }], new Set(), OVERVIEW_DEFAULTS, NOW);
  expect(rows[0]).toEqual({ id: 'maint', name: 'Maint', open: 3, stuck: 1, overdue: 1, waiting: 1, busy: 0 });
  expect(rows.find((r) => r.id === 'hr')).toEqual({ id: 'hr', name: 'HR', open: 8, stuck: 0, overdue: 0, waiting: 0, busy: 1 });
  expect(rows.map((r) => r.id)).toEqual(['maint', 'hr', 'clean']);
});

test('folding: the phone folds cards 5, 6 and 11 until the viewer chooses; a stored choice wins; a broken value reads as none', () => {
  expect(PHONE_FOLDED).toEqual(['throughput', 'daily', 'departments']);
  expect([...foldedOf(null, true)]).toEqual(['throughput', 'daily', 'departments']);
  expect([...foldedOf(null, false)]).toEqual([]);
  expect([...foldedOf('["load"]', true)]).toEqual(['load']);
  expect([...foldedOf('[]', true)]).toEqual([]);
  expect([...foldedOf('{x', true)]).toEqual(['throughput', 'daily', 'departments']);
});

test('the tab: first in the area, for tickets.manage only, active on #/tickets/overview', () => {
  expect(TICKETS_TABS[0].id).toBe('overview');
  expect(TICKETS_TABS[0].href).toBe(TICKETS_OVERVIEW_HREF);
  expect(TICKETS_TABS[0].label).toBe('סקירה');
  expect(TAB_PERMISSIONS[TICKETS_OVERVIEW_HREF]).toEqual(['tickets.manage']);
  expect(tabAllowed(TICKETS_OVERVIEW_HREF, (p) => p === 'tickets.view')).toBe(false);
  expect(tabAllowed(TICKETS_OVERVIEW_HREF, (p) => p === 'tickets.manage')).toBe(true);
  const r = { path: '/tickets/overview', mode: 'tickets', segments: ['tickets', 'overview'], params: new URLSearchParams() } as never;
  expect(activeAreaTab(r)).toBe('overview');
});

test('the board\'s handler filter (a load row opens the board on one handler): parsed with the server\'s pattern, kept in the address', () => {
  expect(parseBoardRoute(new URLSearchParams('assignee=user:dev-tom')).assignee).toBe('user:dev-tom');
  expect(parseBoardRoute(new URLSearchParams('assignee=contact:c1&dept=maint'))).toMatchObject({ assignee: 'contact:c1', dept: 'maint' });
  expect('assignee' in parseBoardRoute(new URLSearchParams('assignee=robert\');drop'))).toBe(false);
  expect('assignee' in parseBoardRoute(new URLSearchParams(''))).toBe(false);
  expect(boardHref({ dept: 'maint', assignee: 'user:u1' })).toBe('#/tickets/board?dept=maint&assignee=user%3Au1');
  expect(boardHref({ assignee: 'bad value' })).toBe('#/tickets/board');
  expect(ASSIGNEE_RE.test('none')).toBe(true);
});

test('the overview catalogue: every Hebrew text has an English one, none writes the default name, a rename and gender reach it', () => {
  expect(OVERVIEW_TEXT_KEYS.filter((k) => !OVERVIEW_TEXT_EN_KEYS.includes(k))).toEqual([]);
  for (const k of OVERVIEW_TEXT_KEYS) for (const lang of ['he', 'en'] as const) expect(overviewTemplate(k, lang), `${lang}.${k}`).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b/);
  expect(ot('kStuck')).toBe('תקועות');
  expect(ot('emptyAll')).toMatch(/במחלקה$/);
  setTicketNames({ he: { one: 'דיווח', many: 'דיווחים', gender: 'm' } });
  expect(ot('kStuck')).toBe('תקועים');
  expect(ot('emptyAll')).toBe('אין עדיין דיווחים במחלקה');
  setTicketNames(undefined);
});
