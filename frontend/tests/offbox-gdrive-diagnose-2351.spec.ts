import { test, expect, type Page, type Route } from '@playwright/test';

// GDRIVE-READY-2351 / PRE-GATE-2360: Settings › אבחון › גיבוי ושחזור - the "בדיקת חיבור Google" dialog of a Google Drive target, against a
// MOCKED wire contract of POST backups/offbox/targets/{id}/gdrive/diagnose (services/offbox_gdrive_diagnose.py). No Google contact: every
// request is answered by the page route below; an invented target, invented client id.
//   1. the button opens the dialog; while the server answers, a "בודק" status shows; then the summary and one row per check, the fix only
//      under a row that is not ok;
//   2. "בדיקה חוזרת" asks again and redraws (fail -> ok); the check never writes anything else (the only non-GET call is diagnose);
//   3. a server error shows in words inside the dialog; Escape / "אישור" close it and the card stays.
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/offbox-gdrive-diagnose-2351.spec.ts --workers=1

const PERMS = ['video.live', 'map.read', 'entity.state.read', 'events.read', 'system.configure', 'backup.manage'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const FAIL = {
  ok: false, connected: false, ready_to_connect: false,
  summary: 'נמצאה בעיה: סוד הלקוח - בשדה הסוד הודבק מזהה הלקוח (Client ID) ולא הסוד.',
  checks: [
    { id: 'client_id', status: 'ok', title: 'מזהה הלקוח', message: 'Client ID הוזן ובמבנה תקין.', fix: 'לא אמור להופיע' },
    { id: 'client_secret', status: 'fail', title: 'סוד הלקוח', message: 'בשדה הסוד הודבק מזהה הלקוח (Client ID) ולא הסוד.', fix: 'יש לפתוח עריכה ולהדביק את הסוד.' },
    { id: 'clock', status: 'warn', title: 'שעון המערכת', message: 'שעון המערכת מקדים בכ־40 שניות.' },
    { id: 'account', status: 'skip', title: 'חשבון Google', message: 'עדיין לא חובר חשבון Google.', fix: "ללחוץ 'חיבור חשבון Google'." },
  ],
};
const OK = {
  ok: true, connected: false, ready_to_connect: true, summary: "ההגדרות ב־Google תקינות. השלב הבא: 'חיבור חשבון Google'.",
  checks: [
    { id: 'client_id', status: 'ok', title: 'מזהה הלקוח', message: 'Client ID הוזן ובמבנה תקין.' },
    { id: 'client_secret', status: 'ok', title: 'סוד הלקוח', message: 'סוד הלקוח שמור (מוצפן; לא מוצג).' },
    { id: 'account', status: 'info', title: 'חשבון Google', message: 'ממתין לחיבור.' },
  ],
};

interface Mock { calls: { method: string; path: string }[]; answers: Array<'fail' | 'ok' | 'error'>; delayMs: number }

async function setup(page: Page, answers: Mock['answers'], delayMs = 0): Promise<Mock> {
  const st: Mock = { calls: [], answers: [...answers], delayMs };
  const target = {
    id: 'g1', name: 'Google Drive של הבניין', kind: 'gdrive', enabled: false,
    config: { client_id: '000000000000-mock.apps.googleusercontent.com', folder: 'arx-backups' },
    secrets: { client_secret: true }, retention: { keep_last: 3, keep_daily: 7, keep_weekly: 4, keep_monthly: 6 }, revision: 1,
    updated_at: '2026-11-01T10:00:00Z', last: { push: null, test: null, drill: null }, gdrive: { connected: false, pending: false, connected_at: null },
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (method !== 'GET') st.calls.push({ method, path: p });
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: true });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-01T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'backups') return json(route, { backups: [], policy: { 'auto-daily': 7, 'auto-pre-upgrade': 5 }, bytes: 0, schema_version: 193 });
    if (p === 'backups/offbox') {
      return json(route, { targets: [target], running: false, transports: { s3: true, sftp: true, local: true, gdrive: true },
        key: { active: '3f2a9c1d7b6e5a40', keys: [{ id: '3f2a9c1d7b6e5a40', created_at: '2026-10-01T00:00:00Z', source: 'generated', exported: true, exported_at: '2026-10-02T00:00:00Z', active: true }] } });
    }
    if (p === 'backups/drill' && method === 'GET') {
      return json(route, { running: false, history: [], schedule: { monthly: true, next_due_at: '2026-12-01T03:00:00Z', due_now: false }, last: null, last_offbox: null });
    }
    if (p === 'backups/offbox/targets/g1/gdrive/diagnose' && method === 'POST') {
      if (st.delayMs) await new Promise((r) => setTimeout(r, st.delayMs));
      const a = st.answers.shift() ?? 'ok';
      if (a === 'error') return json(route, { code: 'remote_error', user_message: 'remote_error', retryable: true, correlation_id: 'mock', details: {} }, 502);
      return json(route, a === 'fail' ? FAIL : OK);
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return st;
}

async function open(page: Page) {
  await page.goto('/?design=a#/system/diagnostics?tab=backup');
  const card = page.locator('sw-offbox-backup');
  await expect(card.locator('[data-offbox-target="g1"] [data-offbox-gdrive="not-connected"]')).toBeVisible();
  return card;
}

test('the Google connection check: running status, summary, one row per check, the fix only where not ok; check again redraws', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const st = await setup(page, ['fail', 'ok'], 600);
  const card = await open(page);

  await card.locator('[data-offbox-gdrive-diagnose]').click();
  const dlg = card.locator('[data-offbox-gdrive-diag]');
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('status').filter({ hasText: 'בודק מול Google' })).toBeVisible();

  const summary = dlg.locator('[data-offbox-gdrive-diag-summary]');
  await expect(summary).toHaveAttribute('data-offbox-gdrive-diag-summary', 'fail');
  await expect(summary).toContainText('נמצאה בעיה: סוד הלקוח');
  const rows = dlg.locator('[data-offbox-gdrive-diag-list] li');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toHaveAttribute('data-status', 'ok');
  await expect(dlg.locator('li[data-check="client_secret"]')).toHaveAttribute('data-status', 'fail');
  // the fix is drawn under a failing / skipped row, never under an ok one (even when the server sent one)
  await expect(dlg.locator('li[data-check="client_id"] .fix')).toHaveCount(0);
  await expect(dlg.locator('li[data-check="client_secret"] .fix')).toContainText('יש לפתוח עריכה');
  await expect(dlg.locator('li[data-check="account"] .fix')).toHaveCount(1);
  await expect(dlg.locator('li[data-check="clock"] .fix')).toHaveCount(0);
  await expect(dlg).toContainText('הבדיקה לא משנה דבר');

  await dlg.locator('[data-offbox-gdrive-diag-again]').click();
  await expect(summary).toHaveAttribute('data-offbox-gdrive-diag-summary', 'ok');
  await expect(rows).toHaveCount(3);
  await expect(dlg.locator('li[data-check="client_secret"]')).toHaveAttribute('data-status', 'ok');

  // read-only: the dialog sent the diagnose call twice and nothing else
  expect(st.calls).toEqual([
    { method: 'POST', path: 'backups/offbox/targets/g1/gdrive/diagnose' },
    { method: 'POST', path: 'backups/offbox/targets/g1/gdrive/diagnose' },
  ]);
  expect(errors).toEqual([]);
});

test('a server error shows in words inside the dialog; Escape closes it and the target row stays', async ({ page }) => {
  await setup(page, ['error']);
  const card = await open(page);
  await card.locator('[data-offbox-gdrive-diagnose]').click();
  const dlg = card.locator('[data-offbox-gdrive-diag]');
  await expect(dlg.getByRole('alert')).toBeVisible();
  await expect(dlg.getByRole('alert')).not.toHaveText('');
  await expect(dlg.locator('[data-offbox-gdrive-diag-summary]')).toHaveCount(0);
  await expect(dlg.locator('[data-offbox-gdrive-diag-again]')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(card.locator('[data-offbox-target="g1"] [data-offbox-gdrive-diagnose]')).toBeVisible();
});
