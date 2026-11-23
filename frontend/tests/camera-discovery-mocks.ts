import type { Page, Route } from '@playwright/test';

// ONVIF-UI-2500: one MOCKED backend for "חיפוש מצלמות ברשת" (the NVR settings page, its "cameras without a recorder" card and the
// discovery wizard). The routes and shapes are those of routers/camera_discovery.py and the preview form of POST /cameras/source/test
// on pilot/ONVIF-CLIENT-2500 (d58353161); the server's own rules are its tests (test_camera_discovery_api_2500.py,
// test_onvif_client_2500.py) - this mock proves the screens. Every address is from the documentation range 192.0.2.0/24 (RFC 5737),
// every maker / model / password is made up; no device, frame or credential is real.

export const ADMIN = ['video.live', 'map.read', 'devices.read', 'events.read', 'system.configure'];
export const OPERATOR = ['video.live', 'map.read', 'devices.read', 'events.read'];
/** The one password the fake cameras accept (d-37 wants its own). */
export const GOOD = 'fixture-pass-1';
export const OTHER = 'fixture-pass-37';

const ENVELOPE = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: 'c', details });
const PREVIEW = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#345"/><circle cx="160" cy="90" r="34" fill="#89a"/></svg>').toString('base64')}`;

type Auth = 'busy' | 'digest_required' | 'locked_guard' | 'no_answer' | 'not_onvif' | 'not_tried' | 'ok' | 'skipped' | 'wrong_password';
interface Profile { token: string; name: string; codec: 'h264' | 'h265' | 'mjpeg' | null; width: number; height: number; fps: number; stream: 'ok' | 'other_host'; uri_masked: string | null }
interface Dev {
  id: string; address: string; port: number | null; engines: ('unicast' | 'http')[]; kind: 'camera' | 'nvr' | 'unknown';
  known: 'none' | 'standalone' | 'behind_recorder' | 'recorder'; known_ref?: string; addable: boolean; manufacturer: string | null; model: string | null;
  name: string | null; firmware: string | null; clock_offset_s: number | null; auth: Auth; has_service: boolean;
  recorder_prefill?: { host: string; http_port: number; vendor?: 'hikvision'; name?: string };
  media: 'media' | 'media2' | 'none'; auth_mode?: 'digest' | 'wsse'; profiles: Profile[]; suggested: { main: string | null; sub: string | null }; snapshot: boolean;
}

const p = (token: string, width: number, height: number, codec: Profile['codec'] = 'h264', stream: Profile['stream'] = 'ok'): Profile => ({
  token, name: token, codec, width, height, fps: 25, stream, uri_masked: stream === 'ok' ? `rtsp://192.0.2.9/${token}` : null,
});

const base = (id: string, octet: number, over: Partial<Dev> = {}): Dev => ({
  id, address: `192.0.2.${octet}`, port: 80, engines: ['unicast'], kind: 'camera', known: 'none', addable: true, manufacturer: null, model: null,
  name: null, firmware: null, clock_offset_s: 0, auth: 'not_tried', has_service: true, media: 'none', profiles: [], suggested: { main: null, sub: null },
  snapshot: false, ...over,
});

/** What each fake camera says once a press reaches it with the right pair: maker, model and its video profiles. */
const IDENTITY: Record<string, Partial<Dev>> = {
  'd-21': { manufacturer: 'Vantis', model: 'DC-4K21', firmware: '5.7.3', media: 'media2', auth_mode: 'wsse', profiles: [p('m0', 2688, 1520, 'h265'), p('m1', 1920, 1080), p('m2', 640, 360)], suggested: { main: 'm0', sub: 'm2' }, snapshot: true },
  'd-22': { manufacturer: 'Vantis', model: 'DB-2M10', media: 'media2', auth_mode: 'wsse', profiles: [p('m0', 1920, 1080), p('m1', 704, 576)], suggested: { main: 'm0', sub: 'm1' } },
  'd-37': { manufacturer: 'Orbel', model: 'PT-300', media: 'media', auth_mode: 'digest', profiles: [p('s0', 1920, 1080), p('s1', 640, 480)], suggested: { main: 's0', sub: 's1' } },
  'd-40': { manufacturer: 'Lumo', model: 'Z5', media: 'media', profiles: [p('x0', 1920, 1080, 'h264', 'other_host')], suggested: { main: 'x0', sub: null } },
  'd-51': { manufacturer: 'Vantis', model: 'DC-2M', media: 'media2', profiles: [p('m0', 1920, 1080), p('m1', 640, 360)], suggested: { main: 'm0', sub: 'm1' } },
  'd-52': { manufacturer: 'Vantis', model: 'DC-2M', media: 'media2', profiles: [p('m0', 1920, 1080), p('m1', 640, 360)], suggested: { main: 'm0', sub: 'm1' } },
  'd-53': { manufacturer: 'Vantis', model: 'DC-2M', media: 'media2', profiles: [p('m0', 1920, 1080), p('m1', 640, 360)], suggested: { main: 'm0', sub: 'm1' } },
};

/** The devices of the sweep, in the order they answer. */
export function sweepDevices(): Dev[] {
  return [
    base('d-21', 21),
    base('d-22', 22),
    base('d-10', 10, { kind: 'nvr', addable: false, manufacturer: null, model: 'NVR', recorder_prefill: { host: '192.0.2.10', http_port: 80, vendor: 'hikvision', name: 'NVR' } }),
    base('d-37', 37, { clock_offset_s: 660 }),
    base('d-40', 40),
    base('d-30', 30, { known: 'standalone', known_ref: 'cam-sa-1', addable: false, name: 'שער אחורי' }),
    base('d-31', 31, { known: 'behind_recorder', known_ref: 'cam-1', addable: false }),
    base('d-44', 44),
    base('d-51', 51),
    base('d-52', 52),
    base('d-53', 53),
  ];
}

export interface DiscoveryMock {
  perms: string[];
  enabled: boolean;
  /** polls before the sweep is done (the running state stays this many GETs) */
  pollsToDone: number;
  /** the sweep finds nothing */
  empty: boolean;
  /** POST scans answers 409 scan_running (another tab) and the list then shows that running scan */
  runningElsewhere: boolean;
  /** the add step refuses these device ids with this code */
  addRefuse: Record<string, string>;
  hits: string[];
  /** every JSON body the screens sent to the discovery routes, as `METHOD path` + body */
  bodies: { route: string; body: Record<string, unknown> }[];
  standalone: { id: string; name: string }[];
  scan: { id: string; state: 'running' | 'done' | 'cancelled' | 'failed'; range: string; polls: number; devices: Dev[]; started_at: string; finished_at: string | null } | null;
  /** user/password pairs each device refused (the server's Q57 rule, mirrored) */
  refused: Record<string, string[]>;
}

export function newDiscoveryMock(over: Partial<DiscoveryMock> = {}): DiscoveryMock {
  return {
    perms: ADMIN, enabled: true, pollsToDone: 2, empty: false, runningElsewhere: false, addRefuse: {}, hits: [], bodies: [],
    standalone: [{ id: 'cam-sa-1', name: 'שער אחורי' }], scan: null, refused: {}, ...over,
  };
}

function jobOf(m: DiscoveryMock) {
  const s = m.scan!;
  const total = 254;
  const share = s.state === 'running' ? Math.min(1, s.polls / Math.max(1, m.pollsToDone + 1)) : 1;
  const visible = s.devices.slice(0, Math.ceil(s.devices.length * share));
  const counts = {
    found: visible.length,
    cameras: visible.filter((d) => d.kind === 'camera').length,
    recorders: visible.filter((d) => d.kind === 'nvr').length,
    unknown: visible.filter((d) => d.kind === 'unknown').length,
    known: visible.filter((d) => d.known !== 'none').length,
    addable: visible.filter((d) => d.addable).length,
  };
  return {
    id: s.id, state: s.state, range: s.range, engines: ['unicast'], started_at: s.started_at, finished_at: s.finished_at,
    progress: { checked: s.state === 'running' ? Math.round(total * share * 0.9) : total, total }, counts, devices: visible,
  };
}

function identifyOne(m: DiscoveryMock, d: Dev, user: string, pw: string): void {
  if (!d.addable) {
    d.auth = 'skipped';
    return;
  }
  if (d.id === 'd-44') {
    d.auth = 'locked_guard'; // the guard already stopped it (three failures in 15 minutes)
    return;
  }
  const pair = `${user}|${pw}`;
  if ((m.refused[d.id] ?? []).includes(pair)) {
    d.auth = 'wrong_password';
    return;
  }
  const want = d.id === 'd-37' ? OTHER : GOOD;
  if (pw !== want) {
    m.refused[d.id] = [...(m.refused[d.id] ?? []), pair];
    d.auth = 'wrong_password';
    d.profiles = [];
    return;
  }
  Object.assign(d, IDENTITY[d.id] ?? {}, { auth: 'ok' as Auth });
}

export async function installDiscovery(page: Page, m: DiscoveryMock): Promise<void> {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const body = (): Record<string, unknown> => {
      try {
        return (req.postDataJSON() as Record<string, unknown>) ?? {};
      } catch {
        return {};
      }
    };
    m.hits.push(`${method} ${path}`);
    const admin = m.perms.includes('system.configure');

    if (path === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true, bindings: [],
        permissions_installation: m.perms, permissions_any: m.perms, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (path === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (path === 'settings') return json({ settings: { 'time.zone': 'Asia/Jerusalem' }, can_edit: admin, nvr_channels: 8, warnings: [] });
    if (path === 'health') {
      return json({
        status: 'ok', version: 'test', nvr_configured: true, go2rtc_configured: true, mode: 'full',
        discovery: { cameras: 8, cameras_last_ok: '2026-11-23T08:00:00Z', cameras_last_error: null },
        events: { ingest: { connected: true, last_error: null } },
      });
    }
    if (path === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-11-23T08:00:00Z', version: 'test' });
    if (path.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (path === 'sites') return json({ sites: [], can_create_site: false });
    if (path.startsWith('events')) return json({ events: [], total: 0, today: { total: 0, unacked: 0 }, windows: [], ingest: null, facets: { types: [], cameras: [] }, next_cursor: null });
    if (path === 'cameras' && method === 'GET') {
      const cam = (id: string, name: string, standalone: boolean) => ({
        id, recorder_id: standalone ? 'standalone' : 'nvr-1', channel: 1, name, name_source: name, alias: null, enabled: true, sort_order: 1, grid_col_span: 1,
        main_track: null, sub_track: null, status: 'online', last_seen_at: null, can_view_live: true, recorder_name: standalone ? '' : 'מקליט ראשי', recorder_enabled: true, standalone,
      });
      return json({ cameras: [cam('cam-1', 'לובי', false), ...m.standalone.map((c) => cam(c.id, c.name, true))], recorders: [{ id: 'nvr-1', name: 'מקליט ראשי' }], recorder: null, can_sync: false });
    }
    if (path === 'devices/tree') {
      return json({
        floors: [{ floor_id: 'f0', name: 'קרקע', level: 0, areas: [{ area_id: 'lobby', name: 'לובי' }, { area_id: 'parking', name: 'חניון' }] }],
        unassigned: { area_id: 'unassigned', name: '', counts: {} }, building: {}, sync: {}, building_climate: null, scoped: false,
      });
    }
    if (path === 'nvr/vendors') {
      return json({
        vendors: [{
          id: 'hikvision', label: 'Hikvision', status: 'available', default_ports: { http_port: 80, rtsp_port: 554 }, fields: [
            { key: 'host', label: 'כתובת', kind: 'host', required: true, secret: false }, { key: 'http_port', label: 'פורט HTTP', kind: 'port', required: true, secret: false },
            { key: 'rtsp_port', label: 'פורט RTSP', kind: 'port', required: true, secret: false },
            { key: 'username', label: 'שם משתמש', kind: 'text', required: true, secret: false }, { key: 'password', label: 'סיסמה', kind: 'password', required: true, secret: true },
          ],
        }],
      });
    }

    // ---- discovery (system.configure on every route)
    if (path.startsWith('cameras/discovery') || (path === 'cameras/source/test' && method === 'POST')) {
      if (!admin) return json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
      if (method !== 'GET' && method !== 'DELETE') m.bodies.push({ route: `${method} ${path}`, body: body() });
    }
    if (path === 'cameras/discovery/capabilities') {
      return json({ enabled: m.enabled, engines: [{ id: 'unicast', available: true }], suggested_range: '192.0.2.0/24', max_addresses: 1024, running: !!m.scan && m.scan.state === 'running' });
    }
    if (path === 'cameras/discovery/scans' && method === 'GET') {
      const scans = m.scan ? [(({ devices: _d, ...rest }) => rest)(jobOf(m))] : [];
      return json({ scans });
    }
    if (path === 'cameras/discovery/scans' && method === 'POST') {
      if (!m.enabled) return json(ENVELOPE('discovery_off', 'כבוי'), 409);
      const range = String(body().range ?? '192.0.2.0/24');
      if (range !== '192.0.2.0/24' && !/^192\.0\.2\.\d+\/(2[4-9]|3[0-2])$/.test(range)) {
        return json(ENVELOPE('range_refused', 'אפשר לחפש רק ברשת של האתר עצמו.', { fields: ['range'], problems: [{ field: 'range', code: 'range_refused' }] }), 422);
      }
      if (m.runningElsewhere) {
        m.runningElsewhere = false;
        m.scan = { id: 'scan-other', state: 'running', range, polls: 0, devices: sweepDevices(), started_at: '2026-11-23T07:59:00Z', finished_at: null };
        return json(ENVELOPE('scan_running', 'פועל'), 409);
      }
      m.scan = { id: 'scan-1', state: 'running', range, polls: 0, devices: m.empty ? [] : sweepDevices(), started_at: '2026-11-23T08:00:00Z', finished_at: null };
      return json(jobOf(m), 202);
    }
    const one = /^cameras\/discovery\/scans\/([^/]+)(\/identify|\/add)?$/.exec(path);
    if (one) {
      const s = m.scan;
      if (!s || s.id !== one[1]) return json(ENVELOPE('scan_not_found', 'לא נמצא'), 404);
      if (!one[2] && method === 'GET') {
        if (s.state === 'running') {
          s.polls += 1;
          if (s.polls > m.pollsToDone) {
            s.state = 'done';
            s.finished_at = '2026-11-23T08:00:20Z';
          }
        }
        return json(jobOf(m));
      }
      if (!one[2] && method === 'DELETE') {
        s.state = 'cancelled';
        m.scan = null;
        return json({ cancelled: true });
      }
      if (s.state === 'cancelled') return json(ENVELOPE('scan_not_active', 'נעצר'), 409);
      const b = body();
      if (one[2] === '/identify') {
        const ids = (b.device_ids as string[]) ?? [];
        if (!b.username || !b.password) return json(ENVELOPE('credentials_invalid', 'חסר', { fields: ['username', 'password'] }), 422);
        if (ids.length > 1 && b.same_for_all !== true) return json(ENVELOPE('same_for_all_required', 'סמנו', { fields: ['same_for_all'] }), 422);
        const devs = ids.map((id) => s.devices.find((d) => d.id === id));
        if (devs.some((d) => !d)) return json(ENVELOPE('device_unknown', 'לא ידוע', { fields: ['device_ids'] }), 422);
        for (const d of devs as Dev[]) identifyOne(m, d, String(b.username), String(b.password));
        return json({ devices: devs });
      }
      if (one[2] === '/add') {
        const rows = (b.cameras as { device_id: string; name?: string }[]) ?? [];
        const added: { device_id: string; camera_id: string }[] = [];
        const failed: { device_id: string; code: string; message: string }[] = [];
        for (const r of rows) {
          const d = s.devices.find((x) => x.id === r.device_id);
          const code = m.addRefuse[r.device_id] ?? (!d ? 'device_unknown' : d.auth !== 'ok' ? 'not_identified' : null);
          if (code) {
            failed.push({ device_id: r.device_id, code, message: 'טקסט השרת' });
            continue;
          }
          const id = `cam-new-${r.device_id}`;
          m.standalone.push({ id, name: r.name ?? r.device_id });
          d!.known = 'standalone';
          d!.addable = false;
          added.push({ device_id: r.device_id, camera_id: id });
        }
        return json({ added, failed });
      }
    }
    if (path === 'cameras/source/test' && method === 'POST') {
      const b = m.bodies[m.bodies.length - 1]?.body ?? {};
      if (!b.scan_id) return json(ENVELOPE('validation', 'x'), 422);
      return json({ ok: true, width: 640, height: 360, codec: 'h264', codec_label: 'H.264', preview: PREVIEW });
    }
    return json(ENVELOPE('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

export async function openApp(page: Page, hash: string, query = ''): Promise<void> {
  await page.goto('about:blank');
  // SW_SCHEME=dark: the app takes its scheme from ?scheme= (src/design/apply.ts), not from the browser's prefers-color-scheme
  const scheme = process.env.SW_SCHEME === 'dark' ? '&scheme=dark' : '';
  await page.goto(`/?design=a${scheme}${query}#${hash}`);
  await page.waitForSelector('sw-app');
}
