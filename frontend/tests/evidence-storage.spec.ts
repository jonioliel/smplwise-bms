import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the read-only NVR storage and recording plan (T051) against the running developer backend and the
// lab NVR: disks and free space, the recording schedule of every camera, retention measured (oldest recording the
// NVR still has) next to retention estimated (capacity over bitrates), each with its reason. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T051-storage-live');

test.describe('NVR storage (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('report from the lab NVR and the storage screen', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const r = await request.get('/api/v1/storage?fresh=true', { timeout: 120000 });
    expect(r.status()).toBe(200);
    const d = await r.json();
    expect(d.nvr).toEqual({ configured: true, reachable: true, error: null });
    expect(d.disks.length).toBeGreaterThan(0);
    expect(d.totals.capacity_mb).toBeGreaterThan(0);
    expect(d.totals.used_mb + d.totals.free_mb).toBe(d.totals.capacity_mb);
    expect(d.cameras.length).toBeGreaterThan(0);
    expect(d.cameras.some((c: { has_schedule: boolean }) => c.has_schedule)).toBe(true);
    expect(d.retention.measured_days_max).toBeGreaterThan(0);
    expect(d.retention.estimated_days).toBeGreaterThan(0);
    expect(d.retention.measured_reason).toContain('נמדד');
    expect(d.retention.estimated_reason).toContain('אומדן');
    expect(d.limits.writes).toBe(false);
    testInfo.annotations.push({ type: 'storage', description: `disks ${d.disks.length}, used ${d.totals.used_pct}%, measured ${d.retention.measured_days_min}–${d.retention.measured_days_max} d, estimated ${d.retention.estimated_days} d, cameras ${d.cameras.length}` });
    const cached = await (await request.get('/api/v1/storage')).json();
    expect(cached.cached).toBe(true);

    await page.goto('/?design=a#/system/storage');
    await page.waitForSelector('sw-app');
    const screen = page.locator('system-storage');
    await expect(screen.locator('[data-storage-disks]')).toBeVisible({ timeout: 30000 });
    await expect(screen.locator('[data-storage-disk]')).toHaveCount(d.disks.length + d.nas.length);
    await expect(screen.locator('[data-storage-camera]')).toHaveCount(d.cameras.length);
    await expect(screen.locator('[data-storage-retention]')).toContainText('נמדד');
    await expect(screen.locator('[data-storage-retention]')).toContainText('אומדן');
    await expect(screen.locator('[data-storage-limits]')).toContainText('format');
    await page.screenshot({ path: path.join(OUT, `storage-${testInfo.project.name}.png`), fullPage: true });
  });
});
