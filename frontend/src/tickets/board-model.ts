/**
 * CR-038 slice 6: the pure logic of the manager board (`#/tickets/board`) - its address, the state strip (D21), whether the cards are
 * grouped (D20), where the floors go (D19 / D30: side tree, chips, or chips with the tree behind the filter button; the user's own hide /
 * show), the tree's nesting, and the reasons a manager reads on a card (stuck since, waiting for me, automatic close). No DOM, no Lit:
 * tests/unit-tickets-board.spec.ts reads it directly.
 */
import type { BoardCounts, BoardFloors, BoardItem, BoardState, ClosedStrip, Grouping, TreeNode } from '../api/tickets-board';
import { bt, type BoardTextKey } from './board-text';
import { shortDateTime } from './model';

export const BOARD_HREF = '#/tickets/board';
export const BOARD_STATES: readonly BoardState[] = ['all', 'waiting', 'stuck', 'unassigned', 'closed'];

export interface BoardRoute {
  state: BoardState;
  dept: string;
  place: string;
  q: string;
  /** the ticket open in the drawer */
  ticketId: string;
  creating: boolean;
}

const isId = (s: string) => /^[0-9a-f]{16}$/.test(s);
const PLACE_RE = /^(none|(site|building|floor|zone|area):[A-Za-z0-9][A-Za-z0-9_.:-]{0,95})$/;

export function parseBoardRoute(params: URLSearchParams): BoardRoute {
  const state = params.get('state') as BoardState | null;
  const place = params.get('place') ?? '';
  const t = params.get('t') ?? '';
  return {
    state: state && BOARD_STATES.includes(state) ? state : 'all',
    dept: (params.get('dept') ?? '').slice(0, 64),
    place: PLACE_RE.test(place) ? place : '',
    q: (params.get('q') ?? '').slice(0, 80),
    ticketId: isId(t) ? t : '',
    creating: params.get('new') === '1',
  };
}

/** The address of the board with its filters (defaults left out), an open drawer (`t`) or the create form (`new`). */
export function boardHref(r: Partial<BoardRoute>, extra: { t?: string; create?: boolean } = {}): string {
  const p = new URLSearchParams();
  if (r.state && r.state !== 'all') p.set('state', r.state);
  if (r.dept) p.set('dept', r.dept);
  if (r.place) p.set('place', r.place);
  if (r.q?.trim()) p.set('q', r.q.trim());
  if (extra.t) p.set('t', extra.t);
  if (extra.create) p.set('new', '1');
  const s = p.toString();
  return `${BOARD_HREF}${s ? `?${s}` : ''}`;
}

/** D20: whether the cards are grouped into ממתין לי / תקועות / בטיפול. A filtered state is a flat list unless the setting says always;
 * the closed list is never grouped. */
export function groupingOn(grouping: Grouping, state: BoardState): boolean {
  if (state === 'closed' || grouping === 'never') return false;
  if (grouping === 'always') return true;
  return state === 'all';
}

export interface StripItem { id: BoardState; label: string; count: number }

/** D21: the state strip - הכול · ממתינות לי · תקועות · ללא מטפל, then "נסגרו השבוע" / "סגורות (הכול)" / nothing. */
export function stripItems(closed: ClosedStrip, c: BoardCounts): StripItem[] {
  const out: StripItem[] = [
    { id: 'all', label: bt('stAll'), count: c.all },
    { id: 'waiting', label: bt('stWaiting'), count: c.waiting },
    { id: 'stuck', label: bt('stStuck'), count: c.stuck },
    { id: 'unassigned', label: bt('stUnassigned'), count: c.unassigned },
  ];
  if (closed === 'week') out.push({ id: 'closed', label: bt('stClosedWeek'), count: c.closed_week });
  else if (closed === 'all') out.push({ id: 'closed', label: bt('stClosedAll'), count: c.closed_all });
  return out;
}

export interface FloorsLayout {
  /** the side tree is drawn next to the cards */
  tree: boolean;
  /** the floor chips row is drawn under the title */
  chips: boolean;
  /** the "סינון" button opens the tree as a panel (chips_tree) */
  treeInFilter: boolean;
  /** the hide / show control of D30 is offered */
  toggle: boolean;
}

/** D19 / D30: where the floors go. `chips` = the tree fully off; `tree` = the side tree, hideable per user (hidden -> chips); `chips_tree`
 * = chips, the tree behind the filter button. On a phone the tree is never drawn (chips). */
export function floorsLayout(mode: BoardFloors, treeHidden: boolean, phone: boolean): FloorsLayout {
  if (mode === 'chips') return { tree: false, chips: true, treeInFilter: false, toggle: false };
  if (phone) return { tree: false, chips: true, treeInFilter: false, toggle: false };
  if (mode === 'chips_tree') return { tree: false, chips: true, treeInFilter: true, toggle: false };
  return treeHidden ? { tree: false, chips: true, treeInFilter: false, toggle: true } : { tree: true, chips: false, treeInFilter: false, toggle: true };
}

export interface TreeBranch { node: TreeNode; children: TreeBranch[] }

/** The flat nodes of the server nested by `parent` (a node whose parent is not in the list is a root), in the server's order. */
export function nestTree(nodes: readonly TreeNode[]): TreeBranch[] {
  const by = new Map<string, TreeBranch>();
  for (const n of nodes) by.set(n.key, { node: n, children: [] });
  const roots: TreeBranch[] = [];
  for (const n of nodes) {
    const b = by.get(n.key) as TreeBranch;
    const parent = n.parent ? by.get(n.parent) : undefined;
    if (parent) parent.children.push(b);
    else roots.push(b);
  }
  // a single site / building level above the floors says nothing - lift its children (the mock-up starts at the floors)
  let level = roots.filter((b) => b.node.kind !== 'none');
  while (level.length === 1 && level[0].children.length && (level[0].node.kind === 'site' || level[0].node.kind === 'building')) level = level[0].children;
  return level.concat(roots.filter((b) => b.node.kind === 'none'));
}

/** The chips row: the floors (else the top places) with their counts, "none" last. */
export function floorChips(nodes: readonly TreeNode[]): TreeNode[] {
  const floors = nodes.filter((n) => n.kind === 'floor');
  const base = floors.length ? floors : nodes.filter((n) => n.kind !== 'none' && !n.parent);
  const none = nodes.filter((n) => n.kind === 'none');
  return [...base, ...none];
}

export function placeLabel(n: TreeNode): string {
  return n.kind === 'none' ? bt('noPlace') : n.name;
}

/** "3 ימ׳ 0 ש׳" / "5 ש׳ 12 ד׳" / "40 ד׳" (the mock-up's compact durations). */
export function fmtDur(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 60) return bt('durMin', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return bt('durHours', { h, m: min % 60 });
  return bt('durDays', { d: Math.floor(h / 24), h: h % 24 });
}

/** The red chip of a stuck ticket: "תקועה · ללא עדכון 3 ימ׳ 0 ש׳" (since the threshold was crossed). */
export function stuckChip(item: Pick<BoardItem, 'stuck'>, now: Date): string {
  if (!item.stuck) return '';
  const since = item.stuck.since ? Date.parse(item.stuck.since) : NaN;
  const dur = Number.isNaN(since) ? '' : fmtDur(now.getTime() - since);
  return bt('stuckChip', { reason: bt(`r_${item.stuck.kind}` as BoardTextKey), dur }).trim();
}

const WAITING_KEYS: Record<string, BoardTextKey> = {
  unassigned: 'w_unassigned', returned: 'w_returned', not_mine: 'w_not_mine', done: 'w_done', reply: 'w_reply', late_reply: 'w_late_reply',
  send_failed: 'w_send_failed', link_expired: 'w_link_expired', contact_changed: 'w_contact_changed', code_locked: 'w_code_locked',
};

/** Why a ticket waits for the manager ("לא שלי", "ממתין לסגירה", ...); '' for an unknown reason. */
export function waitingLabel(reason: string | null | undefined): string {
  const k = reason ? WAITING_KEYS[reason] : undefined;
  return k ? bt(k) : '';
}

/** "ייסגר אוטומטית 07:00 16/10" for a done ticket of a department with an automatic close (D10). */
export function autoCloseLine(at: string | null | undefined): string {
  return at ? bt('autoClose', { when: shortDateTime(at) }) : '';
}

/** The board's sections in order, from the server's `group` of each item. */
export function sections(items: readonly BoardItem[]): { waiting: BoardItem[]; stuck: BoardItem[]; handling: BoardItem[] } {
  return {
    waiting: items.filter((i) => i.group === 'waiting'),
    stuck: items.filter((i) => i.group === 'stuck'),
    handling: items.filter((i) => i.group === 'handling'),
  };
}

/** The age text of a handling group's oldest ticket ("2 ימ׳ 4 ש׳"). */
export function ageOf(iso: string | null, now: Date): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : fmtDur(now.getTime() - t);
}
