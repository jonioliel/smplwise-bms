import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the screens rebuilt after the live review of 2026-09-17 (0.1.50 / 0.1.51) against the running
// developer backend: the overview's numbers come from the API, saved views round-trip through the API and open
// on the wall, the synchronized-playback launcher opens a comparison, the connections page shows the add-on's
// facts, the audit screen lists real rows, and the Review tab is the event centre in windows mode.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'review-fixes-live');

test.describe('live review fixes (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('overview KPIs match the API', async ({ page, request }, testInfo) => {
    test.setTimeout(120000);
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { enabled: boolean; status: string }[]).filter((c) => c.enabled);
    const sites = (await (await request.get('/api/v1/sites?tree=true')).json()).sites as unknown[];
    const summary = (await (await request.get('/api/v1/events/summary')).json()) as { today: { total: number } };
    await page.goto('/?design=a#/live');
    const ov = page.locator('live-overview');
    await expect(ov.locator('[data-overview-kpis] sw-kpi')).toHaveCount(4, { timeout: 30000 });
    await expect.poll(async () => ov.locator('[data-overview-kpis] sw-kpi').nth(0).evaluate((k) => (k as unknown as { value: string }).value), { timeout: 20000 }).toBe(`${cams.filter((c) => c.status === 'online').length}/${cams.length}`);
    expect(await ov.locator('[data-overview-kpis] sw-kpi').nth(1).evaluate((k) => (k as unknown as { value: string }).value)).toBe(String(sites.length));
    expect(await ov.locator('[data-overview-kpis] sw-kpi').nth(2).evaluate((k) => (k as unknown as { value: string }).value)).toBe(String(summary.today.total));
    await expect(ov.locator('[data-overview-event]').first()).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: path.join(OUT, `overview-${testInfo.project.name}.png`), fullPage: true });
  });

  test('saved views: create, open on the wall, edit, delete', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean }[]).filter((c) => c.enabled);
    expect(cams.length).toBeGreaterThan(1);
    await page.goto('/?design=a#/live/views');
    const lv = page.locator('live-views');
    await expect(lv.locator('[data-view-new]')).toBeVisible({ timeout: 30000 });
    const before = await lv.locator('[data-view]').count();
    await lv.locator('[data-view-new]').click();
    await lv.locator('[data-view-name]').fill('ראיה F3');
    await lv.locator('[data-view-camera]').nth(0).click();
    await lv.locator('[data-view-camera]').nth(1).click();
    await lv.locator('[data-view-save]').click();
    await expect(lv.locator('[data-view]')).toHaveCount(before + 1, { timeout: 20000 });
    const created = ((await (await request.get('/api/v1/views')).json()).views as { id: string; name: string; cameras: string[] }[]).find((v) => v.name === 'ראיה F3');
    expect(created?.cameras.length).toBe(2);
    await page.screenshot({ path: path.join(OUT, `views-${testInfo.project.name}.png`) });
    // open on the wall: exactly the view's cameras
    await page.goto(`/?design=a#/live/wall?cameras=${created!.cameras.join(',')}`);
    await expect(page.locator('live-wall sw-camera-tile')).toHaveCount(2, { timeout: 30000 });
    // edit and delete through the API-backed screen
    await page.goto('/?design=a#/live/views');
    const card = lv.locator(`[data-view="${created!.id}"]`);
    await card.locator('[data-view-edit]').click();
    await lv.locator('[data-view-name]').fill('ראיה F3 ערוכה');
    await lv.locator('[data-view-save]').click();
    await expect(card.locator('.head b')).toHaveText('ראיה F3 ערוכה', { timeout: 20000 });
    await card.locator('[data-view-delete]').click();
    await lv.locator('[data-view-delete-confirm]').click();
    await expect(lv.locator(`[data-view="${created!.id}"]`)).toHaveCount(0, { timeout: 20000 });
    expect((await request.get('/api/v1/audit?prefix=views.&limit=5')).status()).toBe(200);
  });

  test('synchronized playback launcher opens a comparison', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/?design=a#/investigate/playback/sync');
    const sy = page.locator('investigate-sync');
    await expect(sy.locator('[data-sync-camera]').first()).toBeVisible({ timeout: 30000 });
    await sy.locator('[data-sync-camera]').nth(0).click();
    await sy.locator('[data-sync-camera]').nth(1).click();
    await expect(sy.locator('[data-sync-pick]')).toHaveCount(2);
    await sy.locator('[data-sync-launch]').click();
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 15000 }).toMatch(/^#\/investigate\/playback\?camera=[^&]+&extra=[^&]+&t=/);
    await expect(page.locator('investigate-playback')).toBeVisible({ timeout: 20000 });
  });

  test('connections, audit and Review windows are real', async ({ page, request }, testInfo) => {
    test.setTimeout(120000);
    const health = (await (await request.get('/api/v1/health')).json()) as { home_assistant: { entities: number } };
    await page.goto('/?design=a#/system/setup');
    const cn = page.locator('system-setup');
    await expect(cn.locator('[data-connections]')).toBeVisible({ timeout: 30000 });
    await expect(cn.locator('[data-connections]')).toContainText(String(health.home_assistant.entities));
    await expect(cn.locator('[data-connection-options]')).toContainText('nvr_host');
    await page.screenshot({ path: path.join(OUT, `connections-${testInfo.project.name}.png`), fullPage: true });
    await page.goto('/?design=a#/system/audit');
    const au = page.locator('system-audit');
    await expect(au.locator('[data-audit-table]')).toBeVisible({ timeout: 30000 });
    const rows = (await (await request.get('/api/v1/audit?prefix=&limit=100')).json()).rows as unknown[];
    expect(rows.length).toBeGreaterThan(0);
    await page.goto('/?design=a#/investigate/reviews');
    const ev = page.locator('investigate-events');
    await expect(ev.locator('[data-mode-windows]')).toHaveAttribute('selected', '', { timeout: 30000 });
  });
});
