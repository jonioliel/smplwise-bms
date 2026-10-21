import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Route, WebSocketRoute } from '@playwright/test';

// CR-036 S7: a STATEFUL mocked backend (page.route on api/v1) for the native people screen. It answers like the typed reads of
// routers/access_control_reads.py (the real rules are the backend tests: tests/test_intercom_people_s7.py and
// tests/test_intercom_adapter.py) - level by level: a names-level caller gets no credentials, no phone flag and no photo, a list
// row never carries the phone / profile / timing, the employee number follows `employeeNoVisible`, a station-scoped caller sees
// only the people of their stations - and, for the message dialog, the message routes of routers/access_control_messaging.py (CR-036 WA):
// the reply shapes come from tests/fixtures/messaging_wire.json, which the backend test test_intercom_messaging.py checks against the REAL routes
// (so this mock cannot drift); the rules (consent, the allowance, the template revision, the outcomes) are the backend tests'. Nothing here can
// reach a phone: the WisKey side of the messaging (ask W11) is unanswered and has only run against a fake.
// Everything is invented: an office building, its stations, its people, numbers in the documentation range. No lab value.

export const ADMIN = ['access.read', 'access.stations.read', 'access.events.read', 'access.events.export', 'access.people.read', 'access.people.sensitive', 'access.people.manage', 'access.cards.capture', 'access.call', 'access.admin.read', 'system.configure'];
export const MESSAGE = 'access.people.message';
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
export type MsgMode = 'ok' | 'rate' | 'not_registered' | 'uncertain' | 'service_down' | 'slow' | 'expired' | 'template_changed' | 'forbidden' | 'gone';

export interface HistoryRow {
  id: string;
  at: string;
  by: string | null;
  kind: 'template' | 'free';
  template_id: string | null;
  template_label: string | null;
  outcome: 'sent' | 'refused' | 'unknown' | 'pending';
  reason: string | null;
  bulk: boolean;
}

/** The message routes' state: what the administrator set and what the next send does. */
export interface MsgState {
  /** How a send ends (`ok` by default). */
  mode: MsgMode;
  /** Per-person overrides of `mode` (a bulk run where one person fails). */
  failFor: Record<string, MsgMode>;
  /** The next N sends are refused with a burst rate limit ("wait a moment"), then they pass. */
  burst: number;
  /** The administrator's switch (`feature`), and whether the messaging service is connected (`enabled`). */
  feature: boolean;
  enabled: boolean;
  freeText: boolean;
  bulkMax: number;
  quota: { limit: number; used: number } | null;
  /** A faulty catalogue: one template with a credential placeholder (the dialog must not offer it). */
  credentialTemplate: boolean;
  templatesRevision: number;
  paceMs: number;
  /** null = by the sensitive level; false = hidden-phone mode, true = the masked number is shown. */
  revealPhone: boolean | null;
  /** Each send takes this long (to look at the "sending" state). */
  delayMs: number;
  history: Record<string, HistoryRow[]>;
  optOut: Record<string, { at: string; by: string }>;
  /** `GET people/{id}/messages` answers this status instead (403 | 404 | 503), to see the tab's states. */
  historyFails: 0 | 403 | 404 | 503;
}

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
  /** The caller holds `access.people.message` (the messaging itself is the administrator's: `msg.feature`). */
  messaging: boolean;
  msg: MsgState;
  hits: string[];
  writes: { path: string; body: unknown }[];
  revision: number;
  /** The change-notice sockets the screen opened (intercom/ws): `push(st)` sends WisKey's data-free refresh notice on each. */
  sockets: WebSocketRoute[];
  /** TESTDEBT3-295: how many typed people-list requests were fully ANSWERED (the request count in `hits` rises when it is sent). */
  answered: number;
}

export function newMock(role: Role = 'admin'): PeopleMock {
  return {
    role, scope: ['gate', 'lobby'], employeeNoVisible: true, people: directory(), mode: 'ready', delay: 0, stale: false, incomplete: null, detail: 'ok', photo: 'ok', photoEnabled: true,
    pageCap: 50, messaging: false, hits: [], writes: [], revision: 1, sockets: [], answered: 0,
    msg: {
      mode: 'ok', failFor: {}, burst: 0, feature: true, enabled: true, freeText: true, bulkMax: 10, quota: { limit: 6, used: 1 }, credentialTemplate: false, templatesRevision: 3,
      paceMs: 0, revealPhone: null, delayMs: 0, history: {}, optOut: {}, historyFails: 0,
    },
  };
}

const permsOf = (st: PeopleMock): { installation: string[]; any: string[] } => {
  const plus = (list: string[]) => (st.messaging ? [...list, MESSAGE] : list);
  if (st.role === 'admin') return { installation: plus(ADMIN), any: plus(ADMIN) };
  if (st.role === 'operator') return { installation: plus(OPERATOR), any: plus(OPERATOR) };
  if (st.role === 'viewer') return { installation: VIEWER, any: VIEWER };
  return { installation: ['access.read'], any: plus(OPERATOR) }; // a station-scoped operator: the new permissions below installation scope
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

const head = (state: string, last_error: string | null = null) => ({ state, configured: state !== 'ha_not_configured', last_error, fetched_at: '2026-10-12T09:59:30Z', sync: { state: 'ready', connected: true } });

const messagingWire = JSON.parse(readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'messaging_wire.json'), 'utf8')) as Record<string, any>;
const wireOf = (name: string): any => JSON.parse(JSON.stringify(messagingWire[name]));
const NOW_ISO = '2026-10-12T10:00:00Z';

const MSG_TEMPLATES = [
  { id: 'card_ready', label: 'כרטיס מוכן', body: 'שלום {name}, כרטיס הכניסה שלך מוכן לאיסוף במשרד.' },
  { id: 'validity_reminder', label: 'תזכורת תוקף', body: 'שלום {name}, תוקף הכניסה שלך מסתיים בקרוב. נא לפנות למשרד.' },
  { id: 'closure', label: 'הכניסה סגורה', body: 'שלום {name}, הכניסה לחניון סגורה היום בין 12:00 ל־14:00.' },
];

/** The effective consent of a person, as the server computes it: Arx's opt-out list, then what the messaging service keeps. */
const consentOf = (st: PeopleMock, p: RawPerson | undefined): 'granted' | 'declined' | 'unknown' =>
  p && (st.msg.optOut[p.id] || p.whatsapp_consent === 'declined') ? 'declined' : p?.whatsapp_consent === 'granted' ? 'granted' : 'unknown';

const maskOf = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length < 4 ? null : `${'•'.repeat(digits.length - 2)}${digits.slice(-2)}`;
};

/** The message routes: the dialog's configuration, the preview of a selection, a send, the history and the opt-out. */
async function messaging(st: PeopleMock, method: string, p: string, body: unknown, json: (b: unknown, s?: number) => Promise<void>): Promise<void | null> {
  const m = st.msg;
  const reveal = m.revealPhone ?? sensitiveLevel(st);
  const permitted = permsOf(st).any.includes(MESSAGE);
  if (!/^access-control\/(messaging|people\/[^/]+\/messages)/.test(p)) return null;
  if (!permitted) return json(err('forbidden', 'אין הרשאה לפעולה הזו.'), 403);

  if (p === 'access-control/messaging') {
    const wire = wireOf('config');
    const templates = [...MSG_TEMPLATES, ...(m.credentialTemplate ? [{ id: 'bad', label: 'עם קוד', body: 'הקוד שלך הוא {pin}' }] : [])];
    return json({
      ...wire,
      messaging: {
        ...wire.messaging, feature: m.feature, enabled: m.feature && m.enabled, can_send: m.feature, can_reveal_phone: sensitiveLevel(st), free_text: m.freeText, bulk_max: m.bulkMax,
        templates: m.feature ? templates : [], templates_revision: m.templatesRevision, quota: m.feature && m.quota ? { ...m.quota, resets_in_s: 840 } : null, pace_ms: m.paceMs,
      },
    });
  }
  if (p === 'access-control/messaging/recipients') {
    if (!m.feature) return json(err('message_disabled', 'שליחת הודעות כבויה בהגדרות.'), 409);
    const ids = [...new Set(((body as { person_ids?: string[] })?.person_ids ?? []) as string[])].slice(0, 6);
    const wire = wireOf('recipients');
    return json({
      ...wire,
      recipients: ids.flatMap((id) => {
        const r = st.people.find((x) => x.id === id);
        if (!r || (st.role === 'scoped' && visibleStations(st, r).length === 0)) return [];
        return [{ person_id: id, name: r.display_name, phone_masked: r.phone && reveal ? maskOf(r.phone) : null, has_phone: !!r.phone, consent: consentOf(st, r), allowed: true }];
      }),
    });
  }
  const one = /^access-control\/people\/([^/]+)\/messages(\/optout)?$/.exec(p);
  if (!one) return null;
  const id = decodeURIComponent(one[1]);
  const r = st.people.find((x) => x.id === id);
  if (!r || (st.role === 'scoped' && visibleStations(st, r).length === 0)) return json(err('intercom_person_not_found', 'האדם לא נמצא.'), 404);
  if (one[2]) {
    st.writes.push({ path: p, body });
    const to = (body as { opted_out?: boolean }).opted_out === true;
    if (to) m.optOut[id] = { at: NOW_ISO, by: 'בודק' };
    else delete m.optOut[id];
    return json({ opt_out: m.optOut[id] ?? null, consent: consentOf(st, r) });
  }
  if (method === 'GET') {
    if (m.historyFails === 403) return json(err('message_forbidden', 'אין לכם הרשאה לשלוח הודעה לאדם הזה.'), 403);
    if (m.historyFails === 404) return json(err('intercom_person_not_found', 'האדם לא נמצא.'), 404);
    if (m.historyFails === 503) return json(err('message_service_unavailable', 'שירות ההודעות אינו מחובר.'), 503);
    return json({ ...wireOf('history'), messages: m.history[id] ?? [], opt_out: m.optOut[id] ?? null, consent: consentOf(st, r) });
  }
  // ---- a send
  const b = body as { template_id?: string | null; templates_revision?: number; text?: string; confirmed?: boolean; bulk_id?: string };
  st.writes.push({ path: p, body });
  if (!m.feature) return json(err('message_disabled', 'שליחת הודעות כבויה בהגדרות.'), 409);
  if (!r.phone) return json(err('message_no_phone', 'לאדם הזה אין מספר טלפון בכרטיס.', { outcome: 'not_sent' }), 422);
  if (consentOf(st, r) === 'declined') return json(err('message_no_consent', 'האדם ביקש לא לקבל הודעות.', { outcome: 'not_sent' }), 409);
  if (b.confirmed !== true) return json(err('confirmation_required', 'שליחת הודעה דורשת אישור מפורש.'), 409);
  if (b.template_id) {
    if (b.text !== undefined) return json(err('validation', 'בשליחת תבנית אין שולחים טקסט.'), 422);
    if (b.templates_revision !== m.templatesRevision) return json(err('message_template_changed', 'התבניות עודכנו מאז שהחלון נפתח - בחרו שוב.', { templates_revision: m.templatesRevision }), 409);
  } else {
    if (!m.freeText) return json(err('message_free_text_disabled', 'הודעה חופשית אינה מופעלת.'), 403);
    if (!b.text?.trim()) return json(err('message_empty', 'ההודעה ריקה.'), 422);
    if (/(?:קוד|pin|code)[^\d\n]{0,14}\d{4,8}/i.test(b.text)) return json(err('message_forbidden_content', 'אי אפשר לשלוח קוד גישה או פרטי כניסה בהודעה.'), 422);
  }
  if (m.burst > 0) {
    m.burst -= 1;
    return json(err('message_rate_limited', 'יותר מדי הודעות בזמן קצר.', { outcome: 'not_sent', scope: 'burst', retry_after_s: 1 }), 429);
  }
  const mode = m.failFor[id] ?? m.mode;
  if (mode === 'slow') await new Promise((res) => setTimeout(res, 600));
  else if (m.delayMs) {
    // a long wait is released by setting `delayMs` back to 0 (a spec holding a send "in flight" lets go of it before it closes the page)
    for (const until = Date.now() + m.delayMs; m.delayMs && Date.now() < until; ) await new Promise((res) => setTimeout(res, 25));
  }
  if (mode === 'service_down') return json(err('message_service_unavailable', 'שירות ההודעות אינו מחובר.', { outcome: 'not_sent' }), 503);
  if (mode === 'rate' || (m.quota && m.quota.used >= m.quota.limit)) {
    return json(err('message_rate_limited', 'הגעתם למכסת ההודעות לשעה.', { outcome: 'not_sent', scope: 'hour', retry_after_s: 840, quota: { ...(m.quota ?? { limit: 6, used: 6 }), resets_in_s: 840 } }), 429);
  }
  if (mode === 'expired') return json(err('message_expired', 'ההודעה פגה.', { outcome: 'not_sent' }), 410);
  if (mode === 'forbidden') return json(err('message_forbidden', 'אין לכם הרשאה לשלוח הודעה לאדם הזה.', { outcome: 'not_sent' }), 403);
  if (mode === 'gone') return json(err('intercom_person_not_found', 'האדם לא נמצא.'), 404);
  if (mode === 'template_changed') {
    m.templatesRevision += 1;
    return json(err('message_template_changed', 'התבניות עודכנו מאז שהחלון נפתח - בחרו שוב.', { templates_revision: m.templatesRevision }), 409);
  }
  const template = MSG_TEMPLATES.find((t) => t.id === b.template_id);
  const row = (outcome: HistoryRow['outcome'], reason: string | null): HistoryRow => ({
    id: `m${Object.values(m.history).flat().length + 1}`, at: NOW_ISO, by: 'בודק', kind: b.template_id ? 'template' : 'free', template_id: b.template_id ?? null,
    template_label: template?.label ?? null, outcome, reason, bulk: !!b.bulk_id,
  });
  if (mode === 'not_registered') {
    m.history[id] = [row('refused', 'not_registered'), ...(m.history[id] ?? [])];
    return json(err('message_not_registered', 'המספר אינו רשום בוואטסאפ.', { outcome: 'refused' }), 502);
  }
  if (mode === 'uncertain') {
    if (m.quota) m.quota.used += 1;
    m.history[id] = [row('unknown', 'uncertain'), ...(m.history[id] ?? [])];
    return json(err('message_uncertain', 'לא ידוע אם ההודעה נשלחה.', { outcome: 'unknown' }), 504);
  }
  if (m.quota) m.quota.used += 1;
  m.history[id] = [row('sent', null), ...(m.history[id] ?? [])];
  const wire = wireOf('sent');
  return json({ ...wire, message: { ...wire.message, id: m.history[id][0].id, sent_at: NOW_ISO }, quota: m.quota ? { ...m.quota, resets_in_s: 840 } : null });
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
      return json({ ...head('ready'), client_api: 1, api: { version: 1, min_client: 1 }, features: { people: { available: st.mode !== 'unsupported', reason: null }, person: { available: true, reason: null }, person_photo: { available: st.photoEnabled, reason: null }, groups: { available: true, reason: null }, } });
    }
    if (p === 'access-control/stations') return json({ ...head('ready'), fresh: true, stations: st.role === 'scoped' ? STATIONS.filter((s) => st.scope.includes(s.id)) : STATIONS, default_zone: { kind: 'iana', name: 'Asia/Jerusalem' } });
    if (p === 'access-control/groups') {
      const groups = st.role === 'scoped' ? GROUPS.filter((g) => g.station_ids.every((s) => st.scope.includes(s))) : GROUPS;
      return json({ ...head('ready'), fresh: true, groups: { revision: 7, photo_enabled: st.photoEnabled, groups, fields: sensitiveLevel(st) ? FIELDS : null } });
    }
    const forbidden = () => json(err('forbidden', 'אין הרשאה לפעולה הזו.'), 403);
    if (!perms.any.includes('access.people.read') && /^access-control\/(people|groups)/.test(p)) return forbidden();
    if ((await messaging(st, method, p, req.postDataJSON(), json)) !== null) return; // handled (the helper answers `null` for a path that is not its own)
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
      const answer = await json({ ...head(feedState), people: listPeople(st, url.searchParams) });
      st.answered += 1;
      return answer;
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
