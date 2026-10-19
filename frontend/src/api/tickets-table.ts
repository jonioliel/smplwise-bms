/**
 * CR-038 slice 6b (D24, section 13.6): the board TABLE's wire contract - smplwise_vms/backend/smplwise/routers/tickets_table.py:
 *
 *   GET    tickets/table          a page: server-side sort / filters / keyset cursor; every row passed the server's visible()
 *   GET    tickets/export.csv     the table's rows as CSV (managers; 5,000 rows; one a minute)
 *   GET    tickets/reports/monthly.csv   monthly counts per department / vendor as CSV (managers; from + to required)
 *   POST   tickets/bulk           assign / remind / priority / close, one result per ticket (never all-or-nothing)
 *   GET|POST tickets/views, PATCH|DELETE tickets/views/<id>   the user's saved filters / layouts
 *   GET|PUT  me/prefs `tickets.board`                          the user's view / columns / sort / density / page size / default view
 *
 * The inline status and assignee changes use slice 1's single-ticket routes (api/tickets.ts). Without a backend (static preview,
 * design review) every call is answered by the demo store below, built on slice 1's demo store (api/tickets-mock.ts).
 */
import { ApiError, apiUrl, get, patch, post, put, api } from './client';
import { isApi } from './session';
import { mockBackend } from './tickets-mock';
import type { TicketItem, TicketStatus } from './tickets';
import type { CostStatus } from './tickets-costs';

export type ColumnKey = 'number' | 'title' | 'department' | 'priority' | 'status' | 'assignee' | 'place' | 'device' | 'created' | 'activity' | 'stuck' | 'sla'
  | 'cost' | 'cost_status'; // CR-038 slice 9 (11A.9): tickets.costs.view at the installation only (tickets/table-model.ts setCostColumns)
export type SortDir = 'asc' | 'desc';
export interface SortKey { key: ColumnKey; dir: SortDir }
export type Density = 'comfortable' | 'compact';
export type BoardView = 'cards' | 'table' | 'kanban';
export type StuckKind = 'unassigned' | 'unopened' | 'ack' | 'stuck' | 'waiting' | 'overdue';

/** The table's own filters (13.6), on top of the list's scope, state and department (the address of the area). */
export interface TableFilters {
  scope: 'visible' | 'mine' | 'department' | 'all';
  /** a group (open / unassigned / handling / done / closed / all) or a comma list of statuses */
  status: string;
  department: string[];
  priority: string[];
  /** '' | 'none' | 'me' | 'user:<id>' | 'contact:<id>' */
  assignee: string;
  floor: string;
  area: string;
  /** '' | 'any' | a stuck kind */
  stuck: string;
  waiting: '' | 'manager';
  created_from: string;
  created_to: string;
  q: string;
  /** slice 9: cost statuses (tickets.costs.view at the installation; the server answers 403 otherwise) */
  cost_status: string[];
}

export interface TableRow extends Omit<TicketItem, 'excerpt' | 'sla'> {
  /** blank (null) for a limited viewer - management information */
  stuck: { kind: StuckKind; level: number; since: string | null; reminders: number } | null;
  sla: { kind: 'ack' | 'stuck' | 'resolve'; due_at: string; overdue: boolean } | null;
  /** the status moves THIS caller may make now (POST tickets/<id>/status) */
  transitions: { to: TicketStatus; note_required: boolean }[];
  can: { manage: boolean; assign: boolean; assign_external: boolean };
  /** slice 9 (11A.9): the approved total, else the submitted one (approved: false); null without tickets.costs.view on the row */
  cost?: { total_minor: number; currency: string; approved: boolean } | null;
  cost_status?: CostStatus | null;
}

export interface TablePage { items: TableRow[]; next_cursor: string | null; sort: string; limit: number }

export type BulkAction = 'assign' | 'remind' | 'priority' | 'close' | 'delete'; // 'delete': owner 14.10, its own route (api/tickets-delete.ts)
export type BulkResult = 'ok' | 'unchanged' | 'stale' | 'forbidden' | 'invalid_transition' | 'not_found' | 'assignee_not_allowed' | 'unavailable' | 'too_soon' | 'invalid'
  | 'cost_claim_approved';
export interface BulkBody {
  action: Exclude<BulkAction, 'delete'>;
  items: { id: string; revision: number }[];
  params: { assignee?: { kind: 'user' | 'contact'; id: string }; priority_key?: string; note?: string };
  client_request_id: string;
}
export interface BulkAnswer { action: BulkAction; total: number; done: number; counts: Partial<Record<BulkResult, number>>; results: { id: string; number?: number; result: BulkResult }[] }

/** A saved view's document - the same whitelists as the list (services/tickets/views.py). */
export interface ViewDoc { view: BoardView; filters: Partial<Record<keyof TableFilters, string | string[]>>; sort: string; columns: ColumnKey[]; density: Density }
export interface SavedView { id: string; name: string; view: ViewDoc; created_at: string; updated_at: string }

/** The per-user preference `tickets.board` (a partial object; a missing key = the default). */
export interface BoardPrefs { view?: BoardView; columns?: ColumnKey[]; sort?: string; density?: Density; limit?: number; default_view?: string }

export interface ExportResult { blob: Blob; rows: number | null; filename: string }

export interface TableBackend {
  page(params: Record<string, string>): Promise<TablePage>;
  bulk(body: BulkBody): Promise<BulkAnswer>;
  exportCsv(params: Record<string, string>): Promise<ExportResult>;
  /** monthly counts per department / vendor (tickets/reports/monthly.csv; from + to required) */
  monthlyReport(params: Record<string, string>): Promise<ExportResult>;
  views(): Promise<{ items: SavedView[]; max: number }>;
  createView(name: string, view: ViewDoc): Promise<SavedView>;
  patchView(id: string, body: { name?: string; view?: ViewDoc }): Promise<SavedView>;
  deleteView(id: string): Promise<void>;
  prefs(): Promise<BoardPrefs>;
  savePrefs(p: BoardPrefs): Promise<BoardPrefs>;
}

const T = 'tickets';
const enc = encodeURIComponent;
const qs = (o: Record<string, string>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** A binary answer (the CSV) with the same credentials and error model as `api()`. */
async function blobOf(path: string): Promise<{ blob: Blob; headers: Headers }> {
  const res = await fetch(apiUrl(path), { credentials: 'same-origin' });
  if (!res.ok) {
    let body: Partial<ApiError['body']> = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      body = {};
    }
    throw new ApiError(res.status, { code: body.code ?? `http_${res.status}`, user_message: body.user_message ?? '', retryable: body.retryable ?? false, correlation_id: body.correlation_id ?? '', details: body.details ?? {} });
  }
  return { blob: await res.blob(), headers: res.headers };
}

const rest: TableBackend = {
  page: (params) => get<TablePage>(`${T}/table${qs(params)}`),
  bulk: (body) => post<BulkAnswer>(`${T}/bulk`, body),
  exportCsv: async (params) => {
    const { blob, headers } = await blobOf(`${T}/export.csv${qs(params)}`);
    const rows = headers.get('X-Export-Rows');
    const name = /filename="?([^";]+)"?/.exec(headers.get('Content-Disposition') ?? '')?.[1];
    return { blob, rows: rows === null ? null : Number(rows), filename: name || 'export.csv' };
  },
  monthlyReport: async (params) => {
    const { blob, headers } = await blobOf(`${T}/reports/monthly.csv${qs(params)}`);
    const rows = headers.get('X-Export-Rows');
    const name = /filename="?([^";]+)"?/.exec(headers.get('Content-Disposition') ?? '')?.[1];
    return { blob, rows: rows === null ? null : Number(rows), filename: name || 'monthly.csv' };
  },
  views: () => get<{ items: SavedView[]; max: number }>(`${T}/views`),
  createView: (name, view) => post<SavedView>(`${T}/views`, { name, view }),
  patchView: (id, body) => patch<SavedView>(`${T}/views/${enc(id)}`, body),
  deleteView: (id) => api<void>(`${T}/views/${enc(id)}`, { method: 'DELETE' }),
  prefs: async () => ((await get<{ prefs: Record<string, unknown> }>('me/prefs')).prefs['tickets.board'] as BoardPrefs | null) ?? {},
  savePrefs: async (p) => ((await put<{ prefs: Record<string, unknown> }>('me/prefs', { 'tickets.board': p })).prefs['tickets.board'] as BoardPrefs | null) ?? {},
};

// ---------------------------------------------------------------- the demo store (no backend)

const ORDER: TicketStatus[] = ['new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned', 'closed', 'cancelled'];
const GROUPS: Record<string, TicketStatus[]> = {
  open: ['new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned'], unassigned: ['new', 'returned'],
  handling: ['assigned', 'acknowledged', 'in_progress', 'waiting_part'], done: ['done'], closed: ['closed', 'cancelled'],
};
const demoViews: SavedView[] = [];
let demoPrefs: BoardPrefs = {};
let demoSeq = 0;

function demoKey(r: TableRow, key: ColumnKey): string | number {
  switch (key) {
    case 'number': return r.number;
    case 'title': return r.title;
    case 'department': return r.department?.name ?? '';
    case 'priority': return r.priority?.rank ?? 99;
    case 'status': return ORDER.indexOf(r.status);
    case 'assignee': return r.assignee?.name ?? '';
    case 'place': return r.place_text;
    case 'device': return r.device_name;
    case 'created': return r.created_at;
    case 'activity': return r.last_activity_at;
    case 'stuck': return r.stuck ? 1 + r.stuck.level : 0;
    case 'sla': return r.sla?.due_at ?? '9999';
    case 'cost': return r.cost?.total_minor ?? -1;
    case 'cost_status': return r.cost_status ?? '';
  }
}

const mock: TableBackend = {
  async page(params) {
    const all = await mockBackend.list({ scope: (params.scope as 'mine') || 'visible', status: 'all', limit: 200 });
    const statuses = !params.status || params.status === 'all' ? null : GROUPS[params.status] ?? params.status.split(',');
    const depts = params.department ? params.department.split(',') : [];
    const prios = params.priority ? params.priority.split(',') : [];
    const q = (params.q ?? '').trim();
    const rows: TableRow[] = [];
    for (const it of all.items) {
      if (statuses && !statuses.includes(it.status)) continue;
      if (depts.length && !depts.includes(it.department?.id ?? '')) continue;
      if (prios.length && !prios.includes(it.priority?.key ?? '')) continue;
      if (params.assignee === 'none' && it.assignee) continue;
      if (params.assignee === 'me' && it.assignee?.id !== 'demo') continue;
      if (params.assignee?.includes(':') && params.assignee !== `${it.assignee?.kind}:${it.assignee?.id}`) continue; // TKSTAFF2: user:<id> | contact:<id>
      if (params.waiting === 'manager' && it.waiting_on !== 'manager') continue;
      if (q && !it.title.includes(q) && String(it.number) !== q.replace(/^#/, '')) continue;
      const d = await mockBackend.get(it.id);
      const { excerpt: _e, ...item } = it;
      if (params.cost_status && !params.cost_status.split(',').includes(d.cost?.status ?? '')) continue;
      const cost = d.cost?.total_minor != null && d.cost.currency ? { total_minor: d.cost.total_minor, currency: d.cost.currency, approved: d.cost.status === 'approved' || d.cost.status === 'paid' } : null;
      rows.push({ ...item, stuck: null, sla: null, transitions: d.transitions, can: { manage: d.can.manage, assign: d.can.assign, assign_external: false }, cost, cost_status: d.cost?.status ?? null });
    }
    const sort = (params.sort || 'activity:desc').split(',').map((p) => p.split(':') as [ColumnKey, SortDir]);
    rows.sort((a, b) => {
      for (const [k, dir] of sort) {
        const x = demoKey(a, k);
        const y = demoKey(b, k);
        if (x !== y) return (x < y ? -1 : 1) * (dir === 'desc' ? -1 : 1);
      }
      return a.id < b.id ? -1 : 1;
    });
    return { items: rows, next_cursor: null, sort: params.sort || 'activity:desc', limit: Number(params.limit || 50) };
  },
  async bulk(body) {
    const results: BulkAnswer['results'] = [];
    for (const item of body.items) {
      let result: BulkResult = 'ok';
      let number: number | undefined;
      try {
        const t = await mockBackend.get(item.id);
        number = t.number;
        if (t.revision !== item.revision) result = 'stale';
        else if (body.action === 'close') await mockBackend.status(item.id, { to: 'closed', note: body.params.note, revision: item.revision });
        else if (body.action === 'assign' && body.params.assignee) await mockBackend.assign(item.id, { assignee: body.params.assignee, revision: item.revision });
        else if (body.action === 'priority') {
          const dept = (await mockBackend.meta()).departments.find((x) => x.id === t.department?.id);
          const p = dept?.priorities.find((x) => x.key === body.params.priority_key);
          if (!p || p.id === t.priority?.id) result = 'unchanged';
          else await mockBackend.patch(item.id, { priority_id: p.id, revision: item.revision });
        } else if (body.action === 'remind' && !t.assignee) result = 'invalid_transition';
      } catch (e) {
        result = e instanceof ApiError && e.status === 409 ? 'invalid_transition' : 'not_found';
      }
      results.push({ id: item.id, number, result });
    }
    const counts: BulkAnswer['counts'] = {};
    for (const r of results) counts[r.result] = (counts[r.result] ?? 0) + 1;
    return { action: body.action, total: body.items.length, done: counts.ok ?? 0, counts, results };
  },
  async exportCsv() {
    return { blob: new Blob(['﻿'], { type: 'text/csv' }), rows: 0, filename: 'export.csv' };
  },
  async monthlyReport() {
    return { blob: new Blob(['﻿'], { type: 'text/csv' }), rows: 0, filename: 'monthly.csv' };
  },
  async views() {
    return { items: demoViews.map((v) => ({ ...v })), max: 20 };
  },
  async createView(name, view) {
    const now = new Date().toISOString();
    const v: SavedView = { id: `v${++demoSeq}`, name, view, created_at: now, updated_at: now };
    demoViews.push(v);
    return { ...v };
  },
  async patchView(id, body) {
    const v = demoViews.find((x) => x.id === id);
    if (!v) throw new ApiError(404, { code: 'view_not_found', user_message: '', retryable: false, correlation_id: '', details: {} });
    Object.assign(v, body.name ? { name: body.name } : {}, body.view ? { view: body.view } : {});
    return { ...v };
  },
  async deleteView(id) {
    const i = demoViews.findIndex((x) => x.id === id);
    if (i >= 0) demoViews.splice(i, 1);
  },
  async prefs() {
    return { ...demoPrefs };
  },
  async savePrefs(p) {
    demoPrefs = { ...p };
    return { ...demoPrefs };
  },
};

/** The backend in force: REST with a server, the demo store without one. */
export function tableApi(): TableBackend {
  return isApi() ? rest : mock;
}

// ---------------------------------------------------------------- the per-user preference, read once per page load

let prefsCache: Promise<BoardPrefs> | null = null;

/** `tickets.board` of the signed-in user (cached for the page's life; a failure reads as the defaults). */
export function boardPrefs(): Promise<BoardPrefs> {
  prefsCache ??= tableApi().prefs().catch(() => ({}));
  return prefsCache;
}

/** Merge a change into `tickets.board` and store it (fire and forget for the screens: a failed save keeps the screen as it is). */
export async function saveBoardPrefs(change: Partial<BoardPrefs>): Promise<BoardPrefs> {
  const current = await boardPrefs();
  const next: BoardPrefs = { ...current, ...change };
  for (const k of Object.keys(next) as (keyof BoardPrefs)[]) if (next[k] === undefined || next[k] === null) delete next[k];
  prefsCache = Promise.resolve(next);
  try {
    const saved = await tableApi().savePrefs(next);
    prefsCache = Promise.resolve(saved);
    return saved;
  } catch {
    return next;
  }
}

/** Tests only: forget the cached preference. */
export function resetBoardPrefsCache(): void {
  prefsCache = null;
}
