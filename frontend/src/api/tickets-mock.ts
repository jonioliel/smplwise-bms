/**
 * CR-038 slice 1: the in-memory demo store of the tickets screens (no backend: the static preview and design review). The demo user is
 * a manager of every department with every ticket permission, so every screen and action can be seen; the moves follow the server's
 * table (services/tickets/model.py STATUS_MOVES) in a simplified form. Nothing here is a security rule - the server decides.
 */
import type {
  AdminDepartment, AssignBody, CreateAnswer, CreateBody, DepartmentBody, Eligible, EntityTickets, HistorySummary, HoldersResponse, ListPage, ListQuery, Meta, ModuleState,
  NameDoc, NameEntries, PatchBody, ReturnAnswer, ReturnBody, SettingsDoc, StatusBody, TicketDetail, TicketEvent, TicketStatus, TicketsBackend, UiSettings,
} from './tickets';
import { DEFAULT_TICKET_NAMES } from '../tickets/naming';

const ME = { id: 'demo', name: 'יוני' };
const PEOPLE = [ME, { id: 'u-avi', name: 'אבי כהן' }, { id: 'u-dana', name: 'דנה לוי' }, { id: 'u-moshe', name: 'משה פרץ' }];
const HOUR = 3_600_000;
const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString().replace(/\.\d+Z$/, 'Z');
const sleep = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
let seq = 1042;
let idn = 0;
const nid = () => `d${(++idn).toString(16).padStart(15, '0')}`;

const OPEN: TicketStatus[] = ['new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned'];
const HANDLING: TicketStatus[] = ['assigned', 'acknowledged', 'in_progress', 'waiting_part'];
const ASSIGNEE_MOVES: [TicketStatus, TicketStatus][] = [
  ['assigned', 'acknowledged'], ['assigned', 'in_progress'], ['acknowledged', 'in_progress'], ['waiting_part', 'in_progress'],
  ['acknowledged', 'waiting_part'], ['in_progress', 'waiting_part'], ['acknowledged', 'done'], ['in_progress', 'done'], ['waiting_part', 'done'],
];
const MANAGER_MOVES: [TicketStatus, TicketStatus][] = [
  ...ASSIGNEE_MOVES, ['done', 'closed'], ['done', 'in_progress'], ['closed', 'new'],
  ...OPEN.filter((s) => s !== 'done').map((s): [TicketStatus, TicketStatus] => [s, 'closed']),
  ...OPEN.map((s): [TicketStatus, TicketStatus] => [s, 'cancelled']),
];
const STATUS_GROUPS: Record<string, TicketStatus[]> = {
  open: OPEN, unassigned: ['new', 'returned'], handling: HANDLING, done: ['done'], closed: ['closed', 'cancelled'],
};

function prios(dept: string): AdminDepartment['priorities'] {
  return [
    { id: `${dept}-urgent`, key: 'urgent', name: 'דחופה', rank: 0, severity: 'critical', is_default: false, active: true },
    { id: `${dept}-high`, key: 'high', name: 'גבוהה', rank: 1, severity: 'alert', is_default: false, active: true },
    { id: `${dept}-normal`, key: 'normal', name: 'רגילה', rank: 2, severity: 'alert', is_default: true, active: true },
    { id: `${dept}-low`, key: 'low', name: 'נמוכה', rank: 3, severity: 'info', is_default: false, active: true },
  ];
}

const departments: AdminDepartment[] = [
  {
    id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה', description: '', icon: null, color: null, sort_order: 0, active: true, open_to_all: true, reopen_days: 14,
    revision: 1, open_tickets: 0, can_edit_members: true, priorities: prios('dept-maintenance'),
    categories: [
      { id: 'cat-hvac', name: 'מיזוג', parent_id: null, default_priority_id: null, sort_order: 0, active: true },
      { id: 'cat-elec', name: 'חשמל', parent_id: null, default_priority_id: null, sort_order: 1, active: true },
      { id: 'cat-plumb', name: 'אינסטלציה', parent_id: null, default_priority_id: null, sort_order: 2, active: true },
    ],
    members: [
      { kind: 'user', id: 'demo', name: ME.name, role: 'manager', notify_new: true, added_at: ago(900) },
      { kind: 'user', id: 'u-avi', name: 'אבי כהן', role: 'member', notify_new: false, added_at: ago(800) },
      { kind: 'user', id: 'u-moshe', name: 'משה פרץ', role: 'member', notify_new: false, added_at: ago(800) },
    ],
  },
  {
    id: 'dept-cleaning', key: 'cleaning', name: 'ניקיון', description: '', icon: null, color: null, sort_order: 1, active: true, open_to_all: true, reopen_days: 7,
    revision: 1, open_tickets: 0, can_edit_members: true, priorities: prios('dept-cleaning'),
    categories: [{ id: 'cat-lobby', name: 'לובי ושטחים משותפים', parent_id: null, default_priority_id: null, sort_order: 0, active: true }],
    members: [
      { kind: 'user', id: 'demo', name: ME.name, role: 'manager', notify_new: true, added_at: ago(900) },
      { kind: 'user', id: 'u-dana', name: 'דנה לוי', role: 'member', notify_new: false, added_at: ago(700) },
    ],
  },
];

let ui: UiSettings = { detail: 'drawer_fullscreen', new_ticket: 'sheet' };
let settingsRevision = 0;
let longPress: 'sheet' | 'menu' = 'sheet';
const FINAL_STATUSES: TicketStatus[] = ['closed', 'cancelled'];
const TRACKED = ['light', 'switch', 'input_boolean', 'climate', 'fan', 'humidifier', 'cover', 'water_heater', 'valve', 'vacuum', 'lock', 'alarm_control_panel'];

/** Slice 3: the demo's 24 h history preview - a schedule and an automation, never a person's name. */
function demoHistory(): HistorySummary {
  const at = (h: number) => new Date(Date.now() - h * HOUR).toISOString().replace(/\.\d+Z$/, 'Z');
  const lines: HistorySummary['lines'] = [
    { at: at(0.5), kind: 'power', from: { state: 'cool' }, to: { state: 'off' }, changed: ['state'], actor: { type: 'person' } },
    { at: at(3), kind: 'value', from: { state: 'cool', temperature: 24 }, to: { state: 'cool', temperature: 22 }, changed: ['temperature'], actor: { type: 'schedule', name: 'קירור בוקר' } },
    { at: at(9), kind: 'power', from: { state: 'off' }, to: { state: 'cool' }, changed: ['state'], actor: { type: 'automation', name: 'הפעלה לפני הגעה' } },
  ];
  return { source: 'device_activity', window_hours: 24, window_from: at(24), window_to: at(0), count: lines.length, truncated: false, withheld: null, lines };
}
let names: NameDoc = { ...clone(DEFAULT_TICKET_NAMES), revision: 0 };

const tickets: TicketDetail[] = [];

function ev(kind: string, at: string, actor: { name: string; me?: boolean }, extra: Partial<TicketEvent> = {}): TicketEvent {
  return { id: nid(), at, kind, actor: { kind: 'user', name: actor.name, me: !!actor.me }, from: null, to: null, body: null, data: {}, via: 'ui', external: false, ...extra };
}

function seed(): void {
  const mk = (title: string, description: string, deptId: string, cat: string | null, prio: string, status: TicketStatus, hours: number, assignee: { id: string; name: string } | null) => {
    const dept = departments.find((d) => d.id === deptId)!;
    const p = dept.priorities.find((x) => x.key === prio)!;
    const c = dept.categories.find((x) => x.id === cat) ?? null;
    const created = ago(hours);
    const t: TicketDetail = {
      id: nid(), number: ++seq, title, description, status, origin: 'manual',
      department: { id: dept.id, key: dept.key, name: dept.name, icon: null, color: null },
      category: c ? { id: c.id, name: c.name } : null,
      priority: { id: p.id, key: p.key, name: p.name, rank: p.rank, severity: p.severity },
      place_text: '', device_name: '', created_by: { id: 'u-dana', name: 'דנה לוי' }, created_at: created, last_activity_at: ago(Math.max(0.2, hours / 3)),
      assignee: assignee ? { kind: 'user', id: assignee.id, name: assignee.name, since: ago(hours / 2), acknowledged_at: status === 'assigned' ? null : ago(hours / 3) } : null,
      last_assignee_name: null, eta_at: null, waiting_on: assignee ? 'assignee' : 'manager', waiting_reason: assignee ? null : 'unassigned', reopen_count: 0,
      external_stale: false, closed_at: status === 'closed' ? ago(hours / 4) : null, revision: 1, view: 'full',
      events: [ev('created', created, { name: 'דנה לוי' }, { to: 'new', data: { origin: 'manual' } })], attachments: [], close_note: null, closed_by_name: null,
      duplicate_of: null, reopen_until: null, can: null as unknown as TicketDetail['can'], transitions: [], assignments: [],
    };
    if (assignee) t.events.push(ev('assigned', ago(hours / 2), ME, { from: 'new', to: 'assigned', data: { assignee: assignee.name, assignee_kind: 'user' }, actor: { kind: 'user', name: ME.name, me: true } }));
    if (status !== 'new' && status !== 'assigned' && assignee) t.events.push(ev('status', ago(hours / 3), assignee, { from: 'assigned', to: status }));
    tickets.push(t);
  };
  mk('מזגן לא מקרר - חדר 102', 'המזגן פועל אך הטמפרטורה בחדר לא יורדת מתחת ל-27 מעלות מאז הבוקר. יש ריח קל של שריפה ליד היחידה החיצונית.', 'dept-maintenance', 'cat-hvac', 'high', 'waiting_part', 50, PEOPLE[1]);
  mk('נזילה מהתקרה בשירותי קומה 2', 'מים מטפטפים מהתקרה מעל הכיור השמאלי. הונח דלי.', 'dept-maintenance', 'cat-plumb', 'urgent', 'new', 3, null);
  mk('שער החניון לא נסגר', 'השער נשאר פתוח אחרי כל כניסה. נדרש מאבטח ליד השער.', 'dept-maintenance', 'cat-elec', 'urgent', 'assigned', 26, PEOPLE[3]);
  mk('החלפת מסנן מזגן - חדר ישיבות', 'טיפול תקופתי.', 'dept-maintenance', 'cat-hvac', 'low', 'done', 120, PEOPLE[1]);
  mk('ניקוי שטיח הלובי אחרי הגשם', 'כתמי בוץ בכניסה.', 'dept-cleaning', 'cat-lobby', 'normal', 'in_progress', 30, PEOPLE[2]);
  mk('נורה מהבהבת בלובי', 'גוף תאורה שני משמאל לדלפק הקבלה מהבהב.', 'dept-maintenance', 'cat-elec', 'normal', 'closed', 200, PEOPLE[3]);
}
seed();
// slice 3: the first demo ticket belongs to a device (the device window's tab lists it)
Object.assign(tickets[0], { origin: 'device', entity_id: 'climate.room_102', device_name: 'מזגן חדר 102', place_text: 'קומה 1 · חדר 102' });

function canOf(t: TicketDetail): TicketDetail['can'] {
  const final = t.status === 'closed' || t.status === 'cancelled';
  const mine = t.assignee?.id === ME.id;
  return {
    edit_fields: final ? [] : ['title', 'description', 'category_id', 'priority_id', 'department_id'],
    assign: ['new', 'returned', 'done', 'closed', ...HANDLING].includes(t.status), assign_external: false,
    note: !final, note_external: true, attach: !final, attach_external: true, eta: HANDLING.includes(t.status),
    return: mine && HANDLING.includes(t.status), manage: true,
  };
}

function view(t: TicketDetail): TicketDetail {
  const dept = departments.find((d) => d.id === t.department?.id);
  const until = t.status === 'closed' && t.closed_at ? new Date(Date.parse(t.closed_at) + (dept?.reopen_days ?? 14) * 24 * HOUR).toISOString() : null;
  const moves = new Map<TicketStatus, boolean>();
  for (const [frm, to] of MANAGER_MOVES) {
    if (frm !== t.status) continue;
    if (frm === 'closed' && to === 'new' && !(until && Date.parse(until) > Date.now())) continue;
    moves.set(to, (to === 'closed' && frm !== 'done') || to === 'cancelled');
  }
  const order: TicketStatus[] = ['new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned', 'closed', 'cancelled'];
  return clone({ ...t, can: canOf(t), reopen_until: until, transitions: [...moves].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([to, note_required]) => ({ to, note_required })) });
}

function find(id: string): TicketDetail {
  const t = tickets.find((x) => x.id === id);
  if (!t) throw Object.assign(new Error('not found'), { status: 404 });
  return t;
}

function touch(t: TicketDetail): void {
  t.revision += 1;
  t.last_activity_at = new Date().toISOString();
}

function deptCounts(): void {
  for (const d of departments) d.open_tickets = tickets.filter((t) => t.department?.id === d.id && OPEN.includes(t.status)).length;
}

export const mockBackend: TicketsBackend = {
  async module(): Promise<ModuleState> {
    await sleep(30);
    const { revision, ...n } = names;
    return { enabled: true, public_ready: false, name: clone(n) as NameEntries, name_revision: revision, ui: { ...ui } };
  },
  async meta(): Promise<Meta> {
    await sleep(40);
    return {
      departments: departments.filter((d) => d.active).map((d) => ({
        id: d.id, key: d.key, name: d.name, icon: d.icon, color: d.color, my_role: 'manager', can_create: true, can_manage: true, open_to_all: d.open_to_all,
        categories: d.categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id, default_priority_id: c.default_priority_id })),
        priorities: d.priorities.filter((p) => p.active).map((p) => ({ id: p.id, key: p.key, name: p.name, rank: p.rank, severity: p.severity, is_default: p.is_default })),
      })),
      can: { view: true, create: true, manage: true, all_departments: true, external: false, configure: true },
    };
  },
  async list(q: ListQuery): Promise<ListPage> {
    await sleep();
    const statuses = q.status === 'all' ? null : STATUS_GROUPS[q.status] ?? [q.status as TicketStatus];
    const needle = (q.q ?? '').trim().toLowerCase();
    const rows = tickets
      .filter((t) => (!statuses || statuses.includes(t.status)) && (!q.department_id || t.department?.id === q.department_id))
      .filter((t) => q.scope !== 'mine' || t.assignee?.id === ME.id || t.created_by.id === ME.id)
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || String(t.number) === needle.replace(/^#/, '') || t.device_name.toLowerCase().includes(needle))
      .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at));
    return { items: rows.map((t) => { const { description, events: _e, attachments: _a, close_note: _c, closed_by_name: _n, duplicate_of: _d, reopen_until: _u, can: _x, transitions: _t, assignments: _s, ...item } = clone(t); return { ...item, excerpt: description.slice(0, 240) }; }), next_cursor: null };
  },
  async get(id) {
    await sleep();
    return view(find(id));
  },
  async create(body: CreateBody): Promise<CreateAnswer> {
    await sleep(200);
    const dept = departments.find((d) => d.id === body.department_id)!;
    const p = dept.priorities.find((x) => x.id === body.priority_id) ?? dept.priorities.find((x) => x.is_default)!;
    const c = dept.categories.find((x) => x.id === body.category_id) ?? null;
    const now = new Date().toISOString();
    const t: TicketDetail = {
      id: nid(), number: ++seq, title: body.title.trim(), description: (body.description ?? '').trim(), status: 'new', origin: 'manual',
      department: { id: dept.id, key: dept.key, name: dept.name, icon: null, color: null }, category: c ? { id: c.id, name: c.name } : null,
      priority: { id: p.id, key: p.key, name: p.name, rank: p.rank, severity: p.severity }, place_text: '', device_name: '', created_by: ME, created_at: now,
      last_activity_at: now, assignee: null, last_assignee_name: null, eta_at: null, waiting_on: 'manager', waiting_reason: 'unassigned', reopen_count: 0, external_stale: false,
      closed_at: null, revision: 1, view: 'full', events: [ev('created', now, { ...ME, me: true }, { to: 'new' })], attachments: [], close_note: null, closed_by_name: null,
      duplicate_of: null, reopen_until: null, can: null as unknown as TicketDetail['can'], transitions: [], assignments: [],
    };
    if (body.entity_id) {
      // slice 3: a device's ticket - the demo has no place resolution; the history is the synthetic preview
      const before = tickets.find((x) => x.entity_id === body.entity_id);
      Object.assign(t, { origin: 'device', entity_id: body.entity_id, device_name: before?.device_name || body.entity_id, place_text: before?.place_text ?? '',
        device_context: { ...demoHistory(), captured_at: now, coverage: {}, shareable: !['lock', 'alarm_control_panel', 'cover', 'camera'].includes(body.entity_id.split('.')[0]) } });
    }
    tickets.unshift(t);
    if (body.assign) await mockBackend.assign(t.id, { assignee: body.assign, note: body.assign_note, revision: t.revision });
    const others = body.entity_id ? (await mockBackend.byEntity(body.entity_id)).items.filter((x) => x.id !== t.id && !FINAL_STATUSES.includes(x.status)) : undefined;
    return { ...view(t), result: 'created', ...(others ? { open_for_entity: others } : {}) };
  },
  async patch(id, body: PatchBody) {
    await sleep();
    const t = find(id);
    const fields: string[] = [];
    if (body.title !== undefined && body.title !== t.title) { t.title = body.title.trim(); fields.push('title'); }
    if (body.description !== undefined && body.description !== t.description) { t.description = body.description.trim(); fields.push('description'); }
    if (body.department_id && body.department_id !== t.department?.id) {
      const d = departments.find((x) => x.id === body.department_id)!;
      t.department = { id: d.id, key: d.key, name: d.name, icon: null, color: null };
      fields.push('department_id');
    }
    const dept = departments.find((d) => d.id === t.department?.id)!;
    if (body.category_id !== undefined) { const c = dept.categories.find((x) => x.id === body.category_id); t.category = c ? { id: c.id, name: c.name } : null; fields.push('category_id'); }
    if (body.priority_id) { const p = dept.priorities.find((x) => x.id === body.priority_id); if (p) { t.priority = { id: p.id, key: p.key, name: p.name, rank: p.rank, severity: p.severity }; fields.push('priority_id'); } }
    if (fields.length) {
      t.events.push(ev('edited', new Date().toISOString(), { ...ME, me: true }, { data: { fields } }));
      touch(t);
    }
    return view(t);
  },
  async status(id, body: StatusBody) {
    await sleep();
    const t = find(id);
    const frm = t.status;
    t.status = body.to;
    const now = new Date().toISOString();
    if (body.to === 'closed' || body.to === 'cancelled') { t.closed_at = now; t.close_note = body.note ?? null; t.closed_by_name = ME.name; t.assignee = null; }
    if (frm === 'closed' && body.to === 'new') { t.closed_at = null; t.reopen_count += 1; }
    const kind = body.to === 'closed' ? 'closed' : body.to === 'cancelled' ? 'cancelled' : frm === 'closed' ? 'reopened' : 'status';
    const dup = body.duplicate_of ? tickets.find((x) => x.id === body.duplicate_of) : null;
    if (dup) t.duplicate_of = { id: dup.id, number: dup.number };
    t.events.push(ev(kind, now, { ...ME, me: true }, { from: frm, to: body.to, body: body.note ?? null, data: dup ? { duplicate_of: { id: dup.id, number: dup.number } } : {} }));
    t.waiting_on = HANDLING.includes(body.to) ? 'assignee' : body.to === 'closed' || body.to === 'cancelled' ? 'none' : 'manager';
    touch(t);
    return view(t);
  },
  async assign(id, body: AssignBody) {
    await sleep();
    const t = find(id);
    const who = PEOPLE.find((p) => p.id === body.assignee.id) ?? PEOPLE[1];
    const now = new Date().toISOString();
    const previous = t.assignee?.name;
    t.events.push(ev(previous ? 'reassigned' : 'assigned', now, { ...ME, me: true }, { from: t.status, to: 'assigned', data: { assignee: who.name, assignee_kind: 'user', ...(previous ? { previous } : {}) } }));
    if (body.note) t.events.push(ev('note', now, { ...ME, me: true }, { body: body.note, external: body.note_external !== false }));
    t.assignee = { kind: 'user', id: who.id, name: who.name, since: now, acknowledged_at: null };
    t.status = 'assigned';
    t.waiting_on = 'assignee';
    t.closed_at = null;
    touch(t);
    return view(t);
  },
  async giveBack(id, body: ReturnBody): Promise<ReturnAnswer> {
    await sleep();
    const t = find(id);
    t.events.push(ev('returned', new Date().toISOString(), { ...ME, me: true }, { from: t.status, to: 'returned', body: body.reason, data: { kind: body.kind }, external: true }));
    t.last_assignee_name = t.assignee?.name ?? null;
    t.assignee = null;
    t.status = 'returned';
    t.waiting_on = 'manager';
    touch(t);
    return view(t);
  },
  async note(id, text, external) {
    await sleep();
    const t = find(id);
    t.events.push(ev('note', new Date().toISOString(), { ...ME, me: true }, { body: text, external }));
    t.last_activity_at = new Date().toISOString();
    return view(t);
  },
  async eta(id, etaAt) {
    await sleep();
    const t = find(id);
    t.eta_at = etaAt;
    t.events.push(ev('eta', new Date().toISOString(), { ...ME, me: true }, { data: { eta_at: etaAt } }));
    touch(t);
    return view(t);
  },
  async upload(id, file, external) {
    await sleep(300);
    const t = find(id);
    const att = { id: nid(), at: new Date().toISOString(), width: 0, height: 0, bytes: file.size, external, mine: true, can_delete: true, url: URL.createObjectURL(file) };
    t.attachments.push(att);
    t.events.push(ev('photo', att.at, { ...ME, me: true }, { data: { attachment_id: att.id }, external }));
    return view(t);
  },
  async removePhoto(id, attachmentId) {
    await sleep();
    const t = find(id);
    t.attachments = t.attachments.filter((a) => a.id !== attachmentId);
    t.events.push(ev('photo_removed', new Date().toISOString(), { ...ME, me: true }, { data: { attachment_id: attachmentId } }));
    return view(t);
  },
  photoUrl: (att) => att.url,
  async assignees(departmentId): Promise<{ users: Eligible[] }> {
    await sleep(60);
    const d = departments.find((x) => x.id === departmentId);
    return { users: (d?.members ?? []).filter((m) => m.kind === 'user').map((m) => ({ kind: 'user', id: m.id, name: m.name, member_role: m.role })) };
  },
  async settings(): Promise<SettingsDoc> {
    await sleep(40);
    return { revision: settingsRevision, ui: { ...ui }, device_long_press: longPress };
  },
  async saveSettings(_revision, patch, extra = {}) {
    await sleep(80);
    ui = { ...ui, ...patch };
    if (extra.device_long_press) longPress = extra.device_long_press;
    settingsRevision += 1;
    return { revision: settingsRevision, ui: { ...ui }, device_long_press: longPress };
  },
  async byEntity(entityId: string): Promise<EntityTickets> {
    // slice 3, the demo store: the device's tickets by entity id, and a synthetic history preview (no person names)
    await sleep(60);
    const rows = tickets.filter((t) => t.entity_id === entityId).sort((a, b) => Number(FINAL_STATUSES.includes(a.status)) - Number(FINAL_STATUSES.includes(b.status)) || b.created_at.localeCompare(a.created_at));
    const items = rows.map((t) => { const { description, events: _e, attachments: _a, close_note: _c, closed_by_name: _n, duplicate_of: _d, reopen_until: _u, can: _x, transitions: _t, assignments: _s, device_context: _dc, ...item } = clone(t); return { ...item, excerpt: description.slice(0, 240) }; });
    const domain = entityId.split('.')[0];
    return {
      entity: { entity_id: entityId, name: rows[0]?.device_name || entityId, domain, tracked: TRACKED.includes(domain) },
      items, open_count: rows.filter((t) => !FINAL_STATUSES.includes(t.status)).length, can_create: true, place_text: rows[0]?.place_text ?? '', history: demoHistory(),
    };
  },
  async saveName(_revision, entries) {
    await sleep(80);
    names = { ...names, ...clone(entries), revision: names.revision + 1 };
    return clone(names);
  },
  async departments() {
    await sleep(60);
    deptCounts();
    return { departments: clone(departments), all_departments: true };
  },
  async createDepartment(body: DepartmentBody) {
    await sleep(80);
    const id = `dept-${body.key ?? nid()}`;
    const d: AdminDepartment = {
      id, key: body.key ?? id, name: body.name ?? '', description: '', icon: null, color: null, sort_order: departments.length, active: true, open_to_all: body.open_to_all ?? true,
      reopen_days: 14, revision: 1, open_tickets: 0, categories: [], priorities: prios(id), members: [], can_edit_members: true,
    };
    departments.push(d);
    return clone(d);
  },
  async patchDepartment(id, body) {
    await sleep(80);
    const d = departments.find((x) => x.id === id)!;
    Object.assign(d, Object.fromEntries(Object.entries(body).filter(([k, v]) => k !== 'revision' && v !== undefined)));
    d.revision += 1;
    return clone(d);
  },
  async deleteDepartment(id) {
    await sleep(80);
    const i = departments.findIndex((x) => x.id === id);
    if (i >= 0) departments.splice(i, 1);
  },
  async createCategory(departmentId, name) {
    await sleep(60);
    const d = departments.find((x) => x.id === departmentId)!;
    d.categories.push({ id: nid(), name, parent_id: null, default_priority_id: null, sort_order: d.categories.length, active: true });
    return clone(d);
  },
  async patchCategory(id, body) {
    await sleep(60);
    const d = departments.find((x) => x.categories.some((c) => c.id === id))!;
    Object.assign(d.categories.find((c) => c.id === id)!, body);
    return clone(d);
  },
  async deleteCategory(id) {
    await sleep(60);
    const d = departments.find((x) => x.categories.some((c) => c.id === id))!;
    d.categories = d.categories.filter((c) => c.id !== id);
    return clone(d);
  },
  async patchPriority(id, body) {
    await sleep(60);
    const d = departments.find((x) => x.priorities.some((p) => p.id === id))!;
    if (body.is_default) for (const p of d.priorities) p.is_default = p.id === id;
    Object.assign(d.priorities.find((p) => p.id === id)!, { ...body, is_default: body.is_default ?? d.priorities.find((p) => p.id === id)!.is_default });
    return clone(d);
  },
  async putMember(departmentId, kind, subjectId, role) {
    await sleep(60);
    const d = departments.find((x) => x.id === departmentId)!;
    const m = d.members.find((x) => x.kind === kind && x.id === subjectId);
    if (m) m.role = role;
    else d.members.push({ kind, id: subjectId, name: PEOPLE.find((p) => p.id === subjectId)?.name ?? subjectId, role, notify_new: false, added_at: new Date().toISOString() });
    return clone(d);
  },
  async deleteMember(departmentId, kind, subjectId) {
    await sleep(60);
    const d = departments.find((x) => x.id === departmentId)!;
    d.members = d.members.filter((x) => !(x.kind === kind && x.id === subjectId));
    return clone(d);
  },
  async directory(q = '') {
    await sleep(40);
    const n = q.trim();
    return { users: PEOPLE.filter((p) => !n || p.name.includes(n)), groups: [{ id: 'g-tech', name: 'טכנאים' }].filter((g) => !n || g.name.includes(n)) };
  },
  async holders(): Promise<HoldersResponse> {
    await sleep(60);
    const grant = (bid: string, role: string, roleName: string, perms: string[], via: 'role' | 'grant') => ({
      binding_id: bid, permissions: perms, via, role_id: role, role_name: roleName, group_name: null, scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה',
      effect: 'allow' as const, expires_at: null,
    });
    return {
      users: [
        { id: 'demo', name: ME.name, active: true, grants: [grant('b1', 'system_admin', 'מנהל מערכת', ['tickets.view', 'tickets.create', 'tickets.manage', 'tickets.external', 'tickets.all_departments', 'tickets.configure'], 'role')] },
        { id: 'u-avi', name: 'אבי כהן', active: true, grants: [grant('b2', 'operator', 'מפעיל', ['tickets.view', 'tickets.create'], 'role')] },
        { id: 'u-dana', name: 'דנה לוי', active: true, grants: [grant('b3', 'tickets_manage', 'ניהול', ['tickets.manage'], 'grant')] },
      ],
      grant_roles: ['tickets_view', 'tickets_create', 'tickets_manage', 'tickets_all_departments', 'tickets_external', 'tickets_configure'],
    };
  },
};
