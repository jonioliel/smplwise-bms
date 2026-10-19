/**
 * MGRDASH phase 3: the client of the manager overview's summary route GET /tickets/dashboard (routers/tickets_board.py, definitions in
 * services/tickets/dashboard.py, docs/design/MANAGER_DASHBOARD_SPEC_HE.md section 7). A module of its own beside api/tickets-board.ts.
 * The server's single visibility rule decides every number; amounts arrive only for tickets.costs.view where the item lies. Nothing here
 * filters for security. Without a backend the demo store answers from the slice-1 demo list (the closed requests by their closing day).
 */
import { get } from './client';
import { isApi } from './session';
import { boardApi } from './tickets-board';

export type DashPeriod = 'today' | '7d' | '30d';
export const DASH_PERIODS: readonly DashPeriod[] = ['today', '7d', '30d'];

export interface ThroughputRow {
  /** `user:<id>` / `contact:<id>` - the board's assignee key */
  key: string;
  kind: 'user' | 'contact';
  name: string;
  /** marked done in the period (the HANDLERLOAD definition, the same number as the handler cards) */
  done: number;
  /** closed in the period while this handler held the request */
  closed: number;
  /** finished work that came back (sent back to handling, or a reopen) */
  returned: number;
  /** the median time from assignment to done, seconds; null when none */
  median_seconds: number | null;
}

export interface DailyRow { date: string; opened: number; closed: number }

interface ApprovalBase { id: string; department_id: string; vendor: string; since: string | null; amount_minor: number | null; currency: string | null }
export interface TicketApproval extends ApprovalBase { ticket: { id: string; number: number; title: string } }
export interface SecondApproval extends ApprovalBase { rfq: { id: string; number: number; ref: string; title: string } }
export interface ApprovalGroup<T> { count: number; items: T[] }

export type RfqStage = 'second' | 'decide' | 'questions' | 'collecting';
export interface DashRfq {
  id: string;
  number: number;
  ref: string;
  title: string;
  department: { id: string; name: string } | null;
  state: string;
  stage: RfqStage;
  due_at: string | null;
  work_from: string | null;
  invited: number;
  quoted: number;
  declined: number;
  questions: number;
}

export interface DashDepartment { id: string; name: string; open: number; stuck: number; overdue: number; waiting: number; done_7d: number; busy_handlers: number }

export interface DashboardResponse {
  period: DashPeriod;
  days: 1 | 7 | 30;
  since: string;
  now: string;
  department_id: string | null;
  throughput: { rows: ThroughputRow[]; total: { done: number; closed: number; returned: number; median_seconds: number | null } };
  daily: { days: DailyRow[]; net: number; since: string };
  approvals: { quotes: ApprovalGroup<TicketApproval>; claims: ApprovalGroup<TicketApproval>; second: ApprovalGroup<SecondApproval> };
  rfqs: { count: number; decide: number; questions: number; items: DashRfq[] };
  departments: DashDepartment[] | null;
  all_departments: boolean;
  truncated: boolean;
  generated_at?: string;
}

export interface DashboardQuery { department_id?: string; period?: DashPeriod }

export interface DashboardBackend {
  summary(q: DashboardQuery): Promise<DashboardResponse>;
}

const rest: DashboardBackend = {
  summary: (q) => {
    const p = new URLSearchParams();
    if (q.department_id) p.set('department_id', q.department_id);
    if (q.period) p.set('period', q.period);
    const s = p.toString();
    return get<DashboardResponse>(`tickets/dashboard${s ? `?${s}` : ''}`);
  },
};

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const demo: DashboardBackend = {
  async summary(q) {
    const period = q.period ?? '7d';
    const days = period === 'today' ? 1 : period === '30d' ? 30 : 7;
    const now = new Date();
    const b = await boardApi().board({ department_id: q.department_id, state: 'closed' });
    const open = await boardApi().board({ department_id: q.department_id });
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime();
    const rows = new Map<string, ThroughputRow>();
    for (const x of b.items) {
      if (!x.assignee || !x.closed_at || Date.parse(x.closed_at) < start) continue;
      const r = rows.get(x.assignee_key) ?? { key: x.assignee_key, kind: x.assignee.kind === 'contact' ? 'contact' : 'user', name: x.assignee.name, done: 0, closed: 0, returned: 0, median_seconds: null };
      r.done += 1;
      r.closed += 1;
      rows.set(x.assignee_key, r);
    }
    const list = [...rows.values()].sort((a, c) => c.done - a.done || a.name.localeCompare(c.name));
    const first = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
    const daily: DailyRow[] = Array.from({ length: 14 }, (_, i) => ({ date: localKey(new Date(first.getTime() + i * DAY + 12 * 3_600_000)), opened: 0, closed: 0 }));
    const at = new Map(daily.map((d) => [d.date, d]));
    for (const x of [...open.items, ...b.items]) {
      const o = at.get(localKey(new Date(x.created_at)));
      if (o) o.opened += 1;
      const c = x.closed_at ? at.get(localKey(new Date(x.closed_at))) : undefined;
      if (c) c.closed += 1;
    }
    const sum = (k: 'done' | 'closed' | 'returned') => list.reduce((s, r) => s + r[k], 0);
    return {
      period, days, since: new Date(start).toISOString(), now: now.toISOString(), department_id: q.department_id ?? null,
      throughput: { rows: list, total: { done: sum('done'), closed: sum('closed'), returned: sum('returned'), median_seconds: null } },
      daily: { days: daily, net: daily.reduce((s, d) => s + d.opened - d.closed, 0), since: first.toISOString() },
      approvals: { quotes: { count: 0, items: [] }, claims: { count: 0, items: [] }, second: { count: 0, items: [] } },
      rfqs: { count: 0, decide: 0, questions: 0, items: [] },
      departments: null, all_departments: false, truncated: false,
    };
  },
};

export function dashboardApi(): DashboardBackend {
  return isApi() ? rest : demo;
}
