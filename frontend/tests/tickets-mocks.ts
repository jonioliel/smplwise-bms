import type { Page, Route } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';

// CR-038 slice 1: the mock layer of the tickets specs - the wire contract of routers/tickets.py and tickets_admin.py with fake data only
// (no real person, phone, address or device). The whole app runs against it through page.route, as a signed-in user of the chosen persona.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string) => json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details: {} }, status);

export type Persona = 'manager' | 'operator' | 'admin' | 'viewer';
export const PERMS: Record<Persona, string[]> = {
  manager: ['tickets.view', 'tickets.create', 'tickets.manage', 'devices.read', 'map.read'],
  operator: ['tickets.view', 'tickets.create', 'devices.read', 'map.read'],
  admin: ['tickets.view', 'tickets.create', 'tickets.manage', 'tickets.external', 'tickets.all_departments', 'tickets.configure', 'system.configure', 'rbac.assign', 'rbac.roles.manage', 'identity.directory.read', 'devices.read', 'map.read'],
  viewer: ['devices.read', 'map.read'],
};

export interface TicketsMockOptions {
  persona?: Persona;
  /** the module switch (`tickets.enabled`) */
  enabled?: boolean;
  /** no tickets at all */
  empty?: boolean;
  /** D33: the configured Hebrew name */
  name?: { one: string; many: string; gender: string };
  /** D18 / D22 */
  ui?: { detail?: 'drawer' | 'fullscreen' | 'drawer_fullscreen'; new_ticket?: 'sheet' | 'dialog'; /* TKUI1 */ detail_tab?: string; drawer_size?: string; phone_sheet?: string; /* CR-CAMVF-295 */ camera_viewfinder?: boolean };
  /** the list answers 500 */
  failList?: boolean;
  /** TKCAL: visit times and SLA targets on the list items (the weekly calendar); the mock clock is Tue 13.10.2026 10:42 UTC */
  schedule?: boolean;
  /** permissions beyond the persona's (the other areas of the rail, for the phone dock evidence) */
  extraPerms?: string[];
}

export interface TicketsMock {
  calls: { method: string; path: string; body: unknown }[];
}

const NOW = Date.parse('2026-10-13T10:42:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
export const DEPTS = [
  { id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה' },
  { id: 'dept-cleaning', key: 'cleaning', name: 'ניקיון' },
  { id: 'dept-hr', key: 'hr', name: 'משאבי אנוש' },
];
const PRIOS = (d: string) => [
  { id: `${d}-urgent`, key: 'urgent', name: 'דחופה', rank: 0, severity: 'critical', is_default: false, active: true },
  { id: `${d}-high`, key: 'high', name: 'גבוהה', rank: 1, severity: 'alert', is_default: false, active: true },
  { id: `${d}-normal`, key: 'normal', name: 'רגילה', rank: 2, severity: 'alert', is_default: true, active: true },
  { id: `${d}-low`, key: 'low', name: 'נמוכה', rank: 3, severity: 'info', is_default: false, active: true },
];
const CATS: Record<string, { id: string; name: string }[]> = {
  'dept-maintenance': [{ id: 'cat-hvac', name: 'מיזוג' }, { id: 'cat-elec', name: 'חשמל' }, { id: 'cat-plumb', name: 'אינסטלציה' }],
  'dept-cleaning': [{ id: 'cat-lobby', name: 'לובי' }],
  'dept-hr': [{ id: 'cat-onboard', name: 'קליטה' }],
};
export const PEOPLE = [{ id: 'u-ronit', name: 'רונית לוי' }, { id: 'u-avi', name: 'אבי כהן' }, { id: 'u-yossi', name: 'יוסי מזרחי' }, { id: 'u-dana', name: 'דנה פרץ' }];

interface Row {
  id: string; number: number; title: string; description: string; status: string; dept: string; cat: string | null; prio: string; hours: number;
  assignee: string | null; reopen?: number;
}
const ROWS: Row[] = [
  { id: '0000000000000a01', number: 1042, title: 'מזגן לא מקרר - חדר 102', description: 'המזגן פועל אך הטמפרטורה בחדר לא יורדת מתחת ל-27 מעלות מאז הבוקר. יש ריח קל של שריפה ליד היחידה החיצונית.', status: 'waiting_part', dept: 'dept-maintenance', cat: 'cat-hvac', prio: 'high', hours: 51, assignee: 'u-avi' },
  { id: '0000000000000a02', number: 1043, title: 'נזילה מהתקרה בשירותי קומה 2', description: 'מים מטפטפים מהתקרה מעל הכיור השמאלי. הונח דלי.', status: 'new', dept: 'dept-maintenance', cat: 'cat-plumb', prio: 'urgent', hours: 3, assignee: null },
  { id: '0000000000000a03', number: 1044, title: 'שער החניון לא נסגר', description: 'השער נשאר פתוח אחרי כל כניסה. נדרש מאבטח ליד השער.', status: 'assigned', dept: 'dept-maintenance', cat: 'cat-elec', prio: 'urgent', hours: 26, assignee: 'u-yossi' },
  { id: '0000000000000a04', number: 1045, title: 'ריח חריף במטבחון קומה 3', description: 'כנראה מהמקרר.', status: 'returned', dept: 'dept-cleaning', cat: null, prio: 'high', hours: 0.7, assignee: null, reopen: 0 },
  { id: '0000000000000a05', number: 1046, title: 'החלפת מסנן מזגן - חדר ישיבות', description: 'טיפול תקופתי.', status: 'done', dept: 'dept-maintenance', cat: 'cat-hvac', prio: 'low', hours: 20, assignee: 'u-avi' },
  { id: '0000000000000a06', number: 1047, title: 'ניקוי שטיח הלובי אחרי הגשם', description: 'כתמי בוץ בכניסה.', status: 'in_progress', dept: 'dept-cleaning', cat: 'cat-lobby', prio: 'normal', hours: 2, assignee: 'u-dana' },
  { id: '0000000000000a07', number: 1048, title: 'קליטת עובד חדש - תג כניסה וחניה', description: 'מתחיל ביום ראשון.', status: 'acknowledged', dept: 'dept-hr', cat: 'cat-onboard', prio: 'normal', hours: 6, assignee: 'u-ronit' },
  { id: '0000000000000a08', number: 1049, title: 'נורה מהבהבת בלובי', description: 'גוף תאורה שני משמאל לדלפק הקבלה מהבהב.', status: 'closed', dept: 'dept-maintenance', cat: 'cat-elec', prio: 'normal', hours: 96, assignee: null, reopen: 1 },
];

const OPEN = ['new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned'];
const GROUPS: Record<string, string[]> = { open: OPEN, unassigned: ['new', 'returned'], handling: ['assigned', 'acknowledged', 'in_progress', 'waiting_part'], done: ['done'], closed: ['closed', 'cancelled'] };

// TKCAL: hours from the mock "now" - a visit time (eta) and the SLA targets (ack / stuck / resolve) of a few rows
const SCHEDULE: Record<string, { eta?: number; ack?: number; stuck?: number; resolve?: number }> = {
  '0000000000000a01': { eta: -27 }, '0000000000000a02': { ack: -0.4, resolve: -30 }, '0000000000000a03': { eta: -5, resolve: 1 },
  '0000000000000a05': { eta: -2 }, '0000000000000a06': { eta: -52, resolve: -80, stuck: -50 }, '0000000000000a07': { eta: -100 },
};
const dueAt = (h: number | undefined) => (h === undefined ? null : ago(h));

function item(r: Row, schedule = false) {
  const sc = schedule ? SCHEDULE[r.id] : undefined;
  const d = DEPTS.find((x) => x.id === r.dept)!;
  const p = PRIOS(r.dept).find((x) => x.key === r.prio)!;
  const c = (CATS[r.dept] ?? []).find((x) => x.id === r.cat) ?? null;
  const a = PEOPLE.find((x) => x.id === r.assignee);
  return {
    id: r.id, number: r.number, title: r.title, excerpt: r.description.slice(0, 240), status: r.status, origin: 'manual',
    department: { ...d, icon: null, color: null }, category: c, priority: { id: p.id, key: p.key, name: p.name, rank: p.rank, severity: p.severity },
    place_text: '', device_name: '', created_by: { id: 'u-ronit', name: 'רונית לוי' }, created_at: ago(r.hours + 2), last_activity_at: ago(r.hours),
    assignee: a ? { kind: 'user', id: a.id, name: a.name, since: ago(r.hours + 1), acknowledged_at: r.status === 'assigned' ? null : ago(r.hours + 0.5) } : null,
    last_assignee_name: r.status === 'returned' ? 'יוסי מזרחי' : null, eta_at: sc ? dueAt(sc.eta) : r.status === 'waiting_part' ? ago(-27) : null,
    waiting_on: a ? 'assignee' : r.status === 'closed' ? 'none' : 'manager', waiting_reason: a ? null : 'unassigned', reopen_count: r.reopen ?? 0, external_stale: false,
    closed_at: r.status === 'closed' ? ago(r.hours) : null, revision: 3, view: 'full',
    ...(sc ? { sla: { ack_due_at: dueAt(sc.ack), stuck_due_at: dueAt(sc.stuck), resolve_due_at: dueAt(sc.resolve) } } : {}),
  };
}

function detail(r: Row, persona: Persona) {
  const base = item(r);
  const { excerpt: _e, ...rest } = base;
  const manager = persona === 'manager' || persona === 'admin';
  const final = r.status === 'closed' || r.status === 'cancelled';
  const handling = ['assigned', 'acknowledged', 'in_progress', 'waiting_part'].includes(r.status);
  const moves: Record<string, string[]> = {
    new: ['closed', 'cancelled'], assigned: ['acknowledged', 'in_progress', 'closed', 'cancelled'], acknowledged: ['in_progress', 'waiting_part', 'done', 'closed', 'cancelled'],
    in_progress: ['waiting_part', 'done', 'closed', 'cancelled'], waiting_part: ['in_progress', 'done', 'closed', 'cancelled'], done: ['in_progress', 'closed', 'cancelled'],
    returned: ['closed', 'cancelled'], closed: ['new'], cancelled: [],
  };
  const events = [
    { id: `${r.id}-e1`, at: ago(r.hours + 2), kind: 'created', actor: { kind: 'user', name: 'רונית לוי', me: false }, from: null, to: 'new', body: null, data: { origin: 'manual' }, via: 'ui', external: false },
    ...(r.assignee ? [{ id: `${r.id}-e2`, at: ago(r.hours + 1), kind: 'assigned', actor: { kind: 'user', name: 'רונית לוי', me: false }, from: 'new', to: 'assigned', body: null, data: { assignee: PEOPLE.find((x) => x.id === r.assignee)?.name, assignee_kind: 'user' }, via: 'ui', external: false }] : []),
    ...(r.status === 'waiting_part' ? [
      { id: `${r.id}-e3`, at: ago(r.hours + 0.5), kind: 'status', actor: { kind: 'user', name: 'אבי כהן', me: false }, from: 'assigned', to: 'in_progress', body: null, data: {}, via: 'ui', external: true },
      { id: `${r.id}-e4`, at: ago(r.hours + 0.2), kind: 'note', actor: { kind: 'user', name: 'אבי כהן', me: false }, from: null, to: null, body: 'הקבל של המדחס שרוף. הוזמן חלק חלופי, מגיע מחר. היחידה כבויה בינתיים כדי לא להחמיר.', data: {}, via: 'ui', external: true },
      { id: `${r.id}-e5`, at: ago(r.hours), kind: 'status', actor: { kind: 'user', name: 'אבי כהן', me: false }, from: 'in_progress', to: 'waiting_part', body: null, data: {}, via: 'ui', external: true },
    ] : []),
    ...(r.status === 'returned' ? [{ id: `${r.id}-e6`, at: ago(r.hours), kind: 'returned', actor: { kind: 'user', name: 'יוסי מזרחי', me: false }, from: 'assigned', to: 'returned', body: 'לא באחריות האחזקה - שייך לניקיון.', data: { kind: 'not_mine' }, via: 'ui', external: true }] : []),
  ];
  return {
    ...rest, description: r.description, events, attachments: [], close_note: r.status === 'closed' ? 'הוחלף גוף התאורה.' : null, closed_by_name: r.status === 'closed' ? 'רונית לוי' : null,
    duplicate_of: null, reopen_until: r.status === 'closed' ? ago(-24 * 10) : null,
    can: {
      edit_fields: manager && !final ? ['title', 'description', 'category_id', 'priority_id', 'department_id'] : [], assign: manager && !['cancelled'].includes(r.status), assign_external: false,
      note: !final, note_external: manager, attach: !final, attach_external: manager, eta: handling, return: persona === 'operator' && handling, manage: manager,
    },
    transitions: (manager ? moves[r.status] ?? [] : persona === 'operator' && handling ? (moves[r.status] ?? []).filter((m) => !['closed', 'cancelled'].includes(m)) : [])
      .map((to) => ({ to, note_required: to === 'cancelled' || (to === 'closed' && r.status !== 'done') })),
    assignments: r.assignee ? [{ id: `${r.id}-a1`, kind: 'user', name: PEOPLE.find((x) => x.id === r.assignee)?.name ?? '', channel: 'inapp', assigned_at: ago(r.hours + 1), assigned_by_name: 'רונית לוי', acknowledged_at: null, ended_at: null, end_reason: null, return_kind: null, return_reason: null }]
      : r.status === 'returned' ? [{ id: `${r.id}-a0`, kind: 'user', name: 'יוסי מזרחי', channel: 'inapp', assigned_at: ago(r.hours + 1), assigned_by_name: 'רונית לוי', acknowledged_at: null, ended_at: ago(r.hours), end_reason: 'returned', return_kind: 'not_mine', return_reason: 'לא באחריות האחזקה - שייך לניקיון.' }] : [],
  };
}

// slice 2: the section 13.1 defaults (minutes)
const SLA: Record<string, number[]> = {
  urgent: [15, 1440, 30, 60, 1440, 480, 30], high: [60, 1440, 120, 480, 4320, 2880, 240],
  normal: [240, 1440, 1440, 4320, 10080, 10080, 1440], low: [1440, 1440, 4320, 10080, 20160, 43200, 4320],
};
export const INSTALLATION = { links: { sliding_days: 14, cap_days: 90, grace_hours: 24 }, send_hours: { from: '07:00', to: '21:00' }, urgent_is_critical: true };

function slaRows(d: string) {
  return PRIOS(d).map((p) => {
    const [un, lo, ack, st, sw, rs, rm] = SLA[p.key];
    return { priority_id: p.id, priority_key: p.key, priority_name: p.name, priority_active: true, unassigned_after_min: un, link_unopened_min: lo, ack_within_min: ack,
      stuck_after_min: st, stuck_waiting_min: sw, resolve_within_min: rs, remind_every_min: rm, max_reminders: 2, manager_alert_after_steps: 1, revision: 1, updated_at: null, updated_by: null };
  });
}

export function adminDept(d: (typeof DEPTS)[number], open: number) {
  const maint = d.id === 'dept-maintenance';
  const overrides = { link_sliding_days: maint ? 30 : null, link_cap_days: null, link_grace_hours: null, send_hours: maint ? { from: '08:00', to: '18:00' } : null, urgent_is_critical: null };
  return {
    auto_close_after_days: maint ? null : 3, share_history_external: maint, overrides,
    effective: { links: { sliding_days: maint ? 30 : 14, cap_days: 90, grace_hours: 24 }, send_hours: overrides.send_hours ?? INSTALLATION.send_hours, urgent_is_critical: true,
      auto_close_after_days: maint ? null : 3, share_history_external: maint, reopen_days: 14, overridden: maint ? ['link_sliding_days', 'send_hours'] : [] },
    sla: slaRows(d.id),
    templates: maint ? [{ id: 'tpl-ac', kind: 'ticket', name: 'מזגן לא מקרר', title: 'מזגן לא מקרר', body: 'חדר:\nתיאור:', category_id: 'cat-hvac', priority_key: 'high', active: true, revision: 1, updated_at: ago(300) }] : [],
    ...d, description: '', icon: null, color: null, sort_order: 0, active: true, open_to_all: d.id !== 'dept-hr', reopen_days: 14, revision: 2, open_tickets: open,
    categories: (CATS[d.id] ?? []).map((c, i) => ({ ...c, parent_id: null, default_priority_id: null, domains: c.id === 'cat-hvac' ? ['climate', 'fan'] : [], sort_order: i, active: true })), priorities: PRIOS(d.id),
    members: d.id === 'dept-maintenance'
      ? [{ kind: 'user', id: 'u-ronit', name: 'רונית לוי', role: 'manager', notify_new: true, added_at: ago(900) }, { kind: 'user', id: 'u-avi', name: 'אבי כהן', role: 'member', notify_new: false, added_at: ago(800) }, { kind: 'group', id: 'g-tech', name: 'טכנאים', role: 'member', notify_new: false, added_at: ago(700) }]
      : [{ kind: 'user', id: 'u-dana', name: 'דנה פרץ', role: 'manager', notify_new: true, added_at: ago(900) }],
    can_edit_members: true,
  };
}

export async function installTicketsMock(page: Page, o: TicketsMockOptions = {}): Promise<TicketsMock> {
  const persona = o.persona ?? 'manager';
  const perms = [...PERMS[persona], ...(o.extraPerms ?? [])];
  const enabled = o.enabled ?? true;
  const st: TicketsMock = { calls: [] };
  let rows: Row[] = o.empty ? [] : ROWS.map((r) => ({ ...r }));
  const nameHe = o.name ?? { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' }; // module absent: derived ("ניהול השירות" while the item names are the defaults)
  const names = { he: nameHe, en: { one: 'Ticket', many: 'Tickets', gender: '' }, ar: { one: 'بلاغ', many: 'بلاغات', gender: 'm' }, ru: { one: 'Заявка', many: 'Заявки', gender: 'f' } };
  let ui: Record<string, unknown> = { detail: 'drawer_fullscreen', new_ticket: 'sheet', detail_tab: 'overview', drawer_size: 'wide', phone_sheet: 'full', ...(o.ui ?? {}) };
  let nameRevision = o.name ? 1 : 0;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body: unknown = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    if (p === 'me') {
      return json(route, {
        user: { id: 'u-ronit', username: 'ronit', display_name: 'רונית לוי', source: 'ingress' }, channel: 'local', remote: null,
        bindings: [{ id: 'b1', role_id: persona === 'admin' ? 'system_admin' : 'operator', role_name: persona === 'admin' ? 'מנהל מערכת' : 'מפעיל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
        modules: { tickets: enabled, tickets_name: names },
      });
    }
    if (p === 'me/prefs') return json(route, { prefs: { 'nav.order': [] }, stored: [], updated_at: null });
    if (p === 'settings') {
      st.calls.push({ method, path: p, body });
      if (method === 'PATCH') return json(route, { settings: { 'ui.design': 'a', 'tickets.enabled': (body as Record<string, string>)['tickets.enabled'] ?? String(enabled) }, can_edit: true });
      return json(route, { settings: { 'ui.design': 'a', 'tickets.enabled': String(enabled) }, can_edit: perms.includes('system.configure') });
    }
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'devices/tree') return json(route, { floors: [], unassigned: { area_id: 'unassigned', name: 'ללא שיוך' }, scoped: false, can_bulk: false });
    if (p === 'access/bindings' && method === 'POST') {
      st.calls.push({ method, path: p, body });
      return json(route, { id: 'b-new', revision: 2 }, 201);
    }
    if (/^access\/bindings\//.test(p) && method === 'DELETE') {
      st.calls.push({ method, path: p, body });
      return json(route, { revoked: p.split('/').pop(), revision: 3 });
    }
    if (!p.startsWith('tickets')) return err(route, 404, 'not_found', 'לא נמצא');
    st.calls.push({ method, path: p + url.search, body });
    if (p === 'tickets/module') return json(route, { enabled, public_ready: false, name: names, name_revision: nameRevision, ui });
    if (!enabled) return err(route, 404, 'feature_disabled', 'המודול כבוי');
    const anyTicketPerm = perms.some((x) => x.startsWith('tickets.'));
    if (p === 'tickets/meta') {
      if (!anyTicketPerm) return err(route, 403, 'forbidden', 'אין הרשאה');
      const manager = persona === 'manager' || persona === 'admin';
      return json(route, {
        departments: DEPTS.map((d) => ({ ...d, icon: null, color: null, my_role: d.id === 'dept-maintenance' ? (manager ? 'manager' : 'member') : persona === 'admin' ? null : null, can_create: true, can_manage: manager && (persona === 'admin' || d.id === 'dept-maintenance'), open_to_all: true,
          categories: (CATS[d.id] ?? []).map((c) => ({ ...c, parent_id: null, default_priority_id: null })), priorities: PRIOS(d.id).map(({ active: _a, ...x }) => x) })),
        can: { view: perms.includes('tickets.view'), create: perms.includes('tickets.create'), manage: manager, all_departments: perms.includes('tickets.all_departments'), external: perms.includes('tickets.external'), configure: perms.includes('tickets.configure') },
      });
    }
    if (p === 'tickets' && method === 'GET') {
      if (!perms.includes('tickets.view')) return err(route, 403, 'forbidden', 'אין הרשאה');
      if (o.failList) return err(route, 500, 'internal', 'שגיאה');
      const status = url.searchParams.get('status') ?? 'open';
      const dept = url.searchParams.get('department_id');
      const q = (url.searchParams.get('q') ?? '').trim();
      const scope = url.searchParams.get('scope') ?? 'visible';
      const list = rows
        .filter((r) => status === 'all' || (GROUPS[status] ?? [status]).includes(r.status))
        .filter((r) => !dept || r.dept === dept)
        .filter((r) => !q || r.title.includes(q) || String(r.number) === q.replace(/^#/, ''))
        .filter((r) => scope !== 'department' || r.dept === 'dept-maintenance')
        .filter((r) => scope !== 'mine' || r.assignee === 'u-ronit' || true)
        .sort((a, b) => a.hours - b.hours);
      return json(route, { items: list.map((r) => item(r, o.schedule)), next_cursor: null });
    }
    // TKUI4: the counts of the list's page frame (GET tickets/facets: per state group, per department, the total) over the same visible set as the list
    if (p === 'tickets/facets' && method === 'GET') {
      if (!perms.includes('tickets.view')) return err(route, 403, 'forbidden', 'אין הרשאה');
      const dept = url.searchParams.get('department_id');
      const q = (url.searchParams.get('q') ?? '').trim();
      const scope = url.searchParams.get('scope') ?? 'visible';
      const status = url.searchParams.get('status') ?? 'all';
      const base = rows
        .filter((r) => !dept || r.dept === dept)
        .filter((r) => !q || r.title.includes(q) || String(r.number) === q.replace(/^#/, ''))
        .filter((r) => scope !== 'department' || r.dept === 'dept-maintenance');
      const inState = base.filter((r) => status === 'all' || (GROUPS[status] ?? [status]).includes(r.status));
      const departments: Record<string, number> = {};
      for (const r of inState) departments[r.dept] = (departments[r.dept] ?? 0) + 1;
      return json(route, {
        status: {}, groups: Object.fromEntries(Object.entries(GROUPS).map(([g, sts]) => [g, base.filter((r) => sts.includes(r.status)).length])),
        departments, stuck: {}, waiting: 0, tree: [], total: inState.length, truncated: false,
      });
    }
    if (p === 'tickets' && method === 'POST') {
      const b = body as { title: string; description?: string; department_id: string; priority_id?: string; category_id?: string };
      const r: Row = { id: `00000000000${String(rows.length + 100).padStart(5, '0')}`, number: 1050 + rows.length, title: b.title, description: b.description ?? '', status: 'new', dept: b.department_id, cat: b.category_id ?? null, prio: (b.priority_id ?? 'x-normal').split('-').pop() ?? 'normal', hours: 0, assignee: null };
      rows = [r, ...rows];
      return json(route, { ...detail(r, persona), result: 'created' }, 201);
    }
    if (p === 'tickets/assignees') return json(route, { users: PEOPLE.slice(1).map((x, i) => ({ kind: 'user', id: x.id, name: x.name, member_role: i === 0 ? 'manager' : 'member' })), contacts: [] });
    if (p === 'tickets/settings') {
      if (method === 'PUT') ui = { ...ui, ...((body as { ui?: object })?.ui ?? {}) };
      return json(route, { revision: 1, ui, ...INSTALLATION });
    }
    if (p === 'tickets/name' && method === 'PUT') {
      nameRevision += 1;
      const b = body as Record<string, unknown>;
      for (const lang of ['he', 'en', 'ar', 'ru'] as const) if (b[lang]) (names as Record<string, unknown>)[lang] = b[lang];
      return json(route, { ...names, revision: nameRevision });
    }
    if (p === 'tickets/admin/departments') return json(route, { departments: DEPTS.map((d) => adminDept(d, rows.filter((r) => r.dept === d.id && OPEN.includes(r.status)).length)), all_departments: perms.includes('tickets.all_departments'), installation: INSTALLATION });
    // slice 2: every department write answers with the department (the mock does not keep the change)
    const deptOf = (id: string) => adminDept(DEPTS.find((x) => x.id === id) ?? DEPTS[0], 0);
    const dm = /^tickets\/admin\/departments\/([\w-]+)(?:\/(sla|templates|categories))?$/.exec(p);
    if (dm && method !== 'GET') return json(route, deptOf(dm[1]), method === 'POST' ? 201 : 200);
    if (/^tickets\/admin\/(templates|categories|priorities)\//.test(p)) return json(route, deptOf('dept-maintenance'));
    if (p === 'tickets/admin/directory') return json(route, { users: PEOPLE, groups: [{ id: 'g-tech', name: 'טכנאים' }] });
    if (p === 'tickets/admin/holders') {
      const g = (bid: string, role: string, roleName: string, ps: string[], via: string, group: string | null = null) => ({ binding_id: bid, permissions: ps, via, role_id: role, role_name: roleName, group_name: group, scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow', expires_at: null });
      return json(route, {
        users: [
          { id: 'u-avi', name: 'אבי כהן', active: true, grants: [g('b2', 'operator', 'מפעיל', ['tickets.view', 'tickets.create'], 'role')] },
          { id: 'u-dana', name: 'דנה פרץ', active: true, grants: [g('b3', 'tickets_manage', 'ניהול בקשות שירות', ['tickets.manage'], 'grant')] },
          { id: 'u-ronit', name: 'רונית לוי', active: true, grants: [g('b1', 'system_admin', 'מנהל מערכת', ['tickets.view', 'tickets.create', 'tickets.manage', 'tickets.external', 'tickets.all_departments', 'tickets.configure'], 'role')] },
          { id: 'u-yossi', name: 'יוסי מזרחי', active: true, grants: [g('b4', 'operator', 'מפעיל', ['tickets.view', 'tickets.create'], 'group', 'טכנאים')] },
        ],
        grant_roles: ['tickets_view', 'tickets_create', 'tickets_manage', 'tickets_all_departments', 'tickets_external', 'tickets_configure'],
        roles: [
          { id: 'viewer', name: 'צופה', builtin: true, permissions: [] },
          { id: 'operator', name: 'מפעיל', builtin: true, permissions: ['tickets.view', 'tickets.create'] },
          { id: 'site_admin', name: 'מנהל אתר', builtin: true, permissions: ['tickets.view', 'tickets.create', 'tickets.manage', 'tickets.external'] },
          { id: 'system_admin', name: 'מנהל מערכת', builtin: true, permissions: ['tickets.view', 'tickets.create', 'tickets.manage', 'tickets.external', 'tickets.all_departments', 'tickets.configure'] },
          { id: 'c-maint', name: 'רכז אחזקה', builtin: false, permissions: ['tickets.view', 'tickets.manage', 'tickets.configure'] },
        ],
      });
    }
    const m = /^tickets\/([0-9a-f]{16})(?:\/(\w+))?/.exec(p);
    if (m) {
      const r = rows.find((x) => x.id === m[1]);
      if (!r) return err(route, 404, 'ticket_not_found', 'לא נמצא');
      if (m[2] === 'status') {
        const b = body as { to: string };
        r.status = b.to;
      } else if (m[2] === 'assign') {
        r.assignee = (body as { assignee: { id: string } }).assignee.id;
        r.status = 'assigned';
      } else if (m[2] === 'notes') {
        // a note answers with the ticket (the mock keeps no notes)
      }
      return json(route, detail(r, persona), m[2] === 'notes' ? 201 : 200);
    }
    return err(route, 404, 'not_found', 'לא נמצא');
  });
  return st;
}

/** slice 4 (tests/tickets-s4-mocks.ts): a pristine demo ticket's detail as a persona sees it, to add the outside-contact parts to. */
export function mockTicketDetail(id: string, persona: Persona): Record<string, unknown> | null {
  const r = ROWS.find((x) => x.id === id);
  return r ? (detail({ ...r }, persona) as unknown as Record<string, unknown>) : null;
}

export const url = (hash: string, skin = 'classic', scheme: 'light' | 'dark' = 'light') => `/?design=a&skin=${skin}&scheme=${scheme}#${hash}`;
export const SKINS = SKIN_IDS;
