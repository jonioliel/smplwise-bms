import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the read-only half of T075 against the running developer backend and the lab NVR: the camera page
// reads the NVR's own detection configuration (motion grid, privacy mask, intrusion regions, crossing lines) through
// ISAPI GETs only and draws it over the snapshot with the explicit read-only / not-a-mask statement. SW_LIVE=1 only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T075-zones-live');

test.describe('detection zones from the NVR (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('camera page shows the NVR zones read-only', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const cams = (await (await request.get('/api/v1/cameras')).json()).cameras.filter((c: { status: string }) => c.status === 'online');
    test.skip(cams.length < 1, 'need an online camera');
    const cam = cams[0];
    const z = await (await request.get(`/api/v1/cameras/${cam.id}/zones?refresh=true`)).json();
    testInfo.annotations.push({ type: 'zones', description: JSON.stringify({ read_only: z.read_only, motion: z.motion && { enabled: z.motion.enabled, rows: z.motion.rows, cols: z.motion.cols, coverage: z.motion.coverage_pct, sensitivity: z.motion.sensitivity, targets: z.motion.target_types }, privacy: z.privacy_mask && { enabled: z.privacy_mask.enabled, regions: z.privacy_mask.regions.length }, intrusion: z.intrusion && { enabled: z.intrusion.enabled, regions: z.intrusion.regions.length }, lines: z.line_crossing && { enabled: z.line_crossing.enabled, lines: z.line_crossing.lines.length }, unsupported: z.unsupported }) });
    expect(z.read_only).toBe(true);
    expect(z.source).toBe('nvr');
    expect(z.motion && z.motion.rows > 0 && z.motion.cols > 0).toBeTruthy();
    // the second read within a minute is served from the cache: one device read per camera per minute at most
    expect((await (await request.get(`/api/v1/cameras/${cam.id}/zones`)).json()).cached).toBe(true);
    await page.goto(`/#/live/cameras/${cam.id}`);
    await page.waitForSelector('sw-app');
    const card = page.locator('live-camera [data-zones]');
    await expect(card.locator('[data-zones-loaded]')).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('[data-zones-note]')).toContainText('קריאה בלבד');
    await expect(card.locator('[data-zone-layer="motion"]')).toContainText('תנועה');
    // the snapshot behind the overlay comes from the NVR; wait until it has really loaded before the picture is taken
    await expect.poll(async () => card.locator('[data-zones-loaded] img').evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(500);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `zones-${testInfo.project.name}.png`), fullPage: true });
    // no write path exists for zones
    expect((await request.put(`/api/v1/cameras/${cam.id}/zones`, { data: {} })).status()).toBe(405);
  });
});
