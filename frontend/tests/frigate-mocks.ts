import type { Page, Route } from '@playwright/test';
import { FRIGATE_CAM_LIST, FRIGATE_CAMERAS, FRIGATE_STATUS, FRIGATE_VENDOR_DETAILS, REVIEW_ITEMS } from '../src/fixtures/frigate';
import type { ReviewItem } from '../src/api/frigate';

// NN5-F1B: one MOCKED backend for the Frigate screens (settings connection test, recorder health, the review screen, the live wall's
// refreshing stills). The routes are those of routers/frigate.py of pilot/NN5-F1A-backend (read at 0edf1bad); the server's own rules
// are the backend tests (test_frigate_api.py), this mock proves the screens. Every name is made up: no real host, frame or credential.

export const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#456"/><circle cx="170" cy="96" r="22" fill="#9ab"/></svg>';
const ENVELOPE = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: '', details });

/** events.read opens the review route and marks the caller's own reviewed state; system.configure the settings. */
export const ADMIN = ['video.live', 'video.playback', 'map.read', 'devices.read', 'events.read', 'system.configure', 'rbac.assign'];

export interface FrigateMock {
  perms: string[];
  /** how the Frigate routes answer: ok | forbidden (403) | error (500) | offline (the sync reports an error) | none (no Frigate recorder) | missing (an old server: 404) | empty */
  reviews: 'ok' | 'forbidden' | 'error' | 'offline' | 'none' | 'missing' | 'empty';
  /** milliseconds the review list waits before answering (the loading state) */
  delayMs: number;
  /** the mark route fails with 500 */
  markFails: boolean;
  /** the server's own page size (smaller than the UI's asks, to prove paging); 0 = no limit */
  pageLimit: number;
  items: ReviewItem[];
  hits: string[];
  marks: { recorder: string; ids: string[]; reviewed: boolean }[];
  /** the recorders list: both (a Hikvision and the Frigate one), or none (the first connection form) */
  recorders: 'two' | 'none';
  /** the connection test answer */
  test: { status: number; body: Record<string, unknown> };
  /** GET cameras/<id>/snapshot.jpg requests, in order, with the time of each */
  stills: { id: string; at: number }[];
  /** `still_refresh_s` the cameras list carries for the Frigate cameras (the tile holds a 5 s floor); 0 = not sent */
  stillRefreshS: number;
  /** NN5-F2: the control routes (routers/frigate_control.py) */
  ctl: FrigateControlMock;
}

export interface FrigateControlMock {
  /** which write classes the administrator switched on */
  classes: Record<string, boolean>;
  /** the camera's switches as Frigate shows them */
  switches: Record<string, boolean>;
  profiles: string[];
  active: string | null;
  rules: Record<string, string>;
  changes: Record<string, unknown>[];
  /** every write the screens sent: "PUT frigate/nvr-2/cameras/fg-front/control/detect {...}" */
  writes: string[];
  /** the next switch write fails with this 409 code */
  failWith: string | null;
  /** the tracked objects' retain flag and sub-label as Frigate shows them (an id not listed = off / none) */
  events: Record<string, { retain: boolean; sub_label: string | null }>;
  /** FRGD / F2b: which supervised first writes are done (routers/frigate_f2b.py `first-writes`) */
  firstWrites: Record<string, boolean>;
  /** the automatic profile setting and its rows */
  auto: { mode: 'off' | 'suggest' | 'apply'; consent: boolean; consent_at: string | null; items: Record<string, unknown>[] };
  /** Frigate's exports and cases as the server lists them (`arx_created` marks the ones Arx may rename / delete) */
  exports: Record<string, unknown>[];
  cases: Record<string, unknown>[];
  /** GET clip.mp4 requests, as "camera start end supervised" */
  clips: string[];
  /** FRGS: zones (relative polygons) and curated settings per camera id, as Frigate's effective config shows them */
  config: { zones: Record<string, Record<string, unknown>[]>; settings: Record<string, Record<string, unknown>> };
}

const SWITCHES = ['detect', 'motion', 'audio', 'review_alerts', 'review_detections', 'notifications', 'improve_contrast', 'birdseye', 'ptz_autotracker', 'enabled', 'recordings', 'snapshots'];
const SWITCH_GROUP = (f: string) => (['enabled', 'recordings', 'snapshots'].includes(f) ? 'record' : 'analytics');
export const F2B_KINDS = ['export_create', 'export_rename', 'export_delete', 'case_create', 'case_rename', 'case_delete', 'event_create', 'event_end', 'profile_auto', 'clip_read', 'config_zone', 'config_settings'];
export function newControlMock(over: Partial<FrigateControlMock> = {}): FrigateControlMock {
  return {
    classes: { analytics: false, record: false, profile: false, review: false, events: false, ptz: false, exports: false, cases: false, config: false },
    switches: Object.fromEntries(SWITCHES.map((f) => [f, !['audio', 'notifications', 'ptz_autotracker', 'snapshots'].includes(f)])),
    profiles: ['home', 'away'], active: 'home', rules: { armed_away: 'away' },
    changes: [
      { id: 'ch1', recorder_id: 'nvr-2', camera_id: 'fg-front', camera_key: 'cam_front', class: 'analytics', kind: 'feature', target: 'detect', before: { value: true }, after: { value: false }, status: 'applied', error: null, reversible: true, reverts_id: null, actor: 'יוני', at: '2026-10-06T07:30:00Z' },
      { id: 'ch2', recorder_id: 'nvr-2', camera_id: 'fg-front', camera_key: 'cam_front', class: 'record', kind: 'feature', target: 'recordings', before: { value: true }, after: { value: false }, status: 'applied', error: null, reversible: true, reverts_id: null, actor: 'דנה', at: '2026-10-06T07:00:00Z' },
      { id: 'ch3', recorder_id: 'nvr-2', camera_id: null, camera_key: '*', class: 'profile', kind: 'profile', target: 'active', before: { profile: null }, after: { profile: 'home' }, status: 'reverted', error: null, reversible: false, reverts_id: null, actor: 'יוני', at: '2026-10-05T20:00:00Z' },
    ],
    writes: [], failWith: null, events: {},
    firstWrites: Object.fromEntries(F2B_KINDS.map((k) => [k, false])),
    auto: { mode: 'off', consent: false, consent_at: null, items: [] },
    exports: [
      { id: 'exp-arx-1', camera: 'cam_front', camera_id: 'fg-front', name: 'כניסה 06.10 07:48', date: 1791273600, in_progress: false, case_id: null, arx_created: true },
      { id: 'exp-fr-1', camera: 'cam_yard', camera_id: 'fg-yard', name: 'yard_export', date: 1791187200, in_progress: true, case_id: null, arx_created: false },
    ],
    cases: [
      { id: 'case-arx-1', name: 'חבילה שנעלמה', description: 'שתי התראות מהכניסה', created_at: 1791273600, arx_created: true },
      { id: 'case-fr-1', name: 'frigate-case', description: '', created_at: 1791100000, arx_created: false },
    ],
    clips: [],
    config: {
      zones: {
        'fg-front': [
          { name: 'porch', points: [[0.08, 0.55], [0.42, 0.5], [0.46, 0.92], [0.06, 0.95]], editable: true, objects: ['person'], inertia: null, loitering_time: null },
          { name: 'driveway', points: [[0.55, 0.45], [0.95, 0.4], [0.98, 0.96], [0.5, 0.97]], editable: true, objects: ['car', 'person'], inertia: 3, loitering_time: 10 },
          { name: 'old_line', points: null, editable: false, objects: [], inertia: null, loitering_time: null },
        ],
      },
      settings: {},
    },
    ...over,
  };
}

export function newFrigateMock(over: Partial<FrigateMock> = {}): FrigateMock {
  return {
    perms: ADMIN, reviews: 'ok', delayMs: 0, markFails: false, pageLimit: 0, recorders: 'two', items: REVIEW_ITEMS.map((i) => ({ ...i })), hits: [], marks: [],
    test: { status: 200, body: { ok: true, code: 'ok', model: 'Frigate', firmware: '0.18.0-fake', channels: 4, transport: { scheme: 'https', insecure: false }, warnings: [] } },
    stills: [], stillRefreshS: 0, ctl: newControlMock(), ...over,
  };
}

const FRIGATE_VENDOR = {
  id: 'frigate', label: 'Frigate', status: 'available', default_ports: { http_port: 8971, rtsp_port: 8554 }, fields: [
    { key: 'host', label: 'כתובת', kind: 'host', required: true, secret: false }, { key: 'http_port', label: 'פורט HTTP', kind: 'port', required: true, secret: false },
    { key: 'username', label: 'שם משתמש', kind: 'text', required: true, secret: false }, { key: 'password', label: 'סיסמה', kind: 'password', required: true, secret: true },
  ],
};
const VENDORS = [
  { id: 'hikvision', label: 'Hikvision', status: 'available', default_ports: { http_port: 80, rtsp_port: 554 }, fields: [
    { key: 'host', label: 'כתובת', kind: 'host', required: true, secret: false }, { key: 'http_port', label: 'פורט HTTP', kind: 'port', required: true, secret: false },
    { key: 'rtsp_port', label: 'פורט RTSP', kind: 'port', required: true, secret: false }, { key: 'username', label: 'שם משתמש', kind: 'text', required: true, secret: false },
    { key: 'password', label: 'סיסמה', kind: 'password', required: true, secret: true }] },
  { id: 'provision_isr', label: 'Provision-ISR', status: 'planned', default_ports: {}, fields: [] },
  FRIGATE_VENDOR,
  { id: 'none', label: 'ללא NVR', status: 'available', default_ports: {}, fields: [] },
];

const CARDS = [
  { id: 'nvr-1', name: 'מקליט ראשי', vendor: 'hikvision', status: 'ok', checked_at: '2026-10-06T08:00:00Z', detail_supported: true, api: { state: 'ok', latency_ms: 120 },
    disks: { state: 'ok', items: [{ ref: '1', state: 'ok', text: 'תקין', total_mb: 953869, free_mb: 847872 }], free_pct: 88.9, full: false, fill_days: null, alarms: [] },
    recording: { state: 'ok', recording: 4, watched: 4, stopped: [], exception: [] }, channels: { state: 'ok', total: 4, connected: 4, disconnected: [] }, clock: { state: 'ok', drift_s: 1 }, certificate: null, vendor_details: null },
  { id: 'nvr-2', name: 'Frigate מחסן', vendor: 'frigate', status: 'warn', checked_at: '2026-10-06T08:00:00Z', detail_supported: true, api: { state: 'ok', latency_ms: 210 },
    disks: { state: 'ok', items: [{ ref: '1', state: 'ok', text: 'תקין', total_mb: 500000, free_mb: 205000 }], free_pct: 41, full: false, fill_days: null, alarms: [] },
    recording: { state: 'ok', recording: 3, watched: 3, stopped: [], exception: [], continuous: false },
    channels: { state: 'warn', total: 4, connected: 3, disconnected: [{ channel: 3, name: 'חניה' }] }, clock: { state: 'ok', drift_s: 0 }, certificate: null, vendor_details: FRIGATE_VENDOR_DETAILS },
];

const recorder = (id: string, name: string, vendor: string, label: string) => ({
  id, primary: id === 'nvr-1', name, vendor, vendor_label: label, enabled: true, removed: false, removed_at: null, sort_order: id === 'nvr-1' ? 0 : 1, time_zone: null,
  model: vendor === 'frigate' ? 'Frigate' : 'DS-FAKE', firmware: vendor === 'frigate' ? '0.18.0-fake' : 'V4', last_seen_at: '2026-10-06T08:00:00Z', cameras: 4, cameras_enabled: 4,
  status: { state: 'online', error: null, events_connected: true, discovery_last_ok: '2026-10-06T08:00:00Z' }, pending_restart: false,
  capabilities: vendor === 'frigate' ? { vendor, live: 'none', playback: 'hls', events: 'push' } : { vendor, live: 'rtsp', playback: 'rtsp', events: 'push' },
  connection: { vendor, host: `${id}.fake.test`, http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'ok', revision: 1, updated_at: null, vendor_locked: true },
});

const cam = (id: string, name: string, recorder_id: string, channel: number, extra: Record<string, unknown> = {}) => ({
  id, recorder_id, channel, name, name_source: name, alias: null, enabled: true, sort_order: channel, grid_col_span: 1, main_track: null, sub_track: null, status: 'online', last_seen_at: null,
  can_view_live: true, recorder_name: recorder_id === 'nvr-2' ? 'Frigate מחסן' : 'מקליט ראשי', recorder_enabled: true, ...extra,
});

const HEALTH = {
  status: 'ok', version: 'test', db: { ok: true, permission_revision: 1 }, data_dir_writable: true, nvr_configured: true, go2rtc_configured: true, mode: 'full',
  discovery: { cameras_last_ok: '2026-10-06T08:00:00Z', cameras_last_error: null, cameras_last_run: null, streams_last_ok: null, streams_last_error: null, last_reason: null, cameras: 4, interval_s: 600 },
  events: { ingest: { connected: true, last_heartbeat_at: null, last_event_at: '2026-10-06T08:00:00Z', last_error: null, reconnects: 0, events_stored: 3, started_at: null }, derive: { last_run: null, last_ok: null, last_error: null, derived: 0 }, stored: 3 },
  home_assistant: { configured: true, connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 1, entities: 10, started_at: null, ha_version: '2026.9' },
  identity_source: 'ingress', renderer: 'fake',
};

const keyOf = (cameraId: string) => `cam_${cameraId.replace('fg-', '')}`;
const epoch = (iso: string) => Date.parse(iso) / 1000;

/** The wire shape of a review item (`fe.review_view` + the camera name and the thumbnail route). */
const wireOf = (i: ReviewItem) => ({
  id: i.id, recorder_id: 'nvr-2', camera_id: i.camera_id, camera_key: keyOf(i.camera_id), camera_name: i.camera_name, severity: i.layer, start: i.start, end: i.end, open: i.end === null,
  duration_s: i.end ? (Date.parse(i.end) - Date.parse(i.start)) / 1000 : null, objects: i.objects, zones: i.zones, sub_labels: [], detections: i.objects.length, type: i.objects[0] ?? 'other',
  event_id: null, reviewed: i.reviewed, thumbnail: `/api/v1/frigate/nvr-2/reviews/${i.id}/thumbnail`,
});

export async function installFrigate(page: Page, m: FrigateMock): Promise<void> {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    m.hits.push(`${method} ${p}${url.search}`);
    const admin = m.perms.includes('system.configure');

    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true, bindings: [],
        permissions_installation: m.perms, permissions_any: m.perms, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'time.zone': 'Asia/Jerusalem', 'media.max_live_sessions': 16 }, can_edit: true, nvr_channels: 8, warnings: [] });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-06T08:00:00Z', version: 'test' });
    if (p === 'health') return json(HEALTH);
    if (p.startsWith('health/report')) return json({ status: 'ok', mode: 'full', version: 'test', uptime_s: 7200, checked_at: '2026-10-06T08:00:00Z', probe_ttl_s: 20, checks: [] });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p.startsWith('events')) return json({ events: [], total: 0, today: { total: 0, unacked: 0 }, windows: [], ingest: null, facets: { types: [], cameras: [] }, next_cursor: null });

    // cameras: one Hikvision (a stream) and the Frigate cameras (no restream: the screens decide from frigate/recorders and its status)
    if (p === 'cameras' && method === 'GET') {
      const still = m.stillRefreshS ? { still_refresh_s: m.stillRefreshS } : {};
      const cameras = [
        cam('hk-1', 'לובי', 'nvr-1', 1),
        cam('fg-off', 'מצלמה כבויה', 'nvr-2', 9, { status: 'offline' }), // second: the wall shows the first four
        ...FRIGATE_CAMERAS.map((c, i) => cam(c.id, c.name, 'nvr-2', i + 1, still)),
      ];
      return json({ cameras, recorders: [{ id: 'nvr-1', name: 'מקליט ראשי' }, { id: 'nvr-2', name: 'Frigate מחסן' }], recorder: null, can_sync: false });
    }
    const snap = /^cameras\/([^/]+)\/snapshot\.jpg$/.exec(p);
    if (snap) {
      m.stills.push({ id: snap[1], at: Date.now() });
      return route.fulfill({ status: 200, contentType: 'image/gif', body: GIF });
    }
    if (p.startsWith('media/')) return json(ENVELOPE('not_found', 'אין וידאו בבדיקה'), 404);

    // settings: connection + recorders + health
    if (p === 'nvr/vendors') return admin ? json({ vendors: VENDORS }) : json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
    if (p === 'nvr/connection' && method === 'GET') {
      return json({ vendor: null, host: null, http_port: null, rtsp_port: null, username: null, user: null, extra: {}, has_password: false, state: 'not_chosen', source: null, revision: null, updated_at: null, updated_by: null, pending_restart: false, legacy_options_differ: false, placeholder: false, in_addon: true, vendor_locked: false, restart: 'manual', cameras: 0 });
    }
    if (p === 'nvr/connection/test') return json(m.test.body, m.test.status);
    if (p === 'recorders') {
      const list = m.recorders === 'none' ? [] : [recorder('nvr-1', 'מקליט ראשי', 'hikvision', 'Hikvision'), recorder('nvr-2', 'Frigate מחסן', 'frigate', 'Frigate')];
      return json({ recorders: list, count: list.length, can_manage: true, restart: 'manual', pending_restart: false, primary_has_history: false });
    }
    const conn = /^recorders\/([^/]+)\/connection$/.exec(p);
    if (conn && method === 'GET') {
      const r = recorder(conn[1], conn[1] === 'nvr-2' ? 'Frigate מחסן' : 'מקליט ראשי', conn[1] === 'nvr-2' ? 'frigate' : 'hikvision', '');
      return json({ ...r.connection, user: r.connection.username, extra: {}, source: 'ui', updated_by: 'joni', pending_restart: false, legacy_options_differ: false, in_addon: false, restart: 'manual', cameras: 4, placeholder: false, recorder_id: conn[1] });
    }
    if (p === 'recorder-health') return json({ recorders: CARDS, interval_s: 60, can_manage: true });
    if (p === 'recorder-health/settings') return json({ values: { interval_s: 60, latency_ms: 1500, recording_gap_min: 30, clock_drift_s: 60, disk_fill_days: 0, cert_days: 30, recover_s: 120, continuous_recorders: [], camera_recording: {} }, ranges: {}, cameras: [] });
    if (p === 'setup/state' || p.startsWith('setup/check/')) return json({ version: 'test', mode: 'full', checked_at: '2026-10-06T08:00:00Z', steps: [], done: 0, total: 0, ready: false, next: null, thresholds: { drift_ok_s: 2, drift_fail_s: 30 }, check_every_s: 5, live_ttl_s: 600 });

    // NN5-F2: the control routes (routers/frigate_control.py)
    if (p === 'frigate/nvr-2/control/policy') {
      if (method === 'PUT') {
        const b = req.postDataJSON() as { classes: Record<string, boolean> };
        m.ctl.writes.push(`PUT ${p} ${JSON.stringify(b)}`);
        if (m.ctl.failWith) {
          const code = m.ctl.failWith;
          m.ctl.failWith = null;
          return json(ENVELOPE(code, 'לא ניתן לשנות את ההגדרה'), 409);
        }
        Object.assign(m.ctl.classes, b.classes);
        return json({ recorder_id: 'nvr-2', policy: m.ctl.classes });
      }
      const per = ['record', 'profile', 'ptz', 'config'];
      const PERM: Record<string, string> = { analytics: 'analytics.control', record: 'analytics.record_control', profile: 'analytics.profile', review: 'analytics.review', events: 'analytics.events', ptz: 'camera.ptz', exports: 'analytics.exports', cases: 'analytics.cases', config: 'system.configure' };
      return json({ recorder_id: 'nvr-2', ptz_released: false, classes: ['analytics', 'record', 'profile', 'review', 'events', 'ptz', 'exports', 'cases', 'config'].map((c) => ({ class: c, enabled: !!m.ctl.classes[c], per_action: per.includes(c), permission: PERM[c], available: c !== 'ptz', confirm_actions: c === 'exports' || c === 'cases' ? ['delete'] : [], persists: c === 'config' })) });
    }
    // FRGD / F2b (routers/frigate_f2b.py): the first supervised write, the automatic profile, exports, cases, manual events, the clip
    const f2b = f2bRoute(m, p, method, req.postDataJSON.bind(req), url);
    if (f2b) return json(f2b.body, f2b.status);
    // FRGS (routers/frigate_config.py): the config schema, one camera's zones and settings, the config writes
    const cfg = configRoute(m, p, method, req.postDataJSON.bind(req));
    if (cfg) return json(cfg.body, cfg.status);
    if (/^frigate\/nvr-2\/cameras\/[^/]+\/snapshot$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG });
    if (f2b === null) return route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]) });
    const ctlCam = /^frigate\/nvr-2\/cameras\/([^/]+)\/control(?:\/([a-z_]+))?$/.exec(p);
    if (ctlCam) {
      const [, camId, feature] = ctlCam;
      const may = (perm: string) => m.perms.includes(perm);
      if (!feature) {
        return json({ recorder_id: 'nvr-2', camera_id: camId, features: SWITCHES.map((f) => ({ feature: f, class: SWITCH_GROUP(f), value: m.ctl.switches[f] })),
          writable: { analytics: !!m.ctl.classes.analytics && may('analytics.control'), record: !!m.ctl.classes.record && may('analytics.record_control'), ptz: false } });
      }
      const b = req.postDataJSON() as { value: boolean; confirm: boolean };
      m.ctl.writes.push(`PUT ${p} ${JSON.stringify(b)}`);
      if (m.ctl.failWith) {
        const code = m.ctl.failWith;
        m.ctl.failWith = null;
        return json(ENVELOPE(code, 'המקליט דחה את השינוי'), 409);
      }
      if (SWITCH_GROUP(feature) === 'record' && !b.confirm) return json(ENVELOPE('confirmation_required', 'פעולה זו דורשת אישור מפורש.'), 409);
      m.ctl.switches[feature] = b.value;
      return json({ recorder_id: 'nvr-2', camera_id: camId, changed: true, verified: true, feature, value: b.value, change_id: 'chx' });
    }
    if (p === 'frigate/nvr-2/profiles') {
      return json({ recorder_id: 'nvr-2', names: m.ctl.profiles, active: m.ctl.active, rules: m.ctl.rules, alarm_states: ['disarmed', 'armed_home', 'armed_away', 'armed_night', 'triggered'],
        can_switch: !!m.ctl.classes.profile && m.perms.includes('analytics.profile') });
    }
    if (p === 'frigate/nvr-2/profile' && method === 'PUT') {
      const b = req.postDataJSON() as { profile: string | null; confirm: boolean };
      m.ctl.writes.push(`PUT ${p} ${JSON.stringify(b)}`);
      if (!b.confirm) return json(ENVELOPE('confirmation_required', 'פעולה זו דורשת אישור מפורש.'), 409);
      m.ctl.active = b.profile;
      return json({ recorder_id: 'nvr-2', changed: true, active: b.profile, verified: true, change_id: 'chp' });
    }
    if (p === 'frigate/nvr-2/profile-rules' && method === 'PUT') {
      const b = req.postDataJSON() as { rules: Record<string, string | null> };
      m.ctl.writes.push(`PUT ${p} ${JSON.stringify(b)}`);
      for (const [k, v] of Object.entries(b.rules)) {
        if (v) m.ctl.rules[k] = v;
        else delete m.ctl.rules[k];
      }
      return json({ recorder_id: 'nvr-2', rules: m.ctl.rules });
    }
    const evCtl = /^frigate\/nvr-2\/events\/([^/]+)\/(control|retain|sub-label)$/.exec(p);
    if (evCtl) {
      const [, evId, what] = evCtl;
      const st = (m.ctl.events[evId] ??= { retain: false, sub_label: null });
      if (what === 'control') {
        const writable = !!m.ctl.classes.events && m.perms.includes('analytics.events');
        return json(writable ? { recorder_id: 'nvr-2', event_id: evId, writable, retain: st.retain, sub_label: st.sub_label } : { recorder_id: 'nvr-2', event_id: evId, writable });
      }
      const b = req.postDataJSON() as { retain?: boolean; sub_label?: string | null };
      m.ctl.writes.push(`POST ${p} ${JSON.stringify(b)}`);
      if (m.ctl.failWith) {
        const code = m.ctl.failWith;
        m.ctl.failWith = null;
        return json(ENVELOPE(code, 'המקליט דחה את השינוי'), 409);
      }
      if (what === 'retain') st.retain = !!b.retain;
      else st.sub_label = (b.sub_label ?? '').trim() || null;
      return json({ recorder_id: 'nvr-2', changed: true, event_id: evId, verified: true, change_id: 'che', ...(what === 'retain' ? { retain: st.retain } : { sub_label: st.sub_label }) });
    }
    if (p.startsWith('frigate/nvr-2/changes')) {
      const rev = /^frigate\/nvr-2\/changes\/([^/]+)\/revert$/.exec(p);
      if (rev && method === 'POST') {
        const b = req.postDataJSON() as { confirm: boolean };
        const ch = m.ctl.changes.find((c) => c.id === rev[1]);
        m.ctl.writes.push(`POST ${p} ${JSON.stringify(b)}`);
        if (!ch) return json(ENVELOPE('not_found', 'השינוי לא נמצא ביומן.'), 404);
        if ((ch.class === 'record' || ch.class === 'profile') && !b.confirm) return json(ENVELOPE('confirmation_required', 'פעולה זו דורשת אישור מפורש.'), 409);
        ch.status = 'reverted';
        ch.reversible = false;
        return json({ recorder_id: 'nvr-2', reverted: true, verified: true, change_id: 'chr', reverts: rev[1] });
      }
      return json({ recorder_id: 'nvr-2', changes: m.ctl.changes });
    }
    // the Frigate provider (routers/frigate.py)
    if (p === 'frigate/recorders') {
      if (m.reviews === 'missing') return json(ENVELOPE('not_found', 'לא נמצא'), 404);
      return json({ recorders: m.reviews === 'none' ? [] : [{ id: 'nvr-2', name: 'Frigate מחסן', enabled: true, firmware: '0.18.0-fake' }] });
    }
    if (p === 'frigate/nvr-2/status') return json({ ...FRIGATE_STATUS, sync: { last_poll_error: m.reviews === 'offline' ? 'source_unavailable' : null, ws_state: m.reviews === 'offline' ? 'down' : 'up' } });
    if (p === 'frigate/nvr-2/cameras') return json({ recorder_id: 'nvr-2', cameras: FRIGATE_CAM_LIST });
    if (p === 'frigate/nvr-2/reviews/summary') {
      if (m.reviews === 'error') return json(ENVELOPE('source_error', 'המקליט החזיר שגיאה'), 500);
      const base = m.reviews === 'empty' ? [] : m.items;
      const sev = (s: string) => ({ total: base.filter((i) => i.layer === s).length, unreviewed: base.filter((i) => i.layer === s && !i.reviewed).length });
      return json({ recorder_id: 'nvr-2', days: Number(url.searchParams.get('days') ?? 7), severity: { alert: sev('alert'), detection: sev('detection') }, unreviewed_by_camera: {} });
    }
    if (p === 'frigate/nvr-2/reviews' && method === 'GET') {
      if (m.delayMs) await new Promise((r) => setTimeout(r, m.delayMs));
      if (m.reviews === 'forbidden') return json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
      if (m.reviews === 'error') return json(ENVELOPE('source_error', 'המקליט החזיר שגיאה'), 500);
      const q = url.searchParams;
      const before = q.get('before') ? Number(q.get('before')) : Infinity;
      let rows = (m.reviews === 'empty' ? [] : m.items)
        .filter((i) => i.layer === q.get('severity') && (!q.get('camera_id') || i.camera_id === q.get('camera_id')) && (q.get('reviewed') == null || String(i.reviewed) === q.get('reviewed')) && epoch(i.start) < before)
        .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
      const limit = m.pageLimit ? Math.min(m.pageLimit, Number(q.get('limit') ?? 50)) : Number(q.get('limit') ?? 50);
      const more = rows.length > limit;
      rows = rows.slice(0, limit);
      return json({ recorder_id: 'nvr-2', items: rows.map(wireOf), next_before: more ? epoch(rows[rows.length - 1].start) : null, layers: ['alert', 'detection', 'motion'], motion_layer: '/api/v1/frigate/nvr-2/activity' });
    }
    if (p === 'frigate/nvr-2/activity') {
      const buckets = (m.reviews === 'empty' ? [] : m.items).filter((i) => i.layer === 'motion').flatMap((i) => {
        const out = [];
        for (let t = epoch(i.start); t < epoch(i.end ?? i.start); t += 30) out.push({ start: t, motion: 4, cameras: [keyOf(i.camera_id)] });
        return out;
      });
      return json({ recorder_id: 'nvr-2', layer: 'motion', window: { start: 0, end: 0 }, bucket_s: 30, buckets });
    }
    if (p === 'frigate/nvr-2/reviews/reviewed' && method === 'POST') {
      const b = req.postDataJSON() as { ids: string[]; reviewed: boolean };
      m.marks.push({ recorder: 'nvr-2', ...b });
      if (m.markFails) return json(ENVELOPE('source_error', 'השמירה נכשלה'), 500);
      m.items = m.items.map((i) => (b.ids.includes(i.id) ? { ...i, reviewed: b.reviewed } : i));
      return json({ recorder_id: 'nvr-2', reviewed: b.reviewed, count: b.ids.length });
    }
    const thumb = /^frigate\/nvr-2\/reviews\/([^/]+)\/thumbnail$/.exec(p);
    if (thumb) {
      const it = m.items.find((i) => i.id === thumb[1]);
      return it && it.thumbnail === 'ready' ? route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }) : json(ENVELOPE('thumbnail_unavailable', 'אין תמונה לפריט הזה.'), 404);
    }
    const one = /^frigate\/nvr-2\/reviews\/([^/]+)$/.exec(p);
    if (one && method === 'GET') {
      const it = m.items.find((i) => i.id === one[1]);
      return it ? json({ ...wireOf(it), reviewed_at: it.reviewed ? '2026-10-06T07:00:00Z' : null, detection_ids: it.objects.map((_, k) => `${it.id}-d${k}`) }) : json(ENVELOPE('not_found', 'פריט הסקירה לא נמצא.'), 404);
    }
    return json(ENVELOPE('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

/** The F2b routes. Returns `{ status, body }` for a JSON answer, `null` for the clip bytes, `undefined` when the path is not one of them. */
function f2bRoute(m: FrigateMock, p: string, method: string, bodyOf: () => unknown, url: URL): { status: number; body: unknown } | null | undefined {
  const ok = (body: unknown) => ({ status: 200, body });
  const err = (status: number, code: string, msg: string) => ({ status, body: ENVELOPE(code, msg) });
  const c = m.ctl;
  const admin = m.perms.includes('system.configure');
  const first = (kind: string, supervised: boolean) => {
    if (c.firstWrites[kind]) return null;
    if (!supervised) return err(409, 'frigate_first_write_unsupervised', 'זו הכתיבה הראשונה מסוג זה אל Frigate. מנהל מערכת צריך לבצע אותה בפיקוח ולאשר זאת במפורש.');
    if (!admin) return err(403, 'forbidden', 'אין הרשאה');
    c.firstWrites[kind] = true;
    return null;
  };
  const change = (kind: string, cls: string, target: string, after: Record<string, unknown> | null, reversible: boolean, camera_id: string | null = null) => {
    const id = `chg-${c.changes.length + 1}`;
    c.changes.unshift({ id, recorder_id: 'nvr-2', camera_id, camera_key: camera_id ? keyOf(camera_id) : null, class: cls, kind, target, before: null, after, status: 'applied', error: null, reversible, reverts_id: null, actor: 'יוני', at: new Date().toISOString() });
    return id;
  };
  if (!p.startsWith('frigate/nvr-2/')) return undefined;
  const rest = p.slice('frigate/nvr-2/'.length);
  // only the F2b paths belong here: the F2 routes (policy, camera switches, profile, event retain / sub-label, changes) keep their own handlers
  const mine = rest === 'control/first-writes' || rest.startsWith('profile-auto') || rest.startsWith('exports') || rest.startsWith('cases') || /\/events\/manual$/.test(rest) || /^events\/[^/]+\/end$/.test(rest) || /\/clip\.mp4$/.test(rest);
  if (!mine) return undefined;
  const b = (method === 'GET' ? {} : (bodyOf() ?? {})) as Record<string, unknown>;
  if (method !== 'GET') m.ctl.writes.push(`${method} ${p} ${JSON.stringify(b)}`);
  if (m.ctl.failWith && method !== 'GET') {
    const code = m.ctl.failWith;
    m.ctl.failWith = null;
    return err(409, code, 'המקליט דחה את השינוי');
  }

  if (rest === 'control/first-writes') return ok({ recorder_id: 'nvr-2', done: { ...c.firstWrites }, can_supervise: admin });

  // automatic profile
  const setting = () => {
    const consent = c.auto.consent;
    const classOn = !!c.classes.profile;
    const done = !!c.firstWrites.profile_auto;
    return { recorder_id: 'nvr-2', mode: c.auto.mode, auto_apply_consent: consent, consent_by: consent ? 'u-admin' : null, consent_at: c.auto.consent_at, profile_class_on: classOn, first_write_done: done, will_apply: c.auto.mode === 'apply' && consent && classOn && done };
  };
  if (rest === 'profile-auto') return ok({ recorder_id: 'nvr-2', setting: setting(), items: c.auto.items, modes: ['off', 'suggest', 'apply'] });
  if (rest === 'profile-auto/setting' && method === 'PUT') {
    if (!admin) return err(403, 'forbidden', 'אין הרשאה');
    const mode = (b.mode as string | undefined) ?? c.auto.mode;
    const consent = b.auto_apply_consent === undefined ? c.auto.consent : !!b.auto_apply_consent;
    if (mode === 'apply' && !consent && b.mode === 'apply') return err(422, 'frigate_auto_consent_required', 'החלפה אוטומטית דורשת הסכמה מפורשת של מנהל המערכת.');
    c.auto.mode = (mode === 'apply' && !consent ? 'suggest' : mode) as typeof c.auto.mode;
    if (consent !== c.auto.consent) c.auto.consent_at = consent ? new Date().toISOString() : null;
    c.auto.consent = consent;
    if (c.auto.mode === 'off') for (const it of c.auto.items) if (it.status === 'suggested' || it.status === 'pending') Object.assign(it, { status: 'dismissed', reason: 'mode_off' });
    return ok({ recorder_id: 'nvr-2', setting: setting() });
  }
  const autoAct = /^profile-auto\/([^/]+)\/(apply|dismiss)$/.exec(rest);
  if (autoAct && method === 'POST') {
    const it = c.auto.items.find((x) => x.id === autoAct[1]);
    if (!it) return err(404, 'not_found', 'ההצעה לא נמצאה.');
    if (it.status !== 'suggested' && it.status !== 'pending') return err(409, 'frigate_auto_not_open', 'ההצעה כבר טופלה או הוחלפה בחדשה.');
    if (autoAct[2] === 'dismiss') {
      Object.assign(it, { status: 'dismissed', reason: 'by_user' });
      return ok({ recorder_id: 'nvr-2', id: it.id, status: 'dismissed' });
    }
    if (!b.confirm) return err(409, 'confirmation_required', 'פעולה זו דורשת אישור מפורש.');
    if (!c.classes.profile) return err(409, 'frigate_class_off', 'סוג הפעולה כבוי.');
    const f = first('profile_auto', !!b.supervised);
    if (f) return f;
    const prof = it.profile === 'none' ? null : (it.profile as string);
    const changed = c.active !== prof;
    c.active = prof;
    const chId = changed ? change('profile', 'profile', 'active', { profile: prof }, true) : null;
    Object.assign(it, { status: changed ? 'applied' : 'skipped', change_id: chId, processed_at: new Date().toISOString() });
    return ok({ recorder_id: 'nvr-2', id: it.id, status: it.status, changed, verified: true, active: prof, change_id: chId });
  }

  // exports
  if (rest === 'exports' && method === 'GET') {
    if (!admin && !m.perms.includes('analytics.exports')) return err(403, 'forbidden', 'אין הרשאה');
    return ok({ recorder_id: 'nvr-2', exports: c.exports, enabled: !!c.classes.exports });
  }
  if (rest === 'exports' && method === 'POST') {
    if (!c.classes.exports) return err(409, 'frigate_class_off', 'סוג הפעולה כבוי.');
    const f = first('export_create', !!b.supervised);
    if (f) return f;
    const id = `exp-new-${c.exports.length + 1}`;
    c.exports.unshift({ id, camera: keyOf(b.camera_id as string), camera_id: b.camera_id, name: b.name, date: b.start, in_progress: true, case_id: null, arx_created: true });
    const ch = change('export_create', 'exports', id, { name: b.name, camera: keyOf(b.camera_id as string), start: b.start, end: b.end, id }, true, b.camera_id as string);
    return ok({ recorder_id: 'nvr-2', camera_id: b.camera_id, created: true, export_id: id, verified: true, change_id: ch });
  }
  const exp = /^exports\/([^/]+)(\/delete)?$/.exec(rest);
  if (exp && method !== 'GET') {
    const row = c.exports.find((x) => x.id === exp[1]);
    if (!row || !row.arx_created) return err(409, 'frigate_object_not_arx', 'Arx משנה או מוחק רק פריטים שהוא יצר בעצמו.');
    const rowId = row.id as string;
    if (exp[2]) {
      if (!b.confirm) return err(409, 'confirmation_required', 'פעולה זו דורשת אישור מפורש.');
      const f = first('export_delete', !!b.supervised);
      if (f) return f;
      c.exports = c.exports.filter((x) => x.id !== rowId);
      change('export_delete', 'exports', rowId, null, false, row.camera_id as string);
      return ok({ recorder_id: 'nvr-2', deleted: true, export_id: rowId, verified: true, change_id: 'chx' });
    }
    const f = first('export_rename', !!b.supervised);
    if (f) return f;
    row.name = b.name;
    change('export_rename', 'exports', rowId, { name: b.name }, true, row.camera_id as string);
    return ok({ recorder_id: 'nvr-2', changed: true, export_id: rowId, name: b.name, verified: true, change_id: 'chx' });
  }

  // cases
  if (rest === 'cases' && method === 'GET') {
    if (!admin && !m.perms.includes('analytics.cases')) return err(403, 'forbidden', 'אין הרשאה');
    return ok({ recorder_id: 'nvr-2', cases: c.cases, enabled: !!c.classes.cases });
  }
  if (rest === 'cases' && method === 'POST') {
    if (!c.classes.cases) return err(409, 'frigate_class_off', 'סוג הפעולה כבוי.');
    const f = first('case_create', !!b.supervised);
    if (f) return f;
    const id = `case-new-${c.cases.length + 1}`;
    c.cases.unshift({ id, name: b.name, description: (b.description as string | null) ?? '', created_at: Math.floor(Date.now() / 1000), arx_created: true });
    const ch = change('case_create', 'cases', id, { name: b.name, description: b.description ?? null, id }, true);
    return ok({ recorder_id: 'nvr-2', created: true, case_id: id, verified: true, change_id: ch });
  }
  const cs = /^cases\/([^/]+)(\/delete)?$/.exec(rest);
  if (cs && method !== 'GET') {
    const row = c.cases.find((x) => x.id === cs[1]);
    if (!row || !row.arx_created) return err(409, 'frigate_object_not_arx', 'Arx משנה או מוחק רק פריטים שהוא יצר בעצמו.');
    const rowId = row.id as string;
    if (cs[2]) {
      if (!b.confirm) return err(409, 'confirmation_required', 'פעולה זו דורשת אישור מפורש.');
      const f = first('case_delete', !!b.supervised);
      if (f) return f;
      c.cases = c.cases.filter((x) => x.id !== rowId);
      change('case_delete', 'cases', rowId, null, false);
      return ok({ recorder_id: 'nvr-2', deleted: true, case_id: rowId, verified: true, change_id: 'chx' });
    }
    const f = first('case_rename', !!b.supervised);
    if (f) return f;
    row.name = b.name;
    change('case_rename', 'cases', rowId, { name: b.name }, true);
    return ok({ recorder_id: 'nvr-2', changed: true, case_id: rowId, name: b.name, verified: true, change_id: 'chx' });
  }

  // manual events
  const manual = /^cameras\/([^/]+)\/events\/manual$/.exec(rest);
  if (manual && method === 'POST') {
    if (!c.classes.events) return err(409, 'frigate_class_off', 'סוג הפעולה כבוי.');
    const f = first('event_create', !!b.supervised);
    if (f) return f;
    const id = `mev-${c.changes.length + 1}`;
    const ch = change('event_create', 'events', id, { camera: keyOf(manual[1]), label: b.label, duration_s: b.duration_s ?? null, sub_label: b.sub_label ?? null, id }, true, manual[1]);
    return ok({ recorder_id: 'nvr-2', camera_id: manual[1], created: true, event_id: id, open: b.duration_s === null, verified: true, change_id: ch });
  }
  const end = /^events\/([^/]+)\/end$/.exec(rest);
  if (end && method === 'POST') {
    const made = c.changes.find((x) => x.kind === 'event_create' && x.target === end[1]);
    if (!made) return err(409, 'frigate_object_not_arx', 'Arx מסיים רק אירועים ידניים שהוא יצר בעצמו.');
    const f = first('event_end', !!b.supervised);
    if (f) return f;
    made.reversible = false;
    const ch = change('event_end', 'events', end[1], { end_time: Date.now() / 1000 }, false, made.camera_id as string | null);
    return ok({ recorder_id: 'nvr-2', ended: true, event_id: end[1], verified: true, change_id: ch });
  }

  // the clip (GET only)
  const clip = /^cameras\/([^/]+)\/clip\.mp4$/.exec(rest);
  if (clip && method === 'GET') {
    const sup = url.searchParams.get('supervised') === 'true';
    m.ctl.clips.push(`${clip[1]} ${url.searchParams.get('start')} ${url.searchParams.get('end')} ${sup}`);
    const f = first('clip_read', sup);
    if (f) return f;
    return null;
  }
  return undefined;
}

export async function openApp(page: Page, hash: string, query = ''): Promise<void> {
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
}

/** FRGS: the config schema as routers/frigate_config.py serves it (the server's rules are test_frigate_config.py; this proves the screens). */
export const CONFIG_SCHEMA = {
  recorder_id: 'nvr-2', version: 'arx-frigate-0.18/1', sections: ['detect', 'motion', 'objects', 'snapshots', 'record', 'review'], persists: true, frigate_check: null,
  settings: [
    { key: 'detect.fps', section: 'detect', type: 'int', min: 1, max: 30, default: 5, unit: 'fps' },
    { key: 'motion.threshold', section: 'motion', type: 'int', min: 1, max: 255, default: 30 },
    { key: 'motion.contour_area', section: 'motion', type: 'int', min: 1, max: 1000, default: 10 },
    { key: 'motion.lightning_threshold', section: 'motion', type: 'number', min: 0.3, max: 1, step: 0.05, default: 0.8 },
    { key: 'objects.track', section: 'objects', type: 'labels', default: ['person'] },
    { key: 'snapshots.retain.default', section: 'snapshots', type: 'int', min: 0, max: 365, default: 10, unit: 'days' },
    { key: 'record.alerts.retain.days', section: 'record', type: 'int', min: 0, max: 365, default: 10, unit: 'days' },
    { key: 'record.detections.retain.days', section: 'record', type: 'int', min: 0, max: 365, default: 10, unit: 'days' },
    { key: 'review.alerts.labels', section: 'review', type: 'labels', default: ['person', 'car'] },
  ],
  zone: {
    fields: [{ key: 'points', type: 'polygon', min_points: 3, max_points: 40 }, { key: 'objects', type: 'labels', default: [] }, { key: 'inertia', type: 'int', min: 1, max: 10, default: 3 },
      { key: 'loitering_time', type: 'int', min: 0, max: 3600, default: 0, unit: 's' }],
    name_pattern: '^[a-z0-9_]{1,40}$', max_zones: 24,
  },
  labels: ['person', 'car', 'bicycle', 'motorcycle', 'bus', 'truck', 'dog', 'cat', 'bird', 'horse', 'package', 'face', 'license_plate'],
};

/** FRGS routes: `{ status, body }` for one of them, `undefined` otherwise. Same gates as the server: system.configure, class on, confirm, first write supervised. */
function configRoute(m: FrigateMock, p: string, method: string, bodyOf: () => unknown): { status: number; body: unknown } | undefined {
  const ok = (body: unknown) => ({ status: 200, body });
  const err = (status: number, code: string, msg: string) => ({ status, body: ENVELOPE(code, msg) });
  const c = m.ctl;
  const admin = m.perms.includes('system.configure');
  if (p === 'frigate/nvr-2/config/schema') return ok(CONFIG_SCHEMA);
  const r = /^frigate\/nvr-2\/cameras\/([^/]+)\/config(?:\/(zones|settings)\/([^/]+)(\/delete)?)?$/.exec(p);
  if (!r) return undefined;
  const [, cam, what, name, del] = r;
  const zones = (c.config.zones[cam] ??= []);
  const settings = (c.config.settings[cam] ??= { 'detect.fps': 5, 'objects.track': ['car', 'person'] });
  if (!what) {
    if (method !== 'GET') return undefined;
    return ok({
      recorder_id: 'nvr-2', camera_id: cam, camera_key: keyOf(cam), frame: { width: 1920, height: 1080 }, zones,
      settings: Object.fromEntries(CONFIG_SCHEMA.settings.map((s) => [s.key, settings[s.key] ?? null])),
      writable: !!c.classes.config && admin, first_write_done: { config_zone: !!c.firstWrites.config_zone, config_settings: !!c.firstWrites.config_settings }, can_supervise: admin,
    });
  }
  const b = (bodyOf() ?? {}) as Record<string, unknown>;
  c.writes.push(`${method} ${p} ${JSON.stringify(b)}`);
  if (!admin) return err(403, 'forbidden', 'אין הרשאה');
  if (!c.classes.config) return err(409, 'frigate_write_class_off', 'סוג הפעולה הזה כבוי עבור המקליט.');
  if (!b.confirm) return err(409, 'confirmation_required', 'פעולה זו דורשת אישור מפורש.');
  const kind = what === 'zones' ? 'config_zone' : 'config_settings';
  if (!c.firstWrites[kind]) {
    if (!b.supervised) return err(409, 'frigate_first_write_unsupervised', 'זו הכתיבה הראשונה מסוג זה אל Frigate. מנהל מערכת צריך לבצע אותה בפיקוח ולאשר זאת במפורש.');
    c.firstWrites[kind] = true;
  }
  if (c.failWith) {
    const code = c.failWith;
    c.failWith = null;
    return err(409, code, 'המקליט דחה את השינוי');
  }
  const log = (target: string, before: unknown, after: unknown) => {
    const id = `chg-${c.changes.length + 1}`;
    c.changes.unshift({ id, recorder_id: 'nvr-2', camera_id: cam, camera_key: keyOf(cam), class: 'config', kind, target, before, after, status: 'applied', error: null, reversible: true, reverts_id: null, actor: 'יוני', at: new Date().toISOString() });
    return id;
  };
  if (what === 'zones') {
    const i = zones.findIndex((z) => z.name === name);
    if (del) {
      if (i < 0) return err(404, 'not_found', 'האזור לא נמצא.');
      const [old] = zones.splice(i, 1);
      return ok({ deleted: true, verified: true, change_id: log(name, old, null) });
    }
    const zone = { name, points: b.points, editable: true, objects: b.objects ?? [], inertia: b.inertia ?? null, loitering_time: b.loitering_time ?? null };
    const before = i >= 0 ? zones[i] : null;
    if (i >= 0) zones[i] = zone;
    else zones.push(zone);
    return ok({ changed: true, verified: true, zone, change_id: log(name, before, zone) });
  }
  const values = (b.values ?? {}) as Record<string, unknown>;
  const before = Object.fromEntries(Object.keys(values).map((k) => [k, settings[k] ?? null]));
  Object.assign(settings, values);
  return ok({ changed: true, verified: true, settings: values, change_id: log(name, before, values) });
}
