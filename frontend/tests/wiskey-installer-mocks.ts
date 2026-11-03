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
  doors: Record<string, Record<number, DoorState>>;
  flow: { id: string; step: string; entry: string | null } | null;
  flowSeq: number;
  flowInputs: { step: string; input: Record<string, unknown> }[];
  jobs: Record<string, any>[];
}

const FLOW_SCHEMAS: Record<string, unknown[]> = {
  user: [{ name: 'name', default: 'Intercom' }, { name: 'host' }, { name: 'username', default: 'admin' }, { name: 'scheme', default: 'http' }, { name: 'port', default: 80 }],
  confirm_device: [],
  locks: [],
  mapping: [],
  confirm_mapping: [],
};

function flowView(m: InstallerMock, errors: Record<string, string> = {}) {
  const f = m.flow!;
  const choices: Record<string, unknown[]> = {};
  if (f.step === 'user' || f.step === 'reconfigure') choices.scheme = ['http', 'https'];
  if (f.step === 'locks') choices.mode = ['camera_only', 'map_active_relay'];
  if (f.step === 'mapping') choices.api_id = [1, 2];
  if (f.step === 'confirm_mapping') choices.result = ['released_and_returned', 'choose_again', 'camera_only'];
  const defaults = f.step === 'reconfigure' ? { name: 'שער ראשי', host: 'gate.local', username: 'admin', scheme: 'http', port: 80, verify_ssl: true, rtsp_port: 554 }
    : f.step === 'user' ? { name: 'Intercom', username: 'admin', scheme: 'http', port: 80, verify_ssl: true, rtsp_port: 554 } : {};
  void FLOW_SCHEMAS;
  return { flow_id: f.id, type: 'form', step_id: f.step, errors, choices, defaults,
    device: f.step === 'confirm_device' ? { model: 'DS-KV6113-WPE1', firmware: 'V2.2.53', serial: 'MAC identity' } : null, entry: null, reason: null };
}

function finish(m: InstallerMock) {
  const f = m.flow!;
  m.flow = null;
  return f.entry
    ? { flow_id: f.id, type: 'abort', step_id: null, errors: {}, choices: {}, defaults: {}, device: null, entry: null, reason: 'reconfigure_successful' }
    : { flow_id: f.id, type: 'create_entry', step_id: null, errors: {}, choices: {}, defaults: {}, device: null, entry: { entry_id: 'entry-new', title: 'לובי' }, reason: null };
}

export interface DoorState {
  doorName: string;
  openDuration: number;
  relayReverseEnabled: boolean;
}

const BOUNDS = { doorName: { type: 'text', min: 1, max: 32 }, openDuration: { type: 'integer', min: 1, max: 255 }, relayReverseEnabled: { type: 'boolean' } };
const RELAYS: Record<string, { physical_index: number; api_id: number; confirmed: boolean; name: string | null }[]> = {
  'entry-a': [{ physical_index: 1, api_id: 1, confirmed: true, name: 'ראשי' }],
  'entry-b': [{ physical_index: 1, api_id: 1, confirmed: true, name: null }],
  'entry-c': [],
};

function technicalView(m: InstallerMock, s: { id: string; name: string; online: boolean }) {
  return {
    station_id: s.id, name: s.name, online: s.online, typed_phrase: s.name, fetched_at: '2026-09-27T10:29:00Z',
    editable_doors: RELAYS[s.id].map((r) => r.api_id), dangerous_fields: ['relayReverseEnabled'],
    report: {
      checked_at: '2026-09-27T10:29:00+00:00',
      doors: [1, 2].map((n) => ({ door: n, values: { ...m.doors[s.id][n] }, constraints: BOUNDS, error: null })),
      passwords: { states: { engineeringConfigured: true, setupAlarmConfigured: false, householderUnlockConfigured: null, antiHijackingConfigured: false, sendCardConfigured: null }, public_pin_state: 'absent' },
      password_error: null,
      features: [
        { family: 'AccessControl', name: 'isSupportDoorParam', supported: true },
        { family: 'AccessControl', name: 'isSupportRemoteControlDoor', supported: true },
        { family: 'VideoIntercom', name: 'isSupportPrivilegePasswordStatus', supported: true },
        { family: 'VideoIntercom', name: 'isSupportElevatorControl', supported: false },
      ],
      relay_selection: RELAYS[s.id],
    },
  };
}

export const newInstallerMock = (over: Partial<InstallerMock> = {}): InstallerMock => ({
  persona: 'admin',
  result: {},
  failParts: new Set(),
  unavailable: new Set(),
  ntp: { revision: 3, server: 'time.windows.com', port: 123, interval: 60 },
  writes: [],
  flow: null,
  flowSeq: 1,
  flowInputs: [],
  jobs: [],
  doors: Object.fromEntries(['entry-a', 'entry-b', 'entry-c'].map((id) => [id, { 1: { doorName: 'כניסה', openDuration: 5, relayReverseEnabled: false }, 2: { doorName: 'שער רכב', openDuration: 3, relayReverseEnabled: false } }])),
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
    const tech = /^technical\/stations\/([^/?]+)$/.exec(p);
    if (tech && method === 'GET') {
      const s = STATIONS.find((x) => x.id === decodeURIComponent(tech[1]))!;
      if (m.result.technical_read === 'refused') return error(route, 502, 'installer_read_failed', 'WisKey לא החזיר את הנתונים (device_busy).', { state: 'error', wiskey_code: 'device_busy' });
      return json(route, technicalView(m, s));
    }
    const door = /^technical\/stations\/([^/]+)\/doors\/(\d)$/.exec(p);
    if (door && method === 'PUT') {
      const s = STATIONS.find((x) => x.id === decodeURIComponent(door[1]))!;
      const n = Number(door[2]);
      const b = JSON.parse(req.postData() ?? '{}') as { changes: Record<string, unknown> };
      const typed = 'relayReverseEnabled' in (b.changes ?? {}) ? s.name : null;
      return write(route, typed ? 'update_relay' : 'update', typed, () => {
        m.doors[s.id][n] = { ...m.doors[s.id][n], ...b.changes } as DoorState;
        return { door: n, values: { ...m.doors[s.id][n] }, constraints: BOUNDS, error: null };
      });
    }
    // ---------------------------------------------------------------- phase 3: onboarding (a fake of WisKey's config-entry flow) and lifecycle jobs
    if (p === 'onboarding' && method === 'POST') {
      const b = JSON.parse(req.postData() ?? '{}') as { kind: string; entry_id?: string };
      return write(route, 'onboarding_start', null, () => {
        const id = `flow${String(m.flowSeq++).padStart(6, '0')}abcd`;
        m.flow = { id, step: b.kind === 'reconfigure' ? 'reconfigure' : 'user', entry: b.entry_id ?? null };
        return flowView(m);
      });
    }
    const step = /^onboarding\/([^/]+)\/steps\/([a-z_]+)$/.exec(p);
    if (step && method === 'POST') {
      const b = JSON.parse(req.postData() ?? '{}') as { input: Record<string, unknown> };
      const typed = step[2] === 'mapping' ? 'פתיחת דלת לבדיקה' : null;
      if (!m.flow || m.flow.id !== step[1]) return error(route, 404, 'onboarding_flow_not_found', 'האשף אינו פתוח', { outcome: 'not_sent' });
      return write(route, typed ? 'onboarding_pulse' : 'onboarding_step', typed, () => {
        m.flowInputs.push({ step: step[2], input: b.input });
        const f = m.flow!;
        if ((f.step === 'user' || f.step === 'reconfigure') && b.input.password === 'wrong') return flowView(m, { base: 'invalid_auth' });
        const next: Record<string, string> = { user: 'confirm_device', reconfigure: 'confirm_device', confirm_device: 'locks', mapping: 'confirm_mapping' };
        if (f.step === 'locks' && b.input.mode === 'camera_only') return finish(m);
        if (f.step === 'confirm_mapping') return finish(m);
        f.step = f.step === 'locks' ? 'mapping' : next[f.step];
        return flowView(m);
      });
    }
    const abort = /^onboarding\/([^/]+)\/abort$/.exec(p);
    if (abort && method === 'POST') return write(route, 'onboarding_abort', null, () => ((m.flow = null), { flow_id: abort[1], type: 'aborted' }));
    if (p === 'lifecycle' && method === 'GET') return json(route, { records: m.jobs.map((j) => ({ ...j })), fetched_at: NOW.toISOString(), stations: STATIONS, open_flows: false });
    if (p.startsWith('lifecycle/review') && method === 'GET') {
      const q = new URL(req.url()).searchParams;
      const target = q.get('target_id') ?? '';
      return json(route, {
        fetched_at: NOW.toISOString(),
        review: {
          mode: target ? 'replacement' : 'retirement', source_id: q.get('source_id'), target_id: target || null, affected_people: 14, rows_complete: true, groups: 1,
          known_bindings: 14, unknown_owners: 0, hold_programs: 0, native_schedules: 0, required_target_locks: target ? [1] : [], device_writes: 0,
          blockers: target === 'entry-c' ? ['target_contains_accounts'] : [],
          stations: [{ id: q.get('source_id'), name: 'שער ראשי', identity_verified: true, error: null }],
        },
      });
    }
    if (p === 'lifecycle/prepare' && method === 'POST') {
      const b = JSON.parse(req.postData() ?? '{}') as { source_id: string; target_id?: string };
      return write(route, 'prepare', null, () => {
        const s = STATIONS.find((x) => x.id === b.source_id)!;
        const t = STATIONS.find((x) => x.id === b.target_id);
        const job = { id: `job-${m.jobs.length + 1}`, fingerprint: 'fp-1', source_id: s.id, target_id: t?.id ?? null, source_name: s.name, target_name: t?.name ?? null, state: 'prepared',
          created_at: NOW.toISOString(), expires_at: null, applied_at: null, verified_at: null, removed_at: null, require_approval: false, approval_state: 'pending', affected_people: 14 };
        m.jobs.push(job);
        return { job };
      });
    }
    const jobAction = /^lifecycle\/jobs\/([^/]+)\/(apply|verify|remove)$/.exec(p);
    if (jobAction && method === 'POST') {
      const job = m.jobs.find((j) => j.id === jobAction[1])!;
      const action = jobAction[2];
      return write(route, action, action === 'verify' ? null : job.source_name, () => {
        job.state = action === 'apply' ? 'applied' : action === 'verify' ? 'verified' : 'removed';
        return { job: { ...job } };
      });
    }
    return error(route, 404, 'not_found', 'לא נמצא', {});
  });
  return m;
}
