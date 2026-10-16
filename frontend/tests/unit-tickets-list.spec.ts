import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Meta, TicketItem } from '../src/api/tickets';
import type { BoardItem } from '../src/api/tickets-board';
import type { TableRow } from '../src/api/tickets-table';
import { CARD_CHIP_MAX, avatarPair, boardWarning, cardChips, cardModel, initials, roleFor, rowSentence, type CardItem } from '../src/tickets/list-card-model';
import { activeCardFilters, applyCardFilters, handlerChoices, NO_CARD_FILTERS, offeredFlags, priorityChoices, toggleIn } from '../src/tickets/list-filters';
import { foldCounts, stateCountsOf } from '../src/tickets/list-counts';
import { LOAD_SEGMENTS, MAX_VISITS, loadMeter, todayEntries } from '../src/tickets/board-today';
import { LIST_MODES, visibleModes } from '../src/tickets/list-view-switch';
import { LIST_TEXT_EN_KEYS, LIST_TEXT_KEYS, listTemplate } from '../src/tickets/list-text';
import { SENTENCE_MAX, sentenceFor } from '../src/tickets/status-sentence';
import { setTicketNames } from '../src/tickets/naming';

// TKUI4: the pure logic of the v5 request LIST - the card's model (sentence, chips <= 3, avatar pair, the board's one warning line), the
// filter row, the counts of the page frame, the "today" row and the load meter, the view registry. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-list.spec.ts

const NOW = new Date(2026, 9, 16, 12, 0, 0); // local time: 16.10.2026 12:00
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const prio = (key: string, rank: number, name: string) => ({ id: key, key, name, rank, severity: key === 'urgent' ? ('critical' as const) : ('info' as const) });
const user = { kind: 'user' as const, id: 'u1', name: 'יוסי מזרחי', since: ago(60), acknowledged_at: null };
const vendor = { kind: 'contact' as const, id: 'c1', name: 'מיזוג אלון', since: ago(60), acknowledged_at: null };

function tk(o: Partial<CardItem> = {}): CardItem {
  return {
    id: 'a'.repeat(16), number: 1041, title: 'דליפת מים ממזגן', excerpt: 'x', status: 'in_progress', origin: 'manual',
    department: { id: 'd1', key: 'maint', name: 'אחזקה', icon: null, color: null }, category: null, priority: prio('high', 1, 'גבוהה'),
    place_text: 'קומה 2 · חדר ישיבות', device_name: '', created_by: { id: 'u9', name: 'דני כ.' }, created_at: ago(300), last_activity_at: ago(120),
    assignee: vendor, last_assignee_name: null, eta_at: null, waiting_on: 'none', waiting_reason: null, reopen_count: 0, external_stale: false,
    closed_at: null, revision: 1, view: 'full', ...o,
  };
}
const board = (o: Partial<BoardItem> = {}): BoardItem => ({
  ...tk(), group: 'handling', stuck: null, sla_cell: null, place_keys: [], assignee_key: 'contact:c1', auto_close_at: null, manager: true, ...o,
} as BoardItem);

test.afterEach(() => setTicketNames(null));

// ---------------------------------------------------------------- the card

test('the sentence on a card IS sentenceFor: the card and the drawer never disagree, for every role', () => {
  for (const role of ['manager', 'handler', 'approver', 'requester'] as const) {
    const t = tk({ status: 'assigned' });
    expect(cardModel(t, { role, now: NOW }).sentence).toBe(sentenceFor(t, role, NOW));
  }
});

test('a limited viewer (sla: null) still gets a sentence and a chip', () => {
  const t = tk({ view: 'limited', sla: null, status: 'new', assignee: null });
  const m = cardModel(t, { role: 'requester', now: NOW });
  expect(m.sentence.length).toBeGreaterThan(0);
  expect(m.chip.label).toBe('חדש');
});

test('the chip is ONE chip: waiting for a part is the sub-state of in progress, never a chip of its own', () => {
  const m = cardModel(tk({ status: 'waiting_part' }), { role: 'manager', now: NOW });
  expect(m.chip.label).toBe('בטיפול');
  expect(m.chip.sub).toBe('ממתין לחלק');
  expect(m.chips.map((c) => c.key)).not.toContain('waiting');
});

test('chips: priority, department, then ONE of to-approve / stuck / reopened - never more than three', () => {
  const all = tk({ reopen_count: 2, cost: { status: 'submitted', can_decide: true }, stuck: { kind: 'unopened', level: 1, reminders: 0, since: ago(900) } });
  const c = cardChips(all, 'manager');
  expect(c.map((x) => x.key)).toEqual(['priority', 'department', 'cost']); // approval outranks stuck and reopened
  expect(c.length).toBeLessThanOrEqual(CARD_CHIP_MAX);
  expect(cardChips({ ...all, cost: null }, 'manager').map((x) => x.key)).toEqual(['priority', 'department', 'stuck']);
  expect(cardChips({ ...all, cost: null, stuck: null }, 'manager').map((x) => x.key)).toEqual(['priority', 'department', 'reopened']);
  expect(cardChips({ ...all, cost: null, stuck: null, reopen_count: 0 }, 'manager').map((x) => x.key)).toEqual(['priority', 'department']);
});

test('chips: management information (stuck, cost to approve) never shows to a requester or a handler', () => {
  const t = tk({ cost: { status: 'submitted', can_decide: true }, stuck: { kind: 'stuck', level: 1, reminders: 0, since: ago(900) } });
  for (const role of ['requester', 'handler'] as const) expect(cardChips(t, role).map((x) => x.key)).toEqual(['priority', 'department']);
});

test('chips: a closed request is never "stuck" or "to approve"; no priority / department = no chip', () => {
  const t = tk({ status: 'closed', priority: null, department: null, stuck: { kind: 'stuck', level: 1, reminders: 0, since: ago(900) }, cost: { status: 'submitted' } });
  expect(cardChips(t, 'manager')).toEqual([]);
});

test('the avatar pair: the handler first (outside = ext, internal = int), the owner second, at most two; none without a handler', () => {
  expect(initials('אלון ד.')).toBe('אד');
  expect(initials('מיזוג')).toBe('מי');
  expect(initials('')).toBe('');
  expect(initials('Dana Perez')).toBe('DP');
  expect(avatarPair(tk({ assignee: vendor })).map((a) => [a.ini, a.kind])).toEqual([['מא', 'ext']]);
  expect(avatarPair(tk({ assignee: user, owner: { name: 'דני כהן' } })).map((a) => [a.ini, a.kind])).toEqual([['ימ', 'int'], ['דכ', 'int']]);
  expect(avatarPair(tk({ assignee: null }))).toEqual([]);
  for (const a of avatarPair(tk({ assignee: vendor }))) expect(a.label).toContain('מיזוג אלון');
});

test('the board card: the ONE ranked warning line replaces the chips row (never both)', () => {
  const failed = board({ waiting_reason: 'send_failed', group: 'waiting' });
  const m = cardModel(failed, { role: 'manager', now: NOW, board: true });
  expect(m.warning?.key).toBe('send_failed');
  expect(m.warning?.tone).toBe('bad');
  expect(m.chips).toEqual([]);
  // the list card (not the board) keeps its chips and shows no warning line
  const l = cardModel(failed, { role: 'manager', now: NOW });
  expect(l.warning).toBeNull();
  expect(l.chips.length).toBeGreaterThan(0);
});

test('the board warning ranks (send failed > link expired > stuck) and a stuck level 2 turns red', () => {
  const stuck = board({ group: 'stuck', stuck: { kind: 'unopened', level: 1, reminders: 2, since: ago(900) } });
  const w = boardWarning(stuck, 'manager');
  expect(w?.key).toBe('stuck');
  expect(w?.tone).toBe('warn');
  expect(w?.text).toContain('נשלחו 2 תזכורות'); // the board item's own reminder count
  expect(boardWarning(board({ group: 'stuck', stuck: { kind: 'stuck', level: 2, reminders: 0, since: ago(900) } }), 'manager')?.tone).toBe('bad');
  const both = board({ waiting_reason: 'link_expired', stuck: { kind: 'stuck', level: 1, reminders: 0, since: ago(900) } });
  expect(boardWarning(both, 'manager')?.key).toBe('link_expired');
  expect(boardWarning(board({ waiting_reason: 'send_failed', stuck: { kind: 'stuck', level: 1, reminders: 0, since: ago(900) } }), 'manager')?.key).toBe('send_failed');
});

test('the board card of a waiting request without a warning says why it waits; nothing needs a human = chips', () => {
  const w = boardWarning(board({ group: 'waiting', waiting_reason: 'unassigned', status: 'new', assignee: null }), 'manager');
  expect(w).toMatchObject({ key: 'wait', icon: 'user', text: 'ללא מטפל' });
  expect(boardWarning(board({ group: 'handling' }), 'manager')).toBeNull();
  expect(boardWarning(board({ status: 'closed', group: 'closed', stuck: { kind: 'stuck', level: 1, reminders: 0, since: ago(9) } }), 'manager')).toBeNull();
  expect(boardWarning(board({ waiting_reason: 'send_failed' }), 'requester')).toBeNull(); // warnings are management information
});

test('a done request on the board tells when it closes by itself, while the sentence fits its budget', () => {
  const d = board({ status: 'done', group: 'waiting', waiting_reason: 'done', auto_close_at: new Date(2026, 9, 17, 7, 0).toISOString() });
  const m = cardModel(d, { role: 'manager', now: NOW, board: true });
  expect(m.sentence).toContain('אוטומטית');
  expect(m.sentence.length).toBeLessThanOrEqual(SENTENCE_MAX);
  expect(cardModel(d, { role: 'manager', now: NOW }).sentence).not.toContain('אוטומטית'); // the list card keeps the plain sentence
});

test('urgent and stuck requests are marked for the border; closed ones are not', () => {
  expect(cardModel(tk({ priority: prio('urgent', 0, 'דחופה') }), { role: 'manager', now: NOW }).urgent).toBe(true);
  expect(cardModel(tk({ priority: prio('urgent', 0, 'דחופה'), status: 'closed' }), { role: 'manager', now: NOW }).urgent).toBe(false);
});

test('roleFor: the department role decides; a limited viewer is a requester; a table row with can.manage is a manager', () => {
  const meta = { departments: [{ id: 'd1', my_role: 'manager' }, { id: 'd2', my_role: 'member' }, { id: 'd3', my_role: null }], can: { manage: false, all_departments: false } } as unknown as Meta;
  expect(roleFor(tk(), meta)).toBe('manager');
  expect(roleFor(tk({ department: { id: 'd2', key: 'x', name: 'x', icon: null, color: null } }), meta)).toBe('handler');
  expect(roleFor(tk({ department: { id: 'd3', key: 'x', name: 'x', icon: null, color: null } }), meta)).toBe('requester');
  expect(roleFor(tk({ view: 'limited' }), meta)).toBe('requester');
  expect(roleFor({ view: 'full', department: null, can: { manage: true } }, meta)).toBe('manager');
});

test('the table sentence reads a row the same way: SLA shape and cost are mapped, not copied', () => {
  const row = { ...tk({ status: 'done' }), stuck: null, sla: { kind: 'resolve', due_at: ago(5), overdue: true }, transitions: [], can: { manage: true, assign: true, assign_external: false }, cost_status: 'submitted' } as unknown as TableRow;
  expect(rowSentence(row, 'manager', NOW, true)).toContain('דרישת תשלום ממתינה לאישורך');
  expect(rowSentence(row, 'manager', NOW, false)).not.toContain('לאישורך');
  expect(rowSentence({ ...row, cost_status: null } as TableRow, 'manager', NOW, true)).toBe(sentenceFor(tk({ status: 'done' }), 'manager', NOW));
});

// ---------------------------------------------------------------- the filter row

test('filters narrow the held rows: priority (any of), handler (none / a key), flags (all of); no filter = everything', () => {
  const rows = [
    tk({ id: '1', priority: prio('urgent', 0, 'דחופה'), assignee: vendor }),
    tk({ id: '2', priority: prio('low', 3, 'נמוכה'), assignee: user, waiting_on: 'manager' }),
    tk({ id: '3', priority: prio('low', 3, 'נמוכה'), assignee: null, waiting_on: 'manager', status: 'new' }),
  ];
  expect(applyCardFilters(rows, NO_CARD_FILTERS).map((x) => x.id)).toEqual(['1', '2', '3']);
  expect(applyCardFilters(rows, { ...NO_CARD_FILTERS, priority: ['low'] }).map((x) => x.id)).toEqual(['2', '3']);
  expect(applyCardFilters(rows, { ...NO_CARD_FILTERS, handler: 'none' }).map((x) => x.id)).toEqual(['3']);
  expect(applyCardFilters(rows, { ...NO_CARD_FILTERS, handler: 'user:u1' }).map((x) => x.id)).toEqual(['2']);
  expect(applyCardFilters(rows, { ...NO_CARD_FILTERS, flags: ['waiting'] }).map((x) => x.id)).toEqual(['2', '3']);
  expect(applyCardFilters(rows, { priority: ['low'], handler: 'none', flags: ['waiting'] }).map((x) => x.id)).toEqual(['3']);
  expect(activeCardFilters({ priority: ['low'], handler: 'none', flags: ['waiting'] })).toBe(3);
  expect(toggleIn(['a'], 'b')).toEqual(['a', 'b']);
  expect(toggleIn(['a', 'b'], 'a')).toEqual(['b']);
});

test('the filter row offers only what the rows can satisfy: stuck / cost flags need the field on the rows', () => {
  expect(offeredFlags([tk()])).toEqual(['waiting']);
  expect(offeredFlags([board()])).toEqual(['stuck', 'waiting']);
  expect(offeredFlags([tk({ cost: { status: 'submitted' } })])).toEqual(['waiting', 'cost']);
  expect(priorityChoices([tk({ priority: prio('low', 3, 'נמוכה') }), tk({ priority: prio('urgent', 0, 'דחופה') }), tk({ priority: prio('low', 3, 'נמוכה') })]).map((p) => p.key)).toEqual(['urgent', 'low']);
  expect(handlerChoices([tk({ assignee: user }), tk({ assignee: vendor }), tk({ assignee: user }), tk({ assignee: null })]).map((h) => h.key).sort()).toEqual(['contact:c1', 'user:u1']);
});

// ---------------------------------------------------------------- the counts of the page frame

test('counts: the state segment reads the groups and the total; a failed read leaves its numbers out', () => {
  const f = { groups: { open: 9, unassigned: 1, handling: 7, done: 1, closed: 2 }, total: 11 };
  expect(stateCountsOf(f)).toEqual({ open: 9, unassigned: 1, handling: 7, done: 1, closed: 2, all: 11 });
  const c = foldCounts({ scopes: { mine: { total: 3 }, department: { total: 9 }, all: null }, states: f, departments: { departments: { d1: 7, d2: 2 } } });
  expect(c.scopes).toEqual({ mine: 3, department: 9 });
  expect(c.states.all).toBe(11);
  expect(c.departments).toEqual({ d1: 7, d2: 2 });
  expect(foldCounts({ scopes: {}, states: null, departments: null })).toEqual({ scopes: {}, states: {}, departments: {} });
});

// ---------------------------------------------------------------- the manager board: today row and load meter

test('today: the visits still to come today (earliest first, at most two), the next response target, and what waits for the manager', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 16, h, m).toISOString();
  const items = [
    board({ id: 'v2', eta_at: at(15), assignee: user, place_text: 'מסדרון' }),
    board({ id: 'v1', eta_at: at(13, 30), assignee: vendor, place_text: 'חדר ישיבות' }),
    board({ id: 'v3', eta_at: at(16), assignee: user }),
    board({ id: 'past', eta_at: at(9), assignee: user }),
    board({ id: 'tomorrow', eta_at: new Date(2026, 9, 17, 9).toISOString(), assignee: user }),
    board({ id: 'closed', eta_at: at(14), status: 'closed', assignee: user }),
    board({ id: 's2', number: 1039, title: 'ריח במטבחון', sla_cell: { kind: 'ack', at: at(14), over: false } }),
    board({ id: 's1', sla_cell: { kind: 'ack', at: at(18), over: false } }),
    board({ id: 'over', sla_cell: { kind: 'ack', at: ago(10), over: true } }),
  ];
  const rows = todayEntries(items, { waiting: 3 }, NOW);
  expect(rows.filter((r) => r.kind === 'visit').map((r) => [r.id, r.time])).toEqual([['v1', '13:30'], ['v2', '15:00']]);
  expect(rows.filter((r) => r.kind === 'visit').length).toBeLessThanOrEqual(MAX_VISITS);
  expect(rows.find((r) => r.kind === 'sla')).toMatchObject({ id: 's2', time: '14:00' });
  expect(rows.at(-1)).toMatchObject({ kind: 'waiting', label: expect.stringContaining('3') });
  expect(todayEntries([], { waiting: 0 }, NOW)).toEqual([]); // nothing today: the row is not drawn
  expect(todayEntries([], { waiting: 1 }, NOW)[0].label).toContain('1');
});

test('load meter: filled segments by requests in hand, "hot" at full load, capped', () => {
  expect(loadMeter(0)).toEqual({ on: 0, total: LOAD_SEGMENTS, hot: false });
  expect(loadMeter(2)).toEqual({ on: 2, total: LOAD_SEGMENTS, hot: false });
  expect(loadMeter(LOAD_SEGMENTS)).toEqual({ on: LOAD_SEGMENTS, total: LOAD_SEGMENTS, hot: true });
  expect(loadMeter(99).on).toBe(LOAD_SEGMENTS);
});

// ---------------------------------------------------------------- the view registry

test('views: cards and table for everyone, the manager board for managers; the registry is extensible and has NO calendar yet (task TKCAL)', () => {
  expect(visibleModes(false).map((m) => m.id)).toEqual(['cards', 'table']);
  expect(visibleModes(true).map((m) => m.id)).toEqual(['cards', 'table', 'board']);
  expect(LIST_MODES.map((m) => m.id as string)).not.toContain('calendar');
  for (const m of LIST_MODES) expect(listTemplate(m.label, 'he').length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------- the words

test('the words: Hebrew first, English falls back, the retired old module word and the default names never appear', () => {
  const bad = /קריא(ה|ות|ת)|ניהול השירות|בקש(ת|ות) שירות|\bTickets?\b|Home Assistant/;
  for (const k of LIST_TEXT_KEYS) for (const lang of ['he', 'en'] as const) expect(listTemplate(k, lang), `${lang}.${k}`).not.toMatch(bad);
  for (const k of LIST_TEXT_EN_KEYS) expect(LIST_TEXT_KEYS).toContain(k);
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const f of ['list-card-model.ts', 'list-filters.ts', 'list-filter-row.ts', 'list-view-switch.ts', 'board-today.ts', 'list-counts.ts', 'list-styles.ts']) {
    expect(readFileSync(path.join(here, '../src/tickets', f), 'utf8'), f).not.toMatch(/קריא(ה|ות|ת)/);
  }
});
