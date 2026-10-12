import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Route, WebSocketRoute } from '@playwright/test';

// CR-036 S7: a STATEFUL mocked backend (page.route on api/v1) for the native people screen. It answers like the typed reads of
// routers/access_control_reads.py (the real rules are the backend tests: tests/test_intercom_people_s7.py and
// tests/test_intercom_adapter.py) - level by level: a names-level caller gets no credentials, no phone flag and no photo, a list
// row never carries the phone / profile / timing, the employee number follows `employeeNoVisible`, a station-scoped caller sees
// only the people of their stations - and, for the message dialog, it is the EXECUTABLE form of the DRAFT messaging contract
// (api/messaging-fake.ts): the real backend has no message route (WisKey ask W11 is open); nothing here can reach a phone.
// Everything is invented: an office building, its stations, its people, numbers in the documentation range. No lab value.

export const ADMIN = ['access.read', 'access.stations.read', 'access.events.read', 'access.events.export', 'access.people.read', 'access.people.sensitive', 'access.people.manage', 'access.cards.capture', 'access.call', 'access.admin.read', 'system.configure'];
export const OPERATOR = ['access.read', 'access.stations.read', 'access.events.read', 'access.people.read', 'access.call'];
export const VIEWER = ['access.read'];
export type Role = 'admin' | 'operator' | 'viewer' | 'scoped';

export interface RawPerson {
  id: string;
  display_name: string;
  employee_no: string;
  active: boolean;
  archived?: boolean;
  valid_from: string | null;
  valid_until: string | null;
  revision: number;
  access_category: 'staff' | 'visitor' | 'contractor';
  group_ids: string[];
  stations: { station_id: string; enabled: boolean; doors: number[]; sync_state: string; last_error?: string | null }[];
  timing: { mode: 'weekly' | 'dates'; timezone: string; days: string[]; dates: string[]; periods: { start: string; end: string }[]; enforcement: 'ha' | 'native' } | null;
  phone: string;
  pin: boolean;
  cards: number;
  photo: boolean;
  profile: Record<string, string>;
  responsible_person?: string;
  access_purpose?: string;
  whatsapp_consent?: 'granted' | 'declined' | 'unknown';
}

const st = (station_id: string, sync_state = 'synced', enabled = true, doors = [1], last_error: string | null = null) => ({ station_id, enabled, doors, sync_state, last_error });
const person = (id: string, display_name: string, employee_no: string, o: Partial<RawPerson>): RawPerson => ({
  id, display_name, employee_no, active: true, valid_from: null, valid_until: null, revision: 1, access_category: 'staff', group_ids: [], stations: [], timing: null,
  phone: '', pin: false, cards: 0, photo: false, profile: {}, ...o,
});

export const STATIONS = [
  { id: 'gate', name: 'שער ראשי', online: true },
  { id: 'lobby', name: 'לובי', online: true },
  { id: 'park', name: 'חניון', online: true },
  { id: 'lab', name: 'מעבדה', online: true },
  { id: 'store', name: 'מחסן', online: false },
  { id: 'mgmt', name: 'הנהלה', online: true },
];
export const GROUPS = [
  { id: 'staff', label: 'עובדים', enabled: true, station_ids: ['gate', 'lobby', 'lab'] },
  { id: 'lab', label: 'מעבדה', enabled: true, station_ids: ['lab'] },
  { id: 'board', label: 'הנהלה', enabled: true, station_ids: ['gate', 'lobby', 'mgmt', 'lab'] },
  { id: 'contractors', label: 'קבלנים', enabled: true, station_ids: ['park', 'store'] },
  { id: 'cleaning', label: 'ניקיון', enabled: true, station_ids: ['lobby', 'store'] },
  { id: 'guests', label: 'אורחים', enabled: true, station_ids: ['lobby'] },
];
export const FIELDS = [
  { id: 'department', label: 'מחלקה', enabled: true, type: 'select', required: false, unique: false, options: ['הנדסה', 'אבטחה', 'תפעול'] },
  { id: 'badge', label: 'מספר תג', enabled: true, type: 'text', required: false, unique: true, options: [] },
];

export function directory(): RawPerson[] {
  const weekdays = { mode: 'weekly' as const, timezone: 'Asia/Jerusalem', days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'], dates: [], periods: [{ start: '08:00', end: '17:00' }], enforcement: 'native' as const };
  return [
    person('p1', 'דנה כהן', '1001', { group_ids: ['staff', 'lab'], stations: [st('gate'), st('lobby'), st('lab')], timing: weekdays, phone: '050-000-0001', pin: true, cards: 1, photo: true, profile: { department: 'הנדסה', badge: 'A-17' }, access_purpose: 'עבודה במעבדה' }),
    person('p2', 'יוסי לוי', '1002', { group_ids: ['staff'], stations: [st('gate'), st('lobby', 'pending')], valid_from: '2026-01-01T00:00:00+02:00', valid_until: '2027-12-31T00:00:00+02:00', phone: '050-000-0002', pin: false, cards: 1, profile: { department: 'תפעול' } }),
    person('p3', 'מיכל אברהם', '1003', { group_ids: ['board'], stations: [st('gate'), st('lobby'), st('mgmt', 'error', true, [1], 'device_unavailable'), st('lab')], phone: '050-000-0003', pin: true, cards: 2, photo: true, profile: { department: 'הנדסה' }, responsible_person: 'רונית גל' }),
    person('p4', 'אורי שמש', 'ק-204', { access_category: 'contractor', group_ids: ['contractors'], stations: [st('park'), st('store', 'offline')], valid_from: '2026-05-01T00:00:00+03:00', valid_until: '2026-11-15T00:00:00+02:00', phone: '052-000-0004', pin: true, cards: 0, profile: { department: 'תפעול' }, whatsapp_consent: 'declined' }),
    person('p5', 'נועה בר', '1005', { group_ids: ['staff', 'lab'], stations: [st('lobby'), st('lab')], valid_from: '2026-01-01T00:00:00+02:00', valid_until: '2026-10-30T00:00:00+02:00', phone: '', pin: false, cards: 1, profile: {} }),
    person('p6', 'אלי פרץ', 'נ-17', { active: false, group_ids: ['cleaning'], stations: [st('lobby', 'synced', false), st('store', 'synced', false)], phone: '050-000-0006', pin: false, cards: 1 }),
    person('p7', 'רונית גל', '1007', { group_ids: ['board'], stations: [st('gate'), st('lobby'), st('mgmt')], phone: '050-000-0007', pin: true, cards: 1, photo: false, profile: { department: 'אבטחה' } }),
    person('p8', 'תומר אדר', 'א-311', { access_category: 'visitor', group_ids: ['guests'], stations: [st('lobby')], valid_from: '2026-10-12T00:00:00+03:00', valid_until: '2026-10-13T00:00:00+03:00', phone: '050-000-0008', pin: true, cards: 0 }),
    person('p9', 'שירה מזרחי', '1009', { group_ids: ['staff'], stations: [], valid_from: '2026-11-01T00:00:00+02:00', valid_until: '2027-11-01T00:00:00+02:00', phone: '050-000-0009', pin: false, cards: 0 }),
    person('p10', 'עומר דהן', '1010', { archived: true, active: false, group_ids: ['staff'], stations: [st('gate', 'synced', false)], phone: '050-000-0010' }),
  ];
}

/** `n` more invented people (ids x1..xn, employee numbers from 2000), for the checks that need a directory longer than a screen. */
export function extraPeople(n: number): RawPerson[] {
  return Array.from({ length: n }, (_, i) =>
    person(`x${i + 1}`, `עובד ${i + 1}`, String(2000 + i), {
      group_ids: ['staff'], stations: [st('gate'), st('lobby')], phone: i % 5 === 4 ? '' : `050-001-${1000 + i}`, pin: i % 2 === 0, cards: 1,
    }));
}

export type ReadMode = 'ready' | 'empty' | 'error' | 'unavailable' | 'unsupported' | 'connecting' | 'forbidden' | 'down_after_ready';
export type MsgMode = 'ok' | 'rate' | 'not_registered' | 'uncertain' | 'service_down' | 'slow' | 'expired';

export interface PeopleMock {
  role: Role;
  /** The stations a `scoped` caller holds people.read on. */
  scope: string[];
  employeeNoVisible: boolean;
  people: RawPerson[];
  mode: ReadMode;
  /** A delay (ms) before the people list answers - lets a spec look at the loading state. */
  delay: number;
  /** The next "load more" answers `stale: true`, and the directory the snapshot belonged to is gone. */
  stale: boolean;
  incomplete: 'rate_limited' | 'scan_limit' | null;
  detail: 'ok' | 'gone' | 'failed' | 'slow';
  photo: 'ok' | 'missing' | 'forbidden' | 'down';
  photoEnabled: boolean;
  /** Page size the list answers with at most (the screen asks for 50; a spec lowers it to see the paging). */
  pageCap: number;
  messaging: boolean;
  msg: { mode: MsgMode; enabled: boolean; freeText: boolean; bulkMax: number; quota: { limit: number; used: number } | null; credentialTemplate: boolean };
  hits: string[];
  writes: { path: string; body: unknown }[];
  revision: number;
  /** The change-notice sockets the screen opened (intercom/ws): `push(st)` sends WisKey's data-free refresh notice on each. */
  sockets: WebSocketRoute[];
  /** A message can-send override (null = by the sensitive permission): a sender who may not see phone numbers (hidden-phone mode). */
  canSend: boolean | null;
}

export function newMock(role: Role = 'admin'): PeopleMock {
  return {
    role, scope: ['gate', 'lobby'], employeeNoVisible: true, people: directory(), mode: 'ready', delay: 0, stale: false, incomplete: null, detail: 'ok', photo: 'ok', photoEnabled: true,
    pageCap: 50, messaging: false, msg: { mode: 'ok', enabled: true, freeText: true, bulkMax: 10, quota: { limit: 6, used: 1 }, credentialTemplate: false }, hits: [], writes: [], revision: 1, sockets: [], canSend: null,
  };
}

const permsOf = (st: PeopleMock): { installation: string[]; any: string[] } => {
  if (st.role === 'admin') return { installation: ADMIN, any: ADMIN };
  if (st.role === 'operator') return { installation: OPERATOR, any: OPERATOR };
  if (st.role === 'viewer') return { installation: VIEWER, any: VIEWER };
  return { installation: ['access.read'], any: OPERATOR }; // a station-scoped operator: the new permissions below installation scope
};
const sensitiveLevel = (st: PeopleMock) => st.role === 'admin';
const err = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: '', details });
const here = path.dirname(fileURLToPath(import.meta.url));
let photoBytes: Buffer | null = null;
function photo(): Buffer {
  if (!photoBytes) {
    const data = JSON.parse(readFileSync(path.resolve(here, '../../smplwise_vms/backend/tests/fixtures/wiskey_rc37/users_photo_get.json'), 'utf8')) as { photo: string };
    photoBytes = Buffer.from(data.photo.split(',')[1], 'base64');
  }
  return photoBytes;
}

const visibleStations = (st: PeopleMock, p: RawPerson) => (st.role === 'scoped' ? p.stations.filter((s) => st.scope.includes(s.station_id)) : p.stations);

/** A person as the server would build the caller's copy (intercom_authority.view_person). */
export function view(st: PeopleMock, p: RawPerson, detail: boolean): Record<string, unknown> | null {
  const stations = visibleStations(st, p);
  if (st.role === 'scoped' && stations.length === 0) return null; // a person with no station the caller sees is not theirs
  const sensitive = sensitiveLevel(st);
  const out: Record<string, unknown> = {
    id: p.id, display_name: p.display_name, active: p.active, archived: !!p.archived, valid_from: p.valid_from, valid_until: p.valid_until, revision: p.revision,
    access_category: p.access_category, user_type: 'normal', identity_locked: false,
    employee_no: st.employeeNoVisible || sensitive ? p.employee_no : null,
    group_ids: p.group_ids,
    stations: stations.map((s) => ({ station_id: s.station_id, enabled: s.enabled, doors: s.doors, sync_state: s.sync_state, last_sync_at: null, last_error: st.role === 'admin' ? (s.last_error ?? null) : null })),
    timing: detail ? p.timing : null,
    level: sensitive ? 'sensitive' : 'names', editable: st.role === 'admin',
    phone: sensitive && detail ? p.phone || null : null, phone_set: sensitive ? !!p.phone : null,
    credentials: sensitive ? { pin: p.pin, cards: p.cards } : null,
    photo_configured: sensitive && detail ? p.photo : null,
    profile: sensitive && detail ? p.profile : null,
    responsible_person: sensitive && detail ? p.responsible_person ?? '' : null,
    access_purpose: sensitive && detail ? p.access_purpose ?? '' : null,
  };
  return out;
}

const stateOf = (p: RawPerson, now: number) => {
  const from = p.valid_from ? Date.parse(p.valid_from) : null;
  const until = p.valid_until ? Date.parse(p.valid_until) : null;
  return { expired: until !== null && until <= now, upcoming: from !== null && from > now };
};

/** The typed list as the server answers it: filters, the Arx-side text search, the sort, the paging with its snapshot. */
function listPeople(st: PeopleMock, q: URLSearchParams) {
  const now = Date.parse('2026-10-12T10:00:00Z');
  const sensitive = sensitiveLevel(st);
  const needle = (q.get('query') ?? '').trim().toLowerCase();
  const state = q.get('state') ?? '';
  const rights = q.get('rights') ?? '';
  const station = q.get('station') ?? '';
  const group = q.get('group') ?? '';
  const credential = q.get('credential') ?? '';
  const profile = q.getAll('profile').map((x) => [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1)] as const);
  let rows = st.people.filter((p) => {
    if (!!p.archived !== (state === 'archived')) return false;
    if (st.role === 'scoped' && visibleStations(st, p).length === 0) return false;
    const stations = visibleStations(st, p);
    if (group && !p.group_ids.includes(group)) return false;
    if (station && !stations.some((s) => s.station_id === station)) return false;
    if (rights === 'assigned' && !stations.some((s) => s.enabled)) return false;
    if (rights === 'unassigned' && stations.length) return false;
    if (rights === 'disabled' && !stations.some((s) => !s.enabled)) return false;
    if (state === 'active' && !p.active) return false;
    if (state === 'inactive' && p.active) return false;
    const w = stateOf(p, now);
    if (state === 'expired' && !w.expired) return false;
    if (state === 'upcoming' && !w.upcoming) return false;
    if (credential) {
      if (!sensitive) return false; // the server answers 403 before; a names-level caller never matches
      if ((credential === 'pin' && !p.pin) || (credential === 'no_pin' && p.pin) || (credential === 'card' && p.cards === 0) || (credential === 'no_card' && p.cards > 0)) return false;
    }
    if (profile.length && (!sensitive || profile.some(([k, v]) => p.profile[k] !== v))) return false;
    if (needle) {
      const hay = `${p.display_name} ${st.employeeNoVisible || sensitive ? p.employee_no : ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const wanted = q.get('sort') ?? (st.employeeNoVisible || sensitive ? 'employee' : 'name');
  const sort = wanted === 'employee' && !(st.employeeNoVisible || sensitive) ? 'name' : wanted;
  rows = [...rows].sort((a, b) => (sort === 'employee' ? a.employee_no.localeCompare(b.employee_no, 'he', { numeric: true }) : a.display_name.localeCompare(b.display_name, 'he')) * (sort === 'name_desc' ? -1 : 1));
  const limit = Math.min(Number(q.get('limit') ?? 50), st.pageCap);
  let offset = Number(q.get('offset') ?? 0);
  const total = rows.length;
  if (offset >= total) offset = total ? Math.floor((total - 1) / limit) * limit : 0;
  const snapshot = `snap-${st.revision}-${rows.length}`;
  const given = q.get('snapshot');
  const page = rows.slice(offset, offset + limit).map((p) => view(st, p, false)!);
  return {
    records: page, total, total_all: st.role === 'scoped' ? null : st.people.filter((p) => !p.archived).length, offset, limit,
    next_offset: offset + limit < total ? offset + limit : null, previous_offset: offset > 0 ? Math.max(0, offset - limit) : null, snapshot,
    stale: st.stale || (!!given && given !== snapshot), complete: st.incomplete === null, incomplete_reason: st.incomplete, sort, employee_no_visible: st.employeeNoVisible || sensitive,
  };
}

const m_canSend = (st: PeopleMock, perms: string[]) => st.canSend ?? perms.includes('access.people.sensitive');
const head = (state: string, last_error: string | null = null) => ({ state, configured: state !== 'ha_not_configured', last_error, fetched_at: '2026-10-12T09:59:30Z', sync: { state: 'ready', connected: true } });

/** The draft messaging contract's server: eligibility, the quota, the outcomes a spec asks for. */
function messaging(st: PeopleMock, p: string, body: unknown, json: (b: unknown, s?: number) => Promise<void>): Promise<void> | null {
  const m = st.msg;
  const perms = permsOf(st).any;
  const canSend = m_canSend(st, perms);
  if (p === 'access-control/messaging') {
    return json({
      ...head('ready'),
      messaging: {
        enabled: m.enabled, can_send: canSend, can_reveal_phone: sensitiveLevel(st), free_text: m.freeText, bulk_max: m.bulkMax, text_max: 1000,
        templates: [
          { id: 'card_ready', label: 'כרטיס מוכן', body: 'שלום {name}, כרטיס הכניסה שלך מוכן לאיסוף במשרד.' },
          { id: 'validity_reminder', label: 'תזכורת תוקף', body: 'שלום {name}, תוקף הכניסה שלך מסתיים בקרוב. נא לפנות למשרד.' },
          { id: 'closure', label: 'הכניסה סגורה', body: 'שלום {name}, הכניסה לחניון סגורה היום בין 12:00 ל־14:00.' },
          ...(m.credentialTemplate ? [{ id: 'bad', label: 'עם קוד', body: 'הקוד שלך הוא {pin}' }] : []),
        ],
        quota: m.quota ? { ...m.quota, resets_in_s: 840 } : null,
      },
    });
  }
  if (p === 'access-control/messaging/recipients') {
    const ids = ((body as { person_ids?: string[] })?.person_ids ?? []) as string[];
    return json({
      recipients: ids.map((id) => {
        const r = st.people.find((x) => x.id === id);
        const phone = r?.phone ?? '';
        const digits = phone.replace(/\D/g, '');
        return {
          person_id: id, name: r?.display_name ?? id, phone_masked: phone && sensitiveLevel(st) ? `${'•'.repeat(Math.max(3, digits.length - 2))}${digits.slice(-2)}` : null, has_phone: !!phone,
          consent: r?.whatsapp_consent ?? 'granted',
        };
      }),
    });
  }
  const send = /^access-control\/people\/([^/]+)\/messages$/.exec(p);
  if (send) {
    const r = st.people.find((x) => x.id === send[1]);
    const b = body as { text?: string; confirmed?: boolean };
    st.writes.push({ path: p, body });
    if (!r || !r.phone) return json(err('message_no_phone', 'אין מספר טלפון.'), 422);
    if (r.whatsapp_consent === 'declined') return json(err('message_no_consent', 'האדם ביקש לא לקבל הודעות.'), 409);
    if (b.confirmed !== true || !b.text?.trim()) return json(err('message_forbidden_content', 'ההודעה אינה תקינה.'), 422);
    if (m.mode === 'service_down') return json(err('message_service_unavailable', 'שירות ההודעות אינו מחובר.'), 503);
    if (m.mode === 'rate' || (m.quota && m.quota.used >= m.quota.limit)) return json(err('message_rate_limited', 'המכסה מלאה.', { retry_after_s: 840 }), 429);
    if (m.mode === 'not_registered') return json(err('message_not_registered', 'המספר אינו רשום.'), 502);
    if (m.mode === 'uncertain') return json(err('message_uncertain', 'לא ידוע.'), 504);
    if (m.mode === 'expired') return json(err('message_expired', 'פג.'), 410);
    if (m.quota) m.quota.used += 1;
    return json({ sent_at: '2026-10-12T10:00:00Z' });
  }
  return null;
}

export async function install(page: Page, st: PeopleMock) {
  await page.routeWebSocket(/\/api\/v1\/intercom\/ws/, (ws) => {
    st.sockets.push(ws);
  });
  await page.routeWebSocket(/\/api\/v1\/(ha|me)\/ws/, () => {});
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const method = req.method();
    st.hits.push(`${method} ${p}${url.search}`);
    const perms = permsOf(st);
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms.installation, permissions_any: perms.any, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {}, 'access.ui.people': 'smplwise', 'access.ui.overview': 'smplwise', 'access.ui.events': 'smplwise' }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-12T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 0, cameras_last_ok: null, cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'cameras') return json({ cameras: [], recorder: null, can_sync: false });
    if (!p.startsWith('access-control/')) return json(err('not_found', 'לא נמצא (בדיקה)'), 404);

    // ---- the typed reads
    const feedState = st.mode === 'unavailable' ? 'ha_unavailable' : st.mode === 'connecting' ? 'connecting' : st.mode === 'error' ? 'error' : 'ready';
    if (p === 'access-control/features') {
      return json({ ...head('ready'), client_api: 1, api: { version: 1, min_client: 1 }, features: { people: { available: st.mode !== 'unsupported', reason: null }, person: { available: true, reason: null }, person_photo: { available: st.photoEnabled, reason: null }, groups: { available: true, reason: null }, ...(st.messaging ? { messaging: { available: true, reason: null } } : {}) } });
    }
    if (p === 'access-control/stations') return json({ ...head('ready'), fresh: true, stations: st.role === 'scoped' ? STATIONS.filter((s) => st.scope.includes(s.id)) : STATIONS, default_zone: { kind: 'iana', name: 'Asia/Jerusalem' } });
    if (p === 'access-control/groups') {
      const groups = st.role === 'scoped' ? GROUPS.filter((g) => g.station_ids.every((s) => st.scope.includes(s))) : GROUPS;
      return json({ ...head('ready'), fresh: true, groups: { revision: 7, photo_enabled: st.photoEnabled, groups, fields: sensitiveLevel(st) ? FIELDS : null } });
    }
    const forbidden = () => json(err('forbidden', 'אין הרשאה לפעולה הזו.'), 403);
    if (!perms.any.includes('access.people.read') && /^access-control\/(people|groups)/.test(p)) return forbidden();
    const msg = messaging(st, p, req.postDataJSON(), json);
    if (msg) return msg;
    if (p === 'access-control/people') {
      if (st.delay) await new Promise((r) => setTimeout(r, st.delay));
      if (st.mode === 'forbidden') return forbidden();
      if (st.mode === 'unsupported') return json({ ...head('unsupported', 'not_listed'), people: null });
      if (st.mode === 'connecting') return json({ ...head('connecting'), people: null });
      if (st.mode === 'unavailable') return json({ ...head('ha_unavailable', 'ha_unreachable'), people: null });
      if (st.mode === 'error') return json({ ...head('error', 'rate_limited'), people: null });
      if (url.searchParams.get('credential') || url.searchParams.get('profile')) {
        if (!perms.any.includes('access.people.sensitive')) return forbidden();
      }
      if (st.mode === 'empty') return json({ ...head('ready'), people: { records: [], total: 0, total_all: 0, offset: 0, limit: 50, next_offset: null, previous_offset: null, snapshot: '', stale: false, complete: true, incomplete_reason: null, sort: 'employee', employee_no_visible: true } });
      if (st.mode === 'down_after_ready' && st.hits.filter((h) => h.startsWith('GET access-control/people?')).length > 1) return json({ ...head('ha_unavailable', 'ha_unreachable'), people: null });
      return json({ ...head(feedState), people: listPeople(st, url.searchParams) });
    }
    const one = /^access-control\/people\/([^/]+)(\/photo)?$/.exec(p);
    if (one) {
      const raw = st.people.find((x) => x.id === decodeURIComponent(one[1]));
      if (one[2]) {
        if (!sensitiveLevel(st) || st.photo === 'forbidden') return forbidden();
        if (st.photo === 'down') return json(err('intercom_unavailable', 'בקרת הכניסה אינה זמינה כרגע.'), 503);
        if (st.photo === 'missing' || !raw?.photo) return json(err('intercom_photo_not_found', 'אין תמונה.'), 404);
        st.writes.push({ path: p, body: null }); // one audit row per view on the server
        return route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'Cache-Control': 'private, no-store' }, body: photo() });
      }
      if (st.detail === 'slow') await new Promise((r) => setTimeout(r, 1500));
      if (st.detail === 'gone' || !raw) return json(err('intercom_person_not_found', 'האדם לא נמצא.'), 404);
      if (st.detail === 'failed') return json(err('intercom_unavailable', 'בקרת הכניסה אינה זמינה כרגע.'), 503);
      const v = view(st, raw, true);
      return v ? json({ ...head('ready'), person: v }) : json(err('intercom_person_not_found', 'האדם לא נמצא.'), 404);
    }
    return json(err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

/** WisKey's data-free refresh notice, as the add-on's feed relays it, on every socket the screen opened. */
export function push(st: PeopleMock): void {
  for (const ws of st.sockets) ws.send(JSON.stringify({ type: 'intercom_refresh', payload: {} }));
}
