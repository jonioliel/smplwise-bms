import type { Page, Route } from '@playwright/test';
import { ADMIN, installFrigate, newFrigateMock } from './frigate-mocks';

// TKSPECS: the mock layers of the secrets card (Settings > Connections > Secrets, routes of routers/system_secrets) and of the setup wizard hint
// (GET /setup/state, POST /setup/check/{step}, GET / PUT /me/prefs `setup.hint`). Fake data only. Both sit ON TOP of the Frigate mock's base
// routes (me, health, settings, ...): Playwright runs the most recently registered route first and `route.fallback()` hands over to the base.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const envelope = (route: Route, status: number, code: string, msg: string) => json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details: {} }, status);
const NOW = '2026-10-16T08:00:00Z';

// ---- secrets ----

export interface MockSecret {
  name: string;
  label_he: string;
  label_en: string;
  restart_required: boolean;
  testable: boolean;
  configured: boolean;
  state: 'set' | 'not_set' | 'unreadable' | 'legacy';
  source: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
}
const secret = (name: string, label_he: string, label_en: string, over: Partial<MockSecret> = {}): MockSecret => ({
  name, label_he, label_en, restart_required: true, testable: false, configured: false, state: 'not_set', source: null, updated_at: null, updated_by: null, updated_by_name: null, ...over,
});
export const SECRET_ROWS = (): MockSecret[] => [
  secret('go2rtc_api_password', 'סיסמת ה־API של go2rtc', 'go2rtc API password', { testable: true, configured: true, state: 'set', source: 'ui', updated_at: '2026-10-14T09:30:00Z', updated_by: 'u-admin', updated_by_name: 'יוני' }),
  secret('wiskey_password', 'סיסמת עמדות WisKey', 'WisKey stations password', { testable: true, configured: true, state: 'legacy', source: 'addon_option' }),
  secret('wiskey_background_token', 'אסימון הרקע של WisKey', 'WisKey background token'),
  secret('openai_api_key', 'מפתח OpenAI', 'OpenAI API key', { restart_required: false, state: 'unreadable', source: 'ui', updated_at: '2026-10-01T07:00:00Z' }),
  secret('push_relay_key', 'מפתח שרת ההתראות לטלפון', 'Push relay key', { configured: true, state: 'set', source: 'addon_import', updated_at: '2026-10-02T07:00:00Z' }),
];

export interface SecretsMockOptions {
  /** GET system/secrets: ok | forbidden (403) | error (500) */
  list?: 'ok' | 'forbidden' | 'error';
  /** PUT / DELETE answer 403 */
  writeForbidden?: boolean;
  /** the answer code of POST .../test, per secret (default ok) */
  testCode?: Record<string, string>;
  /** the remote channel: the server answers `me.channel = remote` */
  remote?: boolean;
  /** without system.configure the host screen does not draw the card */
  perms?: string[];
  rows?: MockSecret[];
}
export interface SecretsMock {
  rows: MockSecret[];
  calls: { method: string; path: string; body: unknown }[];
  /** every response body ever sent, lowercased - the proof that a typed value is never echoed */
  responses: string[];
}

export async function installSecretsMock(page: Page, o: SecretsMockOptions = {}): Promise<SecretsMock> {
  const perms = o.perms ?? ADMIN;
  const st: SecretsMock = { rows: o.rows ?? SECRET_ROWS(), calls: [], responses: [] };
  await installFrigate(page, newFrigateMock({ perms }));
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me' && o.remote) {
      return json(route, {
        channel: 'remote', remote: { path: '/arx/' }, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ha_token' }, active: true, bindings: [],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full',
      });
    }
    const m = /^system\/secrets(?:\/([^/]+?)(\/test)?)?$/.exec(p);
    if (!m) return route.fallback();
    const body: unknown = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    st.calls.push({ method, path: p, body });
    const reply = (status: number, payload: unknown) => { st.responses.push(JSON.stringify(payload).toLowerCase()); return json(route, payload, status); };
    if (!m[1]) {
      if (o.list === 'forbidden') return envelope(route, 403, 'forbidden', 'אין הרשאה לנהל סודות');
      if (o.list === 'error') return envelope(route, 500, 'internal', 'שגיאה בקריאת הסודות');
      return reply(200, { secrets: st.rows, in_addon: true });
    }
    const name = decodeURIComponent(m[1]);
    const row = st.rows.find((r) => r.name === name);
    if (!row) return envelope(route, 404, 'not_found', 'הסוד לא נמצא');
    if (m[2]) {
      const code = o.testCode?.[name] ?? 'ok';
      return reply(200, { ok: code === 'ok', code });
    }
    if (o.writeForbidden) return envelope(route, 403, 'forbidden', 'אין הרשאה לשנות סודות');
    if (method === 'PUT') {
      Object.assign(row, { configured: true, state: 'set', source: 'ui', updated_at: NOW, updated_by: 'u-admin', updated_by_name: 'יוני' });
      return reply(200, { restart_required: row.restart_required, secret: row });
    }
    if (method === 'DELETE') {
      Object.assign(row, { configured: false, state: 'not_set', source: null, updated_at: NOW, updated_by: 'u-admin', updated_by_name: 'יוני' });
      return reply(200, { restart_required: row.restart_required, secret: row });
    }
    return envelope(route, 405, 'method_not_allowed', 'לא נתמך');
  });
  return st;
}

// ---- setup wizard / hint ----

type Status = 'done' | 'todo' | 'failed' | 'skipped' | 'not_applicable';
export type StepIdT = 'install' | 'nvr' | 'ha' | 'go2rtc' | 'floor' | 'camera';
const TITLES: Record<StepIdT, string> = { install: 'התקנה', nvr: 'חיבור ל־NVR', ha: 'תשתית המערכת', go2rtc: 'go2rtc', floor: 'קומה ותוכנית', camera: 'מצלמה על המפה' };
const PROBLEM: Partial<Record<StepIdT, { code: string; message: string; action: string }>> = {
  nvr: { code: 'source_unavailable', message: 'ה־NVR לא ענה', action: 'ודאו שה־NVR דולק ומחובר לרשת' },
  ha: { code: 'ha_not_configured', message: 'תשתית המערכת לא מוגדרת', action: 'הגדירו את החיבור בהגדרות' },
  floor: { code: 'no_floor', message: 'עוד אין קומה עם תוכנית', action: 'צרו קומה והעלו תוכנית' },
  camera: { code: 'no_camera_placed', message: 'אף מצלמה עוד לא מוצבת על מפה', action: 'הציבו מצלמה על התוכנית' },
};
const OPTIONAL = new Set<StepIdT>(['floor', 'camera']);

export type StepStatuses = Partial<Record<StepIdT, Status>>;
export const ORDER: StepIdT[] = ['install', 'nvr', 'ha', 'go2rtc', 'floor', 'camera'];

export function wizardState(statuses: StepStatuses, opts: { sendOptional?: boolean } = {}) {
  const send = opts.sendOptional ?? true;
  const steps = ORDER.map((id, i) => {
    const status: Status = statuses[id] ?? 'done';
    const pr = PROBLEM[id] ?? { code: 'incomplete', message: 'חסר', action: 'השלימו' };
    return {
      id, index: i + 1, title: TITLES[id], ...(send ? { optional: OPTIONAL.has(id) } : {}), status, summary: status === 'done' ? 'הכול תקין' : 'השלב עוד לא הושלם', facts: [], evidence: {},
      problem: status === 'failed' || status === 'todo' ? { ...pr, link: { href: '#/system/setup', label: 'להגדרות' } } : null,
      warnings: [], settings_link: { href: '#/system/setup', label: 'להגדרות' }, source: 'local', checked_at: NOW,
    };
  });
  const required = steps.filter((s) => !OPTIONAL.has(s.id) && s.status !== 'not_applicable');
  const requiredDone = required.filter((s) => s.status === 'done').length;
  const applicable = steps.filter((s) => s.status !== 'not_applicable');
  return {
    version: 'test', mode: 'full', checked_at: NOW, steps, done: applicable.filter((s) => s.status === 'done').length, total: applicable.length,
    required_done: requiredDone, required_total: required.length, required_failed: required.filter((s) => s.status === 'failed').map((s) => s.id),
    ready: requiredDone === required.length, next: required.find((s) => s.status !== 'done')?.id ?? null,
    thresholds: { drift_ok_s: 2, drift_fail_s: 30 }, check_every_s: 5, live_ttl_s: 600,
  };
}

export interface WizardMockOptions {
  steps: StepStatuses;
  /** the stored dismissal at the start (`/me/prefs` setup.hint) */
  dismissal?: { dismissed: true; failed: string[] } | null;
  /** an older backend that sends no `optional` field */
  noOptionalField?: boolean;
  /** the prefs write is refused */
  prefsWriteFails?: boolean;
}
export interface WizardMock {
  /** the stored prefs value (mutated by PUT /me/prefs) */
  hint: { dismissed: true; failed: string[] } | null;
  puts: unknown[];
  setSteps: (s: StepStatuses) => void;
}

export async function installWizardMock(page: Page, o: WizardMockOptions): Promise<WizardMock> {
  let steps = o.steps;
  const st: WizardMock = { hint: o.dismissal ?? null, puts: [], setSteps: (s) => { steps = s; } };
  await installFrigate(page, newFrigateMock({ perms: ADMIN }));
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me/prefs') {
      if (req.method() === 'PUT') {
        const b = req.postDataJSON() as Record<string, unknown>;
        st.puts.push(b);
        if (o.prefsWriteFails) return envelope(route, 500, 'internal', 'שגיאה');
        if ('setup.hint' in b) st.hint = b['setup.hint'] as WizardMock['hint'];
      }
      return json(route, { prefs: st.hint ? { 'setup.hint': st.hint } : {}, stored: st.hint ? ['setup.hint'] : [], updated_at: null });
    }
    if (p === 'setup/state' || p.startsWith('setup/check/')) return json(route, wizardState(steps, { sendOptional: !o.noOptionalField }));
    return route.fallback();
  });
  return st;
}
