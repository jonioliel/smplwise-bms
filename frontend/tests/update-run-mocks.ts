import type { Page } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// CR-021 S3 (update and restarts UI): the mocked backend shared by evidence-system-update-apply.spec.ts and
// layout-update-screens.spec.ts. Pure page.route on api/v1 (npm run build first, the preview serves dist/; the dev server works too).
// Server behaviour (permission, the state machine, the fake infrastructure) is smplwise_vms/backend/tests/test_self_update_s3.py.

export const BASE_PERMS = ['video.live', 'video.playback', 'map.read', 'map.edit', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
export const ADMIN_PERMS = [...BASE_PERMS, 'system.update'];

/** The bundle's own version (vite defines __ARX_BUILD__ from config.yaml): a run that ends on another version reloads the page once. */
export const BUILD = (() => {
  try {
    const m = /^version:\s*"?([^"\s]+)"?/m.exec(fs.readFileSync(fileURLToPath(new URL('../../smplwise_vms/config.yaml', import.meta.url)), 'utf8'));
    return m ? m[1] : 'dev';
  } catch {
    return 'dev';
  }
})();

export const RUN_ID = '0123456789abcdef';

export interface RunViewMock {
  run_id: string;
  kind: 'update' | 'platform_restart';
  state: string;
  step: string | null;
  started_at: string;
  finished_at: string | null;
  from_version: string | null;
  to_version: string | null;
  /** A CONFIRMED backup; `backup_requested` is what the operator asked for. */
  backup: boolean;
  backup_requested: boolean;
  backup_state: 'not_requested' | 'requested' | 'confirmed';
  error_code: string | null;
  /** The ceiling (update 5400 s, platform restart 600 s) and what the run usually takes. */
  timeout_s: number;
  expected_s: number;
}

export function runView(over: Partial<RunViewMock> = {}): RunViewMock {
  const kind = over.kind ?? 'update';
  return {
    run_id: RUN_ID, kind, state: 'requested', step: null, started_at: new Date(Date.now() - 5000).toISOString(), finished_at: null,
    from_version: kind === 'update' ? '0.1.156' : '2026.10.1', to_version: kind === 'update' ? '0.1.157' : null, backup: kind === 'update', backup_requested: kind === 'update', backup_state: kind === 'update' ? 'confirmed' : 'not_requested', error_code: null,
    timeout_s: kind === 'update' ? 5400 : 600, expected_s: kind === 'update' ? 1200 : 600, ...over,
  };
}

/** One answer of `GET /runs/{id}`: a run, 'down' (the connection is refused: Arx is restarting) or a bare status. */
export type RunReply = RunViewMock | 'down' | { status: number; body?: unknown };

export interface UpdateMock {
  state: Record<string, unknown>;
  check: { status: number; body: Record<string, unknown>; headers?: Record<string, string> };
  /** Answers of GET /runs/{id}, one per call; the last repeats. */
  runReplies: RunReply[];
  runGets: number;
  /** null = 202 with a fresh run (`startRun`). */
  applyReply: { status: number; body: unknown; headers?: Record<string, string> } | null;
  restartReply: { status: number; body: unknown } | null;
  arxRestartReply: { status: number; body: unknown } | null;
  /** The run an accepted apply / platform restart starts. */
  startRun: RunViewMock;
  applyBodies: Record<string, unknown>[];
  restartBodies: Record<string, unknown>[];
  arxRestarts: number;
  /** While true `GET me` is refused (Arx is down after "restart Arx"). */
  meDown: boolean;
  stateCalls: number;
  checkCalls: number;
}

export const ENVELOPE = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: '', details });

export function freshMock(): UpdateMock {
  return {
    state: { installed: '0.1.156', latest: '0.1.156', update_available: false, checked_at: '2026-10-04T08:00:00+00:00', check_result: 'current', interval_hours: 6, permitted: 'yes', notes: [], requires_platform_restart: false, platform_restart_reasons: [], run: null },
    check: { status: 200, body: { checked_at: '2026-10-04T09:00:00+00:00', check_result: 'current', installed: '0.1.156', latest: '0.1.156', update_available: false, refreshed: true } },
    runReplies: [],
    runGets: 0,
    applyReply: null,
    restartReply: null,
    arxRestartReply: null,
    startRun: runView(),
    applyBodies: [],
    restartBodies: [],
    arxRestarts: 0,
    meDown: false,
    stateCalls: 0,
    checkCalls: 0,
  };
}

/** An update is waiting (0.1.157). */
export function withUpdate(mock: UpdateMock, extra: Record<string, unknown> = {}): UpdateMock {
  mock.state = { ...mock.state, latest: '0.1.157', update_available: true, check_result: 'available', ...extra };
  return mock;
}

export async function mockBackend(page: Page, perms: string[], mock: UpdateMock) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (p === 'me') {
      if (mock.meDown) return route.abort('connectionrefused');
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'time.zone': 'Asia/Jerusalem' }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-04T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p === 'system/update/state') {
      mock.stateCalls += 1;
      return json(perms.includes('system.update') ? mock.state : { update_available: false });
    }
    if (p === 'system/update/check' && req.method() === 'POST') {
      mock.checkCalls += 1;
      return json(mock.check.body, mock.check.status, mock.check.headers);
    }
    if (p === 'system/update/settings' && req.method() === 'PUT') return json({ interval_hours: (req.postDataJSON() as { interval_hours: number }).interval_hours });
    if (p === 'system/update/apply' && req.method() === 'POST') {
      mock.applyBodies.push(req.postDataJSON() as Record<string, unknown>);
      if (mock.applyReply) return json(mock.applyReply.body, mock.applyReply.status, mock.applyReply.headers);
      return json(mock.startRun, 202);
    }
    if (p === 'system/update/restart-platform' && req.method() === 'POST') {
      mock.restartBodies.push(req.postDataJSON() as Record<string, unknown>);
      if (mock.restartReply) return json(mock.restartReply.body, mock.restartReply.status);
      return json(mock.startRun, 202);
    }
    if (p === 'system/restart' && req.method() === 'POST') {
      mock.arxRestarts += 1;
      if (mock.arxRestartReply) return json(mock.arxRestartReply.body, mock.arxRestartReply.status);
      return json({ restarting: true }, 202);
    }
    if (p.startsWith('system/update/runs/')) {
      const i = Math.min(mock.runGets, Math.max(0, mock.runReplies.length - 1));
      mock.runGets += 1;
      const r = mock.runReplies[i];
      if (!r) return json(ENVELOPE('not_found', 'הפעולה לא נמצאה.'), 404);
      if (r === 'down') return route.abort('connectionrefused');
      if ('status' in r) return json(r.body ?? ENVELOPE('http_' + r.status, ''), r.status);
      return json(r);
    }
    return json(ENVELOPE('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

export async function openUpdate(page: Page, hash: string, query = '') {
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(700);
}
