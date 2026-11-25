import type { Page } from '@playwright/test';
import { NOW_ISO, type StationsMock } from './wiskey-stations-mocks';

// WISKEY-STATION-OPS-2390: the mocked backend of a station's maintenance, layered over the stations screen's mock
// (tests/wiskey-stations-mocks.ts; routes registered later win, everything else falls through to it). Invented answers only: no
// station, no intercom. It answers like routers/access_control_station_ops.py: the read (health detail, the sign-in failure, the
// actions this caller may run, cool-downs, the last runs) and the four actions with an outcome per action and station, and it RECORDS
// every POST so a spec can assert exactly what was sent and how many times.

export type OpName = 'sync' | 'rescan' | 'health_refresh' | 'clock_refresh';
export type OpResult = 'ok' | 'failed' | 'unknown' | 'not_sent' | 'cooldown' | 'forbidden' | 'slow';

// the stations mock's admin persona, plus the maintenance permission when `manage` is on
const ADMIN = ['access.read', 'access.release', 'access.stations.read', 'access.events.read', 'access.people.read', 'access.admin.read', 'access.call', 'devices.read', 'system.configure', 'map.read'];

export interface OpsMock {
  /** The caller holds access.stations.manage (the toolbar button, the drawer's buttons). */
  manage: boolean;
  /** Per action (or `station/action`): how the server answers. Default `ok`. */
  result: Record<string, OpResult>;
  /** Stations whose recent records hold a sign-in failure (the report's last failure). */
  authFailed: Set<string>;
  /** Stations whose event stream fails sign-in right now. */
  streamFailing: Set<string>;
  /** Stations whose read answers 500 (the block's error note). */
  readFails: Set<string>;
  /** WISKEY-R4-2520: the sync form the view reports (absent = a server before the numbered sync: nothing extra is drawn). */
  syncMode?: 'request_id' | 'classic';
  /** WISKEY-R4-2520: the hold the view reports until a status read answers (cleared by the mock's status read). */
  syncGate?: 'outcome_pending' | 'readback_required' | null;
  /** WISKEY-R4-2520: where the status read places the request (`queued` ...), or the read's refusal state. */
  syncMatch?: 'queued' | 'running' | 'finished' | 'not_observed' | 'forbidden';
  syncReads?: string[];
  // recorded
  reads: string[];
  posts: { station: string; action: string; body: Record<string, unknown> }[];
}

export const newOpsMock = (over: Partial<OpsMock> = {}): OpsMock => ({
  manage: true,
  result: {},
  authFailed: new Set(['gate']),
  streamFailing: new Set(),
  readFails: new Set(),
  reads: [],
  posts: [],
  ...over,
});

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (status: number, code: string, details: Record<string, unknown>) => json({ code, user_message: `(בדיקה) ${code}`, retryable: false, correlation_id: 'test', details }, status);

const OPS: OpName[] = ['sync', 'rescan', 'health_refresh', 'clock_refresh'];

function view(base: StationsMock, m: OpsMock, id: string) {
  const s = base.stations.find((x) => x.id === id)!;
  const failing = m.authFailed.has(id);
  const streaming = m.streamFailing.has(id) ? 'authentication_failed' : s.online ? 'connected' : 'disconnected';
  const lastSync = m.posts.some((p) => p.station === id && p.action === 'sync');
  return {
    station_id: id,
    online: s.online,
    feed: 'ready',
    health_hidden: false,
    technical: {
      reconciled_at: '2026-10-12T07:58:00+00:00',
      scanned_at: '2026-10-12T06:30:00+00:00',
      scanning: false,
      last_error: s.last_error ?? (failing ? 'authentication_failed' : null),
      scan_error: null,
      event_status: { stream: streaming, history: 'recovered', last_frame_at: NOW_ISO },
      clock: { status: 'ready', skew_seconds: id === 'lab' ? -7 : 1, checked_at: '2026-10-12T08:00:00+00:00', error: null },
      last_poll_ms: 40,
    },
    report: {
      state: 'ready',
      fresh: true,
      fetched_at: NOW_ISO,
      last_error: null,
      health: {
        loaded: true,
        online: s.online,
        consecutive_poll_failures: s.online ? 0 : 4,
        access: { sync_state: s.sync_state, last_error: s.last_error ?? (failing ? 'authentication_failed' : null), pending_request: false, worker_active: false, queue_depth: 0 },
        events: { stream: streaming, history: 'recovered', reconnects: 1, last_frame_at: NOW_ISO, storage_failed: false },
        clock: { status: 'ready', skew_seconds: id === 'lab' ? -7 : 1, drift_state: 'within_tolerance', time_mode: 'NTP', checked_at: '2026-10-12T08:00:00+00:00', error: null },
      },
      auth: {
        last_failure: failing ? { source: 'sync', step: 'inventory', at: '2026-10-12T07:41:00+00:00', status_code: 4, sub_status: 'unauthorized' } : null,
        retained: failing ? 3 : 0,
        steps: failing ? { inventory: 2, identity: 1 } : {},
        sync_now: failing,
        event_stream_now: m.streamFailing.has(id),
        event_history_now: false,
        last_sync_ok_at: '2026-10-12T07:58:00+00:00',
        retention: 'last_200_stages_since_start',
      },
    },
    auth_seen: failing ? { source: 'sync', step: 'identity', at: '2026-10-12T05:10:00+00:00', status_code: 4, sub_status: null } : null,
    actions: Object.fromEntries(OPS.map((op) => [op, { allowed: m.manage, needs_online: op !== 'sync', cooldown_s: m.manage ? 0 : null, result: op === 'sync' ? 'acknowledged' : 'completed' }])),
    last_runs: Object.fromEntries(OPS.map((op) => [op, op === 'sync' && !lastSync ? { status: 'acknowledged', at: '2026-10-12T07:57:00+00:00', code: null } : null])),
    ...(m.syncMode ? { sync_mode: m.syncMode, sync_gate: m.syncGate ?? null } : {}),
  };
}

export const MOCK_REQUEST_ID = '5c1f9e2a-7b3d-4e8f-9a01-23456789abcd';

// WISKEY-R4-2520: GET .../maintenance/sync-request, like routers/access_control_station_ops.py sync_request_status
function syncRequest(m: OpsMock, id: string) {
  const gateBefore = m.syncGate ?? null;
  if (m.syncMatch === 'forbidden') {
    return { station_id: id, state: 'forbidden', reason: 'wiskey_refused', wiskey_code: 'unauthorized', fetched_at: null, gate_before: gateBefore, gate: gateBefore, last_request: null, match: null, observation: null };
  }
  m.syncGate = null; // the read answered: the hold is settled
  const match = m.syncMatch ?? 'queued';
  const known = gateBefore === null;
  return {
    station_id: id, state: 'ready', reason: null, wiskey_code: null, fetched_at: NOW_ISO, gate_before: gateBefore, gate: null,
    last_request: known ? { status: 'acknowledged', request_id: MOCK_REQUEST_ID, at: NOW_ISO, code: null } : { status: 'unknown', request_id: null, at: NOW_ISO, code: 'timeout' },
    match: known ? match : null,
    observation: {
      connection: 'connected', loaded: true, sync_state: match === 'finished' ? 'synced' : 'pending', last_reconciled_at: NOW_ISO,
      request: {
        scope: 'current_attached_runtime_only',
        pending_request_id: match === 'queued' ? MOCK_REQUEST_ID : null,
        active_request_id: match === 'running' ? MOCK_REQUEST_ID : null,
        last_result: match === 'finished' ? { request_id: MOCK_REQUEST_ID, state: 'synced', observed_at: NOW_ISO, code: null, effect_proven: false } : null,
      },
    },
  };
}

export async function installOpsMock(page: Page, base: StationsMock, m: OpsMock): Promise<OpsMock> {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me' && base.persona === 'admin') {
      const perms = m.manage ? [...ADMIN, 'access.stations.manage'] : ADMIN;
      return route.fulfill(json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'admin', display_name: 'יוני', source: 'ingress' }, active: true, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' }));
    }
    const read = /^access-control\/stations\/([^/]+)\/maintenance$/.exec(p);
    if (read && req.method() === 'GET') {
      const id = decodeURIComponent(read[1]);
      m.reads.push(id);
      if (!base.stations.some((s) => s.id === id)) return route.fulfill(err(404, 'intercom_station_not_found', {}));
      if (m.readFails.has(id)) return route.fulfill(err(500, 'http_error', {}));
      return route.fulfill(json(view(base, m, id)));
    }
    const sr = /^access-control\/stations\/([^/]+)\/maintenance\/sync-request$/.exec(p);
    if (sr && req.method() === 'GET') {
      const id = decodeURIComponent(sr[1]);
      (m.syncReads ??= []).push(id);
      return route.fulfill(json(syncRequest(m, id)));
    }
    const act = /^access-control\/stations\/([^/]+)\/maintenance\/([a-z_]+)$/.exec(p);
    if (act && req.method() === 'POST') {
      const station = decodeURIComponent(act[1]);
      const action = act[2];
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      m.posts.push({ station, action, body });
      const r = m.result[`${station}/${action}`] ?? m.result[action] ?? 'ok';
      if (r === 'slow') await new Promise((res) => setTimeout(res, 1200));
      if (action === 'sync' && m.syncMode === 'request_id' && r === 'unknown') m.syncGate = 'readback_required'; // WISKEY-R4-2520: the hold
      if (r === 'failed') return route.fulfill(err(502, 'station_ops_failed', { outcome: 'refused', wiskey_code: 'authentication_failed', state: 'error' }));
      if (r === 'unknown') return route.fulfill(err(504, 'station_ops_outcome_unknown', { outcome: 'unknown', wiskey_code: 'timeout' }));
      if (r === 'not_sent') return route.fulfill(err(409, 'intercom_station_offline', { outcome: 'not_sent' }));
      if (r === 'cooldown') return route.fulfill(err(429, 'station_ops_cooldown', { outcome: 'not_sent', retry_after_s: 25 }));
      if (r === 'forbidden') return route.fulfill(err(403, 'forbidden', { outcome: 'not_sent', permission: 'access.stations.manage' }));
      const data =
        action === 'sync' && m.syncMode === 'request_id'
          ? { accepted: true, request_id: MOCK_REQUEST_ID, scope: 'current_attached_runtime_only', effect_proven: false }
          : action === 'sync' || action === 'rescan'
          ? { accepted: true }
          : action === 'clock_refresh'
            ? { source: 'device', status: 'ready', skew_seconds: 1, drift_state: 'within_tolerance', time_mode: 'NTP', checked_at: NOW_ISO, error: null }
            : view(base, m, station).report;
      return route.fulfill(json({ station_id: station, action, status: action === 'sync' ? 'acknowledged' : 'completed', command_id: `cmd-${m.posts.length}`, at: NOW_ISO, data }));
    }
    return route.fallback();
  });
  return m;
}
