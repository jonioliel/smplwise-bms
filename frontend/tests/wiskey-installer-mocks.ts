import type { Page, Route } from '@playwright/test';
import { installAccessMock, NOW, type Persona } from './access-control-mocks';

// WISKEY-INSTALLER-NATIVE-2400: the mocked backend of הגדרות › התקנה ותחזוקת מערכת האינטרקום, layered over the access-control mock
// (tests/access-control-mocks.ts: the session, the settings, the shell; routes registered later win, everything else falls through to
// it). Invented answers only - no station, no intercom. It answers like routers/wiskey_installer*.py (the reads, the writes with their
// envelope, the typed phrase, refusals, unknown outcomes) and RECORDS every write so a spec can assert exactly what was sent, once.

export type WriteResult = 'ok' | 'refused' | 'unknown' | 'not_sent' | 'slow';

export interface InstallerMock {
  persona: Persona;
  /** Per operation name (`settings_update`, `host_apply`, `station_sync`): how the server answers a write. Default `ok`. */
  result: Record<string, WriteResult>;
  /** Parts of the clock view that fail to load. */
  failParts: Set<'settings' | 'host'>;
  /** The overview says a tool is not offered by this WisKey. */
  unavailable: Set<string>;
  ntp: { revision: number; server: string; port: number; interval: number };
  writes: { path: string; body: Record<string, unknown> }[];
}

export const newInstallerMock = (over: Partial<InstallerMock> = {}): InstallerMock => ({
  persona: 'admin',
  result: {},
  failParts: new Set(),
  unavailable: new Set(),
  ntp: { revision: 3, server: 'time.windows.com', port: 123, interval: 60 },
  writes: [],
  ...over,
});

export const STATIONS = [
  { id: 'entry-a', name: 'שער ראשי', online: true },
  { id: 'entry-b', name: 'דלת צדדית', online: false },
  { id: 'entry-c', name: 'רציף פריקה', online: true },
];
const CLOCKS: Record<string, { skew: number | null; mode: string }> = {
  'entry-a': { skew: 0.4, mode: 'NTP' },
  'entry-b': { skew: null, mode: 'unknown' },
  'entry-c': { skew: 61, mode: 'manual' },
};
const CHECKED = '2026-09-27T10:12:00+00:00';

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const error = (route: Route, status: number, code: string, message: string, details: Record<string, unknown>) =>
  json(route, { code, user_message: message, retryable: false, correlation_id: 'mock', details }, status);

function stationClock(id: string) {
  const c = CLOCKS[id];
  return c.skew === null ? null : { status: 'ready', skew_seconds: c.skew, drift_state: Math.abs(c.skew) > 5 ? 'ahead' : 'within_tolerance', time_mode: c.mode, checked_at: CHECKED, error: null };
}

export async function installInstallerMock(page: Page, m: InstallerMock = newInstallerMock()): Promise<InstallerMock> {
  await installAccessMock(page, { persona: m.persona });
  const holds = () => m.persona === 'admin';
  const refuse = (route: Route) =>
    error(route, 403, 'forbidden', 'אין הרשאה', { permission: 'system.configure', target_type: 'installation', target_id: '*', reason: 'no_binding' });

  /** A write: the envelope and `confirmed` are checked like the server; then the configured outcome. */
  async function write(route: Route, op: string, typed: string | null, apply: () => unknown): Promise<void> {
    const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    if (body.confirmed !== true || typeof body.client_request_id !== 'string' || typeof body.expires_at !== 'string') {
      return error(route, 409, 'confirmation_required', 'דורש אישור', { outcome: 'not_sent', operation: op });
    }
    if (typed !== null && String(body.typed_confirmation ?? '').trim() !== typed) {
      return error(route, 409, 'typed_confirmation_required', `יש להקליד בדיוק: ${typed}`, { outcome: 'not_sent', operation: op, expected: typed });
    }
    m.writes.push({ path: new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, ''), body });
    const result = m.result[op] ?? 'ok';
    if (result === 'refused') return error(route, 502, 'installer_refused', 'WisKey דחה את הפעולה (revision_conflict). לא בוצע שינוי.', { outcome: 'refused', wiskey_code: 'revision_conflict', operation: op });
    if (result === 'unknown') return error(route, 504, 'installer_outcome_unknown', 'לא התקבלה תשובה ברורה', { outcome: 'unknown', wiskey_code: 'readback_mismatch', operation: op });
    if (result === 'not_sent') return error(route, 429, 'installer_cooldown', 'הפעולה נשלחה לפני רגע.', { outcome: 'not_sent', retry_after_s: 42, operation: op });
    if (result === 'slow') await new Promise((r) => setTimeout(r, 2500));
    return json(route, { operation: op, status: 'completed', command_id: 'cmd-1', at: NOW.toISOString(), data: apply() });
  }

  await page.route('**/api/v1/access-control/installer/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/access-control\/installer\//, '');
    const method = req.method();
    if (!holds()) return refuse(route);
    if (p === 'overview') {
      const tools = Object.fromEntries(['clock', 'technical', 'lifecycle', 'platform'].map((t) => [t, m.unavailable.has(t) ? { available: false, missing: [`${t}/x`] } : { available: true, missing: [] }]));
      return json(route, { feed: 'ready', stations: STATIONS, tools });
    }
    if (p === 'clock' && method === 'GET') {
      const part = (name: 'settings' | 'host', data: unknown) =>
        m.failParts.has(name)
          ? { state: 'error', error: { code: 'installer_read_failed', wiskey_code: 'operations_unavailable', message: 'WisKey לא החזיר את הנתונים (operations_unavailable).' }, fetched_at: null, data: null }
          : { state: 'ready', error: null, fetched_at: NOW.toISOString(), data };
      return json(route, {
        settings: part('settings', { ...m.ntp }),
        host: part('host', { supported: true, synchronized: true, use_ntp: true, config: { servers: ['time.windows.com'], fallback_servers: [] } }),
        stations: STATIONS.map((s) => ({ ...s, clock: stationClock(s.id) })),
        feed: 'ready',
        defaults: { server: 'time.windows.com', port: 123, interval: 60 },
        host_typed_phrase: 'שעון השרת',
        cooldowns: { host_apply: 0 },
      });
    }
    const check = /^clock\/stations\/([^/]+)$/.exec(p);
    if (check && method === 'GET') {
      const s = STATIONS.find((x) => x.id === decodeURIComponent(check[1]))!;
      return json(route, { station_id: s.id, name: s.name, typed_phrase: s.name, cooldown_s: 0, fetched_at: NOW.toISOString(), online: s.online, clock: stationClock(s.id) });
    }
    if (p === 'clock/settings' && method === 'PUT') {
      return write(route, 'settings_update', null, () => {
        const b = JSON.parse(req.postData() ?? '{}') as { values: { server: string; port: number; interval: number } };
        m.ntp = { revision: m.ntp.revision + 1, ...b.values };
        return { ...m.ntp };
      });
    }
    if (p === 'clock/host-apply' && method === 'POST') {
      return write(route, 'host_apply', 'שעון השרת', () => ({ configuration_verified: true, config: { servers: [m.ntp.server], fallback_servers: [] } }));
    }
    const sync = /^clock\/stations\/([^/]+)\/sync$/.exec(p);
    if (sync && method === 'POST') {
      const s = STATIONS.find((x) => x.id === decodeURIComponent(sync[1]))!;
      return write(route, 'station_sync', s.name, () => ({
        configuration_verified: true, server: m.ntp.server, clock_verified: true, copied_system: false,
        clock: { device_time: '2026-09-27T13:30:01+03:00', checked_at: NOW.toISOString(), time_mode: 'NTP', skew_seconds: 1, measurement: { status: 'measured', estimated_skew_seconds: 0.7, uncertainty_seconds: 1.1 } },
      }));
    }
    return error(route, 404, 'not_found', 'לא נמצא', {});
  });
  return m;
}
