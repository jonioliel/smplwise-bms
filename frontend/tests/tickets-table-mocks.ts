import type { Page, Route } from '@playwright/test';
import { installTicketsMock, type TicketsMockOptions } from './tickets-mocks';

// CR-038 slice 6b: the mock layer of the board TABLE specs - the wire contract of routers/tickets_table.py (the table's page, bulk, the
// CSV export, saved views) and of the `tickets.board` preference, on top of slice 1's mock (tests/tickets-mocks.ts, which keeps
// answering everything else). Fake data only: no real person, phone, address or device.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string, details: Record<string, unknown> = {}) =>
  json(route, { code, user_message: msg, retryable: status === 429, correlation_id: 'mock', details }, status);

const NOW = Date.parse('2026-10-13T10:42:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
const DEPTS: Record<string, string> = { 'dept-maintenance': 'אחזקה', 'dept-cleaning': 'ניקיון', 'dept-hr': 'משאבי אנוש' };
const PRIO: Record<string, [string, number, string]> = { urgent: ['דחופה', 0, 'critical'], high: ['גבוהה', 1, 'alert'], normal: ['רגילה', 2, 'alert'], low: ['נמוכה', 3, 'info'] };
const PEOPLE: Record<string, string> = { 'u-avi': 'אבי כהן', 'u-yossi': 'יוסי מזרחי', 'u-dana': 'דנה פרץ', 'u-ronit': 'רונית לוי', 'u-noa': 'נועה שחר' };
const ORDER = ['new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned', 'closed', 'cancelled'];
const OPEN = ORDER.slice(0, 7);
const GROUPS: Record<string, string[]> = { open: OPEN, unassigned: ['new', 'returned'], handling: ['assigned', 'acknowledged', 'in_progress', 'waiting_part'], done: ['done'], closed: ['closed', 'cancelled'] };
const MOVES: Record<string, string[]> = {
  new: ['closed', 'cancelled'], assigned: ['acknowledged', 'in_progress', 'closed', 'cancelled'], acknowledged: ['in_progress', 'waiting_part', 'done', 'closed', 'cancelled'],
  in_progress: ['waiting_part', 'done', 'closed', 'cancelled'], waiting_part: ['in_progress', 'done', 'closed', 'cancelled'], done: ['in_progress', 'closed', 'cancelled'],
  returned: ['closed', 'cancelled'], closed: ['new'], cancelled: [],
};

export interface TRow {
  id: string; number: number; title: string; cat: string | null; dept: string; prio: string; status: string; assignee: string | null; place: string; device: string;
  created: number; activity: number; stuck?: string; sla?: number; revision: number;
}

/** The mock-up v2 board-table rows (fake), ids a01-a08 shared with slice 1's mock (the drawer opens them). */
export const TABLE_ROWS: TRow[] = [
  { id: '0000000000000a02', number: 1043, title: 'נזילה מהתקרה בשירותי קומה 2', cat: 'אינסטלציה', dept: 'dept-maintenance', prio: 'urgent', status: 'new', assignee: null, place: 'קומה 2 · שירותים', device: '', created: 3, activity: 1, stuck: 'unassigned', sla: -2.5, revision: 3 },
  { id: '0000000000000a03', number: 1044, title: 'שער החניון לא נסגר', cat: 'דלתות ומנעולים', dept: 'dept-maintenance', prio: 'urgent', status: 'assigned', assignee: 'u-yossi', place: 'חניון · תת-קרקע', device: 'שער חניון', created: 26, activity: 2, sla: 0.4, revision: 3 },
  { id: '0000000000000a04', number: 1045, title: 'ריח חריף במטבחון קומה 3', cat: 'ריח / מפגע', dept: 'dept-cleaning', prio: 'high', status: 'returned', assignee: null, place: 'קומה 3 · מטבחון', device: '', created: 4, activity: 3, revision: 3 },
  { id: '0000000000000a01', number: 1042, title: 'מזגן לא מקרר - חדר 102', cat: 'מיזוג', dept: 'dept-maintenance', prio: 'high', status: 'waiting_part', assignee: 'u-avi', place: 'קומה 1 · חדר 102', device: 'מזגן חדר 102', created: 53, activity: 4, stuck: 'waiting', sla: 20, revision: 3 },
  { id: '0000000000000a07', number: 1048, title: 'קליטת עובד חדש - תג כניסה וחניה', cat: 'קליטה', dept: 'dept-hr', prio: 'normal', status: 'acknowledged', assignee: 'u-ronit', place: 'קרקע · קבלה', device: '', created: 8, activity: 5, sla: 30, revision: 3 },
  { id: '0000000000000a06', number: 1047, title: 'ניקוי שטיח הלובי אחרי הגשם', cat: 'ניקיון שוטף', dept: 'dept-cleaning', prio: 'normal', status: 'in_progress', assignee: 'u-dana', place: 'קרקע · לובי', device: '', created: 7, activity: 6, sla: 46, revision: 3 },
  { id: '0000000000000a09', number: 1050, title: 'נורה מהבהבת בלובי', cat: 'חשמל ותאורה', dept: 'dept-maintenance', prio: 'normal', status: 'acknowledged', assignee: 'u-yossi', place: 'קרקע · לובי', device: 'גוף תאורה לובי 2', created: 30, activity: 7, sla: 70, revision: 3 },
  { id: '0000000000000a10', number: 1051, title: 'גנרטור: בדיקת הנעה חודשית לא בוצעה', cat: 'גנרטור ותשתית', dept: 'dept-maintenance', prio: 'normal', status: 'in_progress', assignee: 'u-yossi', place: 'חניון · חדר גנרטור', device: 'גנרטור ראשי', created: 75, activity: 8, stuck: 'stuck', sla: -6, revision: 3 },
  { id: '0000000000000a11', number: 1052, title: 'קליטת עובד חדש עבור תג כניסה וחניה', cat: 'ציוד ואישורים', dept: 'dept-hr', prio: 'high', status: 'acknowledged', assignee: 'u-noa', place: 'קרקע · קבלה', device: '', created: 49, activity: 9, sla: 3, revision: 3 },
  { id: '0000000000000a05', number: 1046, title: 'החלפת מסנן מזגן - חדר ישיבות', cat: 'מיזוג', dept: 'dept-maintenance', prio: 'low', status: 'done', assignee: 'u-avi', place: 'קומה 1 · חדר ישיבות', device: 'מזגן חדר ישיבות', created: 22, activity: 10, revision: 3 },
  { id: '0000000000000a12', number: 1053, title: '=HYPERLINK("http://example.invalid") שלט כניסה', cat: null, dept: 'dept-maintenance', prio: 'low', status: 'new', assignee: null, place: '', device: '', created: 120, activity: 11, revision: 3 },
  { id: '0000000000000a08', number: 1049, title: 'נורה מהבהבת בלובי - הוחלפה', cat: 'חשמל ותאורה', dept: 'dept-maintenance', prio: 'normal', status: 'closed', assignee: null, place: 'קרקע · לובי', device: '', created: 98, activity: 12, revision: 3 },
];

export interface TableMockOptions extends TicketsMockOptions {
  /** the user's stored `tickets.board` preference */
  board?: Record<string, unknown> | null;
  /** saved views already stored */
  views?: { id: string; name: string; view: Record<string, unknown> }[];
  /** how many rows (repeats the set with new ids and numbers) */
  many?: number;
  /** the export answers 413 / 429 */
  exportFail?: 'too_large' | 'rate';
  /** the table page answers 500 */
  failTable?: boolean;
  /** POST bulk answers these results by id (default: ok for a manager in maintenance, forbidden elsewhere) */
  bulkResults?: Record<string, string>;
}

export interface TableMock {
  calls: { method: string; path: string; body: unknown; search: string }[];
  prefs: () => Record<string, unknown> | null;
  rows: () => TRow[];
}

function rowOf(r: TRow, persona: string) {
  const manager = persona === 'manager' || persona === 'admin';
  const [pname, rank, sev] = PRIO[r.prio];
  const manages = manager && (persona === 'admin' || r.dept === 'dept-maintenance');
  return {
    id: r.id, number: r.number, title: r.title, status: r.status, origin: 'manual', department: { id: r.dept, key: r.dept.slice(5), name: DEPTS[r.dept], icon: null, color: null },
    category: r.cat ? { id: `cat-${r.number}`, name: r.cat } : null, priority: { id: `${r.dept}-${r.prio}`, key: r.prio, name: pname, rank, severity: sev },
    place_text: r.place, device_name: r.device, created_by: { id: 'u-ronit', name: 'רונית לוי' }, created_at: ago(r.created), last_activity_at: ago(r.activity),
    assignee: r.assignee ? { kind: 'user', id: r.assignee, name: PEOPLE[r.assignee], since: ago(r.created - 0.5), acknowledged_at: null } : null, last_assignee_name: null,
    eta_at: null, waiting_on: r.assignee ? 'assignee' : r.status === 'closed' ? 'none' : 'manager', waiting_reason: r.assignee ? null : 'unassigned', reopen_count: 0,
    external_stale: false, closed_at: r.status === 'closed' ? ago(r.activity) : null, revision: r.revision, view: 'full',
    stuck: r.stuck ? { kind: r.stuck, level: 1, since: ago(Math.max(0.5, r.activity - 1)), reminders: 1 } : null,
    sla: r.sla !== undefined && !['closed', 'cancelled'].includes(r.status) ? { kind: 'resolve', due_at: ago(-r.sla), overdue: r.sla < 0 } : null,
    transitions: manages ? (MOVES[r.status] ?? []).map((to) => ({ to, note_required: to === 'cancelled' || (to === 'closed' && r.status !== 'done') })) : [],
    can: { manage: manages, assign: manages && r.status !== 'cancelled', assign_external: false },
  };
}

function detailOf(r: TRow, persona: string) {
  const row = rowOf(r, persona);
  return { ...row, description: '', events: [], attachments: [], close_note: null, closed_by_name: null, duplicate_of: null, reopen_until: null,
    can: { edit_fields: [], assign: row.can.assign, assign_external: false, note: true, note_external: row.can.manage, attach: true, attach_external: row.can.manage, eta: false, return: false, manage: row.can.manage },
    assignments: [] };
}

function key(r: TRow, k: string): string | number {
  switch (k) {
    case 'number': return r.number;
    case 'title': return r.title;
    case 'department': return DEPTS[r.dept];
    case 'priority': return PRIO[r.prio][1];
    case 'status': return ORDER.indexOf(r.status);
    case 'assignee': return r.assignee ? PEOPLE[r.assignee] : '';
    case 'place': return r.place;
    case 'device': return r.device;
    case 'created': return -r.created;
    case 'activity': return -r.activity;
    case 'stuck': return r.stuck ? 1 : 0;
    case 'sla': return r.sla ?? 1e9;
    default: return 0;
  }
}

export async function installTableMock(page: Page, o: TableMockOptions = {}): Promise<TableMock> {
  await installTicketsMock(page, o);
  const persona = o.persona ?? 'manager';
  let rows: TRow[] = o.empty ? [] : TABLE_ROWS.map((r) => ({ ...r }));
  if (o.many && !o.empty) {
    const base = rows;
    rows = [];
    for (let i = 0; i < o.many; i++) {
      const r = base[i % base.length];
      rows.push({ ...r, id: i < base.length ? r.id : `0000000000${(0xb000 + i).toString(16).padStart(6, '0')}`, number: i < base.length ? r.number : 2000 + i, activity: r.activity + Math.floor(i / base.length) * 200 });
    }
  }
  let prefs: Record<string, unknown> | null = o.board ?? null;
  const views = (o.views ?? []).map((v) => ({ ...v, created_at: ago(5), updated_at: ago(5) }));
  const st: TableMock = { calls: [], prefs: () => prefs, rows: () => rows };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body: unknown = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    const log = () => st.calls.push({ method, path: p, body, search: url.search });
    if (p === 'me/prefs') {
      if (method === 'PUT') {
        log();
        const b = body as Record<string, unknown>;
        if ('tickets.board' in b) prefs = (b['tickets.board'] as Record<string, unknown> | null) ?? null;
      }
      return json(route, { prefs: { 'nav.order': [], 'tickets.board': prefs }, stored: prefs ? ['tickets.board'] : [], updated_at: null });
    }
    if (p === 'tickets/table') {
      log();
      if (o.failTable) return err(route, 500, 'internal', 'שגיאה');
      const s = url.searchParams;
      const status = s.get('status') ?? 'open';
      const statuses = status === 'all' ? null : GROUPS[status] ?? status.split(',');
      const depts = (s.get('department') ?? '').split(',').filter(Boolean);
      const prios = (s.get('priority') ?? '').split(',').filter(Boolean);
      const assignee = s.get('assignee') ?? '';
      const q = (s.get('q') ?? '').trim();
      const sort = (s.get('sort') ?? 'activity:desc').split(',').map((x) => x.split(':'));
      const limit = Number(s.get('limit') ?? 50);
      const offset = Number((s.get('cursor') ?? 'o0').slice(1)) || 0;
      const list = rows
        .filter((r) => !statuses || statuses.includes(r.status))
        .filter((r) => !depts.length || depts.includes(r.dept))
        .filter((r) => !prios.length || prios.includes(r.prio))
        .filter((r) => !assignee || (assignee === 'none' ? !r.assignee : assignee === 'me' ? r.assignee === 'u-ronit' : r.assignee === assignee.split(':')[1]))
        .filter((r) => s.get('waiting') !== 'manager' || (!r.assignee && !['closed', 'cancelled'].includes(r.status)))
        .filter((r) => !s.get('stuck') || !!r.stuck)
        .filter((r) => !q || r.title.includes(q) || String(r.number) === q.replace(/^#/, ''))
        .sort((a, b) => {
          for (const [k, d] of sort) {
            const x = key(a, k);
            const y = key(b, k);
            if (x !== y) return (x < y ? -1 : 1) * (d === 'desc' ? -1 : 1);
          }
          return a.id < b.id ? -1 : 1;
        });
      const pageRows = list.slice(offset, offset + limit);
      return json(route, { items: pageRows.map((r) => rowOf(r, persona)), next_cursor: offset + limit < list.length ? `o${offset + limit}` : null, sort: s.get('sort') ?? 'activity:desc', limit });
    }
    if (p === 'tickets/bulk' && method === 'POST') {
      log();
      const b = body as { action: string; items: { id: string; revision: number }[]; params: { note?: string; priority_key?: string; assignee?: { id: string } } };
      const results = b.items.map((it) => {
        const r = rows.find((x) => x.id === it.id);
        if (!r) return { id: it.id, result: 'not_found' };
        const forced = o.bulkResults?.[it.id];
        const result = forced ?? (persona !== 'admin' && r.dept !== 'dept-maintenance' ? 'forbidden' : r.revision !== it.revision ? 'stale' : 'ok');
        if (result === 'ok') {
          r.revision += 1;
          if (b.action === 'close') r.status = 'closed';
          if (b.action === 'priority' && b.params.priority_key) r.prio = b.params.priority_key;
          if (b.action === 'assign' && b.params.assignee) {
            r.assignee = b.params.assignee.id;
            r.status = 'assigned';
          }
        }
        return { id: it.id, number: r.number, result };
      });
      const counts: Record<string, number> = {};
      for (const r of results) counts[r.result] = (counts[r.result] ?? 0) + 1;
      return json(route, { action: b.action, total: results.length, done: counts.ok ?? 0, counts, results });
    }
    if (p === 'tickets/export.csv') {
      log();
      if (o.exportFail === 'too_large') return err(route, 413, 'export_too_large', 'יותר מדי שורות', { max_rows: 5000 });
      if (o.exportFail === 'rate') return err(route, 429, 'export_rate', 'פעם בדקה', { retry_after_s: 40 });
      const csv = '﻿"מס׳","כותרת"\r\n' + rows.slice(0, 3).map((r) => `"${r.number}","${r.title.replace(/"/g, '""').replace(/^=/, "'=")}"`).join('\r\n') + '\r\n';
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="tickets-20261013-1342.csv"', 'X-Export-Rows': '3' }, body: csv });
    }
    if (p === 'tickets/views') {
      log();
      if (method === 'POST') {
        const b = body as { name: string; view: Record<string, unknown> };
        if (views.some((v) => v.name === b.name)) return err(route, 409, 'view_name_taken', 'כבר יש');
        const v = { id: `v${views.length + 1}`, name: b.name, view: b.view, created_at: ago(0), updated_at: ago(0) };
        views.push(v);
        return json(route, v, 201);
      }
      return json(route, { items: views, max: 20 });
    }
    const vm = /^tickets\/views\/(\w+)$/.exec(p);
    if (vm) {
      log();
      const i = views.findIndex((v) => v.id === vm[1]);
      if (i < 0) return err(route, 404, 'view_not_found', 'לא נמצא');
      if (method === 'DELETE') {
        views.splice(i, 1);
        return json(route, { deleted: vm[1] });
      }
      Object.assign(views[i], body as object);
      return json(route, views[i]);
    }
    const tm = /^tickets\/([0-9a-f]{16})\/(status|assign)$/.exec(p);
    if (tm && method === 'POST') {
      log();
      const r = rows.find((x) => x.id === tm[1]);
      if (!r) return err(route, 404, 'ticket_not_found', 'לא נמצא');
      const b = body as { to?: string; revision: number; assignee?: { id: string } };
      if (b.revision !== r.revision) return err(route, 409, 'ticket_stale', 'השתנה', { revision: r.revision });
      r.revision += 1;
      if (tm[2] === 'status' && b.to) r.status = b.to;
      if (tm[2] === 'assign' && b.assignee) {
        r.assignee = b.assignee.id;
        r.status = 'assigned';
      }
      return json(route, detailOf(r, persona));
    }
    const gm = /^tickets\/([0-9a-f]{16})$/.exec(p);
    if (gm && method === 'GET' && !['0000000000000a01', '0000000000000a02', '0000000000000a03', '0000000000000a04', '0000000000000a05', '0000000000000a06', '0000000000000a07', '0000000000000a08'].includes(gm[1])) {
      const r = rows.find((x) => x.id === gm[1]);
      if (r) return json(route, detailOf(r, persona));
    }
    return route.fallback();
  });
  return st;
}
