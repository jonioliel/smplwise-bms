import type { Page, Route, WebSocketRoute } from '@playwright/test';

// CR-036 slice S6: a mocked backend for the REAL native stations screen (wiskey-stations) behind the real shell. Every name is
// synthetic (an invented office building); no WisKey, no Home Assistant, no station, no camera frame - the stills are drawn
// SVG scenes. The mock answers like the typed endpoints do (services/intercom_adapter.py): stations are filtered per persona the
// way the server filters them (technical part with access.stations.read, error texts with access.admin.read), writes are
// recorded so a spec can assert exactly what was sent - and how many times. Used by evidence-wiskey-stations.spec.ts,
// layout-wiskey-stations.spec.ts, evidence-wiskey-stations-skins.spec.ts and pixel-wiskey-stations.spec.ts.
// Needs the Vite DEV server or the preview (the real shell, `page.route` over /api/v1).

/** The fixed "now" of the specs (the screen's clock and every "seen" text derive from it). */
export const NOW_ISO = '2026-10-12T08:14:07Z';

export type Persona = 'admin' | 'operator' | 'door' | 'viewer' | 'none';

const PERMS: Record<Persona, string[]> = {
  // everything the screen reacts to: physical actions (access.release), the technical part, status, devices (the place tree)
  admin: ['access.read', 'access.release', 'access.stations.read', 'access.events.read', 'access.people.read', 'access.admin.read', 'access.call', 'devices.read', 'system.configure', 'map.read'],
  // an ordinary operator of this build: sees stations with the technical part, no physical actions (they need access.release)
  operator: ['access.read', 'access.stations.read', 'access.events.read', 'access.people.read', 'devices.read', 'map.read'],
  // a door opener: the physical actions, no technical part
  door: ['access.read', 'access.release', 'devices.read', 'map.read'],
  viewer: ['access.read', 'devices.read', 'map.read'],
  none: ['map.read'],
};

export interface MockStation {
  id: string;
  name: string;
  online: boolean;
  call_state: string;
  sync_state: string;
  lock_enabled: boolean;
  locks: { physical_index: number; name: string | null }[];
  has_camera: boolean;
  camera_entity: string | null;
  last_seen: string | null;
  model: string;
  firmware: string;
  last_error?: string;
  /** The area the camera is in (the place tree derives from it). */
  area: string | null;
}

const zone = { kind: 'iana', name: 'Asia/Jerusalem' };

export const STATIONS: MockStation[] = [
  { id: 'gate', name: 'שער ראשי', online: true, call_state: 'ringing', sync_state: 'synced', lock_enabled: true, locks: [{ physical_index: 1, name: 'שער' }], has_camera: true, camera_entity: 'camera.gate', last_seen: '2026-10-12T08:14:03+00:00', model: 'DS-KD8003', firmware: 'V2.2.62', area: 'a-gate' },
  { id: 'lobby', name: 'לובי', online: true, call_state: 'idle', sync_state: 'synced', lock_enabled: true, locks: [{ physical_index: 1, name: 'כניסה' }, { physical_index: 2, name: 'מחסום' }], has_camera: true, camera_entity: 'camera.lobby', last_seen: '2026-10-12T08:14:05+00:00', model: 'DS-KD8003', firmware: 'V2.2.62', area: 'a-lobby' },
  { id: 'park', name: 'חניון', online: true, call_state: 'idle', sync_state: 'pending', lock_enabled: false, locks: [], has_camera: true, camera_entity: 'camera.park', last_seen: '2026-10-12T08:13:00+00:00', model: 'DS-KV8213', firmware: 'V2.2.53', area: 'a-park' },
  { id: 'lab', name: 'מעבדה', online: true, call_state: 'in_call', sync_state: 'synced', lock_enabled: true, locks: [{ physical_index: 1, name: 'דלת מעבדה' }], has_camera: true, camera_entity: 'camera.lab', last_seen: '2026-10-12T08:14:06+00:00', model: 'DS-KD8003', firmware: 'V2.2.62', area: 'a-lab' },
  { id: 'store', name: 'מחסן', online: false, call_state: 'unavailable', sync_state: 'offline', lock_enabled: true, locks: [{ physical_index: 1, name: 'מחסן' }], has_camera: false, camera_entity: null, last_seen: '2026-10-11T07:02:00+00:00', model: 'DS-KV6113', firmware: 'V2.2.53', area: 'a-store' },
  { id: 'mgmt', name: 'הנהלה', online: true, call_state: 'idle', sync_state: 'error', lock_enabled: true, locks: [{ physical_index: 1, name: 'הנהלה' }], has_camera: true, camera_entity: 'camera.mgmt', last_seen: '2026-10-12T08:14:01+00:00', model: 'DS-KD8003', firmware: 'V2.2.62', last_error: 'sync_rejected', area: 'a-mgmt' },
];

const FLOORS = [
  { floor_id: 'f0', name: 'קומת קרקע', level: 0, areas: [{ area_id: 'a-lobby', name: 'לובי' }, { area_id: 'a-gate', name: 'שער ראשי' }, { area_id: 'a-park', name: 'חניון' }] },
  { floor_id: 'f1', name: 'קומה 1', level: 1, areas: [{ area_id: 'a-lab', name: 'מעבדה' }, { area_id: 'a-store', name: 'מחסן' }] },
  { floor_id: 'f2', name: 'קומה 2', level: 2, areas: [{ area_id: 'a-mgmt', name: 'הנהלה' }] },
];

export type ReleaseMode = 'ok' | 'unknown' | 'not_sent' | 'in_progress' | 'slow';

export interface StationsMock {
  persona: Persona;
  stations: MockStation[];
  /** `ready` (live), `stale` (a last-known copy: `ha_unavailable`, not fresh), or a feed state with no stations. */
  feed: 'ready' | 'stale' | 'ha_not_configured' | 'connecting' | 'ha_unavailable' | 'not_installed' | 'forbidden' | 'error';
  /** An HTTP status for GET stations (403, 500 ...) instead of an answer. */
  stationsStatus: number | null;
  /** A delay (ms) before GET stations answers (a loading state to look at). */
  stationsDelay: number;
  /** Whether the place tree has data (the camera areas). */
  places: boolean;
  settings: Record<string, string>;
  release: ReleaseMode;
  ttsFail: Record<string, { status: number; code: string; details?: Record<string, unknown> }>;
  engines: 'ok' | 'none' | 'unsupported';
  programs: 'ok' | 'busy' | 'error' | 'unsupported';
  codes: 'ok' | 'error';
  features: Record<string, boolean>;
  // recorded
  reads: string[];
  released: { station: string; body: Record<string, unknown> }[];
  signals: { station: string; body: Record<string, unknown> }[];
  spoken: { station: string; body: Record<string, unknown> }[];
  sockets: WebSocketRoute[];
  /** Push a change notice over the (mocked) notice socket: the screen reads again. */
  push(type?: string, payload?: Record<string, unknown>): void;
}

export const newMock = (over: Partial<StationsMock> = {}): StationsMock => {
  const m: StationsMock = {
    persona: 'admin',
    stations: STATIONS.map((s) => ({ ...s, locks: s.locks.map((l) => ({ ...l })) })),
    feed: 'ready',
    stationsStatus: null,
    stationsDelay: 0,
    places: true,
    settings: {},
    release: 'ok',
    ttsFail: {},
    engines: 'ok',
    programs: 'ok',
    codes: 'ok',
    features: {},
    reads: [],
    released: [],
    signals: [],
    spoken: [],
    sockets: [],
    push(type = 'intercom_refresh', payload = {}) {
      for (const ws of m.sockets) ws.send(JSON.stringify({ type, payload }));
    },
    ...over,
  };
  return m;
};

const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, message: string, details: Record<string, unknown> = {}) => json(route, { code, user_message: message, retryable: false, correlation_id: 'test', details }, status);

function me(persona: Persona) {
  const perms = PERMS[persona];
  return { channel: 'local', remote: null, user: { id: `u-${persona}`, username: persona, display_name: 'יוני', source: 'ingress' }, active: true, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' };
}

/** The view the server would build for this persona (services/intercom_authority.view_station). */
function view(m: StationsMock, s: MockStation) {
  const technical = PERMS[m.persona].includes('access.stations.read');
  const errors = PERMS[m.persona].includes('access.admin.read');
  return {
    id: s.id,
    name: s.name,
    online: s.online,
    call_state: s.call_state,
    sync_state: s.sync_state,
    lock_enabled: s.lock_enabled,
    locks: s.locks,
    has_camera: s.has_camera,
    camera_entity: s.camera_entity,
    last_seen: s.last_seen,
    zone,
    technical: technical
      ? {
          loaded: true,
          model: s.model,
          firmware: s.firmware,
          capabilities: null,
          clock: { source: 'device', status: 'ready', zone, device_zone: null, skew_seconds: s.online ? 1 : null, time_mode: 'NTP', drift_state: 'within_tolerance', checked_at: null, error: null },
          event_status: { stream: s.online ? 'connected' : 'disconnected', history: 'pending', reconnects: 0, last_frame_at: null, recovered_until: null },
          scanned_at: null,
          scanning: false,
          reconciled_at: '2026-10-12T08:11:00+00:00',
          last_poll_ms: 40,
        }
      : null,
    errors: technical && errors ? { last_error: s.last_error ?? null, scan_error: null } : null,
  };
}

const head = (extra: Record<string, unknown> = {}) => ({ state: 'ready', configured: true, last_error: null, fetched_at: NOW_ISO, fresh: true, sync: { connected: true }, ...extra });

/** An invented entrance scene (no real frame, no lab image anywhere): sky, two walls, a door with glass, a person or a car. */
export function sceneSvg(i: number): string {
  const hue = [212, 196, 28, 160, 230, 265][i % 6];
  const person = i === 0 ? '<g transform="translate(118 44)"><circle r="5" fill="#2b3446"/><path d="M-7 8c0-5 14-5 14 0v16h-14z" fill="#3a4457"/></g>' : '';
  const car = i === 2 ? '<g transform="translate(40 50)"><rect width="52" height="16" rx="4" fill="#2d3748"/><rect x="10" y="-8" width="30" height="10" rx="3" fill="#3f4a5e"/><circle cx="12" cy="17" r="4" fill="#111"/><circle cx="40" cy="17" r="4" fill="#111"/></g>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 78%)"/><stop offset="1" stop-color="hsl(${hue} 35% 62%)"/></linearGradient></defs><rect width="160" height="80" fill="url(#s)"/><rect y="12" width="60" height="46" fill="hsl(${hue} 12% 58%)"/><rect x="100" y="12" width="60" height="46" fill="hsl(${hue} 12% 46%)"/><rect x="60" y="8" width="40" height="50" fill="hsl(${hue} 22% 36%)"/><rect x="66" y="14" width="12" height="36" fill="rgba(255,255,255,.55)"/><rect x="82" y="14" width="12" height="36" fill="rgba(255,255,255,.55)"/><rect y="56" width="160" height="24" fill="#7b8494"/>${car}${person}</svg>`;
}

const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function programsBody(station: MockStation) {
  return {
    programs: station.locks.map((l, i) => ({
      door: l.physical_index,
      revision: 3,
      enabled: i === 0,
      removing: false,
      policy: {
        timezone: 'Asia/Jerusalem',
        name: 'שעות עבודה',
        weekly: Object.fromEntries(WEEK.map((d) => [d, d === 'Saturday' ? [] : d === 'Friday' ? [{ start: '08:00', end: '13:00' }] : [{ start: '08:00', end: '17:00' }]])),
        holidays: i === 0 ? [{ name: 'חג', start: '2026-10-20', end: '2026-10-21', periods: [] }] : [],
      },
      execution: { owned: true, attempted: null, status: i === 0 ? 'held_acknowledged' : 'idle' },
      error: null,
      checked_at: NOW_ISO,
    })),
    saved: [],
    timezone: 'Asia/Jerusalem',
    native_supported: true,
  };
}

export async function installStationsMock(page: Page, m: StationsMock): Promise<StationsMock> {
  await page.routeWebSocket(/\/api\/v1\/intercom\/ws/, (ws) => {
    m.sockets.push(ws); // accepted: `onopen` fires, nothing is forwarded to a server
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const at = (re: RegExp) => re.exec(p);
    if (p === 'me') return json(route, me(m.persona));
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'time.zone': 'Asia/Jerusalem', 'access.ui.stations': 'smplwise', 'access.ui.overview': 'wiskey', 'access.ui.events': 'wiskey', 'access.ui.people': 'wiskey', ...m.settings }, can_edit: m.persona === 'admin', nvr_channels: 16, warnings: [] });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: NOW_ISO, version: 'test' });
    if (p === 'health') return json(route, { status: 'ok', version: 'test', mode: 'full' });
    if (p.startsWith('health/report')) return json(route, { status: 'ok', mode: 'full', version: 'test', uptime_s: 7200, checked_at: NOW_ISO, probe_ttl_s: 20, checks: [] });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });

    // ---- the typed reads
    if (p === 'access-control/features') {
      const names = ['people', 'person', 'events', 'door_programs', 'hold_schedules', 'public_codes', 'health', 'sync_status', 'alerts'];
      return json(route, { ...head(), client_api: 1, api: { version: 1, min_client: 0 }, features: Object.fromEntries(names.map((n) => [n, { available: m.features[n] ?? true, reason: null }])) });
    }
    if (p === 'access-control/stations') {
      m.reads.push('stations');
      if (m.stationsDelay) await new Promise((r) => setTimeout(r, m.stationsDelay));
      if (m.stationsStatus === 403) return err(route, 403, 'forbidden', 'אין הרשאה לבצע את הפעולה (בדיקה).');
      if (m.stationsStatus) return err(route, m.stationsStatus, 'http_error', 'שגיאת שרת (בדיקה).');
      if (m.feed === 'ready') return json(route, { ...head(), stations: m.stations.map((s) => view(m, s)), default_zone: zone });
      if (m.feed === 'stale') return json(route, { ...head({ state: 'ha_unavailable', fresh: false, fetched_at: '2026-10-12T08:10:07Z' }), stations: m.stations.map((s) => view(m, s)), default_zone: zone });
      return json(route, { ...head({ state: m.feed, fresh: false, fetched_at: null, last_error: m.feed }), stations: null, default_zone: null });
    }
    const station = at(/^access-control\/stations\/([^/]+)(?:\/(programs|codes))?$/);
    if (station) {
      const s = m.stations.find((x) => x.id === decodeURIComponent(station[1]));
      if (!s) return err(route, 404, 'intercom_station_not_found', 'העמדה לא נמצאה.');
      if (station[2] === 'programs') {
        m.reads.push(`programs:${s.id}`);
        if (m.programs === 'unsupported') return json(route, { ...head({ state: 'unsupported', last_error: 'not_listed' }), programs: null });
        if (m.programs === 'busy') return json(route, { ...head({ state: 'error', last_error: 'busy', fresh: false }), programs: null });
        if (m.programs === 'error') return err(route, 500, 'http_error', 'שגיאת שרת (בדיקה).');
        return json(route, { ...head(), programs: programsBody(s) });
      }
      if (station[2] === 'codes') {
        m.reads.push(`codes:${s.id}`);
        if (m.codes === 'error') return err(route, 500, 'http_error', 'שגיאת שרת (בדיקה).');
        return json(route, { ...head(), codes: { public_pin_state: 'configured', slots: [{ slot: 1, configured: true }, { slot: 2, configured: false }], capabilities: { advertised: true, min: 4, max: 8 }, checked_at: NOW_ISO } });
      }
      return json(route, { ...head(), station: view(m, s), default_zone: zone });
    }

    // ---- the places the tree derives from (Arx's own floors and areas) and the camera entities' areas
    if (p === 'devices/tree') {
      if (!m.places) return err(route, 403, 'forbidden', 'אין הרשאה (בדיקה).');
      return json(route, { floors: FLOORS, unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: {} }, building: {}, building_climate: [], scoped: false, sync: {} });
    }
    if (p === 'devices/entities') {
      const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
      return json(route, { entities: ids.map((id) => ({ entity_id: id, name: id, domain: 'camera', state: 'idle', area_id: m.stations.find((s) => s.camera_entity === id)?.area ?? null, area_name: null })) });
    }

    // ---- the stills
    const still = at(/^intercom\/stations\/([^/]+)\/camera-snapshot\.jpg$/);
    if (still) {
      const i = m.stations.findIndex((s) => s.id === decodeURIComponent(still[1]));
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: sceneSvg(Math.max(0, i)), headers: { 'cache-control': 'no-store' } });
    }

    // ---- the existing physical actions (recorded; answered like the backend does)
    const act = at(/^intercom\/stations\/([^/]+)\/(release|call|tts)$/);
    if (act && method === 'POST') {
      const station = decodeURIComponent(act[1]);
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      if (act[2] === 'release') {
        m.released.push({ station, body });
        if (m.release === 'unknown') return err(route, 504, 'door_outcome_unknown', 'לא ידוע אם הפקודה בוצעה (בדיקה).', { outcome: 'unknown', retry_after_s: 12 });
        if (m.release === 'not_sent') return err(route, 409, 'intercom_station_offline', 'העמדה אינה מחוברת כרגע, ולכן הפקודה לא נשלחה (בדיקה).', { outcome: 'not_sent' });
        if (m.release === 'in_progress') return err(route, 409, 'intercom_release_in_progress', 'שחרור קודם של הדלת הזו עדיין לא הוכרע (בדיקה).', { outcome: 'not_sent', retry_after_s: 8 });
        if (m.release === 'slow') await new Promise((r) => setTimeout(r, 1500));
        return json(route, { ...head(), release: { accepted: true }, note: 'x', command_id: 'cmd-1' });
      }
      if (act[2] === 'call') {
        m.signals.push({ station, body });
        return json(route, { ...head(), call: { command: body.command, acknowledged: true, physical_result: 'unverified', before_state: 'ringing', observed_state: body.command === 'hangUp' ? 'idle' : 'in_call', observation: 'state_changed', checked_at: NOW_ISO }, command_id: 'cmd-2' });
      }
      m.spoken.push({ station, body });
      const fail = m.ttsFail[station];
      if (fail) return err(route, fail.status, fail.code, `שגיאת הכרזה (${fail.code})`, fail.details ?? { outcome: 'not_sent' });
      return json(route, { ...head(), tts: { station_id: station, state: 'started', reason: null, physical_result: null, at: NOW_ISO }, command_id: 'cmd-3' });
    }
    if (p === 'intercom/tts/engines') {
      if (m.engines === 'unsupported') return json(route, { ...head({ state: 'unsupported', last_error: 'not_listed' }), tts: null });
      return json(route, { ...head(), tts: { default: 'tts.local', engines: m.engines === 'none' ? [] : [{ engine_id: 'tts.local', name: 'מנוע מקומי', supported_languages: ['he', 'en'], default_language: 'he' }, { engine_id: 'tts.cloud', name: 'שירות ענן', supported_languages: ['en'], default_language: 'en' }] } });
    }
    return json(route, NOT_FOUND, 404);
  });
  return m;
}

/** The screen's own shell route: the native stations screen is WisKey's `devices` tab, shown when `access.ui.stations` says so. */
export const STATIONS_ROUTE = '#/wiskey/devices';

/** Opens the screen: fixed clock, the skin / scheme the specs ask for, the product's real shell. */
export async function openStations(page: Page, o: { skin?: string; scheme?: 'light' | 'dark'; hash?: string; look?: string } = {}): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW_ISO));
  // a clean start for this test's tab - once: a reload inside the test keeps what the screen remembered (the view, the folded floors)
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('sw.s6.start')) return;
      sessionStorage.setItem('sw.s6.start', '1');
      localStorage.removeItem('sw.wiskey.stations.view');
      localStorage.removeItem('sw.wiskey.stations.treeCollapsed');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  const q = new URLSearchParams({ design: 'a', skin: o.skin ?? 'classic', scheme: o.scheme ?? 'light', look: o.look ?? 'performance:full' });
  await page.goto(`/?${q}${o.hash ?? STATIONS_ROUTE}`);
  await page.waitForSelector('sw-app');
}
