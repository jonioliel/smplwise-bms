import { test, expect, type Page, type Route } from '@playwright/test';

// CR-DIAG-DEFECTS-2436 (code review 2026-11-13, report 06: DIAG-1..4, MSG-1): the settings screen against a mocked backend.
//   DIAG-1  a failed backup action shows its error on the backup tab (and inside the restore dialog)
//   DIAG-2  a deep link straight to ?tab=media / ?tab=ha loads that tab's administrator data once the permissions are known
//   DIAG-3  the General tab's health row is the server's real status (the fixed sentence stays in the demo only)
//   DIAG-4  a failure on one tab does not show up on another
//   MSG-1   a newer saved message is not cut short by the timer of an older one
// Mocked backend only (no NVR, no go2rtc, no Home Assistant). One worker:
//   npx playwright test tests/evidence-diagnostics-defects.spec.ts --project=desktop --workers=1
const D = 'sw-app system-diagnostics';
const ADMIN = ['video.live', 'video.playback', 'map.read', 'events.read', 'devices.read', 'system.configure', 'rbac.assign', 'backup.manage'];
const CHECKED = '2026-10-10T08:00:00Z';

const BACKUP = {
  name: 'smplwise-backup-20261010-080000.zip', kind: 'manual', created_at: CHECKED, bytes: 204800, app_version: 'test', note: '', valid: true,
  tables: { sites: 1, floors: 2, plan_versions: 2, map_anchors: 0, spatial_zones: 0, cameras: 4 }, files: 2,
};

interface Mock {
  calls: string[];
  summary: { status: 'ok' | 'warn' | 'error'; items: { id: string; status: 'ok' | 'warn' | 'error' | 'off'; label: string }[] };
  reportFails: boolean;
  backupCreateFails: boolean;
  restoreFails: boolean;
  patches: number;
}

function newMock(): Mock {
  return {
    calls: [],
    summary: { status: 'ok', items: [{ id: 'db', status: 'ok', label: 'מסד נתונים' }, { id: 'ha', status: 'ok', label: 'Home Assistant' }] },
    reportFails: false,
    backupCreateFails: false,
    restoreFails: false,
    patches: 0,
  };
}

const fail = (route: Route, status: number, message: string) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: 'mock_refused', user_message: message, retryable: false, correlation_id: 'mock', details: {} }) });

async function install(page: Page, m: Mock) {
  const settings: Record<string, unknown> = { 'time.zone': 'Asia/Jerusalem', 'ui.tile_layout': 'auto' };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    m.calls.push(`${method} ${p}`);
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') return json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'מנהל', source: 'ingress' }, active: true, bindings: [], permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') {
      if (method === 'PATCH') {
        m.patches += 1;
        Object.assign(settings, req.postDataJSON() as Record<string, unknown>);
      }
      return json({ settings: { ...settings }, can_edit: true, nvr_channels: 16, warnings: [] });
    }
    if (p === 'health') return json({ status: 'ok', version: 'test', mode: 'full' });
    if (p === 'health/summary') return json({ ...m.summary, checked_at: CHECKED, version: 'test' });
    if (p.startsWith('health/report')) {
      if (m.reportFails) return fail(route, 500, 'דוח הבריאות נכשל (בדיקה)');
      return json({ status: 'ok', mode: 'full', version: 'test', uptime_s: 7200, checked_at: CHECKED, probe_ttl_s: 20, checks: [{ id: 'db', label: 'מסד נתונים', status: 'ok', detail: 'תקין', meta: {} }] });
    }
    if (p === 'backups' && method === 'GET') return json({ backups: [BACKUP], policy: { 'auto-pre-upgrade': 5, 'auto-daily': 7 }, bytes: BACKUP.bytes, schema_version: 1 });
    if (p === 'backups' && method === 'POST') {
      if (m.backupCreateFails) return fail(route, 409, 'יצירת הגיבוי נכשלה (בדיקה)');
      return json({ ...BACKUP, name: 'smplwise-backup-new.zip' });
    }
    if (/^backups\/[^/]+\/restore$/.test(p)) {
      if (m.restoreFails) return fail(route, 400, 'סיסמת הגיבוי שגויה (בדיקה)');
      return json({ mode: 'merge', tables: {}, files: 0 });
    }
    if (p === 'media/streams') return json({ go2rtc: { version: '1.9.9' }, streams: [{ name: 'smplwise_cam1_sub', online: false, state: 'idle', consumers: 0 }], foreign_streams: 3 });
    if (p === 'media/sessions') return json({ sessions: [], max_live_sessions: 16 });
    if (p === 'ha/status') {
      return json({
        configured: true,
        sync: { connected: true, last_event_at: CHECKED, last_error: null, reconnects: 0, sequence: 1, entities: 12, started_at: CHECKED, ha_version: '2026.11.0', last_registry_at: CHECKED, last_snapshot_at: CHECKED },
        bridge: { paired: true, paired_at: CHECKED, directory_users: 2, last_directory_at: CHECKED },
      });
    }
    if (p.startsWith('ha/bridge/pairing')) return json({ pairing_code: 'MOCKCODE1234', addon_host: 'local-arx', addon_url: 'http://local-arx:8099', paired_at: CHECKED, announce_path: true });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p.startsWith('notifications')) return json({ unread: 0, items: [] });
    return fail(route, 404, 'לא נמצא (בדיקה)');
  });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full#${hash}`);
  await page.waitForSelector(D, { timeout: 30_000 });
}

test.describe('settings screen defects (CR-DIAG-DEFECTS-2436)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour, not layout: desktop only');
  });

  test('DIAG-1: a refused backup create shows its error on the backup tab', async ({ page }) => {
    const m = newMock();
    m.backupCreateFails = true;
    await install(page, m);
    await open(page, '/system/diagnostics?tab=backup');
    const sd = page.locator(D);
    await expect(sd.locator('[data-backup-row]').first()).toBeVisible({ timeout: 20_000 });
    await sd.locator('[data-backup-create]').click();
    const alert = sd.locator('[data-backup-error][role=alert]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('יצירת הגיבוי נכשלה (בדיקה)');
  });

  test('DIAG-1: a refused restore shows its error inside the restore dialog', async ({ page }) => {
    const m = newMock();
    m.restoreFails = true;
    await install(page, m);
    await open(page, '/system/diagnostics?tab=backup');
    const sd = page.locator(D);
    await sd.locator('[data-backup-restore]').first().click();
    const dialog = sd.locator('sw-dialog');
    await dialog.locator('[data-restore-confirm]').fill('RESTORE');
    await dialog.locator('[data-restore-go]').click();
    const alert = dialog.locator('[data-restore-error][role=alert]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('סיסמת הגיבוי שגויה (בדיקה)');
  });

  test('DIAG-2: a deep link to ?tab=media lists the streams without switching tabs', async ({ page }) => {
    const m = newMock();
    await install(page, m);
    await open(page, '/system/diagnostics?tab=media');
    const sd = page.locator(D);
    await expect(sd.locator('.stream', { hasText: 'smplwise_cam1_sub' })).toBeVisible({ timeout: 20_000 });
    expect(m.calls).toContain('GET media/streams');
  });

  test('DIAG-2: a deep link to ?tab=ha shows the pairing rows without switching tabs', async ({ page }) => {
    const m = newMock();
    await install(page, m);
    await open(page, '/system/diagnostics?tab=ha');
    const sd = page.locator(D);
    await expect(sd.locator('code.ltr', { hasText: 'http://local-arx:8099' })).toBeVisible({ timeout: 20_000 });
    expect(m.calls.some((c) => c.startsWith('GET ha/bridge/pairing'))).toBe(true);
  });

  test('DIAG-3: with a backend the General tab shows the real health status, and its button opens the health tab', async ({ page }) => {
    const m = newMock();
    await install(page, m);
    await open(page, '/system/diagnostics');
    const sd = page.locator(D);
    const row = sd.locator('[data-general-health]');
    await expect(row).toHaveAttribute('data-general-health', 'ok', { timeout: 20_000 });
    await expect(row).toContainText('הכל תקין');
    await expect(row).toContainText('כל הרכיבים תקינים');
    await expect(sd).not.toContainText('גשר HA טרם חובר');
    await row.locator('[data-general-health-open]').click();
    await expect(sd.locator('.hsum')).toBeVisible();
    await expect(page).toHaveURL(/tab=health/);
  });

  test('DIAG-3: a component that needs attention is named in the General tab row', async ({ page }) => {
    const m = newMock();
    m.summary = { status: 'warn', items: [{ id: 'db', status: 'ok', label: 'מסד נתונים' }, { id: 'ha_bridge', status: 'warn', label: 'גשר Arx' }] };
    await install(page, m);
    await open(page, '/system/diagnostics');
    const row = page.locator(`${D} [data-general-health]`);
    await expect(row).toHaveAttribute('data-general-health', 'warn', { timeout: 20_000 });
    await expect(row).toContainText('יש מה לבדוק');
    await expect(row).toContainText('גשר Arx');
    await expect(row).not.toContainText('מסד נתונים');
  });

  test('DIAG-3: the demo (no backend) keeps its sample health row', async ({ page }) => {
    await open(page, '/system/diagnostics');
    const sd = page.locator(D);
    await expect(sd).toContainText('גשר HA טרם חובר · שאר הרכיבים תקינים');
    await expect(sd.locator('[data-general-health]')).toHaveCount(0);
  });

  test('DIAG-4: a failed health report does not show on another tab', async ({ page }) => {
    const m = newMock();
    m.reportFails = true;
    await install(page, m);
    await open(page, '/system/diagnostics?tab=health');
    const sd = page.locator(D);
    await expect(sd.locator('sw-state-panel[state=error]')).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => (location.hash = '#/system/diagnostics?tab=devices'));
    await expect(sd.locator('[data-save-devices]')).toBeVisible({ timeout: 20_000 });
    await expect(sd.locator('.foot .msg.err')).toHaveCount(0);
    await expect(sd).not.toContainText('דוח הבריאות נכשל (בדיקה)');
  });

  test('MSG-1: a second saved message lives its full time (the first one\'s timer does not cut it short)', async ({ page }) => {
    const m = newMock();
    await install(page, m);
    await page.clock.install({ time: new Date('2026-10-10T10:00:00Z') });
    await open(page, '/system/diagnostics');
    const sd = page.locator(D);
    const card = sd.locator('sw-card[heading="עיצוב הממשק"]');
    const select = card.locator('select[data-set-tile-layout]');
    await expect(select).toBeEnabled({ timeout: 20_000 });
    await page.clock.pauseAt(new Date('2026-10-10T10:10:00Z'));
    const msg = card.locator('.msg.ok');

    const saveAs = async (value: string, n: number) => {
      await select.selectOption(value);
      await card.locator('[data-save-row]').click();
      await expect.poll(() => m.patches).toBe(n);
      await expect(msg).toBeVisible();
    };
    await saveAs('compact', 1);
    await page.clock.runFor(1000);
    await saveAs('cards', 2);
    await page.clock.runFor(1800); // 2.8 s after the first save: its 2.5 s timer has fired
    await expect(msg).toBeVisible();
    await page.clock.runFor(800); // 2.6 s after the second save
    await expect(msg).toHaveCount(0);
  });
});
