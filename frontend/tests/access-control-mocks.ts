import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Route, WebSocketRoute } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';

// CR-036 S8 / S10: the mock layer of the access-control Playwright specs. The whole app runs against it through page.route:
// `/me` carries the permissions, so the navigation, the screens and the hiding are the real ones; the typed reads
// (`/api/v1/access-control/...`) answer in the WIRE shapes of tests/fixtures/access_control_wire.json - the file the backend test
// smplwise_vms/backend/tests/test_access_control_wire.py checks against the real endpoints, so this layer cannot drift from the server.
// Fake data only: an invented office with three entrances; no real person, station, host or picture.
//
// Personas (what `/me` says and what the server would answer for them):
//   admin       every access-control permission, installation scope
//   siteAdmin   admin without system.configure (a site manager: the Settings status page is theirs)
//   operator    read, stations, events, people (no export, no Settings status)
//   scoped      an operator whose bindings are on ONE station only: no installation permission, rows of entry-a only
//   scopedAdmin a site manager whose bindings are on ONE station only: rows of entry-a only, an export names a station, the installation-wide
//               Settings reads (conflicts, the intercom's own log, policy versions) are refused (station_scoped)
//   viewer      access.read only (the entry center): the log is refused
//   nobody      no access-control permission at all

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WIRE = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'access_control_wire.json'), 'utf8')) as Record<string, any>;

/** "Now" of the specs: Sunday 2026-09-27 13:30 in Jerusalem (UTC+3). The fixture's newest day is that day, the next one is "yesterday". */
export const NOW = new Date('2026-09-27T10:30:00Z');

export type Persona = 'admin' | 'siteAdmin' | 'operator' | 'scoped' | 'scopedAdmin' | 'viewer' | 'nobody';

const BASE = ['access.read', 'access.stations.read', 'access.events.read', 'access.people.read'];
const SITE = [...BASE, 'access.events.export', 'access.people.sensitive', 'access.people.manage', 'access.call', 'access.admin.read'];
export const PERMS: Record<Persona, { installation: string[]; any: string[] }> = {
  admin: { installation: [...SITE, 'system.configure'], any: [] },
  siteAdmin: { installation: SITE, any: [] },
  operator: { installation: BASE, any: [] },
  scoped: { installation: [], any: BASE },
  scopedAdmin: { installation: [], any: SITE },
  viewer: { installation: ['access.read'], any: [] },
  nobody: { installation: ['map.read'], any: [] },
};
for (const p of Object.values(PERMS)) if (!p.any.length) p.any = p.installation;

export interface MockOptions {
  persona?: Persona;
  /** TICKGATE-295: the tickets module is ON in the session and in the product settings (default off, as shipped) */
  ticketsOn?: boolean;
  /** The events read: ready (default), empty, error (500), slow (answers after 1.2 s), hold (answers when `release()` is called: a screenshot of the
   * loading state cannot race the answer), rate (not ready: rate_limited), unavailable (ha_unavailable),
   * not_installed, not_configured, unsupported, connecting, gone (403 on the read itself) */
  events?: 'ready' | 'empty' | 'error' | 'slow' | 'hold' | 'rate' | 'unavailable' | 'not_installed' | 'not_configured' | 'unsupported' | 'connecting' | 'gone';
  /** The export: ok (default), unavailable, unsupported, slow, station_required (the server wants one station named, whoever asks) */
  exportMode?: 'ok' | 'unavailable' | 'unsupported' | 'slow' | 'station_required';
  /** The administrator's `access.event_portrait_sensitive`: a caller without access.people.sensitive gets `portrait: null` and no picture. */
  portraitSensitive?: boolean;
  /** Every cursor the list is given is refused as expired (422 `intercom_cursor_expired`). */
  cursor?: 'ok' | 'expired';
  /** Rows per page whatever `limit` asks (the integration's own page cap can be smaller than the one requested). */
  pageSize?: number;
  /** The event picture: ok (default), gone (404), error (503), slow */
  portrait?: 'ok' | 'gone' | 'error' | 'slow';
  /** The evidence read of one event: ok (default), error */
  detail?: 'ok' | 'error';
  /** Features the installed integration does NOT offer (their names in the features reply). */
  hideFeatures?: string[];
  /** The Settings status reads: ready (default), error (503), empty (no stations), slow, hold (answers when `release()` is called), stale (served from
   * the cache: fresh false), rate, not_configured (no integration in this environment), unsupported (the installed version does not offer them) */
  status?: 'ready' | 'error' | 'empty' | 'slow' | 'hold' | 'stale' | 'rate' | 'not_configured' | 'unsupported';
  /** Fleet alerts per page whatever `limit` asks (the next page is served over `offset`). */
  alertsPage?: number;
  /** Extra product settings (merged over the defaults that switch the three screens to the native ones). */
  settings?: Record<string, string>;
  /** A PATCH of the product settings: ok (default, merged and answered) or fail (500). */
  settingsPatch?: 'ok' | 'fail';
  /** CR-036 S9, every schedules read (per station: programs, codes; installation-wide: library, proposals, checks): ready (default),
   * error (503), busy (not ready: rate_limited), unsupported (the installed version does not list it), empty (nothing scheduled
   * anywhere), stale (served from the cache: fresh false), hold (answers when `release()` is called) */
  schedules?: 'ready' | 'error' | 'busy' | 'unsupported' | 'empty' | 'stale' | 'hold';
}

export interface Call {
  method: string;
  path: string;
  query: Record<string, string>;
}

export interface AccessMock {
  opts: MockOptions;
  calls: Call[];
  /** The paths the app asked for that nothing here answers (answered 404). */
  unhandled: string[];
  /** The product-settings PATCH bodies the app sent, in order. */
  patches: Record<string, string>[];
  portraitViews: number;
  detailViews: number;
  exports: Record<string, string>[];
  sockets: WebSocketRoute[];
  /** Answer the reads held by the `hold` modes (every one waiting now, and every later one). */
  release: () => void;
  /** Tell the open screens "something changed" (the integration's data-free refresh notice). */
  push: (type?: 'intercom_refresh' | 'intercom_state') => void;
  /** Rows the events read serves in total (the fixture plus the generated older ones). */
  total: number;
}

const json = (route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function me(persona: Persona, ticketsOn = false) {
  const p = PERMS[persona];
  return {
    user: { id: `u-${persona}`, username: persona, display_name: persona === 'admin' ? 'מנהל מערכת' : persona === 'siteAdmin' ? 'מנהל אתר' : 'מפעיל', source: 'ingress' },
    channel: 'local', remote: null, bindings: [], permissions_installation: p.installation, permissions_any: p.any, has_access: true, permission_revision: 1, bootstrap_state: 'done',
    ...(ticketsOn ? { modules: { tickets: true } } : {}), // TICKGATE-295: absent = the tickets module is off
  };
}

interface Ev {
  id: string; station_id: string; timestamp: string; received_at: string | null; time_source: 'device' | 'received' | null; person_name: string | null; employee_no: string | null;
  authentication: string; result: string; event_type: string; recovered: boolean; door: number | null; portrait: boolean | null;
}

/** The fixture's 12 rows, then generated older ones (a row every 37 minutes before the fixture's oldest) up to `total`. */
export function allEvents(total = 130): Ev[] {
  const base = clone(WIRE.events.events.records) as Ev[];
  const oldest = Date.parse(base[base.length - 1].timestamp);
  const out = [...base];
  for (let i = base.length + 1; i <= total; i++) {
    const src = base[(i - 1) % 8];
    const t = new Date(oldest - (i - base.length) * 37 * 60_000).toISOString().replace('.000Z', '+00:00');
    out.push({ ...src, id: `ev-${String(i).padStart(4, '0')}`, timestamp: t, received_at: t, portrait: false, recovered: false, time_source: 'device' });
  }
  return out;
}

const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#dfe6f2"/><circle cx="200" cy="120" r="56" fill="#8a97ae"/><path d="M80 300c0-72 54-112 120-112s120 40 120 112z" fill="#8a97ae"/></svg>`;

export async function installAccessMock(page: Page, opts: MockOptions = {}): Promise<AccessMock> {
  const st: AccessMock = { opts: { persona: 'admin', ...opts }, calls: [], unhandled: [], patches: [], portraitViews: 0, detailViews: 0, exports: [], sockets: [], push: () => undefined, release: () => undefined, total: 0 };
  const gate = new Promise<void>((resolve) => (st.release = resolve));
  const events = allEvents();
  st.total = events.length;
  // the product settings the app reads and the Settings page writes (the four access-control policy settings at their defaults)
  const settingsState: Record<string, string> = {
    'ui.design': 'a',
    ...(opts.ticketsOn ? { 'tickets.enabled': 'true' } : {}),
    'access.ui.overview': 'smplwise',
    'access.ui.events': 'smplwise',
    'access.ui.people': 'smplwise',
    'access.event_portrait_audit': 'true',
    'access.event_portrait_sensitive': 'false',
    'access.employee_no_sensitive': 'false',
    'access.sync_errors_everyone': 'false',
    ...(st.opts.settings ?? {}),
  };
  const persona = () => st.opts.persona ?? 'admin';
  const holds = (perm: string) => PERMS[persona()].any.includes(perm);
  const scoped = () => persona() === 'scoped' || persona() === 'scopedAdmin';
  const visible = (e: Ev) => !scoped() || e.station_id === 'entry-a';
  const sync = () => clone(WIRE.sync);
  const err = (route: Route, status: number, key: string, extra: Record<string, unknown> = {}) => json(route, { ...clone(WIRE.errors[key]), ...extra }, status);
  const refuse = (route: Route, permission: string) =>
    json(route, { ...clone(WIRE.errors.forbidden), details: { permission, target_type: 'installation', target_id: '*', reason: 'no_binding' } }, 403);

  const stationsReply = () => {
    const r = clone(WIRE.stations);
    r.stations = r.stations.filter((s: { id: string }) => !scoped() || s.id === 'entry-a');
    for (const s of r.stations) {
      if (!holds('access.stations.read')) {
        s.technical = null;
      }
      if (!holds('access.admin.read')) s.errors = null;
    }
    return { ...r, sync: sync() };
  };

  const featuresReply = () => {
    const r = clone(WIRE.features);
    for (const f of st.opts.hideFeatures ?? []) r.features[f] = { available: false, reason: 'not_listed' };
    return { ...r, sync: sync() };
  };

  /** The rows a read with these filters matches (newest first, only what the persona may see). */
  const filterRows = (q: URLSearchParams): Ev[] => {
    let rows = events.filter(visible);
    const f = (k: string) => q.get(k);
    if (f('station_id')) rows = rows.filter((e) => e.station_id === f('station_id'));
    if (f('result')) rows = rows.filter((e) => e.result === f('result'));
    if (f('authentication')) rows = rows.filter((e) => e.authentication === f('authentication'));
    if (f('event_type')) rows = rows.filter((e) => e.event_type === f('event_type'));
    if (f('door')) rows = rows.filter((e) => String(e.door) === f('door'));
    if (f('person')) {
      const needle = f('person')!.toLowerCase();
      rows = rows.filter((e) => `${e.person_name ?? ''} ${e.employee_no ?? ''}`.toLowerCase().includes(needle));
    }
    if (f('start')) rows = rows.filter((e) => Date.parse(e.timestamp) >= Date.parse(f('start')!));
    if (f('end')) rows = rows.filter((e) => Date.parse(e.timestamp) < Date.parse(f('end')!));
    return rows;
  };

  const eventsReply = (q: URLSearchParams) => {
    const rows = filterRows(q);
    const f = (k: string) => q.get(k);
    const limit = st.opts.pageSize ?? Number(f('limit') ?? 100);
    let from = 0;
    const before = f('before');
    if (before) {
      if (st.opts.cursor === 'expired') return null;
      const id = before.startsWith('c.') ? before.slice(2) : before;
      const at = rows.findIndex((e) => e.id === id);
      if (at < 0 || (scoped() && !before.startsWith('c.'))) return null; // a cursor the server does not know
      from = at + 1;
    }
    const page = rows.slice(from, from + limit);
    const last = page[page.length - 1];
    const next = from + limit < rows.length && last ? (scoped() ? `c.${last.id}` : last.id) : null;
    const body = clone(WIRE.events);
    // the administrator's setting: a caller without access.people.sensitive is not offered the picture (`portrait: null`)
    body.events.records = st.opts.portraitSensitive && !holds('access.people.sensitive') ? page.map((e) => ({ ...e, portrait: null })) : page;
    body.events.next = next;
    body.events.stations = Object.fromEntries(Object.entries(body.events.stations).filter(([id]) => !scoped() || id === 'entry-a'));
    return { ...body, sync: sync() };
  };

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const q = url.searchParams;
    const method = req.method();
    const query = Object.fromEntries(q.entries());
    st.calls.push({ method, path: p, query });

    if (p === 'me') return json(route, me(persona(), !!st.opts.ticketsOn));
    if (p === 'me/prefs') return json(route, { prefs: { 'nav.order': [] }, stored: [], updated_at: null });
    if (p === 'settings') {
      if (method === 'PATCH') {
        if (!holds('system.configure')) return refuse(route, 'system.configure');
        if (st.opts.settingsPatch === 'fail') return json(route, { code: 'internal', user_message: 'השמירה נכשלה', retryable: false, correlation_id: 'mock', details: {} }, 500);
        const body = JSON.parse(req.postData() ?? '{}') as Record<string, string>;
        st.patches.push(body);
        Object.assign(settingsState, body);
      }
      return json(route, { settings: { ...settingsState }, can_edit: holds('system.configure') });
    }
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'intercom/overview') {
      // the entry center's own read (the legacy feed copy): the tab row of the area is reached through it in the specs that start there
      if (!holds('access.read')) return refuse(route, 'access.read');
      const r = clone(WIRE.stations);
      return json(route, {
        state: 'ready', configured: true, fresh: true, fetched_at: r.fetched_at, last_error: null, server_time_ms: NOW.getTime(), camera_access: {},
        overview: {
          version: '4.37.0', api_version: 1, default_zone: r.default_zone,
          stations: r.stations.map((s: Record<string, any>) => ({ id: s.id, name: s.name, online: s.online, call_state: s.call_state, sync_state: s.sync_state, lock_enabled: s.lock_enabled, lock_count: s.locks.length, locks: s.locks, has_camera: s.has_camera, camera_entity: s.camera_entity, last_error: null, last_seen: s.last_seen, zone: s.zone })),
        },
      });
    }
    if (p === 'identity/users') return json(route, { users: [], directory: { paired: false, last_directory_at: null, users: 0 }, revision: 1, can_assign: false, members: [], bindings: [] });
    if (p === 'access/groups') return json(route, { groups: [], can_manage: false, delegated: false });

    if (!p.startsWith('access-control/')) {
      st.unhandled.push(`${method} ${p}`);
      return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
    }
    const ac = p.slice('access-control/'.length);

    // ---------------------------------------------------------------- the stations and the features (access.read)
    if (ac === 'stations') {
      if (!holds('access.read')) return refuse(route, 'access.read');
      return json(route, stationsReply());
    }
    if (ac === 'features') {
      if (!holds('access.read')) return refuse(route, 'access.read');
      return json(route, featuresReply());
    }

    // ---------------------------------------------------------------- the entry log (access.events.read)
    if (ac === 'events') {
      if (!holds('access.events.read') || st.opts.events === 'gone') return refuse(route, 'access.events.read');
      const mode = st.opts.events ?? 'ready';
      const head = { configured: true, fetched_at: null, events: null, sync: sync() };
      if (mode === 'error') return json(route, { code: 'internal', user_message: 'השרת לא ענה', retryable: false, correlation_id: 'mock', details: {} }, 500);
      if (mode === 'slow') await delay(1200);
      if (mode === 'hold') await gate;
      if (mode === 'rate') return json(route, { state: 'error', last_error: 'rate_limited', ...head });
      if (mode === 'unavailable') return json(route, { state: 'ha_unavailable', last_error: 'ha_unavailable', ...head });
      if (mode === 'not_installed') return json(route, { state: 'not_installed', last_error: 'not_installed', ...head });
      if (mode === 'not_configured') return json(route, { state: 'ha_not_configured', configured: false, last_error: 'ha_not_configured', fetched_at: null, events: null, sync: sync() });
      if (mode === 'unsupported') return json(route, { state: 'unsupported', last_error: 'not_listed', ...head });
      if (mode === 'connecting') return json(route, { state: 'connecting', last_error: null, ...head });
      if (mode === 'empty') {
        const b = clone(WIRE.events);
        b.events.records = [];
        b.events.next = null;
        return json(route, { ...b, sync: sync() });
      }
      const r = eventsReply(q);
      if (!r) return err(route, 422, 'cursor_expired');
      return json(route, r);
    }
    if (ac === 'events/export.csv') {
      if (!holds('access.events.export')) return refuse(route, 'access.events.export');
      st.exports.push(query);
      const mode = st.opts.exportMode ?? 'ok';
      if (mode === 'slow') await delay(1200);
      if (mode === 'unavailable') return err(route, 503, 'unavailable');
      if (mode === 'unsupported') return json(route, { code: 'intercom_unsupported', user_message: 'התכונה אינה זמינה בבקרת הכניסה המותקנת.', retryable: false, correlation_id: 'mock', details: { reason: 'not_listed' } }, 409);
      if ((scoped() || mode === 'station_required') && !q.get('station_id')) return err(route, 422, 'export_station_required');
      const list = filterRows(q);
      const header = ['timestamp', 'station', 'employee_no', 'person_name', 'event_type', 'authentication', 'result', 'door', 'recovered', 'time_source'];
      const csv = '﻿' + [header, ...list.map((e) => [e.timestamp, e.station_id, e.employee_no ?? '', e.person_name ?? '', e.event_type, e.authentication, e.result, e.door ?? '', e.recovered, e.time_source ?? ''])].map((r) => r.map((c) => `"${String(c)}"`).join(',')).join('\r\n');
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="access-events.csv"', 'X-Export-Rows': String(list.length), 'Cache-Control': 'private, no-store' }, body: csv });
    }
    const evMatch = /^events\/([^/]+)(\/portrait)?$/.exec(ac);
    if (evMatch) {
      if (!holds('access.events.read')) return refuse(route, 'access.events.read');
      const row = events.filter(visible).find((e) => e.id === decodeURIComponent(evMatch[1]));
      if (evMatch[2]) {
        st.portraitViews += 1;
        const mode = st.opts.portrait ?? 'ok';
        if (mode === 'slow') await delay(1200);
        if (mode === 'error') return err(route, 503, 'unavailable');
        if (st.opts.portraitSensitive && !holds('access.people.sensitive')) return json(route, { code: 'intercom_event_not_found', user_message: 'האירוע לא נמצא.', retryable: false, correlation_id: 'mock', details: {} }, 404);
        if (!row || !row.portrait || mode === 'gone') return err(route, 404, 'photo_not_found');
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Cache-Control': 'private, no-store' }, body: AVATAR_SVG });
      }
      st.detailViews += 1;
      if (st.opts.detail === 'error') return err(route, 503, 'unavailable');
      if (!row) return json(route, { code: 'intercom_event_not_found', user_message: 'האירוע לא נמצא.', retryable: false, correlation_id: 'mock', details: {} }, 404);
      const d = clone(WIRE.event_detail);
      const { portrait: _portrait, ...rest } = row;
      void _portrait;
      d.event = { ...d.event, ...rest, evidence: { ...d.event.evidence, time_source: row.time_source } };
      return json(route, { ...d, sync: sync() });
    }

    // ---------------------------------------------------------------- the Settings status page (access.admin.read)
    const statusMode = st.opts.status ?? 'ready';
    const needAdmin = () => !holds('access.admin.read');
    const statusFailure = async (): Promise<boolean> => {
      if (statusMode === 'slow') await delay(1200);
      if (statusMode === 'hold') await gate;
      if (statusMode === 'error') {
        await err(route, 503, 'unavailable');
        return true;
      }
      if (statusMode === 'rate') {
        await json(route, { state: 'error', configured: true, last_error: 'rate_limited', fetched_at: null, sync: sync() });
        return true;
      }
      if (statusMode === 'not_configured') {
        await json(route, { state: 'ha_not_configured', configured: false, last_error: 'ha_not_configured', fetched_at: null, sync: sync() });
        return true;
      }
      if (statusMode === 'unsupported') {
        await json(route, { state: 'unsupported', configured: true, last_error: 'not_listed', fetched_at: null, sync: sync() });
        return true;
      }
      return false;
    };
    const fresh = <T extends Record<string, unknown>>(b: T): T => (statusMode === 'stale' ? { ...b, fresh: false } : b);
    if (ac === 'status/stations') {
      if (needAdmin()) return refuse(route, 'access.admin.read');
      if (await statusFailure()) return;
      const r = stationsReply();
      if (statusMode === 'empty') r.stations = [];
      return json(route, fresh(r));
    }
    const health = /^stations\/([^/]+)\/health(\/history)?$/.exec(ac);
    if (health) {
      if (needAdmin()) return refuse(route, 'access.admin.read');
      if (await statusFailure()) return;
      const body = clone(health[2] ? WIRE.health_history : WIRE.health);
      if (!health[2] && decodeURIComponent(health[1]) === 'entry-c') {
        body.health.online = false;
        body.health.consecutive_poll_failures = 6;
        body.health.events.stream = 'disconnected';
        body.health.events.history = 'incomplete';
        body.health.clock = null;
      }
      return json(route, { ...fresh(body), sync: sync() });
    }
    if (ac === 'status/sync') {
      if (needAdmin()) return refuse(route, 'access.admin.read');
      if (await statusFailure()) return;
      const b = clone(WIRE.status_sync);
      if (scoped()) {
        // the server counts only what the caller sees: the totals are recomputed over the stations left (never the integration's own)
        const rows = (b.sync_status.stations as Array<Record<string, any>>).filter((r) => r.station_id === 'entry-a');
        const sum = (k: string) => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
        const ops = (k: string) => rows.reduce((n, r) => n + (r.operations?.[k] ?? 0), 0);
        b.sync_status = {
          stations: rows,
          totals: { pending_users: sum('pending_users'), managed_users: sum('managed_users'), revocations_pending: sum('revocations_pending'), card_removals_pending: sum('card_removals_pending'), pin_removals_pending: sum('pin_removals_pending'), deletions_pending: sum('deletions_pending'), operations: { pending: ops('pending'), failed: ops('failed'), verified: ops('verified'), settled: ops('settled') } },
        };
      }
      if (statusMode === 'empty') b.sync_status = { stations: [], totals: { ...b.sync_status.totals, pending_users: 0, managed_users: 0, revocations_pending: 0, pin_removals_pending: 0, operations: { pending: 0, failed: 0, verified: 0, settled: 0 } } };
      return json(route, { ...fresh(b), sync: sync() });
    }
    if (ac === 'status/conflicts') {
      if (needAdmin()) return refuse(route, 'access.admin.read');
      if (scoped()) return json(route, { ...clone(WIRE.errors.forbidden), details: { permission: 'access.admin.read', target_type: 'installation', target_id: '*', reason: 'station_scoped' } }, 403);
      if (await statusFailure()) return;
      const b = clone(WIRE.status_conflicts);
      if (statusMode === 'empty') b.conflicts = [];
      return json(route, { ...b, sync: sync() });
    }
    if (ac === 'status/alerts') {
      if (needAdmin()) return refuse(route, 'access.admin.read');
      if (await statusFailure()) return;
      const b = clone(WIRE.status_alerts);
      const kind = q.get('kind') ?? '';
      const includeSuppressed = q.get('include_suppressed') === 'true';
      let items = b.alerts.items as Array<{ kind: string; suppressed: boolean; station_id: string }>;
      if (scoped()) items = items.filter((i) => i.station_id === 'entry-a');
      if (kind) items = items.filter((i) => i.kind === kind);
      if (!includeSuppressed) items = items.filter((i) => !i.suppressed);
      if (statusMode === 'empty') items = [];
      b.alerts.total = items.length;
      b.alerts.active_count = items.filter((i) => !i.suppressed).length;
      b.alerts.suppressed_count = items.filter((i) => i.suppressed).length;
      const offset = Number(q.get('offset') ?? 0);
      const size = st.opts.alertsPage ?? Number(q.get('limit') ?? 50);
      b.alerts.offset = offset;
      b.alerts.limit = size;
      b.alerts.next_offset = offset + size < items.length ? offset + size : null;
      b.alerts.items = items.slice(offset, offset + size);
      return json(route, { ...fresh(b), sync: sync() });
    }
    if (ac === 'status/audit') {
      if (needAdmin()) return refuse(route, 'access.admin.read');
      if (scoped()) return json(route, { ...clone(WIRE.errors.forbidden), details: { permission: 'access.admin.read', target_type: 'installation', target_id: '*', reason: 'station_scoped' } }, 403);
      if (await statusFailure()) return;
      const b = clone(WIRE.status_audit);
      const records = b.audit.records as Array<Record<string, any>>;
      const before = Number(q.get('before') ?? 0);
      const station = q.get('station_id');
      const action = q.get('action');
      let rows = before ? records.filter((r) => r.sequence < before) : records;
      if (station) rows = rows.filter((r) => r.stations.includes(station));
      if (action) rows = rows.filter((r) => r.action === action);
      // CR-036 S12: the period (`start`) and one person's records (`user_id`), as the integration filters them
      const person = q.get('user_id');
      const start = q.get('start');
      if (person) rows = rows.filter((r) => r.person?.id === person);
      if (start) rows = rows.filter((r) => Date.parse(r.time) >= Date.parse(start));
      if (before) {
        // the second page: older entries, generated
        rows = [{ sequence: 27, time: '2026-09-25T10:00:00+00:00', action: 'users/update', actor_name: 'מנהל אתר', fields: ['phone'], revision_before: 1, revision_after: 2, reason_code: null, stations: ['entry-b'], person: { id: 'u3', display_name: 'נועה בר', employee_no: '1050' } }];
        b.audit.next_cursor = null;
      }
      if (statusMode === 'empty') rows = [];
      b.audit.records = rows;
      return json(route, { ...b, sync: sync() });
    }
    if (ac === 'groups') {
      if (!holds('access.people.read')) return refuse(route, 'access.people.read');
      if (await statusFailure()) return;
      const g = clone(WIRE.groups);
      if (scoped()) {
        // a station-scoped caller sees only the groups whose every station they see
        g.groups.groups = (g.groups.groups as Array<{ station_ids: string[] | null }>).filter((x) => Array.isArray(x.station_ids) && x.station_ids.length > 0 && x.station_ids.every((id) => id === 'entry-a'));
      }
      if (!holds('access.people.sensitive') && scoped()) g.groups.fields = null;
      return json(route, { ...fresh(g), sync: sync() });
    }
    if (ac === 'groups/versions') {
      if (needAdmin()) return refuse(route, 'access.admin.read');
      if (scoped()) return json(route, { ...clone(WIRE.errors.forbidden), details: { permission: 'access.admin.read', target_type: 'installation', target_id: '*', reason: 'station_scoped' } }, 403);
      if (await statusFailure()) return;
      const b = clone(WIRE.group_versions);
      if (Number(q.get('offset') ?? 0) >= 3) {
        b.versions.records = [{ revision: 5, saved_at: '2026-09-01T09:00:00+00:00', action: 'profiles/settings_update', origin: 'saved', field_changes: 2, group_changes: 0 }, { revision: 2, saved_at: '2026-08-02T09:00:00+00:00', action: 'system', origin: 'saved', field_changes: 0, group_changes: 0 }];
        b.versions.offset = 3;
        b.versions.next_offset = null;
        b.versions.previous_offset = 0;
      }
      return json(route, { ...fresh(b), sync: sync() });
    }

    // ---------------------------------------------------------------- CR-036 S9: the schedules (access.stations.read)
    const schedMode = st.opts.schedules ?? 'ready';
    const schedFailure = async (key: string): Promise<boolean> => {
      if (schedMode === 'hold') await gate;
      if (schedMode === 'error') {
        await err(route, 503, 'unavailable');
        return true;
      }
      if (schedMode === 'busy') {
        await json(route, { state: 'error', configured: true, last_error: 'rate_limited', fetched_at: null, fresh: false, [key]: null, sync: sync() });
        return true;
      }
      if (schedMode === 'unsupported') {
        await json(route, { state: 'unsupported', configured: true, last_error: 'not_listed', fetched_at: null, [key]: null, sync: sync() });
        return true;
      }
      return false;
    };
    const schedFresh = <T extends Record<string, unknown>>(b: T): T => (schedMode === 'stale' ? { ...b, fresh: false, fetched_at: '2026-09-27T09:58:00Z' } : b);
    const perStation = /^stations\/([^/]+)\/(programs|codes)$/.exec(ac);
    if (perStation) {
      const id = decodeURIComponent(perStation[1]);
      if (!holds('access.stations.read')) return refuse(route, 'access.stations.read');
      // a station the caller may not see answers exactly like one that does not exist
      if ((scoped() && id !== 'entry-a') || !['entry-a', 'entry-b', 'entry-c'].includes(id)) return json(route, { code: 'intercom_station_not_found', user_message: 'העמדה לא נמצאה.', retryable: false, correlation_id: 'mock', details: {} }, 404);
      if (await schedFailure(perStation[2])) return;
      if (perStation[2] === 'codes') {
        const b = clone(WIRE.codes);
        if (id === 'entry-b') b.codes = { ...b.codes, public_pin_state: 'absent', slots: [{ slot: 1, configured: false }] };
        if (id === 'entry-c') b.codes = { ...b.codes, public_pin_state: 'unknown', slots: [{ slot: 1, configured: null }] };
        return json(route, { ...schedFresh(b), sync: sync() });
      }
      const b = clone(WIRE.programs);
      const base = b.programs.programs[0];
      if (schedMode === 'empty') b.programs.programs = [];
      else if (id === 'entry-b') {
        // door 1 paused; door 2 has only an older saved draft (never activated)
        b.programs.programs = [{ ...base, revision: 2, enabled: false, policy: { ...base.policy, name: 'ערב', weekly: { ...base.policy.weekly, Friday: [], Sunday: [{ start: '17:00', end: '20:00' }] }, holidays: [] }, execution: { owned: false, attempted: null, status: 'idle' }, checked_at: '2026-09-26T17:00:00+00:00' }];
        b.programs.saved = [{ door: 2, revision: 1, policy: { ...base.policy, name: 'מחסום פתוח', holidays: [] } }];
      } else if (id === 'entry-c') {
        b.programs.programs = [{ ...base, error: 'device_unreachable', execution: { owned: false, attempted: null, status: 'unknown' } }];
      }
      return json(route, { ...schedFresh(b), sync: sync() });
    }
    const lib = /^schedules(?:\/(plans|operations))?$/.exec(ac);
    if (lib) {
      if (!holds('access.stations.read')) return refuse(route, 'access.stations.read');
      // installation-wide in the integration: a station-scoped caller is refused (and the server audits it)
      if (scoped()) return json(route, { ...clone(WIRE.errors.forbidden), details: { permission: 'access.stations.read', target_type: 'installation', target_id: '*', reason: 'station_scoped' } }, 403);
      if (await schedFailure('schedules')) return;
      const b = clone(lib[1] === 'plans' ? WIRE.schedules_plans : lib[1] === 'operations' ? WIRE.schedules_operations : WIRE.schedules_library);
      if (schedMode === 'empty') b.schedules = lib[1] === 'operations' ? { ...b.schedules, jobs: [], claims: [] } : [];
      return json(route, { ...schedFresh(b), sync: sync() });
    }

    st.unhandled.push(`${method} access-control/${ac}`);
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });

  // the two sockets the shell and the screens open: nothing is sent unless a spec pushes a notice
  await page.routeWebSocket(/\/api\/v1\/.*\/ws$/, (ws) => {
    if (ws.url().includes('/intercom/ws')) {
      st.sockets.push(ws);
      ws.onClose(() => {
        st.sockets = st.sockets.filter((s) => s !== ws);
      });
    }
  });
  st.push = (type = 'intercom_refresh') => {
    for (const ws of st.sockets) ws.send(JSON.stringify({ type, payload: type === 'intercom_state' ? { state: 'ready' } : {} }));
  };
  return st;
}

/** The URL of a screen: skin and scheme as the dev query, the route as the hash. */
export const url = (hash: string, skin = 'classic', scheme: 'light' | 'dark' = 'light') => `/?design=a&skin=${skin}&scheme=${scheme}#${hash}`;

/** The skins the product has in this checkout - read from the registry, so a skin added by a merge (Crystal, on main) is covered
 * without an edit here. */
export const SKINS: readonly string[] = SKIN_IDS;
