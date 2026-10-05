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
}

export function newFrigateMock(over: Partial<FrigateMock> = {}): FrigateMock {
  return {
    perms: ADMIN, reviews: 'ok', delayMs: 0, markFails: false, pageLimit: 0, recorders: 'two', items: REVIEW_ITEMS.map((i) => ({ ...i })), hits: [], marks: [],
    test: { status: 200, body: { ok: true, code: 'ok', model: 'Frigate', firmware: '0.18.0-fake', channels: 4, transport: { scheme: 'https', insecure: false }, warnings: [] } },
    stills: [], stillRefreshS: 0, ...over,
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

export async function openApp(page: Page, hash: string, query = ''): Promise<void> {
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
}
