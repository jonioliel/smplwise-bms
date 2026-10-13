/**
 * CR-038 slice 6: the client of the manager board and the facet counts (routers/tickets_board.py) and of the board's display settings
 * (D19-D21, D28 in `tickets.settings`) and the personal tree choice (D30, /me/prefs `tickets.board.tree_hidden`). A module of its own
 * beside api/tickets.ts so the slices never edit the same lines. Without a backend the demo store answers (the board is computed from
 * the slice-1 demo list). The server's single visibility rule decides every row and every count; nothing here filters for security.
 */
import { get, put } from './client';
import { isApi } from './session';
import { ticketsApi, type ModuleState, type TicketItem, type TicketStatus } from './tickets';

export type BoardFloors = 'chips' | 'tree' | 'chips_tree';
export type Grouping = 'always' | 'no_status_filter' | 'never';
export type ClosedStrip = 'week' | 'all' | 'hidden';
export type BoardState = 'all' | 'waiting' | 'stuck' | 'unassigned' | 'closed';
export type StuckKind = 'unassigned' | 'overdue' | 'unopened' | 'ack' | 'stuck' | 'waiting';
export type BoardGroup = 'waiting' | 'stuck' | 'handling' | 'closed';

/** The board's part of `tickets.settings.ui` (GET /tickets/module carries it to every signed-in user). */
export interface BoardUi { board_floors: BoardFloors; grouping: Grouping; closed_strip: ClosedStrip }
export const BOARD_UI_DEFAULTS: BoardUi = { board_floors: 'tree', grouping: 'no_status_filter', closed_strip: 'all' };

export interface BoardItem extends TicketItem {
  group: BoardGroup;
  stuck: { kind: StuckKind; level: number; reminders: number; since: string | null } | null;
  sla: { kind: StuckKind; at: string; over: boolean } | null;
  place_keys: string[];
  assignee_key: string;
  auto_close_at: string | null;
  manager: boolean;
}

export interface TreeNode { key: string; kind: 'site' | 'building' | 'floor' | 'zone' | 'area' | 'none'; name: string; parent: string | null; count: number; order: number }
export interface HandlingGroup { key: string; kind: 'user' | 'contact' | 'none'; name: string; count: number; oldest_at: string | null; last_activity_at: string | null; eta_at: string | null; ids: string[] }
export interface BoardCounts { all: number; waiting: number; stuck: number; unassigned: number; closed_week: number; closed_all: number }

export interface BoardResponse {
  items: BoardItem[];
  closed: BoardItem[];
  counts: BoardCounts;
  handling: HandlingGroup[];
  departments: { id: string; name: string; count: number; mine: boolean }[];
  tree: TreeNode[];
  truncated: boolean;
  all_departments: boolean;
  now: string;
  ui: Partial<BoardUi> & Record<string, unknown>;
}

export interface BoardQuery {
  department_id?: string;
  priority?: string;
  assignee?: string;
  place?: string;
  stuck?: string;
  state?: BoardState;
  q?: string;
}

export interface Facets {
  status: Partial<Record<TicketStatus, number>>;
  groups: Record<'open' | 'unassigned' | 'handling' | 'done' | 'closed', number>;
  departments: Record<string, number>;
  stuck: Partial<Record<StuckKind, number>>;
  waiting: number;
  tree: TreeNode[];
  total: number;
  truncated: boolean;
}

export interface BoardSettingsDoc { revision: number; ui: Record<string, unknown> & Partial<BoardUi>; urgent_is_critical?: boolean }

export interface BoardBackend {
  board(q: BoardQuery): Promise<BoardResponse>;
  facets(q: BoardQuery & { scope?: string; status?: string }): Promise<Facets>;
  saveSettings(revision: number, patch: { ui?: Partial<BoardUi>; urgent_is_critical?: boolean }): Promise<BoardSettingsDoc>;
  treeHidden(): Promise<boolean>;
  setTreeHidden(hidden: boolean): Promise<void>;
}

const qs = (o: Record<string, string | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

const rest: BoardBackend = {
  board: (q) => get<BoardResponse>(`tickets/board${qs({ department_id: q.department_id, priority: q.priority, assignee: q.assignee, place: q.place, stuck: q.stuck, state: q.state && q.state !== 'all' ? q.state : undefined, q: q.q?.trim() })}`),
  facets: (q) => get<Facets>(`tickets/facets${qs({ scope: q.scope, status: q.status, department_id: q.department_id, priority: q.priority, assignee: q.assignee, place: q.place, stuck: q.stuck, q: q.q?.trim() })}`),
  saveSettings: (revision, patch) => put<BoardSettingsDoc>('tickets/settings', { revision, ...patch }),
  treeHidden: async () => {
    const r = await get<{ prefs: Record<string, unknown> }>('me/prefs');
    return r.prefs?.['tickets.board.tree_hidden'] === 'hidden';
  },
  setTreeHidden: async (hidden) => {
    await put<unknown>('me/prefs', { 'tickets.board.tree_hidden': hidden ? 'hidden' : null });
  },
};

// ---------------------------------------------------------------- the demo store (no backend)

const HOUR = 3_600_000;
let demoTreeHidden = false;
let demoUi: BoardUi = { ...BOARD_UI_DEFAULTS };
let demoUrgent = true;
let demoRevision = 0;
const DEMO_PLACES: TreeNode[] = [
  { key: 'building:b-main', kind: 'building', name: 'בניין ראשי', parent: null, count: 0, order: 0 },
  { key: 'floor:f-0', kind: 'floor', name: 'קרקע', parent: 'building:b-main', count: 0, order: 0 },
  { key: 'floor:f-1', kind: 'floor', name: 'קומה 1', parent: 'building:b-main', count: 0, order: 1 },
  { key: 'floor:f-2', kind: 'floor', name: 'קומה 2', parent: 'building:b-main', count: 0, order: 2 },
  { key: 'zone:z-lobby', kind: 'zone', name: 'לובי', parent: 'floor:f-0', count: 0, order: 0 },
  { key: 'zone:z-102', kind: 'zone', name: 'חדר 102', parent: 'floor:f-1', count: 0, order: 0 },
];

function demoItem(t: TicketItem, i: number, now: number): BoardItem {
  const places = [['building:b-main', 'floor:f-1', 'zone:z-102'], ['building:b-main', 'floor:f-2'], ['building:b-main', 'floor:f-0', 'zone:z-lobby'], ['none']][i % 4];
  const age = (now - Date.parse(t.last_activity_at)) / HOUR;
  const open = !['closed', 'cancelled'].includes(t.status);
  const stuckKind: StuckKind | null = !open ? null : t.status === 'assigned' && age > 2 ? 'ack' : t.status === 'waiting_part' && age > 12 ? 'waiting' : null;
  const group: BoardGroup = !open ? 'closed' : t.waiting_on === 'manager' ? 'waiting' : stuckKind ? 'stuck' : 'handling';
  return {
    ...t, group, place_keys: places, manager: true,
    stuck: stuckKind ? { kind: stuckKind, level: 1, reminders: 1, since: new Date(now - (age - 1) * HOUR).toISOString() } : null,
    sla: open ? { kind: 'stuck', at: new Date(now + 5 * HOUR).toISOString(), over: false } : null,
    assignee_key: t.assignee ? `user:${t.assignee.id}` : 'none',
    auto_close_at: null,
  };
}

const demo: BoardBackend = {
  async board(q) {
    const now = Date.now();
    const page = await ticketsApi().list({ scope: 'visible', status: 'all', q: q.q, limit: 200 });
    let all = page.items.map((t, i) => demoItem(t, i, now));
    const base = all.filter((x) => (!q.place || x.place_keys.includes(q.place)) && (!q.assignee || x.assignee_key === q.assignee));
    const deptCounts = new Map<string, number>();
    for (const x of base) if (x.group !== 'closed' && x.department) deptCounts.set(x.department.id, (deptCounts.get(x.department.id) ?? 0) + 1);
    all = base.filter((x) => !q.department_id || x.department?.id === q.department_id);
    const open = all.filter((x) => x.group !== 'closed');
    const closed = all.filter((x) => x.group === 'closed');
    const week = closed.filter((x) => x.closed_at && now - Date.parse(x.closed_at) < 7 * 24 * HOUR);
    const state = q.state ?? 'all';
    const items = state === 'waiting' ? open.filter((x) => x.group === 'waiting') : state === 'stuck' ? open.filter((x) => x.stuck) : state === 'unassigned' ? open.filter((x) => ['new', 'returned'].includes(x.status)) : state === 'closed' ? (demoUi.closed_strip === 'week' ? week : closed) : open;
    const tree = DEMO_PLACES.map((n) => ({ ...n, count: open.filter((x) => x.place_keys.includes(n.key)).length })).filter((n) => n.count > 0);
    const none = open.filter((x) => x.place_keys.includes('none')).length;
    if (none) tree.push({ key: 'none', kind: 'none', name: '', parent: null, count: none, order: 1 << 30 });
    const handling = new Map<string, BoardResponse['handling'][number]>();
    for (const x of items.filter((y) => y.group === 'handling')) {
      const h = handling.get(x.assignee_key) ?? { key: x.assignee_key, kind: x.assignee ? 'user' : 'none', name: x.assignee?.name ?? '', count: 0, oldest_at: x.created_at, last_activity_at: x.last_activity_at, eta_at: x.eta_at, ids: [] };
      h.count += 1;
      h.ids.push(x.id);
      handling.set(x.assignee_key, h);
    }
    const depts = (await ticketsApi().meta()).departments;
    return {
      items, closed: state === 'closed' ? [] : (demoUi.closed_strip === 'week' ? week : closed), handling: [...handling.values()],
      counts: { all: open.length, waiting: open.filter((x) => x.group === 'waiting').length, stuck: open.filter((x) => x.stuck).length, unassigned: open.filter((x) => ['new', 'returned'].includes(x.status)).length, closed_week: week.length, closed_all: closed.length },
      departments: depts.map((d) => ({ id: d.id, name: d.name, count: deptCounts.get(d.id) ?? 0, mine: d.my_role === 'manager' })), tree, truncated: false, all_departments: true,
      now: new Date(now).toISOString(), ui: { ...demoUi },
    };
  },
  async facets() {
    const b = await demo.board({});
    return { status: {}, groups: { open: b.counts.all, unassigned: b.counts.unassigned, handling: 0, done: 0, closed: b.counts.closed_all }, departments: {}, stuck: {}, waiting: b.counts.waiting, tree: b.tree, total: b.counts.all, truncated: false };
  },
  async saveSettings(_revision, patch) {
    demoUi = { ...demoUi, ...(patch.ui ?? {}) };
    if (typeof patch.urgent_is_critical === 'boolean') demoUrgent = patch.urgent_is_critical;
    demoRevision += 1;
    return { revision: demoRevision, ui: { ...demoUi }, urgent_is_critical: demoUrgent };
  },
  async treeHidden() {
    return demoTreeHidden;
  },
  async setTreeHidden(hidden) {
    demoTreeHidden = hidden;
  },
};

export function boardApi(): BoardBackend {
  return isApi() ? rest : demo;
}

/** The board's display settings from GET /tickets/module (a missing key reads as its default - an older server, the demo). */
export function boardUiOf(m: ModuleState | null | undefined): BoardUi {
  const ui = (m?.ui ?? {}) as Partial<BoardUi>;
  const pick = <K extends keyof BoardUi>(k: K, allowed: readonly BoardUi[K][]): BoardUi[K] => (allowed.includes(ui[k] as BoardUi[K]) ? (ui[k] as BoardUi[K]) : BOARD_UI_DEFAULTS[k]);
  return {
    board_floors: pick('board_floors', ['chips', 'tree', 'chips_tree']),
    grouping: pick('grouping', ['always', 'no_status_filter', 'never']),
    closed_strip: pick('closed_strip', ['week', 'all', 'hidden']),
  };
}
