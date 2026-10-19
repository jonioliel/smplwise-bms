/**
 * CR-038 slice 6b (D24, section 13.6): the pure logic of the board TABLE - columns, sort (click / Shift+click, aria-sort), the
 * request parameters, saved views and the per-user preference, selection (Shift ranges, the page), keyboard moves, and the age /
 * SLA / stuck texts. No DOM, no Lit: tests/unit-tickets-table.spec.ts reads it directly. The server re-validates everything (the same
 * whitelists in services/tickets/table.py); nothing here is a security rule.
 */
import type { BoardPrefs, BulkAnswer, BulkResult, ColumnKey, Density, SortDir, SortKey, TableFilters, TableRow, ViewDoc } from '../api/tickets-table';
import { tbt, type TableTextKey } from './table-text';
import { ct } from './cost-text';

export const COLUMN_KEYS: readonly ColumnKey[] = ['number', 'title', 'department', 'priority', 'status', 'assignee', 'place', 'device', 'created', 'activity', 'stuck', 'sla'];
export const DEFAULT_COLUMNS: readonly ColumnKey[] = ['number', 'title', 'department', 'priority', 'status', 'assignee', 'place', 'activity'];
/** always shown, never hidden by the chooser */
export const REQUIRED_COLUMNS: readonly ColumnKey[] = ['number', 'title'];
export const DEFAULT_SORT: readonly SortKey[] = [{ key: 'activity', dir: 'desc' }];
export const MAX_SORT_KEYS = 2;
export const LIMITS: readonly number[] = [25, 50, 100, 200];
export const DEFAULT_LIMIT = 50;
export const PRIORITY_KEYS = ['urgent', 'high', 'normal', 'low'] as const;
/** CR-038 slice 9 (11A.9): the cost columns - offered (chooser, sort, filter) only to holders of tickets.costs.view at the installation;
 * the host turns them on with setCostColumns (the server answers 403 to a cost sort / filter otherwise). */
export const COST_COLUMN_KEYS: readonly ColumnKey[] = ['cost', 'cost_status'];
let COST_COLUMNS = false;
export function setCostColumns(on: boolean): void {
  COST_COLUMNS = on;
}
export function costColumnsOn(): boolean {
  return COST_COLUMNS;
}
/** The columns this user may see: the slice-6b set, plus the cost columns when turned on. */
export function knownColumns(): readonly ColumnKey[] {
  return COST_COLUMNS ? [...COLUMN_KEYS, ...COST_COLUMN_KEYS] : COLUMN_KEYS;
}
/** columns whose first click sorts newest / most urgent first */
const DESC_FIRST: ReadonlySet<ColumnKey> = new Set(['created', 'activity', 'stuck', 'cost']);

export const NO_TABLE_FILTERS: Pick<TableFilters, 'priority' | 'assignee' | 'stuck' | 'waiting' | 'created_from' | 'created_to' | 'cost_status'> = {
  priority: [], assignee: '', stuck: '', waiting: '', created_from: '', created_to: '', cost_status: [],
};
export type ExtraFilters = typeof NO_TABLE_FILTERS;

export function columnLabel(c: ColumnKey): string {
  if (c === 'cost') return ct('sCost');
  if (c === 'cost_status') return ct('colCostStatus');
  return tbt(`col_${c}` as TableTextKey);
}

// ---------------------------------------------------------------- columns

/** Known columns in the given order, without repeats; the required ones first when missing; the default set when empty. */
export function normalizeColumns(raw: unknown): ColumnKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_COLUMNS];
  const seen: ColumnKey[] = [];
  for (const c of raw) if ((knownColumns() as readonly unknown[]).includes(c) && !seen.includes(c as ColumnKey)) seen.push(c as ColumnKey);
  if (!seen.length) return [...DEFAULT_COLUMNS];
  return [...REQUIRED_COLUMNS.filter((c) => !seen.includes(c)), ...seen];
}

/** Show / hide one column (a required one stays); a shown column is appended at the end. */
export function toggleColumn(cols: readonly ColumnKey[], c: ColumnKey): ColumnKey[] {
  if (REQUIRED_COLUMNS.includes(c)) return [...cols];
  return cols.includes(c) ? cols.filter((x) => x !== c) : [...cols, c];
}

/** Move a shown column one place (delta -1 = earlier, +1 = later); the edges stay. */
export function moveColumn(cols: readonly ColumnKey[], c: ColumnKey, delta: -1 | 1): ColumnKey[] {
  const out = [...cols];
  const i = out.indexOf(c);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** The chooser's list: the shown columns in their order, then the hidden ones in the default order. */
export function chooserOrder(cols: readonly ColumnKey[]): { key: ColumnKey; shown: boolean; required: boolean }[] {
  return [...cols, ...knownColumns().filter((c) => !cols.includes(c))].map((key) => ({ key, shown: cols.includes(key), required: REQUIRED_COLUMNS.includes(key) }));
}

// ---------------------------------------------------------------- sort

export function parseSort(text: unknown): SortKey[] {
  if (typeof text !== 'string' || !text) return [...DEFAULT_SORT];
  const out: SortKey[] = [];
  for (const part of text.split(',')) {
    const [key, dir = 'asc'] = part.trim().split(':');
    if (!(knownColumns() as readonly string[]).includes(key) || (dir !== 'asc' && dir !== 'desc') || out.some((k) => k.key === key)) return [...DEFAULT_SORT];
    out.push({ key: key as ColumnKey, dir });
  }
  return out.length && out.length <= MAX_SORT_KEYS ? out : [...DEFAULT_SORT];
}

export function sortText(keys: readonly SortKey[]): string {
  return keys.map((k) => `${k.key}:${k.dir}`).join(',');
}

/** A header click: the primary key flips, another column becomes the only key (newest first for times). Shift+click (`add`): the
 * column is flipped where it is, or added as the second key (replacing a previous second one). */
export function toggleSort(keys: readonly SortKey[], key: ColumnKey, add = false): SortKey[] {
  const first: SortDir = DESC_FIRST.has(key) ? 'desc' : 'asc';
  const flip = (d: SortDir): SortDir => (d === 'asc' ? 'desc' : 'asc');
  const at = keys.findIndex((k) => k.key === key);
  if (add) {
    if (at >= 0) return keys.map((k, i) => (i === at ? { key, dir: flip(k.dir) } : k));
    return [...keys.slice(0, MAX_SORT_KEYS - 1), { key, dir: first }];
  }
  if (at === 0) return [{ key, dir: flip(keys[0].dir) }];
  return [{ key, dir: first }];
}

/** `aria-sort` of a header: the primary key only (a grid announces one); the second key shows its arrow without it. */
export function ariaSort(keys: readonly SortKey[], key: ColumnKey): 'ascending' | 'descending' | 'none' {
  if (keys[0]?.key !== key) return 'none';
  return keys[0].dir === 'asc' ? 'ascending' : 'descending';
}

/** The arrow and the order number of a sorted header (`1`, `2` when two keys), or null. */
export function sortMark(keys: readonly SortKey[], key: ColumnKey): { dir: SortDir; order: number } | null {
  const i = keys.findIndex((k) => k.key === key);
  return i < 0 ? null : { dir: keys[i].dir, order: i + 1 };
}

// ---------------------------------------------------------------- the request

/** The base filters come from the area's address (scope, state, department, text); the table adds its own. */
export interface BaseFilters { scope: TableFilters['scope']; status: string; department: string; q: string }

export function tableFilters(base: BaseFilters, extra: ExtraFilters): TableFilters {
  return {
    scope: base.scope, status: base.status || 'open', department: base.department ? [base.department] : [], priority: [...extra.priority], assignee: extra.assignee,
    floor: '', area: '', stuck: extra.stuck, waiting: extra.waiting, created_from: extra.created_from, created_to: extra.created_to, q: base.q.trim(),
    cost_status: COST_COLUMNS ? [...extra.cost_status] : [],
  };
}

/** The query parameters of GET tickets/table and tickets/export.csv (empty values left out). */
export function queryParams(f: TableFilters, sort: readonly SortKey[], extra: { limit?: number; cursor?: string | null; columns?: readonly ColumnKey[]; lang?: string } = {}): Record<string, string> {
  const p: Record<string, string> = {
    scope: f.scope, status: f.status, department: f.department.join(','), priority: f.priority.join(','), assignee: f.assignee, floor: f.floor, area: f.area,
    stuck: f.stuck, waiting: f.waiting, created_from: f.created_from, created_to: f.created_to, q: f.q, sort: sortText(sort), cost_status: (f.cost_status ?? []).join(','),
  };
  if (extra.limit) p.limit = String(extra.limit);
  if (extra.cursor) p.cursor = extra.cursor;
  if (extra.columns) p.columns = extra.columns.join(',');
  if (extra.lang) p.lang = extra.lang;
  for (const k of Object.keys(p)) if (p[k] === '') delete p[k];
  return p;
}

export const MONTHLY_MAX_DAYS = 366;
export type MonthlyGroup = 'department' | 'vendor';

/** The monthly-counts report (GET tickets/reports/monthly.csv): both days are required, from <= to, at most MONTHLY_MAX_DAYS days. '' = fine. */
export function monthlyRangeError(from: string, to: string): '' | 'required' | 'order' | 'tooLong' {
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  if (!ok.test(from) || !ok.test(to)) return 'required';
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 'required';
  if (a > b) return 'order';
  return (b - a) / 86_400_000 + 1 > MONTHLY_MAX_DAYS ? 'tooLong' : '';
}

export function monthlyParams(from: string, to: string, group: MonthlyGroup, lang?: string): Record<string, string> {
  const p: Record<string, string> = { from, to, group };
  if (lang) p.lang = lang;
  return p;
}

export function activeExtraCount(e: ExtraFilters): number {
  return (e.priority.length ? 1 : 0) + (e.cost_status.length ? 1 : 0) + (e.assignee ? 1 : 0) + (e.stuck ? 1 : 0) + (e.waiting ? 1 : 0) + (e.created_from || e.created_to ? 1 : 0);
}

// ---------------------------------------------------------------- saved views and the preference

export interface TableLayout { columns: ColumnKey[]; sort: SortKey[]; density: Density; limit: number }

export function layoutFromPrefs(p: BoardPrefs | null | undefined): TableLayout {
  const limit = p?.limit && LIMITS.includes(p.limit) ? p.limit : DEFAULT_LIMIT;
  return { columns: normalizeColumns(p?.columns), sort: parseSort(p?.sort), density: p?.density === 'compact' ? 'compact' : 'comfortable', limit };
}

/** A saved view's document of the table as it is now. */
export function viewDoc(base: BaseFilters, extra: ExtraFilters, layout: TableLayout): ViewDoc {
  const f = tableFilters(base, extra);
  const filters: ViewDoc['filters'] = { scope: f.scope, status: f.status };
  if (f.department.length) filters.department = f.department;
  if (f.priority.length) filters.priority = f.priority;
  for (const k of ['assignee', 'stuck', 'waiting', 'created_from', 'created_to', 'q'] as const) if (f[k]) filters[k] = f[k];
  return { view: 'table', filters, sort: sortText(layout.sort), columns: [...layout.columns], density: layout.density };
}

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' && v ? v.split(',') : []);
const asText = (v: unknown): string => (typeof v === 'string' ? v : '');

/** What applying a saved view changes: the base filters (the host writes them to the address), the table's own ones and the layout. */
export function applyView(doc: ViewDoc, current: TableLayout): { base: Omit<BaseFilters, 'scope'>; extra: ExtraFilters; layout: TableLayout } {
  const f = doc.filters ?? {};
  const waiting = asText(f.waiting) === 'manager' ? 'manager' : '';
  return {
    base: { status: asText(f.status) || 'open', department: asList(f.department)[0] ?? '', q: asText(f.q) },
    extra: {
      priority: asList(f.priority).filter((p) => (PRIORITY_KEYS as readonly string[]).includes(p)), assignee: asText(f.assignee), stuck: asText(f.stuck), waiting,
      created_from: asText(f.created_from), created_to: asText(f.created_to), cost_status: [],
    },
    layout: { ...current, columns: normalizeColumns(doc.columns), sort: parseSort(doc.sort), density: doc.density === 'compact' ? 'compact' : 'comfortable' },
  };
}

// ---------------------------------------------------------------- selection and keyboard

/** Shift+click: every row between the anchor and the target (inclusive) joins the selection (rows the caller may not manage too -
 * the server answers `forbidden` for them, item by item). */
export function rangeSelect(ids: readonly string[], selected: ReadonlySet<string>, anchor: string | null, target: string): Set<string> {
  const out = new Set(selected);
  const a = anchor ? ids.indexOf(anchor) : -1;
  const b = ids.indexOf(target);
  if (b < 0) return out;
  if (a < 0) {
    out.add(target);
    return out;
  }
  const [lo, hi] = a < b ? [a, b] : [b, a];
  for (let i = lo; i <= hi; i++) out.add(ids[i]);
  return out;
}

export function toggleOne(selected: ReadonlySet<string>, id: string): Set<string> {
  const out = new Set(selected);
  if (out.has(id)) out.delete(id);
  else out.add(id);
  return out;
}

/** The header checkbox: all of the page selected -> none; otherwise the whole page. */
export function togglePage(ids: readonly string[], selected: ReadonlySet<string>): Set<string> {
  return ids.length && ids.every((id) => selected.has(id)) ? new Set() : new Set(ids);
}

export function pageState(ids: readonly string[], selected: ReadonlySet<string>): 'none' | 'some' | 'all' {
  const n = ids.filter((id) => selected.has(id)).length;
  return n === 0 ? 'none' : n === ids.length ? 'all' : 'some';
}

/** The focused row after a key (↑ ↓ Home End PageUp PageDown; vertical - the same in RTL); null for another key. */
export function nextIndex(i: number, key: string, count: number): number | null {
  if (!count) return null;
  const clamp = (n: number) => Math.max(0, Math.min(count - 1, n));
  switch (key) {
    case 'ArrowDown': return clamp(i < 0 ? 0 : i + 1);
    case 'ArrowUp': return clamp(i < 0 ? 0 : i - 1);
    case 'Home': return 0;
    case 'End': return count - 1;
    case 'PageDown': return clamp(i + 10);
    case 'PageUp': return clamp(i - 10);
    default: return null;
  }
}

// ---------------------------------------------------------------- texts of the cells

/** A duration as the table writes it: "40 דק׳" / "3 ש׳" / "יום" / "4 ימים". */
export function spanText(ms: number): string {
  const min = Math.floor(Math.abs(ms) / 60_000);
  if (min < 1) return tbt('t_now');
  if (min < 60) return tbt('t_min', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return tbt('t_hours', { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? tbt('t_day') : tbt('t_days', { n: d });
}

/** The age column: how long the ticket has been open (from `created_at`; to `closed_at` once closed). */
export function ageText(row: Pick<TableRow, 'created_at' | 'closed_at'>, now: Date = new Date()): string {
  const from = Date.parse(row.created_at);
  if (Number.isNaN(from)) return '';
  const to = row.closed_at ? Date.parse(row.closed_at) : now.getTime();
  return spanText((Number.isNaN(to) ? now.getTime() : to) - from);
}

/** The SLA column: "בעוד 3 ש׳" or "חריגה 2 ימים" (the nearest due); '' without one. */
export function slaText(sla: TableRow['sla'], now: Date = new Date()): { text: string; tone: '' | 'warn' | 'bad' } {
  if (!sla) return { text: '', tone: '' };
  const due = Date.parse(sla.due_at);
  if (Number.isNaN(due)) return { text: '', tone: '' };
  const left = due - now.getTime();
  if (left <= 0 || sla.overdue) return { text: tbt('sla_over', { t: spanText(left) }), tone: 'bad' };
  return { text: tbt('sla_in', { t: spanText(left) }), tone: left < 3_600_000 ? 'warn' : '' };
}

export function stuckText(stuck: TableRow['stuck'], now: Date = new Date()): string {
  if (!stuck) return '';
  const kind = tbt(`stuck_${stuck.kind}` as TableTextKey);
  if (!stuck.since) return kind;
  const at = Date.parse(stuck.since);
  return Number.isNaN(at) ? kind : tbt('stuckSince', { kind, t: spanText(now.getTime() - at) });
}

/** "בוצע ב־12 מתוך 14" and the other results with their counts ("2 השתנו בינתיים · 1 אין הרשאה"). */
export function bulkSummary(a: BulkAnswer): { head: string; rest: string; tone: 'ok' | 'bad' } {
  const head = tbt('bulkDone', { done: a.done, total: a.total });
  const rest = (Object.entries(a.counts) as [BulkResult, number][]).filter(([r]) => r !== 'ok').map(([r, n]) => `${n} ${tbt(`r_${r}` as TableTextKey)}`).join(' · ');
  return { head, rest, tone: a.done === a.total ? 'ok' : 'bad' };
}

/** The ids a bulk answer leaves selected: what did not succeed (the user may retry them), as long as they are still on the page. */
export function keepAfterBulk(a: BulkAnswer, ids: readonly string[]): Set<string> {
  return new Set(a.results.filter((r) => r.result !== 'ok' && r.result !== 'unchanged' && ids.includes(r.id)).map((r) => r.id));
}
