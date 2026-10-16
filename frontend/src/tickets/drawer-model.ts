/**
 * TKUI1 (release 2.6.0, the v5 request drawer): the pure model of the drawer / page / phone sheet - the four tabs and their badges, the
 * ONE role-resolved primary action, at most one quiet action and the "⋯" menu (IA §3.3 rules 1-3), the three sizes and the phone sheet,
 * the default tab (settings + deep link `?tab=`). No DOM, no Lit (tests/unit-tickets-drawer-model.spec.ts).
 *
 * Rules: approvals outrank status moves (a submitted payment demand is the primary even in `in_progress`); when the ball is not with the
 * viewer the primary is the softest useful push, rendered quiet ("nothing is expected from you"); every other move lives in the menu.
 * The server still decides everything: a move is offered only when `transitions` carries it, an assign only with `can.assign`.
 */
import type { DetailMode, TicketStatus } from '../api/tickets';
import type { CostStatus } from '../api/tickets-costs';
import { dlt } from './delete-text';
import { dwt, type DrawerTextKey } from './drawer-text';
import { menuMoves, statusLabel } from './model';
import type { ViewerRole } from './status-sentence';

// ---------------------------------------------------------------- tabs

export type DrawerTab = 'overview' | 'conv' | 'costs' | 'history';
export const DRAWER_TABS: readonly DrawerTab[] = ['overview', 'conv', 'costs', 'history'];
export const DEFAULT_TAB: DrawerTab = 'overview';

const TAB_ALIASES: Record<string, DrawerTab> = {
  overview: 'overview', conv: 'conv', conversation: 'conv', messages: 'conv', costs: 'costs', cost: 'costs', history: 'history', timeline: 'history',
};

/** A tab name from the address or a setting; anything else is null. */
export function parseTab(raw: string | null | undefined): DrawerTab | null {
  if (!raw) return null;
  return TAB_ALIASES[raw.trim().toLowerCase()] ?? null;
}

/** The tab a request opens on: a deep link (`?tab=`, the card's "ציר זמן" = history) wins, else the module setting, else Overview. */
export function initialTab(o: { deepLink?: string | null; focusTimeline?: boolean; setting?: string | null }): DrawerTab {
  return parseTab(o.deepLink) ?? (o.focusTimeline ? 'history' : null) ?? parseTab(o.setting) ?? DEFAULT_TAB;
}

/** What the tab badges read: the events (unread replies) and the cost block (an approval waiting for the viewer). */
export interface TabTicket {
  events?: readonly { kind: string; at: string; actor?: { me: boolean } }[];
  cost?: { status: CostStatus; can_decide?: boolean } | null;
}

/** Replies of the handler after the viewer's own last action in the ticket (no read receipts exist: "since you last acted here"). */
export function unreadReplies(t: TabTicket): number {
  const evs = t.events ?? [];
  const mine = evs.filter((e) => e.actor?.me).at(-1)?.at ?? '';
  return evs.filter((e) => (e.kind === 'inbound' || e.kind === 'late_reply') && e.at > mine).length;
}

/** Items waiting for the viewer's approval in the Costs tab (today: one submitted payment demand per ticket). */
export function pendingApprovals(t: TabTicket): number {
  return t.cost?.status === 'submitted' && t.cost.can_decide ? 1 : 0;
}

export interface TabItem {
  id: DrawerTab;
  label: string;
  badge: number;
  tone: '' | 'info' | 'warn';
  /** the accessible name: the label and the badge in words ("שיחה, הודעה אחת חדשה") */
  name: string;
}

export function tabItems(t: TabTicket): TabItem[] {
  const conv = unreadReplies(t);
  const costs = pendingApprovals(t);
  const item = (id: DrawerTab, badge: number, tone: TabItem['tone'], one: DrawerTextKey | null, many: DrawerTextKey | null): TabItem => {
    const label = dwt(`tab_${id}` as DrawerTextKey);
    const words = badge && one && many ? (badge === 1 ? dwt(one) : dwt(many, { n: badge })) : '';
    return { id, label, badge, tone: badge ? tone : '', name: words ? `${label}, ${words}` : label };
  };
  return [
    item('overview', 0, '', null, null),
    item('conv', conv, 'info', 'badgeConvOne', 'badgeConvMany'),
    item('costs', costs, 'warn', 'badgeCostsOne', 'badgeCostsMany'),
    item('history', 0, '', null, null),
  ];
}

/** The tab a roving-tabindex key press moves to (RTL is the browser's: ArrowLeft = next in Hebrew). */
export function tabKey(current: DrawerTab, key: string, rtl: boolean): DrawerTab | null {
  const i = DRAWER_TABS.indexOf(current);
  const n = DRAWER_TABS.length;
  const next = rtl ? 'ArrowLeft' : 'ArrowRight';
  const prev = rtl ? 'ArrowRight' : 'ArrowLeft';
  if (key === next) return DRAWER_TABS[(i + 1) % n];
  if (key === prev) return DRAWER_TABS[(i - 1 + n) % n];
  if (key === 'Home') return DRAWER_TABS[0];
  if (key === 'End') return DRAWER_TABS[n - 1];
  return null;
}

// ---------------------------------------------------------------- sizes and the phone sheet

export type DrawerSize = 'drawer' | 'wide' | 'full';
export type PhoneSheet = 'full' | 'half';
export const DRAWER_SIZES: readonly DrawerSize[] = ['drawer', 'wide', 'full'];
export const PHONE_SHEETS: readonly PhoneSheet[] = ['full', 'half'];
/** Owner decision (16.10): 520 / 640 / full screen; the wide panel of v4 (980) is gone. */
export const SIZE_WIDTH: Record<DrawerSize, string> = { drawer: '520px', wide: '640px', full: '100vw' };

export function parseSize(raw: string | null | undefined): DrawerSize | null {
  return raw && (DRAWER_SIZES as readonly string[]).includes(raw) ? (raw as DrawerSize) : null;
}
export function parseSheet(raw: string | null | undefined): PhoneSheet | null {
  return raw && (PHONE_SHEETS as readonly string[]).includes(raw) ? (raw as PhoneSheet) : null;
}

/** The size the drawer opens in: the viewer's own last choice (remembered per browser), else the module setting, else wide. */
export function effectiveSize(own: string | null | undefined, setting: string | null | undefined): DrawerSize {
  return parseSize(own) ?? parseSize(setting) ?? 'wide';
}

// ---------------------------------------------------------------- actions

export type ActionKind =
  | 'assign' | 'reassign' | 'move' | 'close' | 'costs' | 'resend_link' | 'conv' | 'toggle_wait' | 'reopen' | 'cancel' | 'eta' | 'return'
  | 'edit' | 'page' | 'delete';
export type ActionIcon = 'user' | 'check' | 'refresh' | 'send' | 'note' | 'clock' | 'edit' | 'expand' | 'x' | 'trash' | 'flag' | 'lock';

export interface DrawerAction {
  /** a stable key (tests, dedupe): the kind, plus the target state for a move */
  key: string;
  kind: ActionKind;
  label: string;
  icon: ActionIcon;
  tone: 'primary' | 'quiet' | 'success' | 'danger';
  /** the move's target state (`move`, `close`, `toggle_wait`, `reopen`, `cancel`) */
  to?: TicketStatus;
  /** the tab the action lives in (approve → costs, update → conversation) */
  tab?: DrawerTab;
}

/** What the action resolution reads (TicketDetail fits). */
export interface ActionTicket {
  status: TicketStatus;
  transitions: readonly { to: TicketStatus; note_required: boolean }[];
  can: { assign: boolean; manage: boolean; return?: boolean; eta?: boolean; edit_fields?: readonly string[]; delete?: boolean };
  assignee: { kind: 'user' | 'contact'; name: string } | null;
  cost?: { status: CostStatus; can_decide?: boolean } | null;
  link?: { first_opened_at: string | null; can?: { resend: boolean } } | null;
}

const HANDLING: readonly TicketStatus[] = ['assigned', 'acknowledged', 'in_progress', 'waiting_part'];
const has = (t: ActionTicket, to: TicketStatus) => t.transitions.some((x) => x.to === to);
const firstName = (name: string) => {
  const w = name.trim().split(/\s+/)[0] ?? '';
  return w.length > 14 ? `${w.slice(0, 13)}…` : w;
};

function act(kind: ActionKind, label: string, icon: ActionIcon, tone: DrawerAction['tone'], extra: Partial<DrawerAction> = {}): DrawerAction {
  return { key: extra.to && kind === 'move' ? `move:${extra.to}` : kind, kind, label, icon, tone, ...extra };
}

/** The handler's next move on the flow (IA §3.2 "handler" column). */
function handlerMove(t: ActionTicket): DrawerAction | null {
  if (t.status === 'assigned' && has(t, 'acknowledged')) return act('move', dwt('a_ack'), 'check', 'primary', { to: 'acknowledged' });
  if (t.status === 'acknowledged' && has(t, 'in_progress')) return act('move', dwt('a_start'), 'clock', 'primary', { to: 'in_progress' });
  if (t.status === 'in_progress' && has(t, 'done')) return act('move', dwt('a_done'), 'check', 'primary', { to: 'done' });
  if (t.status === 'waiting_part' && has(t, 'in_progress')) return act('move', dwt('a_back'), 'refresh', 'primary', { to: 'in_progress' });
  return null;
}

/** The approval that outranks every move (IA §3.3 rule 3): a submitted payment demand, then marking an approved one as paid. */
function approval(t: ActionTicket): DrawerAction | null {
  if (!t.cost?.can_decide) return null;
  if (t.cost.status === 'submitted') return act('costs', dwt('a_approveClaim'), 'check', 'primary', { tab: 'costs' });
  if (t.cost.status === 'approved') return act('costs', dwt('a_markPaid'), 'check', 'primary', { tab: 'costs' });
  return null;
}

/** The softest useful push while the ball is with the handler or the vendor (a QUIET button). */
function push(t: ActionTicket): DrawerAction | null {
  if (!HANDLING.includes(t.status) || !t.assignee) return null;
  if (t.status === 'assigned' && t.assignee.kind === 'contact' && t.link && !t.link.first_opened_at && t.link.can?.resend) {
    return act('resend_link', dwt('a_resend'), 'send', 'quiet');
  }
  return act('conv', dwt('a_update', { name: firstName(t.assignee.name) }), t.assignee.kind === 'contact' ? 'send' : 'note', 'quiet', { tab: 'conv' });
}

/** The ONE primary action of the status block for this viewer, or null (a requester, a final ticket without a reopen). */
export function primaryAction(t: ActionTicket, role: ViewerRole): DrawerAction | null {
  const a = approval(t);
  if (a && (role === 'manager' || role === 'approver')) return a;
  if (role === 'handler') return handlerMove(t);
  if (role !== 'manager') return null;
  if (t.status === 'done' && has(t, 'closed')) return act('close', dwt('a_close'), 'check', 'success', { to: 'closed' });
  if (t.status === 'new' && t.can.assign) return act('assign', dwt('a_assign'), 'user', 'primary');
  if (t.status === 'returned' && t.can.assign) return act('reassign', dwt('a_reassign'), 'user', 'primary');
  if (t.status === 'closed' && has(t, 'new')) return act('reopen', dwt('a_reopen'), 'refresh', 'quiet', { to: 'new' });
  return push(t);
}

/** At most ONE quiet action beside the primary: the handler's "waiting for a part" toggle (IA usability task 5). */
export function quietAction(t: ActionTicket, role: ViewerRole, primary: DrawerAction | null): DrawerAction | null {
  if (role !== 'handler') return null;
  if ((t.status === 'in_progress' || t.status === 'acknowledged') && has(t, 'waiting_part') && primary?.to !== 'waiting_part') {
    return act('toggle_wait', dwt('a_waitMark'), 'clock', 'quiet', { to: 'waiting_part' });
  }
  return null;
}

/**
 * Everything else, in the "⋯" menu (the ones already on screen are left out): update / note, the part toggle, the state moves the
 * server allows ("שינוי מצב"), assign / reassign, return, ETA, edit, the full page, close without handling, reopen, delete.
 */
export function menuActions(t: ActionTicket, role: ViewerRole, shown: readonly (DrawerAction | null)[], opts: { detailMode?: DetailMode; page?: boolean } = {}): DrawerAction[] {
  const out: DrawerAction[] = [];
  const keys = new Set(shown.filter(Boolean).map((a) => (a as DrawerAction).key));
  const add = (a: DrawerAction | null) => {
    if (a && !keys.has(a.key)) {
      keys.add(a.key);
      out.push(a);
    }
  };
  if (role === 'requester') {
    if (t.can.edit_fields?.length) add(act('edit', dwt('a_edit'), 'edit', 'quiet'));
    if (!opts.page && opts.detailMode === 'drawer_fullscreen') add(act('page', dwt('a_page'), 'expand', 'quiet'));
    return out;
  }
  const p = push(t);
  if (p && p.kind === 'conv') add(p);
  if (t.status === 'waiting_part' && has(t, 'in_progress')) add(act('toggle_wait', dwt('a_back'), 'refresh', 'quiet', { to: 'in_progress' }));
  else if ((t.status === 'in_progress' || t.status === 'acknowledged') && has(t, 'waiting_part')) add(act('toggle_wait', dwt('a_waitMark'), 'clock', 'quiet', { to: 'waiting_part' }));
  const shownTo = new Set(out.concat(shown.filter(Boolean) as DrawerAction[]).map((a) => a.to).filter(Boolean));
  for (const m of menuMoves(t.status, t.transitions)) {
    const to = m.move.to;
    if (to === 'cancelled' || (to === 'new' && t.status === 'closed') || shownTo.has(to)) continue;
    add(act('move', to === 'closed' ? dwt('a_closeMenu') : m.label || statusLabel(to), to === 'closed' ? 'lock' : 'flag', 'quiet', { to }));
  }
  if (t.can.assign) add(t.assignee || t.status !== 'new' ? act('reassign', dwt('a_reassign'), 'user', 'quiet') : act('assign', dwt('a_assign'), 'user', 'quiet'));
  if (t.can.return) add(act('return', dwt('a_return'), 'refresh', 'quiet'));
  if (t.can.eta) add(act('eta', dwt('a_eta'), 'clock', 'quiet'));
  if (t.can.edit_fields?.length) add(act('edit', dwt('a_edit'), 'edit', 'quiet'));
  if (!opts.page && opts.detailMode === 'drawer_fullscreen') add(act('page', dwt('a_page'), 'expand', 'quiet'));
  if (has(t, 'cancelled')) add(act('cancel', dwt('a_cancel'), 'x', 'danger', { to: 'cancelled' }));
  if (t.status === 'closed' && has(t, 'new')) add(act('reopen', dwt('a_reopen'), 'refresh', 'quiet', { to: 'new' }));
  if (t.can.delete) add(act('delete', dlt('action'), 'trash', 'danger'));
  return out;
}

/** The read-only flow of the status block (IA §3.4: six steps that look like actions become one read-only stepper). */
export const FLOW: readonly TicketStatus[] = ['new', 'assigned', 'acknowledged', 'in_progress', 'done', 'closed'];
export function flowSteps(status: TicketStatus): { id: TicketStatus; label: string; state: 'done' | 'cur' | 'todo' }[] {
  const shown = status === 'waiting_part' ? 'in_progress' : status;
  const i = FLOW.indexOf(shown);
  return FLOW.map((id, k) => ({ id, label: statusLabel(id), state: i < 0 ? 'todo' : k < i ? 'done' : k === i ? 'cur' : 'todo' }));
}
