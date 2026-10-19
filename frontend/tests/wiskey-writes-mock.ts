import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';
import { ADMIN, OPERATOR, STATIONS, view, type PeopleMock, type RawPerson } from './wiskey-people-mock';

// CR-036 S11: the person WRITES of the native people screen, on top of the S7 people mock (tests/wiskey-people-mock.ts - install it
// first; the routes here are registered after it and win, `route.fallback()` hands everything else back to it). It answers like the
// typed writes of routers/access_control.py and routers/access_control_writes.py, statefully on the same invented directory: the
// editor projection at the caller's level, the archive / active / temporary-cancel / card / photo writes, the update, the delete that
// stays PENDING until the read model stops finding the person, the PIN generation (a fake sentinel, never a real PIN), and the
// failures a spec asks for - "not sent" (scope / forbidden), "refused" (by code), "unknown" (504) and a dropped connection.
// Every reply has the shape of tests/fixtures/access_writes_wire.json: tests/unit-people-writes-wire.spec.ts holds these builders to
// it and smplwise_vms/backend/tests/test_access_writes_wire.py holds it to the real endpoints, so this mock cannot drift unseen.
// Nothing here can reach a device, a station, Home Assistant or WisKey. Everything is invented.

const HERE = path.dirname(fileURLToPath(import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WIRE = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'access_writes_wire.json'), 'utf8')) as Record<string, any>;

/** A fake sentinel the PIN generator answers with (never a real PIN): it must be shown once and found nowhere afterwards. */
export const PIN_SENTINEL = '918273';

export type WriteKind = 'archive' | 'unarchive' | 'active' | 'temporary-cancel' | 'cards' | 'card-remove' | 'photo' | 'delete' | 'update' | 'create' | 'pin';
export type Failure = 'scope' | 'forbidden' | 'refused' | 'unknown' | 'network' | 'photo_disabled';

export interface Card {
  id: string;
  masked_number: string;
  label: string;
  card_type: string;
  enabled: boolean;
}

export interface Timing {
  draft: Record<string, unknown> | null;
  policy: Record<string, unknown> | null;
}

export interface WritesMock {
  /** A names-level manager: the S7 operator plus access.people.manage and access.pin.generate - WITHOUT access.people.sensitive. */
  manager: boolean;
  /** The caller holds access.pin.generate (the editor context's `pin_generate`). */
  pinGenerate: boolean;
  /** The stations the caller may read a card at (the editor context's `capture_stations`). */
  captureStations: string[];
  /** One failure per command, answered once (then the command works again). */
  failOnce: Partial<Record<WriteKind, Failure>>;
  /** How many reads of the person's page still find a deleted person (then it is gone: 404). */
  deleteLag: number;
  /** A delay (ms) before a write answers - lets a spec see the "sending" state. */
  delay: number;
  cards: Record<string, Card[]>;
  timing: Record<string, Timing>;
  /** Every write as it arrived (method, path, body) - the envelope included. */
  sent: { method: string; path: string; body: Record<string, unknown> }[];
  deleting: Record<string, number>;
  counter: number;
}

export function newWrites(): WritesMock {
  return { manager: false, pinGenerate: true, captureStations: ['gate', 'lobby'], failOnce: {}, deleteLag: 1, delay: 0, cards: {}, timing: {}, sent: [], deleting: {}, counter: 0 };
}

const sensitiveOf = (st: PeopleMock, w: WritesMock) => st.role === 'admin' && !w.manager;
const FETCHED = '2026-10-12T09:59:30Z';
const head = () => ({ state: 'ready', configured: true, last_error: null, fetched_at: FETCHED, sync: WIRE.sync });
const DAY = (d: string) => d.charAt(0).toUpperCase() + d.slice(1);

export function cardsOf(w: WritesMock, p: RawPerson): Card[] {
  if (!w.cards[p.id]) {
    w.cards[p.id] = Array.from({ length: p.cards }, (_, i) => ({
      id: `card-${p.id}-${i + 1}`, masked_number: `•••• ${String(4821 + 7 * i + p.id.length * 113).slice(-4)}`, label: i === 0 ? 'תג ראשי' : `תג ${i + 1}`, card_type: 'normalCard', enabled: true,
    }));
  }
  return w.cards[p.id];
}

/** The S7 timing of the read model as the editor's proposal / enforced policy (the device's own slots for a native one). */
export function timingOf(w: WritesMock, p: RawPerson): Timing {
  if (w.timing[p.id]) return w.timing[p.id];
  if (!p.timing) return { draft: null, policy: null };
  const schedule = { mode: p.timing.mode, timezone: p.timing.timezone, days: p.timing.days.map(DAY), dates: p.timing.dates, periods: p.timing.periods };
  const bindings = p.timing.enforcement === 'native' ? Object.fromEntries(p.stations.map((s, i) => [s.station_id, { template: 10 + i, weekly: 20 + i, holiday_group: null, holidays: [] }])) : {};
  return { draft: null, policy: { mode: p.timing.enforcement, schedule, bindings } };
}

/** One person in the editor projection at the caller's level (intercom_writes.view_editor_person). */
export function editorPerson(st: PeopleMock, w: WritesMock, p: RawPerson): Record<string, unknown> {
  const sensitive = sensitiveOf(st, w);
  const timing = timingOf(w, p);
  return {
    id: p.id,
    employee_no: st.employeeNoVisible || sensitive ? p.employee_no : null,
    display_name: p.display_name,
    active: p.active,
    valid_from: p.valid_from,
    valid_until: p.valid_until,
    revision: p.revision,
    group_ids: p.group_ids,
    stations: p.stations.map((s) => ({ station_id: s.station_id, enabled: s.enabled, doors: s.doors, sync_state: s.sync_state, last_error: null, desired_revision: p.revision, applied_revision: s.sync_state === 'synced' ? p.revision : p.revision - 1 })),
    phone: sensitive ? p.phone : null,
    identity_locked: false,
    pin_configured: sensitive ? p.pin : null,
    cards: sensitive ? cardsOf(w, p).map((c) => ({ ...c })) : null,
    permission_overrides: Object.fromEntries(p.stations.map((s) => [s.station_id, s.enabled ? 'allow' : 'deny'])),
    has_timing: !!(timing.draft || timing.policy),
    archived: !!p.archived,
    access_category: p.access_category,
    responsible_person: sensitive ? p.responsible_person ?? '' : null,
    access_purpose: sensitive ? p.access_purpose ?? '' : null,
    photo_configured: sensitive ? p.photo : null,
    timing_draft: timing.draft,
    timing_policy: timing.policy,
    level: sensitive ? 'sensitive' : 'names',
    // WisKey rounds 4-6: the completeness markers of the read side (intercom_sync / intercom_authority) - a mock person is complete
    access_known: true,
    stations_known: true,
    credentials_known: sensitive,
    redacted_fields: [],
    operator_editable: true,
  };
}

export const contextReply = (st: PeopleMock, w: WritesMock) => ({
  ...head(),
  context: {
    stations: (st.role === 'scoped' ? STATIONS.filter((s) => st.scope.includes(s.id)) : STATIONS).map((s) => ({
      id: s.id, name: s.name, online: s.online, lock_enabled: true,
      locks: s.id === 'lobby' ? [{ physical_index: 1, name: 'דלת' }, { physical_index: 2, name: 'מחסום' }] : [{ physical_index: 1, name: 'דלת' }], pin_writable: true,
    })),
    default_zone: { kind: 'iana', name: 'Asia/Jerusalem' },
    capabilities: ['panel_permissions'],
    writes_listed: true,
    users_manage: true,
    profile_policy: null,
    capture_stations: w.captureStations,
    pin_generate: w.pinGenerate,
  },
});

export const editorReply = (st: PeopleMock, w: WritesMock, p: RawPerson) => ({ ...head(), person: editorPerson(st, w, p) });
const commandId = (w: WritesMock) => `cmd${String(++w.counter).padStart(29, '0')}`;
export const writeReply = (st: PeopleMock, w: WritesMock, p: RawPerson) => ({ ...head(), person: editorPerson(st, w, p), command_id: commandId(w), effect: 'sync', pending: false });
export const saveReply = (st: PeopleMock, w: WritesMock, p: RawPerson) => ({ ...writeReply(st, w, p), note: 'נשמר.' });
export const deleteReply = (w: WritesMock) => ({ ...head(), deleted: { accepted: true }, command_id: commandId(w), note: 'המחיקה התקבלה.', effect: 'unknown_effect', pending: true });
export const pinReply = () => ({ ...head(), pin: { pin: PIN_SENTINEL } });

const ERRORS: Record<string, { status: number; key: string; code?: string; wiskey?: string }> = {
  scope: { status: 403, key: 'scope' },
  forbidden: { status: 403, key: 'forbidden' },
  unknown: { status: 504, key: 'unknown' },
  not_found: { status: 404, key: 'not_found' },
};

/** A structured error body of the server (the fixture's shapes); `refused` takes the code and WisKey's code of the case. */
export function errorBody(kind: 'scope' | 'forbidden' | 'unknown' | 'not_found' | 'refused', refused?: { code: string; wiskey: string; status?: number }): { status: number; body: Record<string, unknown> } {
  if (kind === 'refused') {
    const base = WIRE.errors.refused;
    return { status: refused?.status ?? 409, body: { ...base, code: refused?.code ?? base.code, details: { ...base.details, wiskey_code: refused?.wiskey ?? base.details.wiskey_code } } };
  }
  const e = ERRORS[kind];
  return { status: e.status, body: { ...WIRE.errors[e.key] } };
}

const REFUSALS: Record<string, { code: string; wiskey: string; status?: number }> = {
  archive_state: { code: 'intercom_archive_state_changed', wiskey: 'archive_state_changed' },
  archived: { code: 'intercom_person_archived', wiskey: 'user_archived' },
  not_temporary: { code: 'intercom_not_temporary', wiskey: 'temporary_user_required' },
  already_inactive: { code: 'intercom_already_inactive', wiskey: 'temporary_already_inactive' },
  card_conflict: { code: 'intercom_card_conflict', wiskey: 'card_conflict' },
  card_gone: { code: 'intercom_card_not_found', wiskey: 'card_not_found', status: 404 },
  revision: { code: 'intercom_revision_conflict', wiskey: 'revision_conflict' },
  photo_disabled: { code: 'intercom_photo_disabled', wiskey: 'photo_disabled' },
};

/** A typed card number the fake directory already holds for someone else (answered `card_conflict`). */
export const TAKEN_CARD = 'TAKEN0001';

export async function installWrites(page: Page, st: PeopleMock, w: WritesMock): Promise<void> {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const fail = (e: { status: number; body: Record<string, unknown> }) => json(e.body, e.status);

    // ---- a names-level manager (who they are), and the person's page that says they may change this person
    if (w.manager && p === 'me' && method === 'GET') {
      const any = [...OPERATOR, 'access.people.manage', 'access.pin.generate'];
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: any, permissions_any: any, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp-manager', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full',
      });
    }
    const page1 = /^access-control\/people\/([^/]+)$/.exec(p);
    if (page1 && method === 'GET') {
      const id = decodeURIComponent(page1[1]);
      if (id in w.deleting) {
        // the read model still finds a deleted person for `deleteLag` reads, then it is gone
        if (w.deleting[id] <= 0) {
          st.people = st.people.filter((x) => x.id !== id);
          delete w.deleting[id];
        } else w.deleting[id] -= 1;
        return route.fallback();
      }
      if (w.manager) {
        const raw = st.people.find((x) => x.id === id);
        const v = raw ? view(st, raw, true) : null;
        if (v) return json({ ...head(), person: { ...v, editable: true } });
      }
      return route.fallback();
    }
    if (!p.startsWith('intercom/') || p === 'intercom/ws') return route.fallback();

    // ---- the gate every write has: manage somewhere (the S7 roles: admin, or the names-level manager)
    const perms = st.role === 'admin' ? ADMIN : w.manager ? [...OPERATOR, 'access.people.manage', 'access.pin.generate'] : OPERATOR;
    if (!perms.includes('access.people.manage')) return fail(errorBody('forbidden'));

    if (p === 'intercom/people-editor/context' && method === 'GET') return json(contextReply(st, w));
    const ed = /^intercom\/people\/([^/]+)\/editor$/.exec(p);
    if (ed && method === 'GET') {
      const raw = st.people.find((x) => x.id === decodeURIComponent(ed[1]));
      return raw ? json(editorReply(st, w, raw)) : fail(errorBody('not_found'));
    }

    // ---- the writes
    if (method === 'GET') return fail(errorBody('not_found')); // the capture and the other intercom reads are not this mock's
    const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
    w.sent.push({ method, path: p, body });
    if (w.delay) await new Promise((r) => setTimeout(r, w.delay));
    const kindOf = (): WriteKind | null => {
      if (p === 'intercom/people/pin-generate') return 'pin';
      if (p === 'intercom/people' && method === 'POST') return 'create';
      if (/^intercom\/people\/[^/]+$/.test(p) && method === 'PUT') return 'update';
      if (/\/cards\/[^/]+\/remove$/.test(p)) return 'card-remove';
      const m = /^intercom\/people\/[^/]+\/(archive|unarchive|active|temporary-cancel|cards|photo|delete)$/.exec(p);
      return m ? (m[1] as WriteKind) : null;
    };
    const kind = kindOf();
    if (!kind) return fail(errorBody('not_found'));
    const failure = w.failOnce[kind];
    if (failure) {
      delete w.failOnce[kind];
      if (failure === 'network') return route.abort('failed');
      if (failure === 'refused') return fail(errorBody('refused', REFUSALS.archive_state));
      if (failure === 'photo_disabled') return fail(errorBody('refused', REFUSALS.photo_disabled));
      return fail(errorBody(failure));
    }
    if (kind === 'pin') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(pinReply()) });
    if (kind === 'create') {
      const data = (body.data ?? {}) as Record<string, unknown>;
      const id = `n${++w.counter}`;
      const raw: RawPerson = {
        id, display_name: String(data.display_name ?? ''), employee_no: String(data.employee_no ?? id), active: data.active !== false, valid_from: (data.valid_from as string) ?? null,
        valid_until: (data.valid_until as string) ?? null, revision: 1, access_category: (data.access_category as RawPerson['access_category']) ?? 'staff', group_ids: [], stations: [], timing: null,
        phone: String(data.phone ?? ''), pin: typeof data.pin === 'string', cards: 0, photo: false, profile: {},
      };
      st.people.push(raw);
      return json(saveReply(st, w, raw));
    }
    const id = decodeURIComponent(p.split('/')[2]);
    const raw = st.people.find((x) => x.id === id);
    if (!raw || id in w.deleting) return fail(errorBody('not_found'));
    if (typeof body.revision === 'number' && body.revision !== raw.revision) return fail(errorBody('refused', REFUSALS.revision));
    const done = () => {
      raw.revision += 1;
      return json(kind === 'update' ? saveReply(st, w, raw) : writeReply(st, w, raw));
    };
    switch (kind) {
      case 'archive':
        if (raw.archived) return fail(errorBody('refused', REFUSALS.archive_state));
        raw.archived = true;
        raw.active = false;
        return done();
      case 'unarchive':
        if (!raw.archived) return fail(errorBody('refused', REFUSALS.archive_state));
        raw.archived = false; // restored switched off, as WisKey does
        return done();
      case 'active':
        if (raw.archived && body.active === true) return fail(errorBody('refused', REFUSALS.archived));
        raw.active = body.active === true;
        return done();
      case 'temporary-cancel':
        if (raw.access_category === 'staff') return fail(errorBody('refused', REFUSALS.not_temporary));
        if (!raw.active) return fail(errorBody('refused', REFUSALS.already_inactive));
        raw.active = false;
        return done();
      case 'cards': {
        const no = String(body.card_no ?? '');
        if (no === TAKEN_CARD) return fail(errorBody('refused', REFUSALS.card_conflict));
        cardsOf(w, raw).push({ id: `card-${raw.id}-n${++w.counter}`, masked_number: `•••• ${no.slice(-4)}`, label: String(body.label ?? ''), card_type: 'normalCard', enabled: body.enabled !== false });
        raw.cards = cardsOf(w, raw).length;
        return done();
      }
      case 'card-remove': {
        const cardId = decodeURIComponent(p.split('/')[4]);
        const list = cardsOf(w, raw);
        if (!list.some((c) => c.id === cardId)) return fail(errorBody('refused', REFUSALS.card_gone));
        w.cards[raw.id] = list.filter((c) => c.id !== cardId);
        raw.cards = w.cards[raw.id].length;
        return done();
      }
      case 'photo':
        if (!st.photoEnabled && body.photo !== null) return fail(errorBody('refused', REFUSALS.photo_disabled));
        raw.photo = body.photo !== null;
        return done();
      case 'delete':
        w.deleting[raw.id] = w.deleteLag;
        return json(deleteReply(w));
      case 'update': {
        const data = (body.data ?? {}) as Record<string, unknown>;
        if (typeof data.display_name === 'string') raw.display_name = data.display_name;
        if (typeof data.active === 'boolean') raw.active = data.active;
        if ('valid_from' in data) raw.valid_from = (data.valid_from as string) ?? null;
        if ('valid_until' in data) raw.valid_until = (data.valid_until as string) ?? null;
        if (typeof data.access_category === 'string') raw.access_category = data.access_category as RawPerson['access_category'];
        if (typeof data.responsible_person === 'string') raw.responsible_person = data.responsible_person;
        if (typeof data.access_purpose === 'string') raw.access_purpose = data.access_purpose;
        if (typeof data.phone === 'string') raw.phone = data.phone;
        if ('pin' in data) raw.pin = typeof data.pin === 'string';
        if ('access_timing_draft' in data || 'access_timing_policy' in data) {
          const before = timingOf(w, raw);
          w.timing[raw.id] = {
            draft: 'access_timing_draft' in data ? (data.access_timing_draft as Record<string, unknown> | null) : before.draft,
            policy: 'access_timing_policy' in data ? (data.access_timing_policy as Record<string, unknown> | null) : before.policy,
          };
        }
        return done();
      }
      default:
        return fail(errorBody('not_found'));
    }
  });
}
