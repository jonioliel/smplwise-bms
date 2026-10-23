import type { Page, Route } from '@playwright/test';

// CR-FLEET215: the mock layer of the Settings › דיווח בריאות specs - the wire contract of routers/fleet.py and (CR-READY96) routers/readiness.py with
// fake data only (invented ids and counts, no real installation). The whole app runs against it through page.route.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string) => json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details: {} }, status);

export type FleetScene = 'off' | 'on' | 'nourl' | 'badurl' | 'failed' | 'first';

export interface FleetMockOptions {
  scene?: FleetScene;
  /** the persona holds system.configure at installation scope (the tab shows); false = a plain operator */
  configure?: boolean;
  /** the status request answers 403 (not a system administrator) */
  forbidden?: boolean;
  /** the status request answers 500 */
  statusError?: boolean;
  /** readiness answers 500 (the rest of the page still works) */
  readinessError?: boolean;
  /** milliseconds the status answer is held (to see the loading state) */
  statusDelay?: number;
  /** the readiness list is complete (nothing missing) */
  allReady?: boolean;
  /** the "reporting stopped" message fails to reach the receiver */
  stopFails?: boolean;
  /** the manual send fails */
  sendFails?: boolean;
  /** every log row carries its exact body */
  emptyLog?: boolean;
}

export interface FleetMock {
  calls: { method: string; path: string; body: unknown }[];
  state: Record<string, unknown>;
}

const ID = '8c41d2f09a6b4e1c93f57a20b6d1e07b';
const KID = '3f9a0c71be52d846';
const CODE = `arx-fleet-1.${ID}.${KID}.MCowBQYDK2VwAyEAqXk3gH0Fakefakefakefakefakefakefakefakefake=`;
const DAY = 24 * 3600 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const REPORT_BODY = {
  schema: 'smplwise-fleet-report/1', installation_id: ID, seq: 412, generated_at: '2026-10-23T03:12:00Z', mode: 'full', demo_mode: false, overall: 'warn', uptime_h: 307,
  versions: { addon: '2.15.0', bridge: '0.9.8', bridge_required: '0.9.8', ha: '2026.10.1', go2rtc: '1.9.9', db_schema: 149 },
  components: { db: 'ok', storage: 'ok', nvr: 'ok', go2rtc: 'ok', ha_sync: 'ok', bridge: 'ok', events_ingest: 'ok', events_derive: 'ok', discovery: 'ok', thumbnails: 'ok', exports: 'ok', backups: 'warn', frigate: 'absent' },
  counts: { cameras: 24, recorders: 1, recorders_by_vendor: { hikvision: 1, provision_isr: 0, frigate: 0, none: 0 }, ha_entities: 386, floors_published: 3, users_active: 11, system_admins: 2 },
  alerts_open: { info: 2, alert: 1, critical: 0 },
  disk: { free_pct: 61, free_gb: 573, total_gb: 938 },
  backup: { count: 6, last_age_h: 71, offbox_targets: 0 },
  update: { check: 'available', available: true, latest: '2.15.1' },
  readiness: { score: 78, ready: false, missing: ['backup', 'notifications', 'places', 'handover'] },
};

// READYFLEET-295: GET /readiness is CR-READY96's report (routers/readiness.py); the fleet screen shows its score and links to its screen
function check(id: string, status: string, applicable = true) {
  return { id, group: 'g', source: 'computed', title: id, weight: 10, critical: false, status, fraction: status === 'ok' ? 1 : 0.5, summary: '', facts: [], next: null,
    applicable, checked_at: ago(1000), gain: status === 'ok' ? 0 : 5 };
}

function readiness(allReady: boolean) {
  const checks = allReady
    ? [check('backup', 'ok'), check('modules', 'not_applicable', false)]
    : [check('backup', 'blocked'), check('notifications', 'attention'), check('places', 'attention'), check('handover', 'pending'), check('people', 'ok'),
      check('modules', 'not_applicable', false)];
  return { score: allReady ? 100 : 78, level: allReady ? 'ready' : 'almost', level_text: '', checks, checked_at: ago(1000),
    handover: { advice_score: 90, advice_met: allReady, blockers: allReady ? [] : ['backup'], may_hand_over: true, done: allReady }, next_steps: [],
    bands: { almost_min: 50, advice: 90 }, history: [], settings: {}, check_every_s: 30 };
}

export interface MockStatus { [k: string]: unknown; enabled: boolean; receiver_configured: boolean; sending: boolean; last_seq: number; silent_after_h: number }

export function baseStatus(o: FleetMockOptions): MockStatus {
  const scene = o.scene ?? 'on';
  const enabled = scene !== 'off';
  const url = scene !== 'nourl' && scene !== 'badurl';
  return {
    enabled, receiver_configured: url, receiver_problem: scene === 'nourl' ? 'receiver_not_configured' : scene === 'badurl' ? 'receiver_url_invalid' : null, sending: enabled && url,
    installation_id: ID, kid: KID, alg: 'Ed25519', last_seq: scene === 'first' || scene === 'nourl' ? 0 : 412,
    last_attempt_at: scene === 'first' || scene === 'nourl' ? null : scene === 'failed' ? ago(2 * 3600 * 1000) : scene === 'off' ? ago(3 * DAY) : ago(11 * 3600 * 1000),
    last_result: scene === 'first' || scene === 'nourl' ? null : scene === 'failed' ? 'unreachable' : 'ok',
    last_ok_at: scene === 'first' || scene === 'nourl' ? null : scene === 'failed' ? ago(DAY + 3600 * 1000) : scene === 'off' ? ago(3 * DAY) : ago(11 * 3600 * 1000),
    schema: 'smplwise-fleet-report/1', period_h: 24, retry_h: 3, silent_after_h: 36, silent_range_h: [26, 168], silent_default_h: 36, stopped_at: null, stopped_result: null,
  };
}

function logRows(o: FleetMockOptions) {
  if (o.emptyLog || o.scene === 'first' || o.scene === 'nourl') return [];
  const failed = o.scene === 'failed';
  return [
    { id: 3, seq: 412, kid: KID, at: failed ? ago(2 * 3600 * 1000) : ago(11 * 3600 * 1000), trigger: 'schedule', result: failed ? 'unreachable' : 'ok', http_status: failed ? null : 202, payload: REPORT_BODY },
    { id: 2, seq: 411, kid: KID, at: ago(DAY + 11 * 3600 * 1000), trigger: 'schedule', result: 'ok', http_status: 202, payload: { ...REPORT_BODY, seq: 411 } },
    { id: 1, seq: 410, kid: KID, at: ago(2 * DAY + 11 * 3600 * 1000), trigger: 'manual', result: 'ok', http_status: 202, payload: { ...REPORT_BODY, seq: 410 } },
  ];
}

export async function installFleetMock(page: Page, o: FleetMockOptions = {}): Promise<FleetMock> {
  const configure = o.configure ?? true;
  const perms = configure ? ['system.configure', 'devices.read', 'map.read'] : ['devices.read', 'map.read'];
  const st: FleetMock = { calls: [], state: {} };
  let status: MockStatus = baseStatus(o);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body: unknown = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    if (p === 'me') {
      return json(route, {
        user: { id: 'u-ronit', username: 'ronit', display_name: 'רונית לוי', source: 'ingress' }, channel: 'local', remote: null,
        bindings: [{ id: 'b1', role_id: configure ? 'system_admin' : 'operator', role_name: configure ? 'מנהל מערכת' : 'מפעיל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
        modules: { tickets: false, tickets_name: { he: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' } } },
      });
    }
    if (p === 'me/prefs') return json(route, { prefs: { 'nav.order': [] }, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: configure });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'tickets/module') return json(route, { enabled: false, public_ready: false, name: { he: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' } }, name_revision: 0, ui: {} });
    if (!p.startsWith('fleet/report') && p !== 'readiness') return err(route, 404, 'not_found', 'לא נמצא');
    st.calls.push({ method, path: p, body });
    if (p === 'fleet/report' && method === 'GET') {
      if (o.statusDelay) await new Promise((r) => setTimeout(r, o.statusDelay));
      if (o.forbidden) return err(route, 403, 'not_system_admin', 'רק מנהל מערכת יכול לראות או לשנות את דיווח הבריאות.');
      if (o.statusError) return err(route, 500, 'internal', 'משהו השתבש');
      return json(route, status);
    }
    if (p === 'fleet/report' && method === 'PUT') {
      const b = body as { enabled?: boolean; silent_after_h?: number };
      if (b.silent_after_h !== undefined) {
        if (b.silent_after_h < 26 || b.silent_after_h > 168) return err(route, 422, 'silent_after_out_of_range', 'מספר השעות מחוץ לטווח המותר.');
        status = { ...status, silent_after_h: b.silent_after_h };
      }
      if (b.enabled !== undefined) {
        const wasOn = status.enabled;
        status = { ...status, enabled: b.enabled, sending: b.enabled && status.receiver_configured };
        if (wasOn && !b.enabled && status.receiver_configured) status = { ...status, stopped_at: new Date().toISOString(), stopped_result: o.stopFails ? 'unreachable' : 'ok' };
      }
      return json(route, status);
    }
    if (p === 'fleet/report/log') return json(route, { items: logRows(o) });
    if (p === 'fleet/report/preview') return json(route, { preview: true, id_assigned: true, bytes: 1180, payload: { ...REPORT_BODY, seq: 413 } });
    if (p === 'fleet/report/enrollment') return json(route, { installation_id: ID, kid: KID, alg: 'Ed25519', public_key: 'MCowBQYDK2VwAyEAqXk3gH0Fake=', code: CODE });
    if (p === 'fleet/report/send') {
      if (o.sendFails) {
        status = { ...status, last_attempt_at: new Date().toISOString(), last_result: 'unreachable' };
        return json(route, { sent: false, result: 'unreachable', http_status: null, seq: 413 });
      }
      status = { ...status, last_attempt_at: new Date().toISOString(), last_ok_at: new Date().toISOString(), last_result: 'ok', last_seq: status.last_seq + 1 };
      return json(route, { sent: true, result: 'ok', http_status: 202, seq: status.last_seq });
    }
    if (p === 'readiness') return o.readinessError ? err(route, 500, 'internal', 'משהו השתבש') : json(route, readiness(!!o.allReady));
    return err(route, 404, 'not_found', 'לא נמצא');
  });
  return st;
}

export const fleetUrl = (skin = 'classic', scheme: 'light' | 'dark' = 'light') => `/?design=a&skin=${skin}&scheme=${scheme}#/system/fleet-report`;
