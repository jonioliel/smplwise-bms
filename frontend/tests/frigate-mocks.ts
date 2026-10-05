import type { Page, Route } from '@playwright/test';
import { FRIGATE_CAMERAS, FRIGATE_CAPABILITIES, FRIGATE_HEALTH, REVIEW_ITEMS, reviewDetail, reviewList } from '../src/fixtures/frigate';
import type { ReviewItem, ReviewList } from '../src/api/frigate';

// NN5-F1B: one MOCKED backend for the Frigate screens (settings connection test, recorder health, the review screen, the live wall's
// refreshing stills). The routes follow src/api/frigate.ts (the contract assumed until pilot/NN5-F1A-backend publishes its own);
// the server's rules are the backend tests. Every name is made up: no real host, camera frame or credential.

export const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const ENVELOPE = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: '', details });

export const ADMIN = ['video.live', 'video.playback', 'map.read', 'devices.read', 'events.read', 'analytics.read', 'analytics.review', 'system.configure', 'rbac.assign'];

export interface FrigateMock {
  perms: string[];
  /** the review routes answer: ok | forbidden (403) | error (500) | offline (stale list) | none (available: false) | missing (404) */
  reviews: 'ok' | 'forbidden' | 'error' | 'offline' | 'none' | 'missing' | 'empty';
  /** milliseconds the review list waits before answering (the loading state) */
  delayMs: number;
  /** the mark route fails with 500 */
  markFails: boolean;
  items: ReviewItem[];
  hits: string[];
  marks: { ids: string[]; reviewed: boolean }[];
  /** the connection test answer of the Frigate vendor */
  test: { status: number; body: Record<string, unknown> };
  /** GET cameras/<id>/snapshot.jpg requests, in order, with the time of each */
  stills: { id: string; at: number }[];
  /** how the cameras answer: `still` = no live stream */
  stillRefreshS: number;
}

export function newFrigateMock(over: Partial<FrigateMock> = {}): FrigateMock {
  return {
    perms: ADMIN, reviews: 'ok', delayMs: 0, markFails: false, items: REVIEW_ITEMS.map((i) => ({ ...i })), hits: [], marks: [],
    test: { status: 200, body: { ok: true, code: 'ok', model: 'Frigate 0.18.0', firmware: '0.18.0', channels: 6, capabilities: FRIGATE_CAPABILITIES } },
    stills: [], stillRefreshS: 5, ...over,
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
    recording: { state: 'ok', recording: 4, watched: 4, stopped: [], exception: [] }, channels: { state: 'ok', total: 4, connected: 4, disconnected: [] }, clock: { state: 'ok', drift_s: 1 }, certificate: null },
  { id: 'nvr-2', name: 'Frigate מחסן', vendor: 'frigate', status: 'warn', checked_at: '2026-10-06T08:00:00Z', detail_supported: true, api: { state: 'ok', latency_ms: 210 },
    disks: { state: 'ok', items: [{ ref: 'recordings', state: 'ok', text: 'תקין', total_mb: 500000, free_mb: 205000 }], free_pct: 41, full: false, fill_days: null, alarms: [] },
    recording: { state: 'ok', recording: 3, watched: 3, stopped: [], exception: [], continuous: false },
    channels: { state: 'warn', total: 4, connected: 3, disconnected: [{ channel: 3, name: 'חניה' }] }, clock: { state: 'ok', drift_s: 0 }, certificate: null, frigate: FRIGATE_HEALTH },
];

const recorder = (id: string, name: string, vendor: string, label: string) => ({
  id, primary: id === 'nvr-1', name, vendor, vendor_label: label, enabled: true, removed: false, removed_at: null, sort_order: id === 'nvr-1' ? 0 : 1, time_zone: null,
  model: vendor === 'frigate' ? 'Frigate 0.18.0' : 'DS-FAKE', firmware: vendor === 'frigate' ? '0.18.0' : 'V4', last_seen_at: '2026-10-06T08:00:00Z', cameras: 4, cameras_enabled: 4,
  status: { state: 'online', error: null, events_connected: true, discovery_last_ok: '2026-10-06T08:00:00Z' }, pending_restart: false,
  capabilities: vendor === 'frigate' ? { vendor, live: 'none', playback: 'hls', events: 'push' } : { vendor, live: 'rtsp', playback: 'rtsp', events: 'push' },
  connection: { vendor, host: `${id}.fake.test`, http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'ok', revision: 1, updated_at: null, vendor_locked: true },
});

const cam = (id: string, name: string, recorder_id: string, channel: number, extra: Record<string, unknown> = {}) => ({
  id, recorder_id, channel, name, name_source: name, alias: null, enabled: true, sort_order: channel, grid_col_span: 1, main_track: null, sub_track: null, status: 'online', last_seen_at: null,
  can_view_live: true, recorder_name: recorder_id === 'nvr-2' ? 'Frigate מחסן' : 'מקליט ראשי', recorder_enabled: true, ...extra,
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
    if (p === 'health') return json({ status: 'ok', version: 'test', mode: 'full' });
    if (p.startsWith('health/report')) return json({ status: 'ok', mode: 'full', version: 'test', uptime_s: 7200, checked_at: '2026-10-06T08:00:00Z', probe_ttl_s: 20, checks: [] });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p === 'events/summary' || p.startsWith('events')) return json({ events: [], total: 0, today: { total: 0, unacked: 0 }, windows: [], ingest: null, facets: { types: [], cameras: [] }, next_cursor: null });

    // cameras: one Hikvision (a stream) and the Frigate cameras (no stream: a refreshing still)
    if (p === 'cameras' && method === 'GET') {
      const cameras = [
        cam('hk-1', 'לובי', 'nvr-1', 1),
        ...FRIGATE_CAMERAS.map((c, i) => cam(c.id, c.name, 'nvr-2', i + 1, { live_kind: 'still', still_refresh_s: m.stillRefreshS })),
        cam('fg-off', 'מצלמה כבויה', 'nvr-2', 9, { live_kind: 'still', status: 'offline' }),
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
    if (p === 'recorders') return json({ recorders: [recorder('nvr-1', 'מקליט ראשי', 'hikvision', 'Hikvision'), recorder('nvr-2', 'Frigate מחסן', 'frigate', 'Frigate')], count: 2, can_manage: true, restart: 'manual', pending_restart: false });
    if (p === 'recorder-health') return json({ recorders: CARDS, interval_s: 60, can_manage: true });
    if (p === 'recorder-health/settings') return json({ values: { interval_s: 60, latency_ms: 1500, recording_gap_min: 30, clock_drift_s: 60, disk_fill_days: 0, cert_days: 30, recover_s: 120, continuous_recorders: [], camera_recording: {} }, ranges: {}, cameras: [] });
    if (p === 'setup/state' || p.startsWith('setup/check/')) return json({ version: 'test', mode: 'full', checked_at: '2026-10-06T08:00:00Z', steps: [], done: 0, total: 0, ready: false, next: null, thresholds: { drift_ok_s: 2, drift_fail_s: 30 }, check_every_s: 5, live_ttl_s: 600 });

    // the review screen
    if (p === 'analytics/reviews' && method === 'GET') {
      if (m.delayMs) await new Promise((r) => setTimeout(r, m.delayMs));
      switch (m.reviews) {
        case 'forbidden': return json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
        case 'error': return json(ENVELOPE('source_error', 'המקליט החזיר שגיאה'), 500);
        case 'missing': return json(ENVELOPE('not_found', 'לא נמצא'), 404);
        case 'none': return json({ available: false, items: [], counts: { alert: 0, detection: 0, motion: 0 }, unreviewed: { alert: 0, detection: 0, motion: 0 }, facets: { objects: [] }, next_cursor: null } satisfies ReviewList);
        default: break;
      }
      const q = url.searchParams;
      const list = reviewList(m.reviews === 'empty' ? [] : m.items, { layer: q.get('layer') ?? 'alert', camera: q.get('camera_id') ?? undefined, object: q.get('object') ?? undefined, reviewed: q.get('reviewed') ?? undefined });
      return json(m.reviews === 'offline' ? { ...list, stale: true } : list);
    }
    if (p === 'analytics/reviews/reviewed' && method === 'POST') {
      const b = req.postDataJSON() as { ids: string[]; reviewed: boolean };
      m.marks.push(b);
      if (m.markFails) return json(ENVELOPE('source_error', 'השמירה נכשלה'), 500);
      m.items = m.items.map((i) => (b.ids.includes(i.id) ? { ...i, reviewed: b.reviewed } : i));
      return json({ changed: b.ids });
    }
    const one = /^analytics\/reviews\/([^/]+)$/.exec(p);
    if (one && method === 'GET') {
      const d = reviewDetail(one[1], m.items);
      return d ? json(d) : json(ENVELOPE('not_found', 'לא נמצא'), 404);
    }
    return json(ENVELOPE('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

export async function openApp(page: Page, hash: string, query = ''): Promise<void> {
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
}
