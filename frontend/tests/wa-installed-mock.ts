import type { Page, Route } from '@playwright/test';
import { demoInstalledView, type InstalledView } from '../src/api/wa-installed';

// WISKEY-WA-QUEUE-2400: the mock of `/api/v1/access-control/messaging/installed` (GET / PUT) and `.../registry-sync` (POST) - a STATEFUL
// server with the reply shape of routers/access_control_wa_queue.py (backend/tests/test_wiskey_wa_queue_2400.py pins the real one).
// Everything is invented: no number, no recipient, no message text.

export interface WaInstalledMock {
  view: InstalledView;
  /** What the next sync answers: `synced`, or an error status with the server's code (409 / 502 / 504). */
  sync: 'synced' | 'not_selected' | 'refused' | 'unknown';
  /** The read fails (500): the card's error state. */
  readFails: boolean;
  puts: Record<string, unknown>[];
  syncs: number;
}

export function newWaInstalled(patch: (v: InstalledView) => void = () => {}): WaInstalledMock {
  const view = demoInstalledView();
  patch(view);
  return { view, sync: 'synced', readFails: false, puts: [], syncs: 0 };
}

const err = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: 'c0ffee', details });
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export async function installWaInstalled(page: Page, st: WaInstalledMock = newWaInstalled()): Promise<WaInstalledMock> {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(/\/api\/v1\/access-control\/messaging\/installed$/, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      if (st.readFails) return json(route, err('internal', 'שגיאת שרת.'), 500);
      return json(route, clone(st.view));
    }
    const body = req.postDataJSON() as Record<string, unknown>;
    st.puts.push(body);
    if (typeof body.send_pacing_v1 !== 'boolean') return json(route, err('installed_settings_invalid', 'ההגדרה אינה תקינה.'), 422);
    st.view.settings.send_pacing_v1 = body.send_pacing_v1;
    return json(route, clone(st.view));
  });
  await page.route(/\/api\/v1\/access-control\/messaging\/installed\/registry-sync$/, async (route) => {
    st.syncs += 1;
    if (st.sync === 'not_selected') return json(route, err('registry_sync_unavailable', 'החיבור הישיר ל-WisKey אינו זמין כרגע, ולכן רשימת התבניות לא רועננה.', { outcome: 'not_sent' }), 409);
    if (st.sync === 'refused') {
      st.view.registry.last_sync = { outcome: 'refused', code: 'installation_unavailable', native: null, at: '2026-11-04T09:00:00+00:00' };
      return json(route, err('registry_sync_refused', 'WisKey לא מסרה רשימת תבניות תקינה. הרשימה הקיימת נשמרה.', { outcome: 'refused', code: 'installation_unavailable' }), 502);
    }
    if (st.sync === 'unknown') return json(route, err('registry_sync_uncertain', 'לא התקבלה תשובה מ-WisKey. הרשימה הקיימת נשמרה.', { outcome: 'unknown' }), 504);
    st.view.registry.last_sync = { outcome: 'synced', code: null, native: st.view.registry.wiskey_rows, at: '2026-11-04T09:00:00+00:00' };
    return json(route, { ...clone(st.view), sync: clone(st.view.registry.last_sync) });
  });
  return st;
}
