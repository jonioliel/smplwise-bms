import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for snapshots and the evidence bundle (T046 / T050) against the running developer backend and the lab NVR:
// a live snapshot is copied into a case with its hash, the bundle ZIP carries the snapshot, the notes, a manifest with
// SHA-256 per file and a readable report, and the verification endpoint confirms the genuine bundle and flags a
// tampered one — through the case page. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T050-bundle-live');

test.describe('evidence bundle (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('snapshot into a case, bundle download, verification of genuine and tampered bundles', async ({ page, request }, testInfo) => {
    test.setTimeout(240000);
    const cams = (await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; name: string; status: string }[];
    const cam = cams.find((c) => c.status === 'online') ?? cams[0];
    const title = `חבילת ראיות T050 ${new Date().toISOString().slice(11, 19)}`;
    const c = await (await request.post('/api/v1/cases', { data: { title, description: 'ראיות אוטומטיות', tags: ['בדיקה'] } })).json();
    expect((await request.post(`/api/v1/cases/${c.id}/items`, { data: { kind: 'note', note: 'הערה לחבילה' } })).status()).toBe(201);

    // the case page: take a snapshot of a camera into the case
    await page.goto(`/?design=a#/investigate/cases/${c.id}`);
    await page.waitForSelector('sw-app');
    const detail = page.locator('investigate-case-detail');
    await expect(detail.locator('[data-snapshot-camera]')).toBeVisible({ timeout: 20000 });
    await detail.locator('[data-snapshot-camera]').selectOption(cam.id);
    await detail.locator('[data-snapshot-add]').click();
    const snapItem = detail.locator('[data-case-item][data-kind="snapshot"]');
    await expect(snapItem).toBeVisible({ timeout: 30000 });
    await expect(snapItem).toHaveAttribute('data-preservation', 'preserved');
    await expect.poll(async () => snapItem.locator('img').evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 20000 }).toBeGreaterThan(0);

    // build the bundle from the page, then verify the downloaded file through the API and the page
    await detail.locator('[data-bundle-create]').click();
    const row = detail.locator('[data-bundle-row]').first();
    await expect(row).toBeVisible({ timeout: 30000 });
    const bundles = (await (await request.get(`/api/v1/cases/${c.id}/bundles`)).json()).bundles as { name: string; download_url: string }[];
    expect(bundles.length).toBe(1);
    const zip = await request.get(`/${bundles[0].download_url}`);
    expect(zip.status()).toBe(200);
    const body = await zip.body();
    expect(body.length).toBeGreaterThan(1000);
    const ok = await (await request.post('/api/v1/cases/bundles/verify', { multipart: { file: { name: bundles[0].name, mimeType: 'application/zip', buffer: body } } })).json();
    expect(ok.ok).toBe(true);
    expect(ok.files.every((f: { status: string }) => f.status === 'ok')).toBe(true);
    testInfo.annotations.push({ type: 'bundle', description: `${bundles[0].name}: ${ok.files.length} files verified` });
    // tamper one byte in the middle of the archive: the verification must not say ok
    const tampered = Buffer.from(body);
    tampered[Math.floor(tampered.length / 2)] ^= 0xff;
    const bad = await (await request.post('/api/v1/cases/bundles/verify', { multipart: { file: { name: 'tampered.zip', mimeType: 'application/zip', buffer: tampered } } })).json();
    expect(bad.ok).toBe(false);
    // verification from the page
    await detail.locator('[data-bundle-verify-file]').setInputFiles({ name: bundles[0].name, mimeType: 'application/zip', buffer: body });
    await expect(detail.locator('[data-bundle-verify-result]')).toContainText('אומתה', { timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, `bundle-${testInfo.project.name}.png`), fullPage: true });
    await detail.locator('[data-bundle-verify-file]').setInputFiles({ name: 'tampered.zip', mimeType: 'application/zip', buffer: tampered });
    await expect(detail.locator('[data-bundle-verify-result]')).toContainText('נכשל', { timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, `bundle-tampered-${testInfo.project.name}.png`), fullPage: true });
    expect((await request.delete(`/api/v1/cases/${c.id}`)).status()).toBe(204);
  });
});
