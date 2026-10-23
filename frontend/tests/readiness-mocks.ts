import type { Page, Route } from '@playwright/test';
import { ADMIN, installFrigate, newFrigateMock } from './frigate-mocks';
import { demoReadiness, type DemoInfo, type DemoState, type ReadinessReport } from '../src/api/readiness';

// CR-READY96 slice 1: the mock layer of the readiness screen (GET /readiness, POST /readiness/check, PUT /readiness/attest/handover,
// PUT /readiness/settings, GET /demo, POST /demo/start|stop) on top of the Frigate mock's base routes (me, health, settings, ...). Fake data only.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string, details: Record<string, unknown> = {}) =>
  json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details }, status);

export interface ReadinessMockOptions {
  /** GET /readiness: ok | forbidden (403) | error (500) | slow (answers after delayMs) */
  mode?: 'ok' | 'forbidden' | 'error' | 'slow';
  delayMs?: number;
  perms?: string[];
  /** a demo is running (every signed-in user's /me carries it) */
  demo?: DemoState;
  /** the caller holds demo.run */
  canRunDemo?: boolean;
  /** many checks, to prove the list scrolls inside its panel instead of the page */
  extraChecks?: number;
  report?: (r: ReadinessReport) => ReadinessReport;
}

export interface ReadinessMock {
  calls: { method: string; path: string; body: unknown }[];
  report: ReadinessReport;
}

export async function installReadinessMock(page: Page, o: ReadinessMockOptions = {}): Promise<ReadinessMock> {
  const perms = [...(o.perms ?? ADMIN), ...(o.canRunDemo ? ['demo.run'] : [])];
  let report = demoReadiness();
  if (o.extraChecks) {
    const base = report.checks[1];
    report = { ...report, checks: [...report.checks, ...Array.from({ length: o.extraChecks }, (_, i) => ({ ...base, id: `extra_${i}`, title: `בדיקה נוספת ${i + 1}` }))] };
  }
  if (o.report) report = o.report(report);
  const st: ReadinessMock = { calls: [], report };
  await installFrigate(page, newFrigateMock({ perms }));
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me' && o.demo) {
      // the base route's /me, with the demo block added
      const res = await route.fetch().catch(() => null);
      const base = res ? await res.json().catch(() => null) : null;
      if (base) return json(route, { ...base, demo: o.demo });
      return route.fallback();
    }
    if (!/^(readiness|demo)(\/|$)/.test(p)) return route.fallback();
    let body: unknown = null;
    if (method !== 'GET') {
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
    }
    st.calls.push({ method, path: p, body });
    if (p === 'readiness' && method === 'GET') {
      if (o.mode === 'forbidden') return err(route, 403, 'forbidden', 'אין הרשאה');
      if (o.mode === 'error') return err(route, 500, 'internal', 'שגיאה בקריאת המוכנות');
      if (o.mode === 'slow') await new Promise((r) => setTimeout(r, o.delayMs ?? 1500));
      return json(route, st.report);
    }
    if (p === 'readiness/check') return json(route, st.report);
    if (p === 'readiness/attest/handover') {
      const done = (body as { done?: boolean } | null)?.done === true;
      st.report = { ...st.report, handover: { ...st.report.handover, done } };
      return json(route, st.report);
    }
    if (p === 'readiness/settings') return json(route, { settings: st.report.settings, changed: Object.keys((body as { changes?: object } | null)?.changes ?? {}) });
    if (p === 'demo' && method === 'GET') {
      const info: DemoInfo = { ...(o.demo ?? { active: false }), can_run: !!o.canRunDemo, datasets: ['residential', 'office', 'retail'], scenarios: ['normal', 'cameras_offline', 'new_installation'], max_hours: 24 };
      return json(route, info);
    }
    if (p === 'demo/start') return json(route, { active: true });
    if (p === 'demo/stop') return json(route, { active: false });
    return route.fallback();
  });
  return st;
}
