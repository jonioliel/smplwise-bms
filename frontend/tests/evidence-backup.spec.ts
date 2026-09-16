import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for project backups (T026 / T036) against the running developer backend: a backup is created from
// the settings screen, listed with its counts, downloadable as a zip, and restored in merge mode after typing
// RESTORE. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T026-backup-live');

test.describe('project backups (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('create, list, download, restore (merge)', async ({ page, request }, testInfo) => {
    await open(page, '/system/diagnostics');
    const screen = page.locator('system-diagnostics');
    await screen.getByText('גיבוי ושחזור').first().click();
    await expect(screen.locator('[data-backup-create]')).toBeVisible();
    const before = await request.get('/api/v1/backups');
    expect(before.status()).toBe(200);
    const nBefore = (await before.json()).backups.length;

    await screen.locator('input.note-in').fill('ראיות T026');
    await screen.locator('[data-backup-create]').click();
    await expect(screen.locator('[data-backup-msg]')).toContainText('נוצר', { timeout: 30000 });
    await expect.poll(async () => (await (await request.get('/api/v1/backups')).json()).backups.length, { timeout: 10000 }).toBe(nBefore + 1);
    const rows = screen.locator('[data-backup-row]');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toContainText('ראיות T026');
    await expect(rows.first()).toContainText('קומות');
    await page.screenshot({ path: path.join(OUT, `backups-${testInfo.project.name}.png`), fullPage: true });

    // download is a real zip
    const href = await rows.first().locator('[data-backup-download]').getAttribute('href');
    expect(href).toBeTruthy();
    const dl = await request.get(href!);
    expect(dl.status()).toBe(200);
    expect(dl.headers()['content-type']).toContain('application/zip');
    expect((await dl.body()).length).toBeGreaterThan(1000);

    // restore in merge mode needs the typed confirmation
    await rows.first().locator('[data-backup-restore]').click();
    const dialog = screen.locator('sw-dialog');
    await expect(dialog.locator('[data-restore-mode]')).toBeVisible(); // the host itself has no box; its content does
    await dialog.locator('[data-restore-mode]').selectOption('merge');
    await expect(dialog.locator('[data-restore-go]')).toHaveAttribute('disabled', ''); // custom element: the attribute is the contract
    await dialog.locator('[data-restore-confirm]').fill('RESTORE');
    await expect(dialog.locator('[data-restore-go]')).not.toHaveAttribute('disabled', '');
    await page.screenshot({ path: path.join(OUT, `restore-dialog-${testInfo.project.name}.png`) });
    await dialog.locator('[data-restore-go]').click();
    await expect(screen.locator('[data-backup-msg]')).toContainText('שוחזר', { timeout: 30000 });
    // the map data is intact after the merge (same floors, still a published plan)
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    expect(floors.some((f: { has_plan: boolean }) => f.has_plan)).toBeTruthy();
  });
});
