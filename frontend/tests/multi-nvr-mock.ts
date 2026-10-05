import type { Page, Route } from '@playwright/test';
import { err, install, newMock, type Mock } from './nvr-cameras-write-mock';
import { batchCameras } from './nvr-batch-mock';

// CR-024 (multi-NVR): a STATEFUL mocked backend for the screens that name recorders - Settings › connections (the recorders card),
// the camera settings table, the all-cameras wall and the event log. It sits on top of the cameras-table mock
// (nvr-cameras-write-mock.ts, which answers /me and the CR-020 routes) and answers the CR-024 routes the way the server does
// (routers/recorders.py, routers/cameras.py `recorders`, routers/events.py `recorder_id`). The server's own rules are the backend
// tests (tests/test_multi_nvr.py); this mock proves the screens. No address, serial or MAC beyond reserved `.test` names.

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export interface MultiState {
  base: Mock;
  recorders: Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  hits: string[];
  writes: { method: string; path: string; body: any }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** the event list's last `recorder_id` query value */
  eventRecorder: string | null;
  /** the NVR system card's last `recorder_id` query value (null = the first recorder) */
  systemRecorder: string | null;
  /** the experimental setting playback.cross_recorder_sync ('true' | 'false') - PATCH /settings changes it */
  crossSync: string;
  /** a recorder disabled while running: its cameras come with recorder_enabled false and can_view_live false */
  disabled: string[];
  /** GET /recorders answers primary_has_history (and the recorders list is empty when `noRecorders`) */
  primaryHistory: boolean;
  noRecorders: boolean;
}

const rec = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, primary: id === 'nvr-1', name, vendor: 'hikvision', vendor_label: 'Hikvision', enabled: true, removed: false, removed_at: null, sort_order: id === 'nvr-1' ? 0 : 1,
  time_zone: null, model: 'DS-7616NI-FAKE', firmware: 'V4.84', last_seen_at: '2026-10-04T08:00:00Z', cameras: 3, cameras_enabled: 3,
  status: { state: 'online', error: null, events_connected: true, discovery_last_ok: '2026-10-04T08:00:00Z' }, pending_restart: false,
  capabilities: { vendor: 'hikvision', live: 'rtsp', playback: 'rtsp', events: 'push' },
  connection: { vendor: 'hikvision', host: id === 'nvr-1' ? 'fake-nvr.test' : 'fake-nvr-2.test', http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'ok', revision: 1, updated_at: null, vendor_locked: true },
  ...extra,
});

const view = (r: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
  ...r.connection, user: r.connection.username, extra: {}, source: 'ui', updated_by: 'joni', pending_restart: r.pending_restart, legacy_options_differ: false, in_addon: false,
  restart: 'manual', cameras: r.cameras, placeholder: false, recorder_id: r.id,
});

const VENDORS = [
  { id: 'hikvision', label: 'Hikvision', status: 'available', default_ports: { http_port: 80, rtsp_port: 554 }, fields: [
    { key: 'host', label: 'כתובת', kind: 'host', required: true, secret: false }, { key: 'http_port', label: 'פורט HTTP', kind: 'port', required: true, secret: false },
    { key: 'rtsp_port', label: 'פורט RTSP', kind: 'port', required: true, secret: false }, { key: 'username', label: 'שם משתמש', kind: 'text', required: true, secret: false },
    { key: 'password', label: 'סיסמה', kind: 'password', required: true, secret: true }] },
  { id: 'provision_isr', label: 'Provision-ISR', status: 'planned', default_ports: { http_port: 80, rtsp_port: 554 }, fields: [] },
  { id: 'none', label: 'ללא NVR', status: 'available', default_ports: {}, fields: [] },
];

/** Two recorders (or one with `count: 1`): the first recorder's cameras come from the cameras-table mock, the second's are copies on `nvr-2`. */
export async function installMulti(page: Page, opts: { count?: 1 | 2 } = {}): Promise<MultiState> {
  const count = opts.count ?? 2;
  const base = newMock();
  base.perms = [...base.perms, 'video.playback']; // the playback / synchronized-playback screens (CR-024 owner answer 1)
  base.canBatch = true;
  base.cameras = batchCameras(3); // three cameras that qualify for the multi-camera change (SVC on, H.264, online)
  if (count === 2) {
    base.cameras = [...base.cameras, ...base.cameras.map((c) => ({ ...JSON.parse(JSON.stringify(c)), camera_id: `w-${c.camera_id}`, recorder_id: 'nvr-2', name: c.name }))];
  }
  const st: MultiState = { base, recorders: count === 2 ? [rec('nvr-1', 'NVR ראשי'), rec('nvr-2', 'NVR מחסן')] : [rec('nvr-1', 'NVR ראשי')], hits: [], writes: [], eventRecorder: null, systemRecorder: null, crossSync: 'false', disabled: [], primaryHistory: false, noRecorders: false };
  await install(page, base);
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    st.hits.push(`${method} ${p}${url.search}`);
    if (method !== 'GET') st.writes.push({ method, path: p, body: req.postDataJSON?.() ?? null });
    const live = st.noRecorders ? [] : st.recorders.filter((r) => !r.removed);

    if (p === 'recorders' && method === 'GET') return json({ recorders: live, count: live.length, can_manage: true, restart: 'manual', pending_restart: live.some((r) => r.pending_restart), primary_has_history: st.primaryHistory });
    if (p === 'recorders' && method === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>;
      const r = rec(`nvr-${st.recorders.length + 1}`, String(body.name), { pending_restart: true, cameras: 0, cameras_enabled: 0, status: { state: 'pending_restart', error: null, events_connected: false, discovery_last_ok: null } });
      st.recorders.push(r);
      return json({ saved: true, restart_required: true, recorder_id: r.id, untested: false, device: { model: 'DS-7608NI-FAKE', firmware: 'V4', channels: 8 }, recorder: r }, 201);
    }
    let m = /^recorders\/([^/]+)$/.exec(p);
    if (m) {
      const r = st.recorders.find((x) => x.id === m![1] && !x.removed);
      if (!r) return json(err('not_found', 'ה־NVR לא נמצא.'), 404);
      if (method === 'PATCH') {
        const body = req.postDataJSON() as Record<string, unknown>;
        if (typeof body.name === 'string') r.name = body.name;
        if (typeof body.enabled === 'boolean') {
          // CR-024 section 7.2: disable / enable apply at once - no restart, the cameras follow at once
          r.enabled = body.enabled;
          r.status = { ...r.status, state: body.enabled ? 'online' : 'disabled' };
          st.disabled = body.enabled ? st.disabled.filter((id) => id !== r.id) : [...new Set([...st.disabled, r.id])];
        }
        return json({ saved: true, restart_required: false, recorder: r });
      }
      if (method === 'DELETE') {
        r.removed = true;
        return json({ removed: true, restart_required: true, recorder_id: r.id, revision: 2, cameras_disabled: r.cameras });
      }
      return json(r);
    }
    m = /^recorders\/([^/]+)\/connection$/.exec(p);
    if (m) {
      const r = st.recorders.find((x) => x.id === m![1] && !x.removed);
      if (!r) return json(err('not_found', 'ה־NVR לא נמצא.'), 404);
      if (method === 'PUT') return json({ ...view(r), saved: true, restart_required: true, restarting: false, revision: 2, device: { model: 'DS-FAKE', channels: 4 }, untested: false });
      return json(view(r));
    }
    if (/^recorders\/[^/]+\/connection\/test$/.test(p) || p === 'nvr/connection/test') return json({ ok: true, code: 'ok', model: 'DS-7608NI-FAKE', firmware: 'V4', channels: 8 });
    if (p === 'nvr/vendors') return json({ vendors: VENDORS });
    if (p === 'nvr/connection' && method === 'GET') return json(view(st.recorders[0]));
    if (p === 'nvr/recorders') {
      return json({ recorders: live.map((r) => ({ recorder_id: r.id, name: r.name, vendor: 'hikvision', model: r.model, firmware: r.firmware, enabled: r.enabled, online: true, checked_at: null,
        capabilities: { read_encodings: true, write_encodings: true, add_channel: false, remove_channel: false, max_channels: 16, used_channels: 3, encoding_fields: [] }, error: null })), can_write: true });
    }
    if (p === 'cameras' && method === 'GET') {
      const multi = live.length > 1;
      const names = Object.fromEntries(live.map((r) => [r.id, r.name]));
      const cams = base.cameras.filter((c) => live.some((r) => r.id === c.recorder_id)).map((c, i) => ({
        id: c.camera_id, recorder_id: c.recorder_id, channel: c.channel, name: c.name, name_source: c.name, alias: null, enabled: true, sort_order: i, grid_col_span: 1, wall_hidden: false,
        main_track: c.channel * 100 + 1, sub_track: c.channel * 100 + 2, status: 'offline', last_seen_at: null, can_view_live: !st.disabled.includes(c.recorder_id),
        recorder_enabled: !st.disabled.includes(c.recorder_id), recorder_name: multi ? names[c.recorder_id] : null,
      }));
      return json({ cameras: cams, recorders: [...new Set(cams.map((c) => c.recorder_id))].map((id) => ({ id, name: names[id] })), recorder: null, can_sync: true, media: {} });
    }
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/gif', body: GIF });
    if (p === 'settings' && method === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      if (typeof body['playback.cross_recorder_sync'] === 'string') st.crossSync = body['playback.cross_recorder_sync'] as string;
      return json({ settings: { 'playback.cross_recorder_sync': st.crossSync }, can_edit: true, warnings: {} });
    }
    if (p === 'settings' && method === 'GET') {
      return json({ settings: { 'playback.cross_recorder_sync': st.crossSync, 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {},
        'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60, 'time.zone': 'Asia/Jerusalem', 'playback.max_sessions': 4, 'playback.lease_s': 600 }, can_edit: true });
    }
    if (p === 'events' && method === 'GET') {
      st.eventRecorder = url.searchParams.get('recorder_id');
      const all = base.cameras.slice(0, 6).map((c, i) => ({
        id: `ev-${i}`, source: 'alertstream', raw_type: 'VMD', type: 'motion', camera_id: c.camera_id, camera_name: c.name, recorder_id: c.recorder_id, channel: c.channel,
        occurred_at: new Date(Date.now() - (i + 1) * 60_000).toISOString(), ended_at: null, received_at: new Date().toISOString(), state: 'inactive', count: 1, severity: 'info',
        confidence: 'measured', details: {}, acked_at: null, acked_by: null, thumbnail: 'unavailable',
      }));
      const events = st.eventRecorder ? all.filter((e) => e.recorder_id === st.eventRecorder) : all;
      return json({ events, from: new Date(Date.now() - 86_400_000).toISOString(), to: new Date().toISOString(), timezone: 'Asia/Jerusalem', filters: { applied: {}, unsupported: [] },
        ingest: { connected: true, last_error: null }, derive: {} });
    }
    if (p === 'health') {
      // the shape the connections screen reads (the cameras-table mock's short answer is enough for the shell only)
      return json({
        status: 'ok', version: 'test', db: { ok: true, permission_revision: 1 }, data_dir_writable: true, nvr_configured: true, go2rtc_configured: true, mode: 'full',
        discovery: { cameras_last_ok: '2026-10-04T08:00:00Z', cameras_last_error: null, cameras_last_run: null, streams_last_ok: null, streams_last_error: null, last_reason: null, cameras: 6, interval_s: 600 },
        events: { ingest: { connected: true, last_heartbeat_at: null, last_event_at: null, last_error: null, reconnects: 0, events_stored: 0, started_at: null }, derive: { last_run: null, last_ok: null, last_error: null, derived: 0 }, stored: 0 },
        home_assistant: { configured: true, connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 1, entities: 10, started_at: null, ha_version: '2026.9' },
        identity_source: 'ingress', renderer: 'fake', recorders: live.map((r) => ({ id: r.id, discovery_last_ok: '2026-10-04T08:00:00Z', discovery_last_error: null, events_connected: true, events_last_error: null })),
      });
    }
    if (p === 'nvr/system') {
      st.systemRecorder = url.searchParams.get('recorder_id');
      return json({ time: { local_time: '2026-10-04T10:00:00', mode: 'NTP', drift_s: 0, ntp: null }, disks: [], outputs: [], errors: {},
        can: { time: false, storage: false, alarm: false, reboot: false, osd: false, connection: true }, recorder_id: st.systemRecorder ?? 'nvr-1' });
    }
    if (p === 'nvr/notify') return json({ channels: [], permission: 'nvr.config.events', can_write: false, labels: {}, recorder_id: 'nvr-1' });
    if (p === 'nvr/changes') return json({ changes: [] });
    if (p.startsWith('events/facets')) return json({ days: 90, since: '2026-07-06T00:00:00Z', types: [], sources: [], severities: [], unavailable_types: [], places: [], notes: [] });
    if (p === 'events/summary') return json({ total: 0, unacked: 0, by_type: {}, by_source: {} });
    return route.fallback();
  });
  return st;
}
