import type { Page, Route } from '@playwright/test';
import { DEMO_ALARM } from '../src/fixtures/alarm-demo';

// CR-020 S2 phase B: a STATEFUL mocked backend (page.route on api/v1) for the cameras screen's write flows. It answers like the
// server of phase A (and of its fix branch, whose contract it follows): change rows carry `fields` as an object, `writable` is null
// in the list and a boolean only in the detail, the error codes are the contract's, a no-op is 200 with change:null, an undo is 201.
// The server's own checks are the backend tests; this mock is how the screen is proven against every outcome without a device.
// Lab-shaped values only: no address, serial or MAC anywhere. Shared by evidence-nvr-cameras-write.spec.ts and layout-nvr-cameras.spec.ts.

export const OPERATOR = ['video.live', 'devices.read', 'alarm.view'];
export const ADMIN = [...OPERATOR, 'map.read', 'entity.state.read', 'events.read', 'system.configure', 'sources.configure', 'rbac.assign'];
export const CONFIGURE = [...ADMIN, 'nvr.configure'];

export type Stream = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** What the next PUT / POST answers with (set by a test, kept until it is changed). */
export type PutMode = 'ok' | 'stale' | 'busy' | 'no_effect' | 'caps' | 'unknown' | 'abort' | 'in_progress' | 'noop' | 'reboot' | 'diverged' | 'rejected';

export interface Row {
  id: string;
  kind: string;
  status: string;
  camera_id: string;
  stream_ref: string;
  fields: Record<string, [unknown, unknown]>;
  created_at: string;
  rollback_of: string | null;
  etag_after: string;
  recorder_id: string;
}

export interface Mock {
  perms: string[];
  /** `can_write` of the list and the detail (the server's nvr.configure answer). */
  canWrite: boolean;
  /** the list: one NVR reading, or the registry's last one */
  stale: boolean;
  put: PutMode;
  /** the detail's options of this stream are null (capability documents unreadable) */
  noOptions: string[];
  /** the detail answers 503 for this camera */
  detailDown: string[];
  cameras: Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  rows: Row[];
  /** every request the screen made, "METHOD path" */
  hits: string[];
  /** non-GET requests with their JSON body */
  writes: { method: string; path: string; body: any }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  seq: number;
  /** a camera's detail was answered with this delay (ms) - lets a test look at the state before the detail arrives */
  detailDelay: number;
}

export const err = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: '', details });

export function stream(ref: string, role: string, v: Partial<Stream> = {}): Stream {
  const s: Stream = {
    stream_ref: ref, role, enabled: true, codec: 'H.264', codec_raw: 'H.264', codec_plus: false, profile: null, resolution: '1920x1080', fps: 25, fps_full: false,
    bitrate_mode: 'VBR', bitrate_kbps: 2048, quality: 60, gop: 50, svc: null, smart_codec: false, b_frames: null, webrtc: 'ok', webrtc_reason: 'h264',
    fields: { b_frames: { supported: false, editable: false } } as Record<string, unknown>, writable: null, not_writable_reason: null, etag: `${ref}e1`, ...v,
  };
  if (s.svc === null) s.fields.svc = { supported: false, editable: false };
  return s;
}

export function options(codec = 'H.264', isMain = true): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    codec: ['H.264', 'H.265'],
    profile: { 'H.264': ['Baseline', 'Main', 'High'], 'H.265': ['Main'] },
    resolution: isMain ? { 'H.264': ['2560x1440', '1920x1080', '1280x720'], 'H.265': ['2560x1440', '1920x1080'] } : { 'H.264': ['640x360', '640x480'], 'H.265': ['640x360'] },
    fps: [25, 20, 15, 12, 10, 8, 6, 4, 2, 1], fps_full: true,
    bitrate_mode: ['CBR', 'VBR'], bitrate_kbps: { min: 32, max: 8192 }, quality: [10, 30, 45, 60, 75, 90],
    gop: { min: 1, max: 400 }, svc: true, smart_codec: isMain, b_frames: false,
    locks: { smart_codec: ['gop', 'bitrate_mode', 'quality'] },
    source: 'capabilities', requested_codec: codec,
  };
}

export const RECORDER = {
  recorder_id: 'nvr-1', name: 'NVR ראשי', vendor: 'hikvision', model: 'DS-7616NI-DEMO', firmware: 'V4.84 demo', enabled: true, online: true, checked_at: '2026-10-01T09:00:00Z', error: null,
  capabilities: { read_encodings: true, write_encodings: true, add_channel: false, remove_channel: false, max_channels: null, used_channels: 3, encoding_fields: ['codec', 'svc'] },
};

export function newCameras(): Record<string, any>[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const cam = (ch: number, name: string, streams: Stream[], extra: Record<string, unknown> = {}) => ({
    camera_id: `cam-${ch}`, recorder_id: 'nvr-1', source_ref: String(ch), channel: ch, name, online: true, enabled_in_arx: true, streams, error: null, ...extra,
  });
  return [
    cam(1, 'כניסה ראשית', [
      stream('101', 'main', { resolution: '2560x1440', fps: null, fps_full: true, bitrate_kbps: 3072, svc: true, profile: 'High', webrtc: 'unknown', webrtc_reason: 'svc' }),
      stream('102', 'sub', { resolution: '640x360', fps: 20, bitrate_kbps: 1024, profile: 'Baseline', gop: 40 }),
    ]),
    cam(2, 'חצר אחורית', [
      stream('201', 'main', { codec: 'H.265', codec_raw: 'H.265', codec_plus: true, profile: 'Main', resolution: '2688x1520', bitrate_kbps: 4096, svc: false, smart_codec: true, webrtc: 'unknown', webrtc_reason: 'h265' }),
      stream('202', 'sub', { codec: 'H.265', codec_raw: 'H.265', profile: 'Main', resolution: '640x360', fps: 20, bitrate_kbps: 512, webrtc: 'unknown', webrtc_reason: 'h265' }),
    ]),
    cam(3, 'גג', [stream('301', 'main', { resolution: '1920x1080', svc: true, profile: 'Main', webrtc: 'unknown', webrtc_reason: 'svc' }), stream('302', 'sub', { resolution: '640x360', fps: 20 })], { online: false }),
  ];
}

export function newMock(perms = CONFIGURE): Mock {
  return { perms, canWrite: true, stale: false, put: 'ok', noOptions: [], detailDown: [], cameras: newCameras(), rows: [], hits: [], writes: [], seq: 0, detailDelay: 0 };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function findStream(st: Mock, camId: string, ref: string): { cam: Record<string, any>; s: Stream } | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const cam = st.cameras.find((c) => c.camera_id === camId);
  const s = cam?.streams.find((x: Stream) => x.stream_ref === ref);
  return cam && s ? { cam, s } : null;
}

/** The value of a field in the request's shape (fps: 'full' or a number). */
const valueOf = (s: Stream, f: string): unknown => (f === 'fps' ? (s.fps_full ? 'full' : s.fps) : s[f]);

function setField(s: Stream, f: string, v: unknown) {
  if (f === 'fps') {
    s.fps_full = v === 'full';
    s.fps = v === 'full' ? null : v;
  } else if (f === 'codec') {
    s.codec = v;
    s.codec_raw = v;
    s.profile = null;
  } else s[f] = v;
  if (f === 'svc') [s.webrtc, s.webrtc_reason] = v === true ? ['unknown', 'svc'] : ['ok', 'h264'];
}

function detailOf(st: Mock, camId: string) {
  const cam = st.cameras.find((c) => c.camera_id === camId);
  if (!cam) return null;
  const streams = cam.streams.map((s: Stream) => ({ ...clone(s), writable: true, not_writable_reason: null }));
  const opts: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const s of streams) opts[s.stream_ref] = st.noOptions.includes(s.stream_ref) ? null : options('H.264', s.role === 'main');
  return { camera: { ...clone(cam), streams }, options: opts, stale: st.stale, can_write: st.canWrite };
}

export async function install(page: Page, st: Mock) {
  await page.routeWebSocket(/\/api\/v1\/ha\/ws/, () => {});
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const method = req.method();
    st.hits.push(`${method} ${p}${url.search}`);
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: st.perms, permissions_any: st.perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {} }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 3, cameras_last_ok: '2026-10-01T08:00:00Z', cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'alarm/panels') return json({ ...DEMO_ALARM, panels: DEMO_ALARM.panels.slice(0, 1), counts: { ...DEMO_ALARM.counts, panels: 1 } });
    if (p === 'alarm/config') return json({ panels: DEMO_ALARM.panels.slice(0, 1), excluded: [], overrides: [], candidates: { controls: [], sensors: [] }, integrations: {}, settings: {} });
    if (p === 'cameras') return json({ cameras: [], recorder: null, can_sync: false });
    if (!st.perms.includes('system.configure') && p.startsWith('nvr/')) return json(err('forbidden', 'אין הרשאה לפעולה הזו.'), 403);

    if (p === 'nvr/recorders') return json({ recorders: [RECORDER], can_write: st.canWrite });
    if (p === 'nvr/cameras') {
      const cameras = st.cameras.map((c) => ({ ...clone(c), streams: c.streams.map((s: Stream) => ({ ...clone(s), writable: null, not_writable_reason: null, ...(st.stale ? { etag: null } : {}) })) }));
      return json({ cameras, recorders_failed: st.stale ? ['nvr-1'] : [], stale: st.stale, error: st.stale ? 'source_unavailable' : null, can_write: st.canWrite });
    }
    let m = /^nvr\/cameras\/([^/]+)$/.exec(p);
    if (m && method === 'GET') {
      if (st.detailDelay) await new Promise((r) => setTimeout(r, st.detailDelay));
      if (st.detailDown.includes(m[1])) return json(err('source_unavailable', 'ה־NVR אינו זמין כרגע.'), 503);
      const d = detailOf(st, m[1]);
      return d ? json(d) : json(err('not_found', 'המצלמה לא נמצאה.'), 404);
    }
    m = /^nvr\/cameras\/([^/]+)\/streams\/(\d+)\/options$/.exec(p);
    if (m && method === 'GET') {
      const f = findStream(st, m[1], m[2]);
      return f ? json(options(url.searchParams.get('codec') ?? 'H.264', f.s.role === 'main')) : json(err('not_found', 'הזרם לא נמצא.'), 404);
    }
    m = /^nvr\/cameras\/([^/]+)\/streams\/(\d+)$/.exec(p);
    if (m && method === 'PUT') return put(st, route, m[1], m[2], req.postDataJSON());
    if (p === 'nvr/changes' && method === 'GET') {
      const cam = url.searchParams.get('camera_id');
      const rows = st.rows.filter((r) => !cam || r.camera_id === cam).slice().reverse().map((r) => ({ ...r, has_before: true, has_after: true, etag_before: null, reboot_required: 0, error: null }));
      return json({ changes: rows });
    }
    m = /^nvr\/changes\/([^/]+)\/rollback$/.exec(p);
    if (m && method === 'POST') return rollback(st, route, m[1], req.postDataJSON());
    return json(err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

async function put(st: Mock, route: Route, camId: string, ref: string, body: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
  const url = new URL(route.request().url());
  st.writes.push({ method: 'PUT', path: url.pathname.replace(/^.*\/api\/v1\//, ''), body });
  const f = findStream(st, camId, ref);
  if (!f) return json(err('not_found', 'הזרם לא נמצא.'), 404);
  if (body?.confirm !== true) return json(err('confirm_required', 'יש לאשר את השינוי.'), 422);
  const mode = st.put;
  if (mode === 'abort') return route.abort('failed');
  if (mode === 'stale' || body.if_match !== f.s.etag) {
    if (mode === 'stale') setField(f.s, 'svc', f.s.svc !== true), (f.s.etag = `${ref}e${++st.seq + 100}`); // someone else changed it on the NVR
    return json(err('stale', 'ההגדרות השתנו ב־NVR. נטען מחדש.', { stream: { ...clone(f.s), writable: null } }), 409);
  }
  if (mode === 'in_progress') return json({ ...err('write_in_progress', 'שינוי אחר של הזרם הזה עדיין מתבצע.'), retryable: true }, 409);
  if (mode === 'busy') return json(err('nvr_busy', 'ה־NVR עסוק.', { change_id: 'x' }), 409);
  if (mode === 'no_effect') return json(err('nvr_no_effect', 'ה־NVR אישר את הכתיבה אבל לא שינה את ההגדרה.', { change_id: 'x' }), 409);
  if (mode === 'diverged') return json(err('nvr_diverged', 'ה־NVR שינה רק חלק מההגדרות.', { change_id: 'x' }), 409);
  if (mode === 'rejected') return json(err('nvr_rejected', 'ה־NVR דחה את המסמך.'), 409);
  if (mode === 'caps') return json(err('capabilities_unreadable', 'ה־NVR אינו מפרסם את יכולות הזרם הזה.', { reason: 'caps_404' }), 503);
  if (mode === 'unknown') return json(err('source_unavailable', 'ה־NVR אינו זמין כרגע.', { outcome: 'unknown' }), 503);
  const fields: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(body.changes ?? {})) if (valueOf(f.s, k) !== v) fields[k] = [valueOf(f.s, k), v];
  if (mode === 'noop' || !Object.keys(fields).length) return json({ change: null, stream: { ...clone(f.s), writable: true }, applied_fields: [], unchanged_fields: Object.keys(body.changes ?? {}), reboot_required: false });
  for (const [k, [, to]] of Object.entries(fields)) setField(f.s, k, to);
  f.s.etag = `${ref}e${++st.seq + 1}`;
  const row: Row = { id: `chg-${st.seq}`, kind: 'stream_encoding', status: 'applied', camera_id: camId, stream_ref: ref, fields, created_at: new Date(Date.now() + st.seq * 1000).toISOString(), rollback_of: null, etag_after: f.s.etag, recorder_id: 'nvr-1' };
  st.rows.push(row);
  return json({ change: { id: row.id, status: 'applied', kind: 'stream_encoding', created_at: row.created_at }, stream: { ...clone(f.s), writable: true }, applied_fields: Object.keys(fields), unchanged_fields: [], reboot_required: mode === 'reboot' });
}

async function rollback(st: Mock, route: Route, id: string, body: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
  const url = new URL(route.request().url());
  st.writes.push({ method: 'POST', path: url.pathname.replace(/^.*\/api\/v1\//, ''), body });
  const orig = st.rows.find((r) => r.id === id);
  if (!orig) return json(err('not_found', 'השינוי לא נמצא.'), 404);
  if (body?.confirm !== true) return json(err('confirm_required', 'יש לאשר את הביטול.'), 422);
  const f = findStream(st, orig.camera_id, orig.stream_ref);
  if (!f) return json(err('not_found', 'הזרם לא נמצא.'), 404);
  if (orig.status !== 'applied') return json(err('not_rollbackable', 'אי אפשר לבטל את השינוי הזה.'), 409);
  if (st.put === 'stale' || f.s.etag !== orig.etag_after) return json(err('stale', 'הזרם השתנה מאז השינוי, ולכן אי אפשר לבטל אותו.', { stream: { ...clone(f.s), writable: null } }), 409);
  if (st.put === 'busy') return json(err('nvr_busy', 'ה־NVR עסוק.'), 409);
  const back: Record<string, [unknown, unknown]> = {};
  for (const [k, [from, to]] of Object.entries(orig.fields)) {
    setField(f.s, k, from);
    back[k] = [to, from];
  }
  f.s.etag = `${orig.stream_ref}e${++st.seq + 1}`;
  orig.status = 'rolled_back';
  const row: Row = { id: `chg-${st.seq}`, kind: 'stream_encoding', status: 'applied', camera_id: orig.camera_id, stream_ref: orig.stream_ref, fields: back, created_at: new Date(Date.now() + st.seq * 1000).toISOString(), rollback_of: id, etag_after: f.s.etag, recorder_id: 'nvr-1' };
  st.rows.push(row);
  return json({ change: { id: row.id, status: 'applied', kind: 'stream_encoding', created_at: row.created_at }, stream: { ...clone(f.s), writable: true }, rollback_of: id, reboot_required: false }, 201);
}
