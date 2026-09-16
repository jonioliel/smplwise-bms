import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the health & diagnostics tab (T033) against the running developer backend: one card per
// subsystem with a real status (NVR probe, go2rtc, HA sync, bridge, storage, database, events, background
// jobs, backups), "בדוק עכשיו" re-probes. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T033-health-live');

test.describe('health & diagnostics (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('subsystem cards with real statuses', async ({ page, request }, testInfo) => {
    const api = await request.get('/api/v1/health/report');
    expect(api.status()).toBe(200);
    const report = await api.json();
    const ids = report.checks.map((c: { id: string }) => c.id);
    for (const id of ['db', 'storage', 'nvr', 'go2rtc', 'ha_sync', 'bridge', 'events_ingest', 'events_derive', 'discovery', 'thumbnails', 'exports', 'sessions', 'backups']) expect(ids).toContain(id);
    const nvr = report.checks.find((c: { id: string }) => c.id === 'nvr');
    expect(['ok', 'warn', 'error']).toContain(nvr.status);

    await open(page, '/system/diagnostics');
    const screen = page.locator('system-diagnostics');
    await screen.getByText('בריאות ועבודות').first().click();
    await expect(screen.locator('[data-health-card]').first()).toBeVisible({ timeout: 20000 });
    expect(await screen.locator('[data-health-card]').count()).toBeGreaterThanOrEqual(10);
    await expect(screen.locator('[data-health-card="nvr"]')).toContainText(nvr.status === 'ok' ? 'מחובר' : nvr.status === 'warn' ? 'לא מוגדר' : 'שגיאה');
    await expect(screen.locator('[data-health-card="storage"]')).toContainText('פנוי');
    await page.screenshot({ path: path.join(OUT, `health-${testInfo.project.name}.png`), fullPage: true });

    // re-probe updates the timestamp
    const before = await screen.locator('[data-health-checked]').textContent();
    await page.waitForTimeout(1100);
    await screen.getByRole('button', { name: 'בדוק עכשיו' }).click();
    await expect.poll(async () => screen.locator('[data-health-checked]').textContent(), { timeout: 20000 }).not.toBe(before);
  });
});
