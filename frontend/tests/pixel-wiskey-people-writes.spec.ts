import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settlePage } from './pixel-settle';
import { isPixelSkin, skinCheck } from './helpers/pixel-skins';
import { install, newMock, type PeopleMock } from './wiskey-people-mock';
import { installWrites, newWrites, type WritesMock } from './wiskey-writes-mock';

// CR-036 S11 pixel baselines: the NEW states of the person writes - the actions menu, a question, the answer under the person's page
// header, a not-sent / an unknown answer, the delete pending, the cards (two rows, a removal question), the photo ready to save, and
// the editor's access category with the weekly timing - against the S7 people mock plus the writes mock (deterministic data, fixed
// clock, performance:full). Classic light is the full matrix; classic dark and crystal light carry the menu and the cards. Desktop 1440
// and phone 390 (the tablet is covered by the layout guard).
// Baselines are per OS (fonts and text shaping differ) and are NOT committed with this spec: the Linux ones are generated on the
// runner with `--update-snapshots` once the owner has looked at the evidence; on an OS without a baseline the check is skipped instead
// of failing on a missing file (the design-foundation rule).
//   run_smart.py linux-pixel <branch> tests/pixel-wiskey-people-writes.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SCREEN = 'wiskey-people';
const ACTIONS = 'wiskey-person-actions';
const NOW = '2026-10-12T10:00:00Z';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const wide = (info: { project: { name: string } }) => (info.project.name === 'mobile' ? '390' : '1440');

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, st: PeopleMock, w: WritesMock, o: { skin?: string; scheme?: string } = {}) {
  await page.clock.setFixedTime(new Date(NOW));
  await install(page, st);
  await installWrites(page, st, w);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#/wiskey/people`);
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
  await expect(page.locator(`${SCREEN} [data-person-row]`).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string) {
  await settlePage(page);
  const file = `writes-${name}-${wide(info)}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function actions(page: Page, id: string, action?: string) {
  await page.locator(`${SCREEN} [data-person-row="${id}"]`).click();
  await expect(page.locator('wiskey-person-drawer [data-person-section="details"]')).toBeVisible();
  await page.locator('wiskey-person-drawer [data-person-actions-open]').click();
  await expect(page.locator(`${ACTIONS} sw-dialog`)).toHaveAttribute('data-person-actions', 'menu');
  if (action) await page.locator(`${ACTIONS} [data-person-action="${action}"]`).click();
}

test.describe('pixel: the person writes', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  // "pixel-stable" in the title: the release gate runs its pixel group with --grep pixel-stable
  for (const [skin, scheme] of [['classic', 'light'], ['classic', 'dark'], ['crystal', 'light']] as const) {
    // GATELANES-297: crystal has no pixel baseline any more (helpers/pixel-skins.ts): its case is the structural smoke
    const what = `the actions menu and the cards, ${skin} ${scheme}`;
    test(isPixelSkin(skin) ? `${what}, is pixel-stable` : `${what} (structural smoke, no pixel baseline)`, async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, newMock('admin'), newWrites(), { skin, scheme });
      await actions(page, 'p1');
      await check(() => compare(page, info, `menu-${skin}-${scheme}`), `${ACTIONS} [data-person-action="cards"]`);
      await page.locator(`${ACTIONS} [data-person-action="cards"]`).click();
      await expect(page.locator(`${ACTIONS} [data-person-card]`)).toHaveCount(1);
      await check(() => compare(page, info, `cards-${skin}-${scheme}`), `${ACTIONS} [data-person-card]`);
    });
  }

  test('a question, the answer in the dialog and under the header, is pixel-stable', async ({ page }, info) => {
    await open(page, newMock('admin'), newWrites());
    await actions(page, 'p8', 'temporary_cancel');
    await expect(page.locator(`${ACTIONS} select[data-action-reason]`)).toBeVisible();
    await compare(page, info, 'ask-reason');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(page.locator(`${ACTIONS} [data-action-result="saved"]`)).toBeVisible();
    await compare(page, info, 'saved');
    await page.locator(`${ACTIONS} [data-action-close]`).click();
    await expect(page.locator('wiskey-person-drawer [data-person-result="saved"]')).toBeVisible();
    await compare(page, info, 'drawer-result');
  });

  test('not sent, unknown and the delete pending are pixel-stable', async ({ page }, info) => {
    const w = newWrites();
    w.deleteLag = 1000; // the read model keeps finding the person: the dialog stays "pending"
    await open(page, newMock('admin'), w);
    w.failOnce.active = 'scope';
    await actions(page, 'p1', 'deactivate');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(page.locator(`${ACTIONS} [data-action-result="not_sent"]`)).toBeVisible();
    await compare(page, info, 'not-sent');
    await page.locator(`${ACTIONS} [data-action-close]`).click();
    w.failOnce.archive = 'unknown';
    await page.locator('wiskey-person-drawer [data-person-actions-open]').click();
    await page.locator(`${ACTIONS} [data-person-action="archive"]`).click();
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(page.locator(`${ACTIONS} [data-action-result="unknown"]`)).toBeVisible();
    await compare(page, info, 'unknown');
    await page.locator(`${ACTIONS} [data-action-close]`).click();
    await page.locator('wiskey-person-drawer [data-person-actions-open]').click();
    await page.locator(`${ACTIONS} [data-person-action="delete"]`).click();
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(page.locator(`${ACTIONS} [data-action-result="pending"]`)).toBeVisible();
    await compare(page, info, 'delete-pending');
  });

  test('the cards with a removal question and the photo ready to save are pixel-stable', async ({ page }, info) => {
    const st = newMock('admin');
    await open(page, st, newWrites());
    await actions(page, 'p3', 'cards'); // p3 holds two cards
    await expect(page.locator(`${ACTIONS} [data-person-card]`)).toHaveCount(2);
    await page.locator(`${ACTIONS} [data-person-card] [data-card-remove]`).first().click();
    await page.locator(`${ACTIONS} [data-card-number]`).fill('bad number!');
    await page.locator(`${ACTIONS} [data-card-add]`).click();
    await compare(page, info, 'cards-remove-ask');
    await page.locator(`${ACTIONS} [data-action-close]`).click();
    await page.locator('wiskey-person-drawer [data-person-actions-open]').click();
    await page.locator(`${ACTIONS} [data-person-action="photo"]`).click();
    const small = JSON.parse(fs.readFileSync(path.resolve(HERE, '../../smplwise_vms/backend/tests/fixtures/wiskey_rc37/users_photo_get.json'), 'utf8')) as { photo: string };
    await page.locator(`${ACTIONS} [data-photo-input]`).setInputFiles({ name: 'face.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(small.photo.split(',')[1], 'base64') });
    await expect(page.locator(`${ACTIONS} [data-photo-preview]`)).toBeVisible();
    await compare(page, info, 'photo-ready');
  });

  test('the editor: a contractor with the weekly timing, is pixel-stable', async ({ page }, info) => {
    await open(page, newMock('admin'), newWrites());
    await page.locator(`${SCREEN} [data-person-row="p2"]`).click();
    await page.locator('wiskey-person-drawer [data-wiskey-person-edit]').click();
    const editor = page.locator('wiskey-person-editor');
    await expect(editor.locator('[data-wiskey-editor-name]')).toBeVisible({ timeout: 15_000 });
    await editor.locator('[data-wiskey-editor-category]').selectOption('contractor');
    await editor.locator('[data-wiskey-editor-responsible]').fill('רונית גל');
    await editor.locator('[data-wiskey-editor-timing-select]').selectOption('weekly');
    await editor.locator('[data-timing-day="Sunday"]').check();
    await editor.locator('[data-timing-day="Thursday"]').check();
    await editor.locator('[data-wiskey-editor-section="timing"]').scrollIntoViewIfNeeded();
    await compare(page, info, 'editor-timing');
  });
});
