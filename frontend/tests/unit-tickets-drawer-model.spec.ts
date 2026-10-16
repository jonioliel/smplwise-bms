import { test, expect } from '@playwright/test';
import {
  DRAWER_TABS, SIZE_WIDTH, effectiveSize, flowSteps, initialTab, menuActions, parseSheet, parseSize, parseTab, pendingApprovals, primaryAction,
  quietAction, tabItems, tabKey, unreadReplies, type ActionTicket,
} from '../src/tickets/drawer-model';
import type { TicketStatus } from '../src/api/tickets';
import type { ViewerRole } from '../src/tickets/status-sentence';

// TKUI1: the pure model of the v5 drawer - the default tab and deep links, the tab badges and their accessible names, the arrow keys, the
// three sizes, and the ONE role-resolved primary action + at most one quiet action + the "⋯" menu (IA §3.3). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-drawer-model.spec.ts

const MOVES: Partial<Record<TicketStatus, TicketStatus[]>> = {
  new: ['assigned', 'cancelled'],
  assigned: ['acknowledged', 'in_progress', 'cancelled'],
  acknowledged: ['in_progress', 'waiting_part', 'done', 'cancelled'],
  in_progress: ['waiting_part', 'done', 'cancelled'],
  waiting_part: ['in_progress', 'done', 'cancelled'],
  done: ['closed', 'in_progress'],
  returned: ['cancelled'],
  closed: ['new'],
  cancelled: [],
};
function tk(status: TicketStatus, o: Partial<ActionTicket> = {}): ActionTicket {
  return {
    status, transitions: (MOVES[status] ?? []).map((to) => ({ to, note_required: to === 'closed' })),
    can: { assign: true, manage: true, return: false, eta: true, edit_fields: ['title'], delete: false },
    assignee: status === 'new' || status === 'returned' ? null : { kind: 'contact', name: 'אלון דוד' }, cost: { status: 'not_required', can_decide: true }, ...o,
  };
}
const keysOf = (xs: { key: string }[]) => xs.map((x) => x.key);

test('the default tab: always Overview; the setting; a deep link ?tab= and the card\'s timeline link win', () => {
  expect(initialTab({})).toBe('overview');
  expect(initialTab({ setting: 'costs' })).toBe('costs');
  expect(initialTab({ setting: 'bogus' })).toBe('overview');
  expect(initialTab({ deepLink: 'conv', setting: 'costs' })).toBe('conv');
  expect(initialTab({ deepLink: 'timeline' })).toBe('history');
  expect(initialTab({ deepLink: 'x', focusTimeline: true, setting: 'costs' })).toBe('history');
  expect(parseTab(' Conversation ')).toBe('conv');
  expect(parseTab('')).toBeNull();
  expect(DRAWER_TABS).toEqual(['overview', 'conv', 'costs', 'history']);
});

test('the tabs: labels, badges (unread replies, approvals waiting for me) in the accessible name', () => {
  const evs = [
    { kind: 'inbound', at: '2026-10-16T08:00:00Z', actor: { me: false } },
    { kind: 'note', at: '2026-10-16T09:00:00Z', actor: { me: true } },
    { kind: 'inbound', at: '2026-10-16T10:00:00Z', actor: { me: false } },
    { kind: 'late_reply', at: '2026-10-16T11:00:00Z', actor: { me: false } },
  ];
  expect(unreadReplies({ events: evs })).toBe(2);
  expect(unreadReplies({ events: evs.slice(0, 3) })).toBe(1);
  expect(unreadReplies({})).toBe(0);
  expect(pendingApprovals({ cost: { status: 'submitted', can_decide: true } })).toBe(1);
  expect(pendingApprovals({ cost: { status: 'submitted', can_decide: false } })).toBe(0);
  expect(pendingApprovals({ cost: { status: 'approved', can_decide: true } })).toBe(0);
  const items = tabItems({ events: evs, cost: { status: 'submitted', can_decide: true } });
  expect(items.map((i) => [i.id, i.label, i.badge, i.tone])).toEqual([['overview', 'סקירה', 0, ''], ['conv', 'שיחה', 2, 'info'], ['costs', 'עלויות', 1, 'warn'], ['history', 'היסטוריה', 0, '']]);
  expect(items[1].name).toBe('שיחה, 2 הודעות חדשות');
  expect(items[2].name).toBe('עלויות, פריט אחד ממתין לאישורך');
  expect(tabItems({ events: evs.slice(0, 3) })[1].name).toBe('שיחה, הודעה אחת חדשה');
  expect(tabItems({})[0].name).toBe('סקירה');
});

test('the arrow keys follow the reading direction; Home / End', () => {
  expect(tabKey('overview', 'ArrowLeft', true)).toBe('conv');
  expect(tabKey('overview', 'ArrowRight', true)).toBe('history');
  expect(tabKey('overview', 'ArrowRight', false)).toBe('conv');
  expect(tabKey('costs', 'Home', true)).toBe('overview');
  expect(tabKey('conv', 'End', true)).toBe('history');
  expect(tabKey('conv', 'Enter', true)).toBeNull();
});

test('sizes: 520 / 640 / full; the viewer\'s own choice, else the setting, else wide; the phone sheet', () => {
  expect(SIZE_WIDTH).toEqual({ drawer: '520px', wide: '640px', full: '100vw' });
  expect(effectiveSize(null, null)).toBe('wide');
  expect(effectiveSize(null, 'drawer')).toBe('drawer');
  expect(effectiveSize('full', 'drawer')).toBe('full');
  expect(effectiveSize('bogus', 'bogus')).toBe('wide');
  expect(parseSize('wide')).toBe('wide');
  expect(parseSize('980')).toBeNull();
  expect(parseSheet('half')).toBe('half');
  expect(parseSheet('x')).toBeNull();
});

test('manager: the primary per state (IA §3.2) - assign, push (quiet), close, reassign, reopen (quiet), nothing when cancelled', () => {
  const p = (t: ActionTicket, role: ViewerRole = 'manager') => primaryAction(t, role);
  expect(p(tk('new'))).toMatchObject({ kind: 'assign', label: 'שיוך מטפל', tone: 'primary' });
  expect(p(tk('new', { can: { ...tk('new').can, assign: false } }))).toBeNull();
  expect(p(tk('assigned'))).toMatchObject({ kind: 'conv', label: 'עדכון לאלון', tone: 'quiet', tab: 'conv' });
  expect(p(tk('assigned', { link: { first_opened_at: null, can: { resend: true } } }))).toMatchObject({ kind: 'resend_link', label: 'שלח שוב', tone: 'quiet' });
  expect(p(tk('assigned', { link: { first_opened_at: '2026-10-16T08:00:00Z', can: { resend: true } } }))?.kind).toBe('conv');
  expect(p(tk('assigned', { link: { first_opened_at: null, can: { resend: false } } }))?.kind).toBe('conv');
  expect(p(tk('assigned', { assignee: { kind: 'user', name: 'יוסי מזרחי' } }))).toMatchObject({ kind: 'conv', label: 'עדכון ליוסי', icon: 'note' });
  for (const st of ['acknowledged', 'in_progress', 'waiting_part'] as TicketStatus[]) expect(p(tk(st))?.tone, st).toBe('quiet');
  expect(p(tk('done'))).toMatchObject({ kind: 'close', label: 'אישור וסגירה', tone: 'success', to: 'closed' });
  expect(p(tk('returned'))).toMatchObject({ kind: 'reassign', label: 'שיוך מחדש', tone: 'primary' });
  expect(p(tk('closed'))).toMatchObject({ kind: 'reopen', tone: 'quiet', to: 'new' });
  expect(p(tk('closed', { transitions: [] }))).toBeNull();
  expect(p(tk('cancelled'))).toBeNull();
});

test('approvals outrank status moves: a submitted payment demand is the primary even in progress; then "mark as paid"', () => {
  const sub = { status: 'submitted' as const, can_decide: true };
  for (const st of ['in_progress', 'waiting_part', 'done'] as TicketStatus[]) {
    expect(primaryAction(tk(st, { cost: sub }), 'manager'), st).toMatchObject({ kind: 'costs', label: 'אישור דרישת התשלום', tab: 'costs', tone: 'primary' });
    expect(primaryAction(tk(st, { cost: sub }), 'approver'), st).toMatchObject({ kind: 'costs' });
  }
  expect(primaryAction(tk('done', { cost: { status: 'approved', can_decide: true } }), 'manager')).toMatchObject({ kind: 'costs', label: 'סימון כשולם' });
  // without the right to decide the approval is not offered
  expect(primaryAction(tk('done', { cost: { status: 'submitted', can_decide: false } }), 'manager')?.kind).toBe('close');
  expect(primaryAction(tk('done', { cost: { status: 'submitted', can_decide: false } }), 'approver')).toBeNull();
  // the handler never sees an approval
  expect(primaryAction(tk('in_progress', { cost: sub }), 'handler')?.label).toBe('בוצע');
  // the close stays reachable in the menu while the approval is the primary
  expect(keysOf(menuActions(tk('done', { cost: sub }), 'manager', [primaryAction(tk('done', { cost: sub }), 'manager')]))).toContain('move:closed');
});

test('handler: קיבלתי → בטיפול → בוצע, "חזרה לטיפול" from the part wait; the quiet part toggle; never an approve', () => {
  const h = (st: TicketStatus) => primaryAction(tk(st, { assignee: { kind: 'user', name: 'אני' } }), 'handler');
  expect(h('assigned')).toMatchObject({ kind: 'move', to: 'acknowledged', label: 'קיבלתי', tone: 'primary' });
  expect(h('acknowledged')).toMatchObject({ to: 'in_progress', label: 'בטיפול' });
  expect(h('in_progress')).toMatchObject({ to: 'done', label: 'בוצע' });
  expect(h('waiting_part')).toMatchObject({ to: 'in_progress', label: 'חזרה לטיפול' });
  expect(h('done')).toBeNull();
  expect(h('new')).toBeNull();
  const t = tk('in_progress');
  expect(quietAction(t, 'handler', primaryAction(t, 'handler'))).toMatchObject({ kind: 'toggle_wait', to: 'waiting_part', label: 'סמן: ממתין לחלק', tone: 'quiet' });
  expect(quietAction(tk('waiting_part'), 'handler', primaryAction(tk('waiting_part'), 'handler'))).toBeNull();
  expect(quietAction(t, 'manager', primaryAction(t, 'manager'))).toBeNull();
  // the requester has no action at all
  expect(primaryAction(tk('done'), 'requester')).toBeNull();
  expect(quietAction(tk('in_progress'), 'requester', null)).toBeNull();
});

test('the "⋯" menu: everything else, nothing twice, only what the server allows', () => {
  const t = tk('in_progress', { can: { assign: true, manage: true, return: false, eta: true, edit_fields: ['title'], delete: true } });
  const prim = primaryAction(t, 'manager');
  const menu = menuActions(t, 'manager', [prim], { detailMode: 'drawer_fullscreen' });
  expect(keysOf(menu)).toEqual(['toggle_wait', 'move:done', 'reassign', 'eta', 'edit', 'page', 'cancel', 'delete']);
  expect(menu.find((a) => a.key === 'move:done')?.label).toBe('הסתיים');
  expect(keysOf(menu)).not.toContain('conv'); // already the primary
  // the page link only when the installation offers both ways (D18) and only inside the drawer
  expect(keysOf(menuActions(t, 'manager', [prim], { detailMode: 'drawer' }))).not.toContain('page');
  expect(keysOf(menuActions(t, 'manager', [prim], { detailMode: 'drawer_fullscreen', page: true }))).not.toContain('page');
  // a handler: return when the server says so, the part toggle is not repeated after the quiet button
  const ht = tk('in_progress', { assignee: { kind: 'user', name: 'אני' }, can: { assign: false, manage: false, return: true, eta: true, edit_fields: [] } });
  const hp = primaryAction(ht, 'handler');
  const hq = quietAction(ht, 'handler', hp);
  const hm = menuActions(ht, 'handler', [hp, hq]);
  expect(keysOf(hm)).toEqual(['conv', 'return', 'eta', 'cancel']);
  // waiting for a part, manager: "חזרה לטיפול" in the menu
  const wp = tk('waiting_part');
  expect(menuActions(wp, 'manager', [primaryAction(wp, 'manager')]).find((a) => a.kind === 'toggle_wait')).toMatchObject({ to: 'in_progress', label: 'חזרה לטיפול' });
  // closed: reopen is the quiet primary, so not again in the menu; cancelled: nothing but edit
  const cl = tk('closed');
  expect(keysOf(menuActions(cl, 'manager', [primaryAction(cl, 'manager')]))).not.toContain('reopen');
  expect(keysOf(menuActions(tk('cancelled', { can: { assign: false, manage: true, edit_fields: [] } }), 'manager', [null]))).toEqual([]);
  // a requester: edit and the page only
  expect(keysOf(menuActions(tk('in_progress', { can: { assign: false, manage: false, edit_fields: ['title'] } }), 'requester', [null], { detailMode: 'drawer_fullscreen' }))).toEqual(['edit', 'page']);
  // the closing move of "done" is the primary, and the reopen-to-work stays in the menu
  const done = tk('done', { can: { assign: true, manage: true, eta: false, edit_fields: ['title'] } });
  expect(keysOf(menuActions(done, 'manager', [primaryAction(done, 'manager')]))).toEqual(['move:in_progress', 'reassign', 'edit']);
});

test('the read-only flow: six steps, the part wait shows as "in progress", side states show no current step', () => {
  expect(flowSteps('waiting_part').map((s) => s.state)).toEqual(['done', 'done', 'done', 'cur', 'todo', 'todo']);
  expect(flowSteps('new')[0]).toEqual({ id: 'new', label: 'חדש', state: 'cur' });
  expect(flowSteps('returned').every((s) => s.state === 'todo')).toBe(true);
  expect(flowSteps('closed').at(-1)?.state).toBe('cur');
});
