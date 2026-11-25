import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appReady, gotoApp } from './helpers/app-ready';
import { DIGEST, ITEM_COUNT, LEGACY_FILE, PRE_IMPORT, installLegacyMock, type LegacyMock } from './legacy-import-mock';

// LEGACY-IMPORT-UI-2550 (T070; owner rule = recommendations Q1 a, Q3 a): Settings › גיבוי ושחזור › "ייבוא מהמערכת הישנה", against a MOCKED
// wire contract of routers/legacy_migration.py (tests/legacy-import-mock.ts):
//   1. a system administrator sees the card and the earlier runs; choosing a file runs the dry run at once with the file as the raw body;
//   2. the report: the source, the counts per action, the warning, every item grouped by area and PAGED (no scrolling list);
//   3. apply: the dialog says a backup (auto-pre-legacy-import) comes first, the button waits for the typed word, the request carries the
//      plan digest and the word; the result names the backup, the backup list is read again and labels the new kind in Hebrew;
//   4. 409 "changed since the dry run" is shown as it is, the apply is blocked until the check runs again; a failed backup says so;
//   5. nothing to write: the apply is not offered; 403 / 404 on the status read: the card is not drawn;
//   6. the English interface: the labels and the server's notes in English; the phone: no sideways overflow.
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/legacy-import-ui-2550.spec.ts --workers=2
// SW_SHOTS=1 also writes screenshots to docs/design/evidence/legacy-import-2550 (nothing otherwise).

const SHOTS_OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/legacy-import-2550');
async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(SHOTS_OUT, { recursive: true });
  await page.locator('sw-legacy-import').screenshot({ path: path.join(SHOTS_OUT, `${name}-${test.info().project.name}.png`) });
}

const CARD = 'sw-legacy-import';
const HASH = '/?design=a#/system/diagnostics?tab=backup';

async function open(page: Page) {
  await gotoApp(page, HASH);
  await expect(page.locator(`${CARD} [data-legacy-pick]`)).toBeVisible({ timeout: 30_000 });
  return page.locator(CARD);
}

async function chooseFile(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.locator(`${CARD} [data-legacy-choose]`).click();
  await (await chooser).setFiles(LEGACY_FILE);
  await expect(page.locator(`${CARD} [data-legacy-summary]`)).toBeVisible();
}

const dryRuns = (m: LegacyMock) => m.calls.filter((c) => c.path === 'migration/legacy/dry-run');
const applies = (m: LegacyMock) => m.calls.filter((c) => c.path === 'migration/legacy/apply');

test.describe('LEGACY-IMPORT-UI-2550: the legacy import card', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
  });

  test('the dry run: the raw file, the source, the counts, the warning and the grouped, paged items', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const m = await installLegacyMock(page, { runs: true });
    const card = await open(page);
    await expect(card.locator('[data-legacy-run]')).toHaveCount(1);
    await shot(page, 'legacy-idle');
    await chooseFile(page);
    expect(dryRuns(m)).toHaveLength(1);
    expect(dryRuns(m)[0].contentType).toBe('application/octet-stream');
    expect(dryRuns(m)[0].bytes).toBe(LEGACY_FILE.buffer.length);
    await expect(card.locator('[data-legacy-source]')).toContainText(LEGACY_FILE.name);
    await expect(card.locator('[data-legacy-source]')).toContainText('גיבוי מלא של מערכת הבית');
    await expect(card.locator('[data-legacy-count="update"]')).toHaveAttribute('label', 'יועתק · 2');
    await expect(card.locator('[data-legacy-count="manual"]')).toHaveAttribute('label', 'לטיפול ידני · 2');
    await expect(card.locator('[data-legacy-count="create"]')).toHaveCount(0); // a zero count is not drawn
    await expect(card.locator('[data-legacy-warning="several_recorders"]')).toBeVisible();
    // grouped and paged: the first page opens with the cameras group, the rows of one page only; the earlier runs step aside
    const table = card.locator('sw-table[data-legacy-items]');
    await expect(table.locator('tr[data-legacy-group="cameras"]')).toContainText('מצלמות · 6');
    const per = test.info().project.name === 'mobile' ? 5 : 8;
    await expect(table.locator('tr[data-legacy-item]')).toHaveCount(per);
    await expect(table.locator('tr[data-legacy-item="cameras.ch1"]')).toContainText('ערוץ 1 · כניסה ראשית');
    await expect(table.locator('tr[data-legacy-item="cameras.ch1"]')).toContainText('הכינוי מהמערכת הישנה יועתק');
    await expect(card.locator('[data-legacy-runs]')).toHaveCount(0);
    const pager = card.locator('sw-pager[data-legacy-pager]');
    expect(await pager.evaluate((el) => (el as HTMLElement & { pages: number }).pages)).toBe(Math.ceil(ITEM_COUNT / per));
    await shot(page, 'legacy-report');
    // the last page: the groups that are left, each opened by its heading
    await pager.evaluate((el, pages) => el.dispatchEvent(new CustomEvent('page-change', { detail: { page: pages }, bubbles: true, composed: true })), Math.ceil(ITEM_COUNT / per));
    await expect(table.locator('tr[data-legacy-item="notifications.all"]')).toBeVisible();
    await expect(table.locator('tr[data-legacy-group="notifications"]')).toBeVisible();
    await expect(card.locator('[data-legacy-writes]')).toContainText('ישתנו 2 כינויי מצלמות ריקים');
    // no scrolling list inside the card: the table is as tall as its rows
    const scrolls = await table.evaluate((el) => {
      const all = [el, ...(el.shadowRoot ? [...el.shadowRoot.querySelectorAll('*')] : [])] as HTMLElement[];
      return all.filter((x) => x.scrollHeight > x.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(x).overflowY)).length;
    });
    expect(scrolls).toBe(0);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('apply: the backup line, the typed word, the digest, the result and the new backup kind in the list', async ({ page }) => {
    const m = await installLegacyMock(page);
    const card = await open(page);
    await chooseFile(page);
    const backupsBefore = m.backupGets;
    await card.locator('[data-legacy-apply-open]').click();
    const dialog = card.locator('sw-dialog[data-legacy-dialog]');
    await expect(dialog.locator('[data-legacy-dialog-backup]')).toContainText('auto-pre-legacy-import');
    await expect(dialog.locator('[data-legacy-dialog-what]')).toContainText('ישתנו ב־Arx 2 כינויי מצלמות');
    const go = dialog.locator('[data-legacy-apply]');
    await expect(go).toHaveAttribute('disabled', '');
    await dialog.locator('[data-legacy-confirm]').fill('ייבוא');
    await expect(go).toHaveAttribute('disabled', '');
    await dialog.locator('[data-legacy-confirm]').fill('ייבוא מהמערכת הישנה');
    await expect(go).not.toHaveAttribute('disabled', '');
    await shot(page, 'legacy-dialog');
    await go.click();
    await expect(card.locator('[data-legacy-result]')).toContainText('הועתקו 2 כינויים');
    const a = applies(m);
    expect(a).toHaveLength(1);
    const q = new URLSearchParams(a[0].search);
    expect(q.get('plan_digest')).toBe(DIGEST);
    expect(q.get('confirm')).toBe('ייבוא מהמערכת הישנה');
    expect(a[0].bytes).toBe(LEGACY_FILE.buffer.length);
    await expect(card.locator('[data-legacy-result-backup]')).toContainText(PRE_IMPORT.name);
    await expect(card.locator('[data-legacy-result-channels]')).toHaveText('1, 2');
    await shot(page, 'legacy-result');
    // the backup list is read again and labels the new kind
    await expect.poll(() => m.backupGets).toBeGreaterThan(backupsBefore);
    const row = page.locator('system-diagnostics [data-backup-row]').filter({ hasText: PRE_IMPORT.name });
    await expect(row.locator('sw-badge').first()).toHaveAttribute('label', 'אוטומטי · לפני ייבוא מהמערכת הישנה');
    // done: back to the file row, the new run listed
    await card.locator('[data-legacy-done]').click();
    await expect(card.locator('[data-legacy-pick]')).toBeVisible();
    await expect(card.locator('[data-legacy-run]')).toHaveCount(1);
  });

  test('409 "changed since the dry run": said as it is, apply blocked until the check runs again', async ({ page }) => {
    const m = await installLegacyMock(page);
    m.apply = 'changed';
    const card = await open(page);
    await chooseFile(page);
    await card.locator('[data-legacy-apply-open]').click();
    await card.locator('[data-legacy-confirm]').fill('ייבוא מהמערכת הישנה');
    await card.locator('[data-legacy-apply]').click();
    await expect(card.locator('sw-dialog[data-legacy-dialog]')).toHaveCount(0);
    await expect(card.locator('[data-legacy-error][role=alert]')).toContainText('התוכנית השתנתה מאז הבדיקה');
    await expect(card.locator('[data-legacy-apply-open]')).toHaveAttribute('disabled', '');
    await shot(page, 'legacy-changed');
    await card.locator('[data-legacy-rerun]').click();
    await expect(card.locator('[data-legacy-error]')).toHaveCount(0);
    expect(dryRuns(m)).toHaveLength(2);
    await expect(card.locator('[data-legacy-apply-open]')).not.toHaveAttribute('disabled', '');
  });

  test('a failed backup before the import: the refusal stays in the dialog, nothing is reported as done', async ({ page }) => {
    const m = await installLegacyMock(page);
    m.apply = 'backup_failed';
    const card = await open(page);
    await chooseFile(page);
    await card.locator('[data-legacy-apply-open]').click();
    await card.locator('[data-legacy-confirm]').fill('ייבוא מהמערכת הישנה');
    await card.locator('[data-legacy-apply]').click();
    await expect(card.locator('[data-legacy-dialog-error]')).toContainText('לא ניתן היה לכתוב גיבוי');
    await expect(card.locator('[data-legacy-result]')).toHaveCount(0);
  });

  test('nothing to write: the apply is not offered; the same file again: "already imported"', async ({ page }) => {
    const m = await installLegacyMock(page);
    m.nothingToWrite = true;
    const card = await open(page);
    await chooseFile(page);
    await expect(card.locator('[data-legacy-apply-open]')).toHaveAttribute('disabled', '');
    await expect(card.locator('[data-legacy-writes]')).toContainText('אין מה לייבא');
    m.nothingToWrite = false;
    m.apply = 'already';
    await card.locator('[data-legacy-recheck]').click();
    await card.locator('[data-legacy-apply-open]').click();
    await card.locator('[data-legacy-confirm]').fill('import legacy'); // the English word is accepted too (the server's rule)
    await card.locator('[data-legacy-apply]').click();
    await expect(card.locator('[data-legacy-result]')).toContainText('כבר יובא');
    await expect(card.locator('[data-legacy-result-backup]')).toContainText('לא נדרש');
    expect(new URLSearchParams(applies(m)[0].search).get('confirm')).toBe('import legacy');
  });

  for (const status of ['forbidden', 'missing'] as const) {
    test(`the status read answers ${status === 'forbidden' ? 403 : 404}: the card is not drawn`, async ({ page }) => {
      const m = await installLegacyMock(page);
      m.status = status;
      await gotoApp(page, HASH);
      await expect(page.locator('system-diagnostics [data-backup-row]').first()).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => page.locator(`${CARD} sw-card`).count()).toBe(0);
    });
  }

  // the before / after pages of the compare page (SW_SHOTS=1 only): "before" is the same build with the import routes missing (404) - the
  // tab exactly as it was; "after" is the report and the result (the backup list then labels the new kind), light and dark
  for (const scheme of ['light', 'dark'] as const) {
    test(`evidence pages (${scheme})`, async ({ page }) => {
      test.skip(!process.env.SW_SHOTS, 'screenshots only');
      const full = async (name: string) => {
        fs.mkdirSync(SHOTS_OUT, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS_OUT, `page-${name}-${scheme}-${test.info().project.name}.png`), fullPage: true });
      };
      const m = await installLegacyMock(page, { runs: true });
      m.status = 'missing';
      await gotoApp(page, `/?design=a&scheme=${scheme}#/system/diagnostics?tab=backup`);
      await expect(page.locator('system-diagnostics [data-backup-row]').first()).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => page.locator(`${CARD} sw-card`).count()).toBe(0);
      await full('before');
      m.status = 'ok';
      await page.reload(); // the same address: a reload, so the card asks the server again
      await appReady(page);
      await expect(page.locator(`${CARD} [data-legacy-pick]`)).toBeVisible({ timeout: 30_000 });
      await chooseFile(page);
      await full('after-report');
      await page.locator(`${CARD} [data-legacy-apply-open]`).click();
      await page.locator(`${CARD} [data-legacy-confirm]`).fill('ייבוא מהמערכת הישנה');
      await page.screenshot({ path: path.join(SHOTS_OUT, `page-after-dialog-${scheme}-${test.info().project.name}.png`) });
      await page.locator(`${CARD} [data-legacy-apply]`).click();
      await expect(page.locator(`${CARD} [data-legacy-result]`)).toBeVisible();
      await expect(page.locator('system-diagnostics [data-backup-row]').filter({ hasText: PRE_IMPORT.name })).toBeVisible();
      await full('after-result');
    });
  }

  test('the English interface: the labels and the server notes in English', async ({ page }) => {
    await installLegacyMock(page, { lang: 'en' });
    const card = await open(page);
    await expect(card.locator('sw-card')).toHaveAttribute('heading', 'Import from the legacy system');
    await chooseFile(page);
    await expect(card.locator('[data-legacy-count="update"]')).toHaveAttribute('label', 'Will be copied · 2');
    const table = card.locator('sw-table[data-legacy-items]');
    await expect(table.locator('tr[data-legacy-group="cameras"]')).toContainText('Cameras · 6');
    await expect(table.locator('tr[data-legacy-item="cameras.ch1"]')).toContainText('Channel 1');
    await expect(table.locator('tr[data-legacy-item="cameras.ch1"]')).toContainText('The legacy name will be copied');
    await card.locator('[data-legacy-apply-open]').click();
    await expect(card.locator('[data-legacy-word]')).toHaveText('import legacy');
    await expect(card.locator('[data-legacy-dialog-backup]')).toContainText('A project backup (');
    await expect(card.locator('[data-legacy-dialog-backup]')).toContainText('auto-pre-legacy-import');
    await expect(card.locator('[data-legacy-dialog-backup]')).toContainText(') is written before any change');
    await shot(page, 'legacy-en-dialog');
  });
});
