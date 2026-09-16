import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T067 against the running developer backend: the storage screen shows the installation's signing
// key, a freshly built bundle verifies through the UI as signed by the active key, a tampered copy is refused,
// and the trust statement separates integrity-at-export from capture authenticity. SW_LIVE=1 only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T067-signing-live');

test.describe('evidence signing (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('signing key on the storage screen, signed bundle verifies, tampered bundle fails', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const info = await (await request.get('/api/v1/evidence/signing')).json();
    expect(info.alg).toBe('Ed25519');
    expect(info.active).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(info)).not.toContain('PRIVATE');
    // a case with a note, bundled and downloaded through the API
    const c = await (await request.post('/api/v1/cases', { data: { title: `חתימה ${new Date().toISOString().slice(11, 19)}`, description: '', tags: [] } })).json();
    await request.post(`/api/v1/cases/${c.id}/items`, { data: { kind: 'note', note: 'ראיה חתומה' } });
    const desc = await (await request.post(`/api/v1/cases/${c.id}/bundle`)).json();
    expect(desc.signature.kid).toBe(info.active);
    const zip = await (await request.get('/' + desc.download_url)).body();
    testInfo.annotations.push({ type: 'bundle', description: JSON.stringify({ name: desc.name, bytes: desc.bytes, files: desc.files, kid: desc.signature.kid }) });

    await page.goto('/#/system/storage');
    await page.waitForSelector('sw-app');
    const card = page.locator('system-storage [data-signing]');
    await expect(card.locator('[data-signing-active]')).toHaveText(info.active, { timeout: 30_000 });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `signing-key-${testInfo.project.name}.png`), fullPage: true });

    await page.goto(`/?design=a#/investigate/cases/${c.id}`);
    await page.waitForSelector('sw-app');
    const bundleCard = page.locator('investigate-case-detail [data-bundle]');
    await expect(bundleCard.locator('[data-bundle-row]').first()).toContainText(`מפתח ${info.active}`, { timeout: 30_000 });
    await bundleCard.locator('[data-bundle-verify-file]').setInputFiles({ name: desc.name, mimeType: 'application/zip', buffer: zip });
    await expect(bundleCard.locator('[data-bundle-signature]')).toContainText('חתימה תקינה', { timeout: 30_000 });
    await expect(bundleCard.locator('[data-bundle-signature]')).toHaveAttribute('data-signature-trust', 'installation');
    await bundleCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `verified-${testInfo.project.name}.png`), fullPage: true });
    // one byte flipped inside the archive: the verification refuses the bundle
    const tampered = Buffer.from(zip);
    const idx = tampered.indexOf('# הערות');
    if (idx > 0) tampered[idx] = tampered[idx] ^ 0x01;
    else tampered[Math.floor(tampered.length / 2)] ^= 0x01;
    await bundleCard.locator('[data-bundle-verify-file]').setInputFiles({ name: 'tampered.zip', mimeType: 'application/zip', buffer: tampered });
    await expect(bundleCard.locator('[data-bundle-verify-result]')).toContainText('האימות נכשל', { timeout: 30_000 });
    await page.screenshot({ path: path.join(OUT, `tampered-${testInfo.project.name}.png`), fullPage: true });
    expect((await request.delete(`/api/v1/cases/${c.id}`)).status()).toBeLessThan(500);
  });
});
