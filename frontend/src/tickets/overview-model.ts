/**
 * MGRDASH phase 1: the pure logic of the manager overview (`#/tickets/overview`, docs/design/MANAGER_DASHBOARD_SPEC_HE.md). Phase 1 changes
 * nothing on the server's data side: every number here is counted from what the existing routes already answered for THIS viewer - the
 * manager board (the rows the viewer manages, the server's single visibility rule), the requests for quotation he may see, the handler
 * load route, the cost claims (tickets.costs.view only). Nothing here filters for security. No DOM, no Lit:
 * tests/unit-tickets-overview.spec.ts reads it directly.
 *
 * The owner decisions (2026-10-17) it carries: the settings in `tickets.settings.ui` (`dash_*`, defaults: each handler sees his own numbers,
 * vendors tagged in the same list, "busy" at 8 open per department, the comparison under the numbers row); "busy" is a count of open
 * requests in hand per department (a handler is busy when his open requests of ONE department reach that department's threshold); the
 * arrow against yesterday only when the number changed; reason chips filter the places; phone: the folded cards 5, 6 and 11.
 */
import type { BoardItem, StuckKind, TreeNode } from '../api/tickets-board';
import type { RfqDetail, RfqSummary } from '../api/tickets-rfq';
import type { TicketItem } from '../api/tickets';
import type { DailyRow, DashboardResponse, DashDepartment, DashPeriod, DashRfq, PayInstalment, PaymentsResponse } from '../api/tickets-dashboard';

// ---------------------------------------------------------------- the settings

export type HandlerNumbers = 'managers' | 'own' | 'everyone';
export type VendorMode = 'tagged' | 'separate' | 'hidden';
export type ComparePlace = 'top' | 'below_numbers' | 'bottom';

export interface OverviewSettings {
  handlerNumbers: HandlerNumbers;
  vendors: VendorMode;
  busy: number;
  busyByDept: Readonly<Record<string, number>>;
  compare: ComparePlace;
  /** phase 5: the local hour of the managers' morning summary (0-23, default 8) */
  digestHour: number;
  /** phase 5: the busy-department alert's threshold of stuck requests (1-999, default 10) */
  deptStuck: number;
}

export const OVERVIEW_DEFAULTS: OverviewSettings = { handlerNumbers: 'own', vendors: 'tagged', busy: 8, busyByDept: {}, compare: 'below_numbers', digestHour: 8, deptStuck: 10 };
export const HANDLER_NUMBERS: readonly HandlerNumbers[] = ['managers', 'own', 'everyone'];
export const VENDOR_MODES: readonly VendorMode[] = ['tagged', 'separate', 'hidden'];
export const COMPARE_PLACES: readonly ComparePlace[] = ['top', 'below_numbers', 'bottom'];

const isBusyN = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99;

/** The overview's settings from a `ui` block (GET /tickets/module, GET /tickets/board); a missing or bad value reads as its default. */
export function overviewSettingsOf(ui: Readonly<Record<string, unknown>> | null | undefined): OverviewSettings {
  const u = ui ?? {};
  const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
  const map: Record<string, number> = {};
  const raw = u.dash_busy_departments;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, n] of Object.entries(raw as Record<string, unknown>)) if (isBusyN(n)) map[k] = n;
  return {
    handlerNumbers: pick(u.dash_handler_numbers, HANDLER_NUMBERS, OVERVIEW_DEFAULTS.handlerNumbers),
    vendors: pick(u.dash_vendors, VENDOR_MODES, OVERVIEW_DEFAULTS.vendors),
    busy: isBusyN(u.dash_busy) ? u.dash_busy : OVERVIEW_DEFAULTS.busy,
    busyByDept: map,
    compare: pick(u.dash_compare, COMPARE_PLACES, OVERVIEW_DEFAULTS.compare),
    digestHour: isInt(u.dash_digest_hour, 0, 23) ? u.dash_digest_hour : OVERVIEW_DEFAULTS.digestHour,
    deptStuck: isInt(u.dash_dept_stuck, 1, 999) ? u.dash_dept_stuck : OVERVIEW_DEFAULTS.deptStuck,
  };
}

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** Phase 5: the busy-department threshold typed into its field - an integer 1-999, anything else (an empty field too) invalid. */
export function parseDeptStuckInput(text: string): number | undefined {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return undefined;
  const n = Number(t);
  return isInt(n, 1, 999) ? n : undefined;
}

/** The "busy" threshold of a department (its own value, else the installation default). */
export function busyThreshold(s: OverviewSettings, departmentId: string | null | undefined): number {
  return (departmentId && s.busyByDept[departmentId]) || s.busy;
}

/** A setting value typed into a field: an integer 1-99, '' = "use the default" (null), anything else invalid (undefined). */
export function parseBusyInput(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  if (!/^\d{1,2}$/.test(t)) return undefined;
  const n = Number(t);
  return isBusyN(n) ? n : undefined;
}

/** Whether a viewer gets a handler's own numbers on "שלי": a manager always; anyone else unless the setting says managers only. */
export function showsOwnNumbers(s: OverviewSettings, isManager: boolean): boolean {
  return isManager || s.handlerNumbers !== 'managers';
}

// ---------------------------------------------------------------- helpers

const FINAL = ['closed', 'cancelled'];
const ms = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN);
const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" of a local day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The local day before a "YYYY-MM-DD" key. */
export function prevDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const assigneeKeyOf = (t: Pick<TicketItem, 'assignee'>): string => (t.assignee ? `${t.assignee.kind === 'contact' ? 'contact' : 'user'}:${t.assignee.id}` : 'none');

/** Whether an assignee key is a vendor (a directory contact of the kind "vendor"). */
export const isVendorKey = (key: string, vendorIds: ReadonlySet<string>): boolean => key.startsWith('contact:') && vendorIds.has(key.slice(8));

// ---------------------------------------------------------------- card 2: where it is stuck

export const STUCK_REASONS: readonly StuckKind[] = ['unopened', 'ack', 'stuck', 'waiting', 'overdue', 'unassigned'];

/** The reason chips: how many stuck requests per reason (every reason present, 0 when none). */
export function stuckReasonCounts(items: readonly Pick<BoardItem, 'stuck'>[]): Record<StuckKind, number> {
  const out = Object.fromEntries(STUCK_REASONS.map((k) => [k, 0])) as Record<StuckKind, number>;
  for (const i of items) if (i.stuck && i.stuck.kind in out) out[i.stuck.kind] += 1;
  return out;
}

export interface PlaceRow {
  key: string;
  name: string;
  kind: TreeNode['kind'];
  /** the indentation (0 = the top shown level; at most 2) */
  level: number;
  /** the stuck requests here (of the chosen reason, or all) */
  count: number;
  /** the open requests here (the board's tree count) */
  open: number;
  why: Partial<Record<StuckKind, number>>;
}

/**
 * The places of the stuck requests (building › floor › area), the most first among siblings; a reason narrows both the rows and the
 * counts (the chip filters the list - owner decision). A single site / building above the floors is lifted (as the board's tree does);
 * "no place" comes last.
 */
export function stuckPlaces(items: readonly Pick<BoardItem, 'stuck' | 'place_keys'>[], tree: readonly TreeNode[], reason: StuckKind | '' = ''): PlaceRow[] {
  const stuck = items.filter((i) => i.stuck && (!reason || i.stuck.kind === reason));
  if (!stuck.length) return [];
  const count = new Map<string, number>();
  const why = new Map<string, Partial<Record<StuckKind, number>>>();
  for (const i of stuck) {
    for (const k of new Set(i.place_keys)) {
      count.set(k, (count.get(k) ?? 0) + 1);
      const w = why.get(k) ?? {};
      const kind = (i.stuck as { kind: StuckKind }).kind;
      w[kind] = (w[kind] ?? 0) + 1;
      why.set(k, w);
    }
  }
  const nodes = tree.filter((n) => count.has(n.key));
  const keys = new Set(nodes.map((n) => n.key));
  const children = new Map<string | null, TreeNode[]>();
  for (const n of nodes) {
    const p = n.parent && keys.has(n.parent) ? n.parent : null;
    children.set(p, [...(children.get(p) ?? []), n]);
  }
  let roots = (children.get(null) ?? []).filter((n) => n.kind !== 'none');
  const none = (children.get(null) ?? []).filter((n) => n.kind === 'none');
  while (roots.length === 1 && (roots[0].kind === 'site' || roots[0].kind === 'building') && (children.get(roots[0].key) ?? []).length) roots = children.get(roots[0].key) ?? [];
  const order = (a: TreeNode, b: TreeNode) => (count.get(b.key) ?? 0) - (count.get(a.key) ?? 0) || a.order - b.order;
  const out: PlaceRow[] = [];
  const walk = (list: TreeNode[], level: number) => {
    for (const n of [...list].sort(order)) {
      out.push({ key: n.key, name: n.name, kind: n.kind, level: Math.min(level, 2), count: count.get(n.key) ?? 0, open: n.count, why: why.get(n.key) ?? {} });
      walk(children.get(n.key) ?? [], level + 1);
    }
  };
  walk(roots, 0);
  for (const n of none) out.push({ key: n.key, name: n.name, kind: 'none', level: 0, count: count.get(n.key) ?? 0, open: n.count, why: why.get(n.key) ?? {} });
  // a stuck request whose place is not in the tree (an older server) still counts under "no place"
  const placed = new Set(out.map((r) => r.key));
  const orphan = stuck.filter((i) => !i.place_keys.some((k) => placed.has(k)));
  if (orphan.length && !none.length) {
    const w: Partial<Record<StuckKind, number>> = {};
    for (const i of orphan) { const k = (i.stuck as { kind: StuckKind }).kind; w[k] = (w[k] ?? 0) + 1; }
    out.push({ key: 'none', name: '', kind: 'none', level: 0, count: orphan.length, open: 0, why: w });
  }
  return out;
}

// ---------------------------------------------------------------- card 3: handler load

export const METER_SEGMENTS = 4;

export interface HandlerRow {
  key: string;
  name: string;
  kind: 'user' | 'contact';
  vendor: boolean;
  open: number;
  waiting: number;
  stuck: number;
  /** the oldest open request in hand (created_at) */
  oldestAt: string | null;
  busy: boolean;
  /** filled segments of the 4-segment meter, scaled to the threshold */
  meter: number;
  /** requests handled (marked done) in the period - absent when not available */
  handled?: number;
}

/**
 * One row per handler with requests in hand. "Busy": the open requests of ONE department reach that department's threshold (a person
 * who works in two departments is measured per department - spec section 4.3; what the viewer sees is already only what he manages).
 * Sorted: busy first, then the most open, then the name.
 */
export function handlerRows(items: readonly BoardItem[], vendorIds: ReadonlySet<string>, s: OverviewSettings, handled?: Readonly<Record<string, number>> | null): HandlerRow[] {
  const by = new Map<string, { row: HandlerRow; perDept: Map<string, number> }>();
  for (const it of items) {
    if (FINAL.includes(it.status) || !it.assignee) continue;
    const key = it.assignee_key && it.assignee_key !== 'none' ? it.assignee_key : assigneeKeyOf(it);
    if (key === 'none') continue;
    let e = by.get(key);
    if (!e) {
      e = { row: { key, name: it.assignee.name, kind: it.assignee.kind === 'contact' ? 'contact' : 'user', vendor: isVendorKey(key, vendorIds), open: 0, waiting: 0, stuck: 0, oldestAt: null, busy: false, meter: 0 }, perDept: new Map() };
      by.set(key, e);
    }
    const r = e.row;
    r.open += 1;
    if (it.waiting_on === 'assignee') r.waiting += 1;
    if (it.stuck) r.stuck += 1;
    if (!r.oldestAt || ms(it.created_at) < ms(r.oldestAt)) r.oldestAt = it.created_at;
    const d = it.department?.id ?? '';
    e.perDept.set(d, (e.perDept.get(d) ?? 0) + 1);
  }
  const rows: HandlerRow[] = [];
  for (const { row, perDept } of by.values()) {
    let worst = 0;
    for (const [d, n] of perDept) {
      const thr = busyThreshold(s, d);
      if (n >= thr) row.busy = true;
      worst = Math.max(worst, n / thr);
    }
    row.meter = Math.min(METER_SEGMENTS, Math.ceil(worst * METER_SEGMENTS));
    if (handled) row.handled = handled[row.key] ?? 0;
    rows.push(row);
  }
  return rows.sort((a, b) => Number(b.busy) - Number(a.busy) || b.open - a.open || a.name.localeCompare(b.name));
}

/** The vendor setting applied: `tagged` one list (the vendor rows carry the tag), `separate` two lists, `hidden` no vendors. */
export function splitVendors(rows: readonly HandlerRow[], mode: VendorMode): { staff: HandlerRow[]; vendors: HandlerRow[] } {
  if (mode === 'tagged') return { staff: [...rows], vendors: [] };
  const staff = rows.filter((r) => !r.vendor);
  return { staff, vendors: mode === 'separate' ? rows.filter((r) => r.vendor) : [] };
}

// ---------------------------------------------------------------- card 4: who waits for whom

export type LaneId = 'me' | 'staff' | 'vendors';
export interface Lane {
  id: LaneId;
  count: number;
  /** since when the oldest one waits (its last activity) */
  oldestAt: string | null;
  /** the two most common reasons: a waiting reason (lane "me") or a stuck kind / '' (the handler lanes) */
  reasons: { key: string; n: number }[];
}

/** The ball's lanes: waiting for the manager / for an employee handler / for a vendor ("for the requester" has no state yet - not drawn). */
export function lanes(items: readonly BoardItem[], vendorIds: ReadonlySet<string>): Lane[] {
  const acc: Record<LaneId, { count: number; oldestAt: string | null; reasons: Map<string, number> }> = {
    me: { count: 0, oldestAt: null, reasons: new Map() },
    staff: { count: 0, oldestAt: null, reasons: new Map() },
    vendors: { count: 0, oldestAt: null, reasons: new Map() },
  };
  for (const it of items) {
    if (FINAL.includes(it.status)) continue;
    let id: LaneId | null = null;
    let reason = '';
    if (it.waiting_on === 'manager') {
      id = 'me';
      reason = it.waiting_reason ?? '';
    } else if (it.waiting_on === 'assignee') {
      const key = it.assignee_key || assigneeKeyOf(it);
      id = isVendorKey(key, vendorIds) ? 'vendors' : 'staff';
      reason = it.stuck?.kind ?? '';
    }
    if (!id) continue;
    const a = acc[id];
    a.count += 1;
    if (!a.oldestAt || ms(it.last_activity_at) < ms(a.oldestAt)) a.oldestAt = it.last_activity_at;
    if (reason) a.reasons.set(reason, (a.reasons.get(reason) ?? 0) + 1);
  }
  return (['me', 'staff', 'vendors'] as LaneId[]).map((id) => ({
    id, count: acc[id].count, oldestAt: acc[id].oldestAt,
    reasons: [...acc[id].reasons].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)).slice(0, 2),
  }));
}

// ---------------------------------------------------------------- card 9: overdue

export type OverdueKind = 'sla' | 'eta' | 'rfq' | 'pay';
export interface OverdueRow {
  kind: OverdueKind;
  id: string;
  /** "#1043" / "RFQ-08" */
  ref: string;
  title: string;
  /** the date that passed */
  since: string;
  /** how long ago (ms) */
  late: number;
  /** who holds it ('' = nobody) */
  who: string;
  tone: 'bad' | 'warn';
  /** a request for quotation (else a service request) */
  rfq: boolean;
}

const DAY = 86_400_000;
const LIVE_RFQ = ['sent', 'collecting', 'due_passed'];

/**
 * Everything past its date, worst first: a crossed time target (red after a day), an arrival time that passed with no update since, a
 * request for quotation whose deadline passed without a decision. A request appears once (its time target wins over its arrival).
 * Payment dates are not here in phase 1: the payment schedule keeps no "paid" mark per instalment, so a passed date is not "late".
 */
export function overdueRows(items: readonly BoardItem[], rfqs: readonly RfqSummary[], now: Date): OverdueRow[] {
  const t = now.getTime();
  const out: OverdueRow[] = [];
  for (const it of items) {
    if (FINAL.includes(it.status)) continue;
    const who = it.assignee?.name ?? '';
    const sla = it.sla_cell;
    if (sla?.over && !Number.isNaN(ms(sla.at)) && ms(sla.at) <= t) {
      const late = t - ms(sla.at);
      out.push({ kind: 'sla', id: it.id, ref: `#${it.number}`, title: it.title, since: sla.at, late, who, tone: late >= DAY ? 'bad' : 'warn', rfq: false });
      continue;
    }
    const eta = ms(it.eta_at);
    if (it.status !== 'done' && !Number.isNaN(eta) && eta < t && !(ms(it.last_activity_at) > eta)) {
      out.push({ kind: 'eta', id: it.id, ref: `#${it.number}`, title: it.title, since: it.eta_at as string, late: t - eta, who, tone: 'warn', rfq: false });
    }
  }
  for (const r of rfqs) {
    const due = ms(r.due_at);
    if (r.state !== 'due_passed' && !(LIVE_RFQ.includes(r.state) && !Number.isNaN(due) && due < t)) continue;
    if (Number.isNaN(due)) continue;
    out.push({ kind: 'rfq', id: r.id, ref: r.ref, title: r.title, since: r.due_at as string, late: t - due, who: r.internal_owner?.name ?? '', tone: 'warn', rfq: true });
  }
  return out.sort((a, b) => Number(b.tone === 'bad') - Number(a.tone === 'bad') || b.late - a.late);
}

export const OVERDUE_SHOWN = 6;

// ---------------------------------------------------------------- card 10: the next two weeks

export type AgendaKind = 'visit_vendor' | 'visit_staff' | 'work_start' | 'rfq_due' | 'payment';
export interface AgendaEntry {
  kind: AgendaKind;
  /** the instant (a timed entry) or local midnight of its day (a date-only entry) */
  at: number;
  timed: boolean;
  /** the request it opens */
  id: string;
  rfq: boolean;
  /** "#1042" / "RFQ-07" */
  ref: string;
  /** the vendor / the handler */
  who: string;
  title: string;
  place: string;
}
export interface AgendaDay { key: string; offset: number; entries: AgendaEntry[] }

/** One date of an approved payment schedule (an instalment due on a date; the ones due on / after completion have no date yet). */
export interface PaymentDate { rfqId: string; ref: string; title: string; vendor: string; date: string }

/** The payment dates of the approved awards of the requests whose detail was read (CR-RFQ-PAYMENT-SCHEDULE; null terms = switch off). */
export function paymentDates(details: readonly RfqDetail[]): PaymentDate[] {
  const out: PaymentDate[] = [];
  for (const d of details) {
    for (const a of d.awards ?? []) {
      if (a.state !== 'approved' || !a.terms?.schedule?.items) continue;
      const v = d.vendors?.find((x) => x.id === a.vendor_id);
      const vendor = v ? v.contact.company || v.contact.name : '';
      for (const it of a.terms.schedule.items) if (it.due === 'date' && it.date && /^\d{4}-\d{2}-\d{2}/.test(it.date)) out.push({ rfqId: d.id, ref: d.ref, title: d.title, vendor, date: it.date.slice(0, 10) });
    }
  }
  return out;
}

/** The start of work of an awarded request: the work order's date, else the confirmed arrival, else the request's own window. */
export function workStart(r: RfqSummary, detail: RfqDetail | undefined): string | null {
  const a = detail?.awards?.find((x) => x.state === 'approved');
  return a?.order?.work_from ?? a?.terms?.arrival?.planned_from ?? r.work_from ?? null;
}

const localDay = (date: string): number => {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

/**
 * The next `days` days, by local day (today first): arrivals of a handler (timed, from now on), the start of work of an awarded request,
 * the deadline of a request still collecting, and the payment dates of approved schedules (date only). Empty days are left out.
 */
export function agenda(items: readonly BoardItem[], rfqs: readonly RfqSummary[], details: ReadonlyMap<string, RfqDetail>, payments: readonly PaymentDate[],
  vendorIds: ReadonlySet<string>, now: Date, days = 14): AgendaDay[] {
  const t = now.getTime();
  const from = startOfDay(now).getTime();
  const until = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)).getTime();
  const out: AgendaEntry[] = [];
  for (const it of items) {
    const eta = ms(it.eta_at);
    if (FINAL.includes(it.status) || it.status === 'done' || !it.assignee || Number.isNaN(eta) || eta < t || eta >= until) continue;
    const key = it.assignee_key || assigneeKeyOf(it);
    out.push({ kind: isVendorKey(key, vendorIds) ? 'visit_vendor' : 'visit_staff', at: eta, timed: true, id: it.id, rfq: false, ref: `#${it.number}`, who: it.assignee.name, title: it.title, place: it.place_text || it.device_name || '' });
  }
  for (const r of rfqs) {
    if ((r.state === 'sent' || r.state === 'collecting') && r.due_at) {
      const due = ms(r.due_at);
      if (!Number.isNaN(due) && due >= t && due < until) out.push({ kind: 'rfq_due', at: due, timed: true, id: r.id, rfq: true, ref: r.ref, who: '', title: r.title, place: r.place_text ?? '' });
    }
    if (r.state === 'awarded' || r.state === 'ordered') {
      const ws = workStart(r, details.get(r.id));
      const at = ms(ws);
      if (!Number.isNaN(at) && at >= from && at < until) {
        const d = details.get(r.id);
        const a = d?.awards?.find((x) => x.state === 'approved');
        const v = a ? d?.vendors?.find((x) => x.id === a.vendor_id) : undefined;
        out.push({ kind: 'work_start', at, timed: at >= t, id: r.id, rfq: true, ref: r.ref, who: v ? v.contact.company || v.contact.name : '', title: r.title, place: r.place_text ?? '' });
      }
    }
  }
  for (const p of payments) {
    const at = localDay(p.date);
    if (at >= from && at < until) out.push({ kind: 'payment', at, timed: false, id: p.rfqId, rfq: true, ref: p.ref, who: p.vendor, title: p.title, place: '' });
  }
  out.sort((a, b) => a.at - b.at || Number(b.timed) - Number(a.timed) || a.ref.localeCompare(b.ref));
  const byDay = new Map<string, AgendaDay>();
  for (const e of out) {
    const d = new Date(e.at);
    const key = dayKey(d);
    let day = byDay.get(key);
    if (!day) {
      day = { key, offset: Math.round((startOfDay(d).getTime() - from) / DAY), entries: [] };
      byDay.set(key, day);
    }
    day.entries.push(e);
  }
  return [...byDay.values()];
}

// ---------------------------------------------------------------- card 1: the numbers and the arrow against yesterday

export interface Kpis { open: number; stuck: number; waiting: number; overdue: number; approval: number | null }
export type KpiKey = keyof Kpis;
export interface KpiStore { cur?: { day: string; k: Kpis }; prev?: { day: string; k: Kpis } }

/**
 * Yesterday's numbers for the arrows, kept in the viewer's browser per view (a department or all): the last numbers of each day. Pure:
 * the stored value and today's numbers in, the next value to store and yesterday's numbers (null = none known) out.
 */
export function rollKpis(stored: KpiStore | null | undefined, today: Kpis, day: string): { store: KpiStore; yesterday: Kpis | null } {
  const y = prevDayKey(day);
  const s = stored ?? {};
  if (s.cur?.day === day) return { store: { cur: { day, k: today }, ...(s.prev ? { prev: s.prev } : {}) }, yesterday: s.prev?.day === y ? s.prev.k : null };
  if (s.cur?.day === y) return { store: { cur: { day, k: today }, prev: s.cur }, yesterday: s.cur.k };
  return { store: { cur: { day, k: today } }, yesterday: null };
}

/** The change since yesterday per number - only where it changed (owner decision: the arrow only on a change). */
export function kpiDeltas(today: Kpis, yesterday: Kpis | null): Partial<Record<KpiKey, number>> {
  const out: Partial<Record<KpiKey, number>> = {};
  if (!yesterday) return out;
  for (const k of Object.keys(today) as KpiKey[]) {
    const a = today[k];
    const b = yesterday[k];
    if (typeof a === 'number' && typeof b === 'number' && a !== b) out[k] = a - b;
  }
  return out;
}

export function parseKpiStore(raw: string | null): KpiStore | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as KpiStore;
    const ok = (x: unknown): boolean => !!x && typeof x === 'object' && typeof (x as { day?: unknown }).day === 'string' && !!(x as { k?: unknown }).k;
    return v && typeof v === 'object' ? { ...(ok(v.cur) ? { cur: v.cur } : {}), ...(ok(v.prev) ? { prev: v.prev } : {}) } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- card 11 (phase 1): the department comparison

export interface DeptRow { id: string; name: string; open: number; stuck: number; overdue: number; waiting: number; busy: number }

/** One row per department of the board, worst first (stuck + overdue, then open). Counted from the board's rows only. */
export function deptComparison(items: readonly BoardItem[], departments: readonly { id: string; name: string }[], vendorIds: ReadonlySet<string>, s: OverviewSettings, now: Date): DeptRow[] {
  const late = new Set(overdueRows(items, [], now).map((r) => r.id));
  const rows = departments.map((d) => {
    const mine = items.filter((i) => i.department?.id === d.id && !FINAL.includes(i.status));
    return {
      id: d.id, name: d.name, open: mine.length, stuck: mine.filter((i) => i.stuck).length, overdue: mine.filter((i) => late.has(i.id)).length,
      waiting: mine.filter((i) => i.waiting_on === 'manager').length, busy: handlerRows(mine, vendorIds, s).filter((h) => h.busy).length,
    };
  });
  return rows.sort((a, b) => b.stuck + b.overdue - (a.stuck + a.overdue) || b.open - a.open || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- phase 3: the cards of the summary route (GET /tickets/dashboard)

/** The summary's period of a handled-days choice (the handler cards and "כמה טופל" share the viewer's remembered period). */
export const periodOfDays = (d: 1 | 7 | 30): DashPeriod => (d === 1 ? 'today' : d === 30 ? '30d' : '7d');
export const daysOfPeriod = (p: DashPeriod): 1 | 7 | 30 => (p === 'today' ? 1 : p === '30d' ? 30 : 7);

/** Card 7: everything waiting for the viewer's decision (quotes on requests, payment demands, second approvals) - counts, never amounts. */
export function approvalsTotal(a: DashboardResponse['approvals'] | null | undefined): number | null {
  return a ? a.quotes.count + a.claims.count + a.second.count : null;
}

/** Card 8: the state of an open request in words - which text, its tone and its numbers (the server decided the stage). */
export type RfqStageText = 'rq_second' | 'rq_due' | 'rq_decide' | 'rq_received' | 'rq_collecting';
export function rfqStageOf(r: Pick<DashRfq, 'stage' | 'state' | 'quoted' | 'invited'>): { text: RfqStageText; tone: 'warn' | 'info' | '' } {
  if (r.stage === 'second') return { text: 'rq_second', tone: 'info' };
  if (r.stage === 'decide') return r.state === 'due_passed' ? { text: 'rq_due', tone: 'warn' } : { text: 'rq_decide', tone: 'warn' };
  return r.quoted > 0 ? { text: 'rq_received', tone: 'info' } : { text: 'rq_collecting', tone: '' };
}

/** Card 6: the totals of the 14 days and the bar scale (the highest day, at least 1). */
export function dailyTotals(days: readonly DailyRow[]): { opened: number; closed: number; net: number; max: number } {
  const opened = days.reduce((s, d) => s + d.opened, 0);
  const closed = days.reduce((s, d) => s + d.closed, 0);
  return { opened, closed, net: opened - closed, max: Math.max(1, ...days.map((d) => Math.max(d.opened, d.closed))) };
}

/** "17.10" of a "YYYY-MM-DD" day (no year: the card covers two weeks). */
export function shortDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return m && d ? `${d}.${m}` : date;
}

/** The net change with its sign ("+6", "-2", "0"). */
export const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Card 11 from the summary route: worst first (stuck + overdue, then open), as the phase-1 comparison sorts. */
export function sortDepartments(rows: readonly DashDepartment[]): DashDepartment[] {
  return [...rows].sort((a, b) => b.stuck + b.overdue - (a.stuck + a.overdue) || b.open - a.open || a.name.localeCompare(b.name));
}

/** Card 7 rows: up to `n` per group unless all are asked for (the server sends at most 50 per group, the count is always complete). */
export const APPROVALS_SHOWN = 5;

// ---------------------------------------------------------------- phase 4: the payments board (GET /tickets/dashboard/payments)

/** The payments card's number: everything waiting for the viewer's payment decision (counts only). */
export function paymentsTotal(p: PaymentsResponse | null | undefined): number {
  return p ? p.overdue.count + p.upcoming.count + p.claims.count : 0;
}

/** Card 9 rows of the instalments past their day (the server decided which; the late time counts from the end of the due day). */
export function paymentOverdueRows(items: readonly PayInstalment[], now: Date): OverdueRow[] {
  const t = now.getTime();
  return items.map((x) => {
    const since = localDay(x.due_date) + DAY;
    return { kind: 'pay' as const, id: x.rfq.id, ref: x.rfq.ref, title: x.rfq.title, since: x.due_date, late: Math.max(0, t - since), who: x.vendor ?? '',
      tone: x.days <= -2 ? 'bad' as const : 'warn' as const, rfq: true };
  });
}

/** Card 10's payment dates from the server (every approved schedule the viewer may pay, no detail cap) - replaces the phase-1 reading of
 * the awarded requests' details when the payments answer is there. */
export function serverPaymentDates(items: readonly PayInstalment[]): PaymentDate[] {
  return items.map((x) => ({ rfqId: x.rfq.id, ref: x.rfq.ref, title: x.rfq.title, vendor: x.vendor ?? '', date: x.due_date }));
}

/** When an instalment is due, in words: late by n days / today / tomorrow / in n days. */
export type PayWhen = { key: 'pyLateDays' | 'pyLateDay' | 'pyDueToday' | 'pyDueTomorrow' | 'pyDueIn'; n: number };
export function payWhen(days: number): PayWhen {
  if (days < -1) return { key: 'pyLateDays', n: -days };
  if (days === -1) return { key: 'pyLateDay', n: 1 };
  if (days === 0) return { key: 'pyDueToday', n: 0 };
  if (days === 1) return { key: 'pyDueTomorrow', n: 1 };
  return { key: 'pyDueIn', n: days };
}

// ---------------------------------------------------------------- folding

export type CardKey = 'departments' | 'stuck' | 'waits' | 'load' | 'overdue' | 'upcoming' | 'throughput' | 'daily' | 'approvals' | 'rfqs' | 'payments';
/** Spec 8 / owner decision: on a phone the cards 5, 6 and 11 start folded (5 and 6 arrive in phase 3). */
export const PHONE_FOLDED: readonly CardKey[] = ['throughput', 'daily', 'departments'];
export const FOLD_STORAGE_KEY = 'sw.tickets.overview.folded';

/** The folded cards: the viewer's own choice when he made one, else the phone default (nothing folded on a larger screen). */
export function foldedOf(stored: string | null, phone: boolean): Set<CardKey> {
  if (stored !== null) {
    try {
      const v = JSON.parse(stored);
      if (Array.isArray(v)) return new Set(v.filter((x): x is CardKey => typeof x === 'string'));
    } catch {
      /* a broken value reads as "never chose" */
    }
  }
  return new Set(phone ? PHONE_FOLDED : []);
}

// ---------------------------------------------------------------- pages (OVERVIEWFIT-297)

/** The widget pages on a desktop: two rows a page. */
export const PAGE_ROWS = 2;

/**
 * OVERVIEWFIT-297 (owner rule: a control screen never scrolls on a desktop; owner option א): the widgets keep their order and are cut into
 * pages of `rows` rows of a `cols`-column grid, the way the grid itself places them (a widget that does not fit in what is left of a row
 * starts the next row; a span wider than the grid takes the whole row). Returns the widget indexes of each page; never an empty page.
 */
export function packPages(spans: readonly number[], cols: number, rows = PAGE_ROWS): number[][] {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  const pages: number[][] = [];
  let page: number[] = [];
  let row = 0;
  let left = c;
  spans.forEach((raw, i) => {
    const s = Math.min(c, Math.max(1, Math.floor(raw) || 1));
    if (s > left) {
      row += 1;
      left = c;
    }
    if (row >= r) {
      pages.push(page);
      page = [];
      row = 0;
      left = c;
    }
    page.push(i);
    left -= s;
  });
  if (page.length) pages.push(page);
  return pages;
}

/**
 * The span each widget takes on its page so that no row ends in an empty cell (taste review: a page never shows a hole): the last widget of
 * a row that is not full widens to the row's end. Same placement rules as packPages; the result is indexed like `spans`.
 */
export function filledSpans(spans: readonly number[], cols: number): number[] {
  const c = Math.max(1, Math.floor(cols));
  const out = spans.map((raw) => Math.min(c, Math.max(1, Math.floor(raw) || 1)));
  let rowStart = 0;
  let left = c;
  const close = (end: number) => {
    if (end > rowStart && left > 0) out[end - 1] += left;
  };
  out.forEach((s, i) => {
    if (s > left) {
      close(i);
      rowStart = i;
      left = c;
    }
    left -= s;
  });
  close(out.length);
  return out;
}

// ---------------------------------------------------------------- the handler's own numbers ("שלי")

export interface OwnNumbers { open: number; waiting: number; overdue: number; visitsToday: number }

/** A handler's own numbers from the requests of "שלי" assigned to him (the list's rows; a creator's own requests do not count). */
export function ownNumbers(items: readonly TicketItem[], uid: string, now: Date): OwnNumbers {
  const t = now.getTime();
  const today = dayKey(now);
  const mine = items.filter((i) => !FINAL.includes(i.status) && i.status !== 'done' && i.assignee?.kind === 'user' && i.assignee.id === uid);
  return {
    open: mine.length,
    waiting: mine.filter((i) => i.waiting_on === 'assignee').length,
    overdue: mine.filter((i) => { const d = ms(i.sla?.resolve_due_at); return !Number.isNaN(d) && d < t; }).length,
    visitsToday: mine.filter((i) => { const e = ms(i.eta_at); return !Number.isNaN(e) && e >= t && dayKey(new Date(e)) === today; }).length,
  };
}
