import type { Page, Route, WebSocketRoute } from '@playwright/test';

// CR-028 (CAST1 UI): the mock layer of the cast specs. It speaks the WIRE contract of the backend (docs/changes/CR-028 section 12.5): targets, sessions,
// start / extend / switch / stop, config, origin check, screens, test cast - with invented names only (no real device, no real address). The whole app runs
// against it through page.route (`/me` carries the permissions, so the navigation and the gates are the real ones) and the live-window socket is a
// routed WebSocket the spec can push `cast_sessions_changed` into.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, user_message: string, details: Record<string, unknown> = {}) => json(route, { code, user_message, retryable: false, correlation_id: 'mock', details }, status);

export const PERMS = {
  /** operator: may cast, sees the live screens */
  operator: ['video.live', 'media.read', 'media.cast', 'devices.read'],
  /** system administrator */
  admin: ['video.live', 'media.read', 'media.cast', 'media.bulk', 'system.configure', 'devices.read', 'rbac.assign'],
  /** a viewer: sees the media but cannot cast */
  viewer: ['video.live', 'media.read', 'devices.read'],
};

export interface MockSession {
  session_id: string;
  device_key: string;
  screen_name: string;
  floor_name: string | null;
  area_name: string | null;
  kind: 'camera' | 'test';
  camera_id: string;
  camera_name: string | null;
  profile: 'sub' | 'main';
  state: 'starting' | 'playing' | 'not_confirmed' | 'stopped';
  started_at: string;
  expires_at: string | null;
  permanent: boolean;
  extended_n: number;
  extensions_left: number;
  first_segment_at: string | null;
  started_by_name: string | null;
  mine: boolean;
  channel: 'local' | 'remote';
  stopped_at: string | null;
  stop_reason: string | null;
  power_off_after: boolean;
  power_off_state: string | null;
  can: { stop: boolean; extend: boolean; switch: boolean };
}

export interface MockTarget {
  key: string;
  name: string;
  kind: string;
  floor_id: string | null;
  floor_name: string | null;
  area_name: string | null;
  state: 'free' | 'casting' | 'playing_music' | 'off' | 'unavailable';
  blocked: null | 'no_permission' | 'unsupported' | 'not_allowed' | 'public' | 'unavailable';
  confidence: string | null;
  permanent_allowed: boolean;
  minutes: number;
  main_allowed: boolean;
  casting_session_id: string | null;
}

export interface CastMock {
  calls: { method: string; path: string; body: unknown }[];
  targets: MockTarget[];
  sessions: MockSession[];
  config: Record<string, unknown>;
  screens: Record<string, unknown>[];
  ready: boolean;
  reason: string | null;
  /** The routed live-window socket (null until the app opened it). */
  ws: WebSocketRoute | null;
  /** Push `cast_sessions_changed` to the page (the client refetches). */
  emit: () => void;
  /** Make the next start answer with this error. */
  failNextStart: { status: number; code: string; message: string } | null;
  /** Make the next start answer 200 refused. */
  refuseNextStart: string | null;
}

export interface CastMockOptions {
  perms?: string[];
  channel?: 'local' | 'remote';
  ready?: boolean;
  reason?: string | null;
  targets?: MockTarget[];
  blockedDisplay?: 'grey_reason' | 'hide' | 'grey_admin';
  /** `ui.dd_phone` of the installation */
  ddPhone?: 'list' | 'sheet';
  /** start from this state of sessions */
  sessions?: MockSession[];
  mainPossible?: boolean;
}

export const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString().replace(/\.\d+Z$/, 'Z');

export function target(key: string, name: string, over: Partial<MockTarget> = {}): MockTarget {
  return { key, name, kind: 'screen', floor_id: 'f0', floor_name: 'קומת קרקע', area_name: 'סלון', state: 'free', blocked: null, confidence: 'confirmed', permanent_allowed: false, minutes: 30, main_allowed: false, casting_session_id: null, ...over };
}

export const DEFAULT_TARGETS: MockTarget[] = [
  target('md-living', 'טלוויזיה סלון', { area_name: 'סלון' }),
  target('md-kitchen', 'מסך מטבח', { area_name: 'מטבח', state: 'playing_music' }),
  target('md-lobby', 'מסך לובי', { area_name: 'לובי', blocked: 'public', state: 'free', confidence: 'confirmed' }),
  target('md-hub', 'מסך חכם (Nest Hub)', { area_name: 'חדר שינה', floor_id: 'f1', floor_name: 'קומה א', permanent_allowed: true, minutes: 45, main_allowed: true, confidence: 'likely' }),
  target('md-old', 'טלוויזיה חדר ילדים', { area_name: 'חדר ילדים', floor_id: 'f1', floor_name: 'קומה א', blocked: 'not_allowed' }),
];

export function session(over: Partial<MockSession> = {}): MockSession {
  return {
    session_id: 'cs-1', device_key: 'md-living', screen_name: 'טלוויזיה סלון', floor_name: 'קומת קרקע', area_name: 'סלון', kind: 'camera', camera_id: 'cam-1', camera_name: 'לובי כניסה', profile: 'sub',
    state: 'playing', started_at: iso(-60_000), expires_at: iso(27 * 60_000 + 24_000), permanent: false, extended_n: 0, extensions_left: 8, first_segment_at: iso(-50_000), started_by_name: 'דנה', mine: true,
    channel: 'local', stopped_at: null, stop_reason: null, power_off_after: false, power_off_state: null, can: { stop: true, extend: true, switch: true }, ...over,
  };
}

const CAMERAS = [1, 2, 3].map((n) => ({
  id: `cam-${n}`, recorder_id: 'r1', channel: n, name: ['לובי כניסה', 'חניה', 'גינה'][n - 1], name_source: 'nvr', alias: null, enabled: true, sort_order: n, grid_col_span: 1, main_track: n * 100 + 1, sub_track: n * 100 + 2,
  status: 'online', last_seen_at: '2026-10-05T10:00:00Z', stream: { codec: 'H.264', resolution: '1920x1080', fps: 15, bitrate_kbps: 2048 }, encoding: null, can_view_live: true,
}));

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export async function installCastMock(page: Page, opts: CastMockOptions = {}): Promise<CastMock> {
  const perms = opts.perms ?? PERMS.operator;
  const st: CastMock = {
    calls: [], targets: opts.targets ? [...opts.targets] : DEFAULT_TARGETS.map((x) => ({ ...x })), sessions: opts.sessions ? [...opts.sessions] : [],
    config: { enabled: true, origin: 'http://192.0.2.10:18092', origin_verified_at: '2026-10-05T09:00:00Z', max_sessions: 2, minutes: 30, allow_main: false, power_off_after: true, blocked_display: opts.blockedDisplay ?? 'grey_reason', max_extensions: 8, test_seconds: 60 },
    screens: DEFAULT_TARGETS.filter((x) => !x.blocked || x.blocked === 'not_allowed' || x.blocked === 'public').map((x) => ({
      key: x.key, name: x.name, kind: 'screen', approved: true, public: x.blocked === 'public', floor_name: x.floor_name, area_name: x.area_name, detected: { method: 'cast_hls', confidence: 'confirmed', reason: 'cast_video' },
      effective: { method: 'cast_hls', confidence: 'confirmed', reason: 'cast_video' }, target_entity_id: `media_player.demo_${x.key.replace('md-', '')}`, settings: { allow: x.blocked !== 'not_allowed', method: 'auto', minutes: null, permanent: x.permanent_allowed, allow_main: null }, casting_session_id: null,
    })),
    ready: opts.ready ?? true, reason: opts.reason ?? null, ws: null, emit: () => undefined, failNextStart: null, refuseNextStart: null,
  };
  for (const sx of st.sessions) {
    const tx = st.targets.find((x) => x.key === sx.device_key);
    if (tx && sx.state !== 'stopped') { tx.state = 'casting'; tx.casting_session_id = sx.session_id; }
  }
  st.emit = () => st.ws?.send(JSON.stringify({ type: 'cast_sessions_changed', payload: { reason: 'test' } }));
  const remote = opts.channel === 'remote';
  const viewSessions = () => st.sessions.map((s) => ({ ...s }));
  const open = () => st.sessions.filter((s) => s.state !== 'stopped');
  let seq = 1;

  await page.routeWebSocket(/\/ha\/ws/, (ws) => {
    st.ws = ws;
  });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') {
      return json(route, { user: { id: 'u-cast', username: 'cast', display_name: 'דנה', source: 'ingress' }, channel: remote ? 'remote' : 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    }
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', ...(opts.ddPhone ? { 'ui.dd_phone': opts.ddPhone } : {}) }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'cameras' && method === 'GET') return json(route, { cameras: CAMERAS, recorders: [{ id: 'r1', name: 'NVR' }], recorder: { id: 'r1', name: 'NVR', model: null, firmware: null, last_seen_at: null }, can_sync: false });
    if (/^cameras\/[^/]+\/snapshot/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (p === 'devices/tree') return json(route, { floors: [], unassigned: { area_id: 'unassigned', name: 'ללא שיוך' }, scoped: false, can_bulk: false });
    if (p === 'multimedia/status') return json(route, { screens: 0, players: 0, groups: 0, bridge: { paired: true, version: '0.7.0', media_ready: true } });
    if (!p.startsWith('multimedia/cast')) return err(route, 404, 'not_found', 'לא נמצא');

    const c = p.slice('multimedia/cast'.length).replace(/^\//, '');
    const body = method === 'GET' || method === 'DELETE' ? null : req.postDataJSON();
    st.calls.push({ method, path: c + url.search, body });
    const localOnly = ['config', 'origin/check', 'screens', 'test'].some((x) => c === x || c.startsWith('screens/'));
    if (remote && localOnly) return err(route, 404, 'not_found', 'לא נמצא');
    if (c === 'targets') {
      if (!perms.includes('media.cast')) return err(route, 403, 'forbidden', 'אין הרשאה');
      return json(route, { ready: st.ready, reason: st.reason, targets: st.ready ? st.targets : [], blocked_display: st.config.blocked_display, main_possible: opts.mainPossible ?? false, max_sessions: st.config.max_sessions, active: open().length });
    }
    if (c === 'sessions' && method === 'GET') return json(route, { sessions: viewSessions(), max_sessions: st.config.max_sessions });
    if (c === 'sessions' && method === 'POST') {
      const b = body as { target_key: string; camera_id: string; profile?: 'sub' | 'main'; duration?: string; confirmed?: boolean };
      if (st.failNextStart) {
        const f = st.failNextStart;
        st.failNextStart = null;
        return err(route, f.status, f.code, f.message);
      }
      const tg = st.targets.find((x) => x.key === b.target_key);
      if (!tg) return err(route, 404, 'screen_not_found', 'המסך לא נמצא.');
      if (tg.state === 'playing_music' && !b.confirmed) return err(route, 409, 'cast_busy', 'המסך עסוק: מנגן מוזיקה.');
      const cam = CAMERAS.find((x) => x.id === b.camera_id);
      const s = session({
        session_id: `cs-${++seq}`, device_key: tg.key, screen_name: tg.name, floor_name: tg.floor_name, area_name: tg.area_name, camera_id: b.camera_id, camera_name: cam?.name ?? null, profile: b.profile ?? 'sub', state: 'starting',
        started_at: iso(0), expires_at: b.duration === 'permanent' ? null : iso(tg.minutes * 60_000), permanent: b.duration === 'permanent', first_segment_at: null, power_off_after: tg.state === 'off',
      });
      if (st.refuseNextStart) {
        const code = st.refuseNextStart;
        st.refuseNextStart = null;
        s.state = 'stopped';
        s.stop_reason = 'refused';
        s.stopped_at = iso(0);
        st.sessions.push(s);
        return json(route, { status: 'refused', error: code, session: s }, 200);
      }
      st.sessions = st.sessions.filter((x) => !(x.device_key === tg.key && x.state !== 'stopped'));
      st.sessions.push(s);
      tg.state = 'casting';
      tg.casting_session_id = s.session_id;
      // the TV reaches the stream a moment later
      setTimeout(() => { s.state = 'playing'; s.first_segment_at = iso(0); st.emit(); }, 700);
      return json(route, { status: 'accepted', error: null, session: s }, 202);
    }
    const one = /^sessions\/([^/]+)(\/(extend|switch))?$/.exec(c);
    if (one) {
      const s = st.sessions.find((x) => x.session_id === one[1]);
      if (!s) return err(route, 404, 'not_found', 'השידור לא נמצא.');
      if (one[3] === 'extend' && method === 'POST') {
        if (s.extensions_left <= 0) return err(route, 409, 'extend_limit', 'אי אפשר להאריך יותר: התחילו שידור חדש.');
        s.extended_n += 1;
        s.extensions_left -= 1;
        s.expires_at = iso(Date.parse(s.expires_at ?? iso(0)) - Date.now() + 30 * 60_000);
        return json(route, s);
      }
      if (one[3] === 'switch' && method === 'POST') {
        const b = body as { camera_id: string };
        s.camera_id = b.camera_id;
        s.camera_name = CAMERAS.find((x) => x.id === b.camera_id)?.name ?? null;
        return json(route, { status: 'accepted', error: null, session: s }, 202);
      }
      if (method === 'DELETE') {
        s.state = 'stopped';
        s.stopped_at = iso(0);
        s.stop_reason = 'user';
        const tg = st.targets.find((x) => x.key === s.device_key);
        if (tg) { tg.state = 'free'; tg.casting_session_id = null; }
        const cancelled = url.searchParams.get('power_off') === 'false';
        return json(route, { status: 'stopped', stop: 'sent', power_off: s.power_off_after ? (cancelled ? 'cancelled' : 'sent') : null, session: s });
      }
      return json(route, s);
    }
    if (c === 'config' && method === 'GET') return json(route, cfgAnswer(st));
    if (c === 'config' && method === 'PUT') {
      const b = body as Record<string, unknown>;
      if (typeof b.origin === 'string' && b.origin && !/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/.test(b.origin)) return err(route, 422, 'validation', 'כתובת המקור חייבת להיות http://כתובת-IP:פורט של רשת פרטית.', { fields: ['origin'] });
      Object.assign(st.config, b);
      if ('origin' in b) st.config.origin_verified_at = null;
      return json(route, { changed: Object.keys(b), ...cfgAnswer(st) });
    }
    if (c === 'origin/check') {
      const ok = !!st.config.origin;
      if (ok) st.config.origin_verified_at = iso(0);
      return json(route, { ok, reason: ok ? null : 'origin_missing' });
    }
    if (c === 'screens' && method === 'GET') return json(route, { screens: st.screens });
    const sc = /^screens\/([^/]+)$/.exec(c);
    if (sc && method === 'PUT') {
      const row = st.screens.find((x) => x.key === sc[1]);
      if (!row) return err(route, 404, 'screen_not_found', 'המסך לא נמצא.');
      Object.assign(row.settings as Record<string, unknown>, body);
      return json(route, { key: sc[1], settings: row.settings, changed: Object.keys(body as object) });
    }
    if (c === 'test' && method === 'POST') {
      const b = body as { target_key: string; camera_id: string };
      const tg = st.targets.find((x) => x.key === b.target_key);
      const s = session({ session_id: `cs-t${++seq}`, kind: 'test', device_key: b.target_key, screen_name: tg?.name ?? '', camera_id: b.camera_id, state: 'starting', expires_at: iso(60_000), can: { stop: true, extend: false, switch: false } });
      st.sessions.push(s);
      setTimeout(() => { s.state = 'playing'; st.emit(); }, 600);
      return json(route, { status: 'accepted', error: null, session: s }, 202);
    }
    return err(route, 404, 'not_found', 'לא נמצא');
  });
  return st;
}

function cfgAnswer(st: CastMock) {
  return { config: st.config, relay: { option: true, listening: st.ready, container_port: 18092, error: null }, bridge: { paired: true, version: '0.7.0', required: '0.7.0', ready: true }, ready: st.ready, reason: st.reason };
}
