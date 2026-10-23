import type { Page, Route } from '@playwright/test';
import { installGeneratorMock } from './generator-mocks';

// CR-MAINT215 slice 2: the mock layer of the maintenance specs - the wire contract of routers/maintenance.py (slice 1 + 2), fake data only.
// The generator mock layer serves the session (/me, settings); the maintenance routes are layered on top (the last route registered wins).
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg = 'mock') => json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details: {} }, status);

export type Role = 'mgr' | 'op' | 'view';
export const ROLE_PERMS: Record<Role, string[]> = {
  mgr: ['maintenance.view', 'maintenance.perform', 'maintenance.manage', 'system.configure', 'tickets.view', 'tickets.create'],
  op: ['maintenance.view', 'maintenance.perform', 'tickets.view', 'tickets.create'],
  view: ['tickets.view'],
};

export interface MaintMockOptions {
  role?: Role;
  /** the maintenance module switch (default on) */
  enabled?: boolean;
  /** the tickets module switch (default on) */
  tickets?: boolean;
  /** no tasks / tags at all */
  empty?: boolean;
  /** the task list answers 500 */
  failList?: boolean;
  /** the installation's default of the phone round (default 'step') */
  roundView?: 'step' | 'list';
  /** reminders enabled in Settings (default false: the log page says so) */
  remindersOn?: boolean;
  /** no lines in the reminder log */
  emptyLog?: boolean;
  /** the closed request belongs to a plan (the close question is shown); default true */
  closeAsks?: boolean;
}
export interface MaintMock {
  calls: { method: string; path: string; body: unknown }[];
}

const S = { kind: 'site', id: 's1', name: 'אתר ראשי' };
const B = { kind: 'building', id: 'b1', name: 'מבנה א' };
const F = (id: string, name: string) => ({ kind: 'floor', id, name });
const ROOF = F('f-roof', 'גג');
const GROUND = F('f-ground', 'קומת קרקע');
const BASE = F('f-base', 'מרתף');

function task(id: string, kind: string, title: string, extra: Record<string, unknown> = {}) {
  const place = (extra.place as { kind: string } | null | undefined) ?? (kind === 'vendor_document' ? null : B);
  const path = place === null ? [] : place === B ? [S, B] : [S, B, place];
  return {
    id, kind, title, category: 'other', place, place_path: path, checklist_count: 0, entity_id: null, elevator_id: null, generator_id: null, vendor_id: null, doc_type: null,
    owner_user_id: null, interval: { unit: 'year', count: 1 }, anchor_date: '2027-02-14', due_date: '2027-02-14', lead_days: 30, state: 'ok', days_left: 120, active: true, auto_ticket: false,
    department_id: null, ticket_id: null, last_done_at: null, revision: 3, ...extra,
  };
}

export function fixtureTasks() {
  return [
    task('c1', 'certificate', 'בדיקת מעלית שנתית - מעלית צפונית', { state: 'due_soon', days_left: 30, vendor_id: 'v-insp', vendor_name: 'בודק מוסמך בע״מ', elevator_name: 'מעלית צפונית', owner_name: 'דני כהן' }),
    task('c2', 'certificate', 'בדיקת גנרטור בעומס', { place: ROOF, interval: { unit: 'month', count: 6 }, due_date: '2027-05-03', generator_name: 'גנרטור ראשי', vendor_id: 'v-power', vendor_name: 'כוח חירום' }),
    task('c3', 'certificate', 'מטפים - כל הקומות', { due_date: '2027-09-20', vendor_name: 'אש-טק' }),
    task('c4', 'certificate', 'בדיקת ספרינקלרים', { active: false, state: 'none', days_left: null, due_date: null, interval: null }),
    task('d1', 'vendor_document', 'ביטוח צד ג׳ - חשמל השרון', { state: 'overdue', days_left: -5, due_date: '2027-01-10', vendor_id: 'v-elec', vendor_name: 'חשמל השרון', doc_type: 'insurance', interval: null }),
    task('d2', 'vendor_document', 'רישיון חשמלאי - קלין-טק', { state: 'due_soon', days_left: 17, due_date: '2027-02-01', vendor_id: 'v-clean', vendor_name: 'קלין-טק', doc_type: 'electrician_license', interval: null }),
    task('p1', 'preventive', 'ניקוי מנדף המטבח', { place: GROUND, state: 'overdue', days_left: -3, due_date: '2027-01-12', interval: { unit: 'month', count: 3 }, checklist_count: 4, auto_ticket: true, department_id: 'dept-maint', ticket_id: 't-1042', vendor_name: 'קלין-טק', lead_days: 7 }),
    task('p2', 'preventive', 'ניקוי מסנני מזגנים', { place: ROOF, state: 'due_soon', days_left: 5, due_date: '2027-01-27', interval: { unit: 'month', count: 1 }, auto_ticket: true, department_id: 'dept-maint', vendor_name: 'קור-אייר', lead_days: 7 }),
    task('p3', 'preventive', 'בדיקת משאבות ביוב', { place: BASE, interval: { unit: 'week', count: 1 }, due_date: '2027-01-20', checklist_count: 3, lead_days: 7 }),
    task('r1', 'round', 'סבב בוקר - חדר משאבות', { place: BASE, interval: { unit: 'day', count: 1 }, due_date: '2027-01-18', checklist_count: 3, lead_days: 0, state: 'due_soon', days_left: 0,
      open_run: { id: 'run-1', started_by_name: 'דני כהן', started_at: '2027-01-18T05:42:00Z', answered: 1, total: 3 }, last_run: { id: 'run-0', performed_on: '2027-01-17', finished_at: '2027-01-17T06:30:00Z', result: 'issues', issues: 2 } }),
    task('r2', 'round', 'סבב שבועי - גג ומזגנים', { place: ROOF, interval: { unit: 'week', count: 1 }, due_date: '2027-01-16', checklist_count: 2, lead_days: 0, state: 'overdue', days_left: -2, open_run: null,
      last_run: { id: 'run-9', performed_on: '2027-01-09', finished_at: '2027-01-09T07:00:00Z', result: 'issues', issues: 1 } }),
  ];
}

const CHECKLIST = [{ key: 'pump', label: 'המשאבה פועלת בלי רעש חריג?', kind: 'check', required: true }, { key: 'pressure', label: 'לחץ במערכת (בר)', kind: 'number', required: true, min: 2, max: 6 },
  { key: 'remark', label: 'הערות לסבב', kind: 'text', required: false }];

const VENDORS = [
  { id: 'v-elec', name: 'חשמל השרון', state: 'expired', expired: [{ doc_type: 'insurance', valid_until: '2027-01-10' }], expiring: [] },
  { id: 'v-air', name: 'קור-אייר', state: 'ok', expired: [], expiring: [] },
  { id: 'v-clean', name: 'קלין-טק', state: 'expiring', expired: [], expiring: [{ doc_type: 'electrician_license', valid_until: '2027-02-01' }] },
];

export async function installMaintenanceMock(page: Page, o: MaintMockOptions = {}): Promise<MaintMock> {
  const role = o.role ?? 'mgr';
  const perms = ROLE_PERMS[role];
  const ticketsOn = o.tickets !== false;
  const enabled = o.enabled !== false;
  await installGeneratorMock(page, { perms, count: 0, modules: ticketsOn ? { tickets: true } : undefined });
  const st: MaintMock = { calls: [] };
  let tasks = o.empty ? [] : fixtureTasks();
  type MockTag = { id: string; token: string; path: string; target_kind: string; target_id: string; label: string; medium: string; created_at: string; revoked_at: string | null; last_scan_at: string | null; target_name: string; target_task_kind: string | null };
  let tags: MockTag[] = o.empty ? [] : [
    { id: 'g1', token: 'TokRoundPumps000000001', path: '#/m/TokRoundPumps000000001', target_kind: 'task', target_id: 'r1', label: 'חדר משאבות', medium: 'qr', created_at: '2027-01-02T08:00:00Z', revoked_at: null, last_scan_at: '2027-01-18T05:42:00Z', target_name: 'סבב בוקר - חדר משאבות', target_task_kind: 'round' },
    { id: 'g2', token: 'TokRoofAc3000000000002', path: '#/m/TokRoofAc3000000000002', target_kind: 'entity', target_id: 'climate.roof_ac_3', label: 'מזגן גג 3', medium: 'nfc', created_at: '2027-01-02T08:00:00Z', revoked_at: null, last_scan_at: null, target_name: 'מזגן גג 3', target_task_kind: null },
  ];
  let run = { id: 'run-1', task_id: 'r1', kind: 'run', status: 'open', started_by_name: 'דני כהן', started_at: '2027-01-18T05:42:00Z', finished_at: null, performed_on: null, due_before: '2027-01-18', due_after: null,
    valid_until: null, note: '', result: null as string | null, checklist: CHECKLIST, answers: { pump: { ok: true, value: null, note: '', at: '2027-01-18T05:43:00Z' } } as Record<string, Record<string, unknown>>, ticket_ids: [] as string[], revision: 2,
    task: { id: 'r1', title: 'סבב בוקר - חדר משאבות', entity_id: null, department_id: 'dept-maint' }, can: { write: role !== 'view', open_request: ticketsOn },
    request_departments: ticketsOn ? [{ id: 'dept-maint', name: 'אחזקה' }] : [] };
  type MockFile = { id: string; name: string; kind: string; bytes: number; uploaded_at: string; uploaded_by_name: string };
  const files: Record<string, MockFile[]> = { c1: [{ id: 'f1', name: 'תסקיר-מעלית-2026.pdf', kind: 'pdf', bytes: 182_000, uploaded_at: '2026-02-16T08:05:00Z', uploaded_by_name: 'דני כהן' }] };
  const detail = (t: Record<string, unknown>) => ({
    ...t, files: files[String(t.id)] ?? [], file_count: (files[String(t.id)] ?? []).length, notes: '', checklist: t.kind === 'round' ? CHECKLIST : [], ticket_error: null, open_run_id: (t.open_run as { id: string } | null | undefined)?.id ?? null,
    can: { edit: role === 'mgr', complete: t.kind === 'certificate' || t.kind === 'vendor_document' ? role === 'mgr' : t.kind === 'preventive' && role !== 'view', start_round: t.kind === 'round' && role !== 'view' && !!t.active, open_request: ticketsOn },
  });
  await page.route('**/api/v1/maintenance/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\/maintenance\//, '');
    const method = req.method();
    const body: unknown = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    st.calls.push({ method, path: p + url.search, body });
    const can = { view: enabled && perms.includes('maintenance.view'), perform: enabled && perms.includes('maintenance.perform'), manage: enabled && perms.includes('maintenance.manage'), open_request: enabled && ticketsOn };
    if (p === 'module') return json(route, { enabled, can, tickets_on: ticketsOn, round_view: o.roundView ?? 'step' });
    if (!enabled) return err(route, 404, 'feature_disabled');
    if (!can.view) return err(route, 403, 'forbidden');
    if (p === 'tasks' && method === 'GET') {
      if (o.failList) return err(route, 500, 'internal', 'שגיאה');
      const kind = url.searchParams.get('kind');
      const items = tasks.filter((t) => !kind || t.kind === kind);
      return json(route, { items, counts: { overdue: 0, due_soon: 0, ok: 0, none: 0 }, truncated: false, today: '2027-01-15' });
    }
    if (p === 'tasks' && method === 'POST') {
      const b = body as Record<string, unknown>;
      const t = task(`n${tasks.length + 1}`, String(b.kind), String(b.title), { place: null });
      tasks = [...tasks, t];
      return json(route, detail(t), 201);
    }
    let m = /^tasks\/([^/]+)$/.exec(p);
    if (m) {
      const t = tasks.find((x) => x.id === m![1]);
      if (!t) return err(route, 404, 'maint_task_not_found');
      if (method === 'PATCH') {
        const next = { ...t, ...(body as Record<string, unknown>), revision: (t.revision as number) + 1 };
        tasks = tasks.map((x) => (x.id === t.id ? next : x));
        return json(route, detail(next));
      }
      if (method === 'DELETE') {
        tasks = tasks.filter((x) => x.id !== t.id);
        return json(route, { id: t.id, deleted: true, tags_revoked: 0 });
      }
      return json(route, detail(t));
    }
    m = /^tasks\/([^/]+)\/records$/.exec(p);
    if (m) {
      return json(route, { items: [
        { id: 'rec2', task_id: m[1], kind: 'completion', status: 'done', started_by_name: 'דני כהן', started_at: '2026-02-16T08:00:00Z', finished_at: '2026-02-16T08:00:00Z', performed_on: '2026-02-16', due_before: '2026-02-14', due_after: '2027-02-14', valid_until: '2027-02-14', note: '', result: 'ok', checklist: [], answers: {}, ticket_ids: [], revision: 1 },
        { id: 'rec1', task_id: m[1], kind: 'completion', status: 'done', started_by_name: 'דני כהן', started_at: '2025-02-10T08:00:00Z', finished_at: '2025-02-10T08:00:00Z', performed_on: '2025-02-10', due_before: '2025-02-14', due_after: '2026-02-14', valid_until: '2026-02-14', note: '', result: 'ok', checklist: [], answers: {}, ticket_ids: [], revision: 1 },
      ] });
    }
    m = /^tasks\/([^/]+)\/complete$/.exec(p);
    if (m) {
      const t = tasks.find((x) => x.id === m![1])!;
      const next = { ...t, state: 'ok', days_left: 365, due_date: (body as { valid_until?: string }).valid_until ?? '2027-04-12', revision: (t.revision as number) + 1 };
      tasks = tasks.map((x) => (x.id === t.id ? next : x));
      return json(route, { record: { id: 'rec-new' }, task: detail(next) });
    }
    m = /^tasks\/([^/]+)\/runs$/.exec(p);
    if (m) return m[1] === 'r1' ? json(route, { ...run }, 201) : json(route, { ...run, id: `run-${m[1]}`, task: { ...run.task, id: m[1] }, answers: {} }, 201);
    m = /^runs\/([^/]+)(?:\/(answers|finish|cancel))?$/.exec(p);
    if (m) {
      if (m[2] === 'answers') {
        const a = (body as { answers: Record<string, Record<string, unknown>> }).answers;
        for (const [k, v] of Object.entries(a)) {
          const item = CHECKLIST.find((i) => i.key === k)!;
          const ok = item.kind === 'number' ? !(Number(v.value) < (item.min ?? -Infinity) || Number(v.value) > (item.max ?? Infinity)) && v.ok !== false : v.ok ?? true;
          run.answers[k] = { ...v, ok, at: '2027-01-18T05:50:00Z' };
        }
        run = { ...run, revision: run.revision + 1 };
      } else if (m[2] === 'finish') run = { ...run, status: 'done', result: 'issues' };
      else if (m[2] === 'cancel') run = { ...run, status: 'cancelled' };
      return json(route, { ...run, id: m[1] });
    }
    m = /^runs\/([^/]+)\/items\/([^/]+)\/request$/.exec(p);
    if (m) {
      if (!ticketsOn) return err(route, 404, 'feature_disabled');
      run.answers[m[2]] = { ...(run.answers[m[2]] ?? {}), ticket_id: 't-1043' };
      run.ticket_ids = [...run.ticket_ids, 't-1043'];
      return json(route, { ticket_id: 't-1043', number: 1043, run }, 201);
    }
    m = /^tasks\/([^/]+)\/files(?:\/([^/]+))?$/.exec(p);
    if (m) {
      const list = files[m[1]] ?? [];
      if (method === 'POST') {
        if (!can.manage) return err(route, 403, 'forbidden');
        if (list.length >= 3) return err(route, 409, 'too_many_files', 'הגעתם למספר הקבצים המרבי למשימה.');
        const f = { id: `f${list.length + 10}`, name: 'scan.pdf', kind: 'pdf', bytes: 52_000, uploaded_at: '2027-01-15T10:00:00Z', uploaded_by_name: 'דני כהן' };
        files[m[1]] = [...list, f];
        return json(route, f, 201);
      }
      if (method === 'DELETE') {
        files[m[1]] = list.filter((x) => x.id !== m![2]);
        return json(route, { id: m[2], deleted: true });
      }
      return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'content-disposition': 'attachment; filename="x.pdf"' }, body: '%PDF-1.4\n%%EOF\n' });
    }
    if (p === 'reminder-log' || p.startsWith('reminder-log?')) {
      const ev = url.searchParams.get('event');
      const rows = o.emptyLog ? [] : [
        { id: 'l1', task_id: 'p1', title: 'ניקוי מנדף המטבח', task_kind: 'preventive', event: 'overdue', due_date: '2027-01-12', detail: '', at: '2027-01-13T06:00:00Z' },
        { id: 'l2', task_id: 'p1', title: 'ניקוי מנדף המטבח', task_kind: 'preventive', event: 'request', due_date: '2027-01-12', detail: 't-1042', at: '2027-01-05T06:00:00Z' },
        { id: 'l3', task_id: 'c1', title: 'בדיקת מעלית שנתית - מעלית צפונית', task_kind: 'certificate', event: 'due_soon', due_date: '2027-02-14', detail: '', at: '2027-01-15T06:00:00Z' },
        { id: 'l4', task_id: 'p2', title: 'ניקוי מסנני מזגנים', task_kind: 'preventive', event: 'request_failed', due_date: '2027-01-27', detail: 'tickets_off', at: '2027-01-14T06:00:00Z' },
      ].filter((r) => !ev || r.event === ev);
      return json(route, { items: rows, reminders_enabled: o.remindersOn === true, keep_days: 365 });
    }
    m = /^close-proposal\/([^/]+)(\/confirm)?$/.exec(p);
    if (m) {
      if (m[2]) return json(route, { record_id: 'rec-close' });
      return json(route, { proposal: o.closeAsks === false ? null : { task_id: 'p1', title: 'ניקוי מנדף המטבח', kind: 'preventive', due_date: '2027-01-12', next_due: '2027-04-12' } });
    }
    m = /^by-subject\/([^/]+)\/([^/]+)$/.exec(p);
    if (m) {
      const items = m[1] === 'elevator' && m[2] === 'e1' ? tasks.filter((t) => t.id === 'c1') : [];
      return json(route, { kind: m[1], id: m[2], state: items.length ? 'due_soon' : 'none', items });
    }
    if (p === 'vendors') return json(route, { items: VENDORS });
    m = /^vendors\/([^/]+)\/documents$/.exec(p);
    if (m) {
      const docs = tasks.filter((t) => t.kind === 'vendor_document' && t.vendor_id === m![1]);
      return json(route, { vendor_id: m[1], name: VENDORS.find((v) => v.id === m![1])?.name ?? 'ספק', state: VENDORS.find((v) => v.id === m![1])?.state ?? 'none', documents: docs, tasks: [] });
    }
    if (p === 'options') {
      if (!can.manage) return err(route, 403, 'forbidden');
      return json(route, { places: [{ kind: 'building', id: 'b1', name: 'מבנה א', parent_id: 's1' }, { kind: 'floor', id: 'f-roof', name: 'גג', parent_id: 'b1' }], placeless: true, vendors: VENDORS,
        elevators: [{ id: 'e1', name: 'מעלית צפונית' }], generators: [{ id: 'g1', name: 'גנרטור ראשי' }],
        departments: [{ id: 'dept-maint', name: 'אחזקה' }], people: [{ id: 'u1', name: 'דני כהן' }], categories: ['elevator', 'other'], doc_types: ['insurance', 'other'],
        defaults: { lead_days: { certificate: 30, preventive: 7, round: 0, vendor_document: 30 }, tag_base_url: '', tag_effective_url: 'https://arx.example.test',
          reminders_enabled: o.remindersOn === true, round_phone_view: o.roundView ?? 'step', close_request_mode: 'ask', file_max_per_task: 3 }, tickets_on: ticketsOn });
    }
    if (p === 'tags' && method === 'GET') {
      if (!can.manage) return err(route, 403, 'forbidden');
      return json(route, { items: tags.filter((t) => !t.revoked_at), base_url: 'https://arx.example.test' });
    }
    if (p === 'tags' && method === 'POST') {
      const b = body as Record<string, string>;
      const t = { id: `g${tags.length + 1}`, token: `TokNew${String(tags.length).padStart(16, '0')}`, path: '', target_kind: b.target_kind, target_id: b.target_id, label: b.label ?? '', medium: b.medium ?? 'qr',
        created_at: '2027-01-18T09:00:00Z', revoked_at: null, last_scan_at: null, target_name: tasks.find((x) => x.id === b.target_id)?.title ?? b.target_id, target_task_kind: 'round' };
      tags = [...tags, t];
      return json(route, t, 201);
    }
    m = /^tags\/([^/]+)$/.exec(p);
    if (m && method === 'DELETE') {
      tags = tags.map((t) => (t.id === m![1] ? { ...t, revoked_at: '2027-01-18T09:00:00Z' } : t));
      return json(route, tags.find((t) => t.id === m![1]));
    }
    m = /^scan\/([^/]+)$/.exec(p);
    if (m) {
      const tag = tags.find((t) => t.token === m![1] && !t.revoked_at);
      if (!tag) return err(route, 404, 'maint_tag_not_found');
      const t = tasks.find((x) => x.id === tag.target_id)!;
      return json(route, { kind: 'task', label: tag.label, task: detail(t), route: `#/tickets/maintenance?task=${t.id}` });
    }
    return err(route, 404, 'not_found');
  });
  return st;
}
