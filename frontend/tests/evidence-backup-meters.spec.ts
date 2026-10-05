import { test, expect, type Page, type Route } from '@playwright/test';
import { installMulti } from './multi-nvr-mock';

// CR-023: the electricity setting "include the meter readings in the backup" (`energy.include_history_in_backup`, default off) lives
// on the server since the electricity release but had no switch. It now sits in Settings › backup and restore, in the project
// backups card. MOCKED backend (the multi-NVR mock with one recorder answers /me and the shell; this file answers /backups and
// /energy/settings the way routers/backups.py and routers/energy_meters.py do). The server's own rules: tests/test_energy_api.py.
//   ~/run_remote.sh spec <branch> tests/evidence-backup-meters.spec.ts

interface MeterState {
  on: boolean;
  editable: boolean;
  /** GET /energy/settings answers 403 (a caller without energy.view): the switch is not shown */
  forbidden: boolean;
  patches: unknown[];
}

async function installMeters(page: Page, init: Partial<MeterState> = {}): Promise<MeterState> {
  const st: MeterState = { on: false, editable: true, forbidden: false, patches: [], ...init };
  await installMulti(page, { count: 1 });
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const settings = () => ({
    values: { 'energy.raw_retention_days': 90, 'energy.interval_retention_months': 26, 'energy.bill_retention_years': 7, 'energy.draft_retention_days': 30, 'energy.stale_after_minutes': 60, 'energy.include_history_in_backup': st.on },
    editable: { 'energy.raw_retention_days': true, 'energy.interval_retention_months': true, 'energy.bill_retention_years': true, 'energy.draft_retention_days': true, 'energy.stale_after_minutes': true, 'energy.include_history_in_backup': st.editable },
    ranges: {},
    storage: { energy_db_bytes: 48 * 1024 * 1024, classes: {}, estimate: { meters: 3 } },
  });
  await page.route('**/api/v1/energy/settings', async (route) => {
    if (st.forbidden) return json(route, { code: 'forbidden', user_message: 'אין הרשאה.', retryable: false, correlation_id: 't', details: {} }, 403);
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      st.patches.push(body);
      if (typeof body['energy.include_history_in_backup'] === 'boolean') st.on = body['energy.include_history_in_backup'] as boolean;
    }
    return json(route, settings());
  });
  await page.route('**/api/v1/backups', (route) => json(route, { backups: [], policy: { 'auto-pre-upgrade': 5, 'auto-daily': 7 }, bytes: 0, schema_version: 60 }));
  return st;
}

async function openBackupTab(page: Page) {
  await page.goto('about:blank');
  await page.goto('/?design=a#/system/diagnostics?tab=backup');
  await page.waitForSelector('sw-app');
}

test.describe('meter readings in the backup (mocked backend)', () => {
  const errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors.length = 0;
    page.on('pageerror', (e) => errors.push(e.message));
  });
  test.afterEach(() => {
    expect(errors, 'page errors').toEqual([]);
  });

  test('the switch shows the server value, saves at once and says what goes into the backup', async ({ page }) => {
    const st = await installMeters(page);
    await openBackupTab(page);
    const row = page.locator('system-diagnostics [data-backup-meters]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('נתוני מוני החשמל');
    await expect(row).toContainText('מונים, חיובים וסיכומים יומיים נכנסים תמיד');
    const toggle = row.locator('sw-toggle[data-backup-meters-toggle]');
    await expect(toggle).not.toHaveAttribute('checked', '');
    await toggle.click();
    await expect.poll(() => st.patches).toEqual([{ 'energy.include_history_in_backup': true }]);
    await expect(toggle).toHaveAttribute('checked', '');
    await expect(row).toContainText('כל הקריאות נכנסות לגיבוי (כרגע 48.0 MB)');
    // it is read back from the server on the next visit
    await openBackupTab(page);
    await expect(page.locator('system-diagnostics [data-backup-meters] sw-toggle[data-backup-meters-toggle]')).toHaveAttribute('checked', '');
    await expect(page.locator('system-diagnostics [data-backup-meters]')).not.toContainText(/Home Assistant|energy\./);
  });

  test('without the permission to change it the switch is read-only; without energy.view it is not shown', async ({ page }) => {
    const st = await installMeters(page, { editable: false, on: true });
    await openBackupTab(page);
    const toggle = page.locator('system-diagnostics [data-backup-meters] sw-toggle[data-backup-meters-toggle]');
    await expect(toggle).toHaveAttribute('disabled', '');
    await expect(toggle).toHaveAttribute('checked', '');
    st.forbidden = true;
    await openBackupTab(page);
    await expect(page.locator('system-diagnostics [data-backup-create]')).toBeVisible();
    await expect(page.locator('system-diagnostics [data-backup-meters]')).toHaveCount(0);
  });
});
