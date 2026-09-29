import { test, expect, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the import half of T050 against a running backend (a throwaway fixture instance is enough: no NVR is
// needed): a bundle built by the backend is picked on the cases screen, verified (per-file table, producer, verdict),
// a tampered copy is refused with the import button disabled, the genuine one is imported as a new case with the
// provenance banner, and picking it again points at the existing case. SW_LIVE=1 only (it needs a backend).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T050-import');

async function bundleOf(request: APIRequestContext, title: string) {
  const c = await (await request.post('/api/v1/cases', { data: { title, description: 'תיק מקור לייבוא', tags: ['ייבוא'] } })).json();
  for (const note of ['נראה אדם ליד השער', 'הרכב יצא דרומה']) expect((await request.post(`/api/v1/cases/${c.id}/items`, { data: { kind: 'note', note } })).status()).toBe(201);
  const desc = await (await request.post(`/api/v1/cases/${c.id}/bundle`)).json();
  const zip = await (await request.get('/' + desc.download_url)).body();
  return { source: c as { id: string }, desc: desc as { name: string; files: number }, zip };
}

test.describe('evidence bundle import (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with a backend running (SW_API_PORT / SW_BASE_URL for a throwaway one)');

  test('verify on the cases screen, tampered refused, import as a case with provenance, duplicate pointed at', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const title = `ייבוא T050 ${testInfo.project.name} ${new Date().toISOString().slice(11, 19)}`;
    const { source, desc, zip } = await bundleOf(request, title);
    const tampered = Buffer.from(zip);
    tampered[Math.floor(tampered.length / 2)] ^= 0xff;

    await page.goto('/?design=a#/investigate/cases');
    await page.waitForSelector('sw-app');
    const screen = page.locator('investigate-cases');
    await expect(screen.locator('[data-bundle-import]')).toBeVisible({ timeout: 20_000 });

    // a tampered copy: the verdict fails and the import button stays disabled
    await screen.locator('[data-bundle-import-file]').setInputFiles({ name: 'tampered.zip', mimeType: 'application/zip', buffer: tampered });
    const dialog = screen.locator('[data-bundle-import-dialog]');
    await expect(dialog.locator('[data-import-summary]')).toHaveAttribute('data-ok', 'false', { timeout: 30_000 });
    await expect(dialog.locator('[data-import-summary]')).toContainText('האימות נכשל');
    await expect(dialog.locator('[data-bundle-import-confirm] button')).toBeDisabled();
    await page.screenshot({ path: path.join(OUT, `import-tampered-${testInfo.project.name}.png`) });
    await dialog.locator('sw-button', { hasText: 'סגור' }).click();
    await expect(dialog).toHaveCount(0);

    // the genuine bundle: every file ok, produced by this installation (confirmed by its signature)
    await screen.locator('[data-bundle-import-file]').setInputFiles({ name: desc.name, mimeType: 'application/zip', buffer: zip });
    await expect(dialog.locator('[data-import-summary]')).toHaveAttribute('data-ok', 'true', { timeout: 30_000 });
    await expect(dialog.locator('[data-import-summary]')).toContainText('אינה מוכיחה שהצילום אמיתי');
    await expect(dialog.locator('[data-import-file][data-status="ok"]')).toHaveCount(desc.files);
    await expect(dialog.locator('[data-import-producer]')).toHaveAttribute('data-producer', 'this_confirmed');
    await expect(dialog.locator('[data-import-signature]')).toContainText('חתימה תקינה');
    await page.screenshot({ path: path.join(OUT, `import-verified-${testInfo.project.name}.png`) });
    await dialog.locator('[data-bundle-import-confirm]').click();

    // the new case: imported, read-only notes, the provenance banner with the hash verdict
    const detail = page.locator('investigate-case-detail');
    await expect(detail.locator('[data-provenance-headline]')).toContainText('hash תואם', { timeout: 30_000 });
    await expect(detail.locator('[data-provenance-headline]')).toContainText('יובא מהתקנה זו (מאושר בחתימה)');
    await expect(detail.locator('[data-case-provenance]')).toHaveAttribute('data-producer', 'this_confirmed');
    await expect(detail.locator('[data-case-item][data-imported]')).toHaveCount(2);
    await expect(detail.locator('[data-case-item][data-imported] [data-item-remove]')).toHaveCount(0);
    await detail.locator('[data-case-integrity]').click();
    await expect(detail.locator('[data-case-integrity-result]')).toHaveAttribute('data-ok', 'true', { timeout: 30_000 });
    await page.screenshot({ path: path.join(OUT, `import-case-${testInfo.project.name}.png`), fullPage: true });
    const importedId = new URL(page.url()).hash.split('/').pop() ?? '';
    expect(importedId).not.toBe(source.id);

    // the list marks it; picking the same bundle again points at the existing case and cannot import twice
    await page.goto('/?design=a#/investigate/cases');
    await expect(screen.locator('[data-case-imported]').first()).toBeVisible({ timeout: 20_000 });
    await screen.locator('[data-bundle-import-file]').setInputFiles({ name: desc.name, mimeType: 'application/zip', buffer: zip });
    await expect(dialog.locator('[data-import-duplicate]')).toBeVisible({ timeout: 30_000 });
    await expect(dialog.locator('[data-bundle-import-confirm] button')).toBeDisabled();
    await page.screenshot({ path: path.join(OUT, `import-duplicate-${testInfo.project.name}.png`) });

    for (const id of [importedId, source.id]) expect((await request.delete(`/api/v1/cases/${id}`)).status()).toBe(204);
  });
});
