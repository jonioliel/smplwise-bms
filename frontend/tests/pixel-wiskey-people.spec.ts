import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { isPixelSkin, skinCheck } from './helpers/pixel-skins';
import { install, newMock, type PeopleMock, type Role } from './wiskey-people-mock';

// CR-036 S7 pixel baselines: the NEW states of the native people screen - the list (table on the desktop, rows on the phone), the
// person's page (details with the sensitive section, access with the sync states), the empty / error / forbidden / stale / loading
// states, the selection bar and the message dialog (single idle / sent / quota, bulk preview) - against the mocked backend
// (deterministic data, fixed clock, performance:full). Classic light is the full matrix; classic dark and crystal light carry the
// list and the person's page. Desktop 1440 and phone 390 (the tablet is covered by the layout guard).
// Baselines are per OS (fonts and text shaping differ): the Linux ones are generated on the runner with `--update-snapshots`; on an OS
// without a baseline the check is skipped instead of failing on a missing file (the design-foundation rule).
//   run_smart.py linux-pixel <branch> tests/pixel-wiskey-people.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SCREEN = 'wiskey-people';
const NOW = '2026-10-12T10:00:00Z';
const wide = (info: { project: { name: string } }) => (info.project.name === 'mobile' ? '390' : '1440');

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, st: PeopleMock, o: { skin?: string; scheme?: string; ready?: boolean } = {}) {
  await page.clock.setFixedTime(new Date(NOW));
  await install(page, st);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#/wiskey/people`);
  await page.waitForSelector('sw-app');
  if (o.ready !== false) {
    await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
    await expect(page.locator(`${SCREEN} [data-person-row]`).first()).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string) {
  await settlePage(page);
  const file = `${name}-${wide(info)}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

const role = (r: Role = 'admin', patch: Partial<PeopleMock> = {}): PeopleMock => Object.assign(newMock(r), patch);

test.describe('pixel: the native people screen', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  // "pixel-stable" in the title: the release gate runs its pixel group with --grep pixel-stable (a title without it ran zero tests)
  for (const [skin, scheme] of [['classic', 'light'], ['classic', 'dark'], ['crystal', 'light']] as const) {
    // GATELANES-297: crystal has no pixel baseline any more (helpers/pixel-skins.ts): its case is the structural smoke
    const what = `people list and the person's page, ${skin} ${scheme}`;
    test(isPixelSkin(skin) ? `${what}, is pixel-stable` : `${what} (structural smoke, no pixel baseline)`, async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, role(), { skin, scheme });
      await check(() => compare(page, info, `list-${skin}-${scheme}`), `${SCREEN} [data-person-row="p3"]`);
      await page.locator(`${SCREEN} [data-person-row="p3"]`).click();
      const sensitive = page.locator('wiskey-person-drawer [data-person-section="sensitive"]');
      await expect(sensitive).toBeVisible();
      await check(() => compare(page, info, `drawer-${skin}-${scheme}`), sensitive);
    });
  }

  test('the person\'s page: access per station with the sync states, is pixel-stable', async ({ page }, info) => {
    await open(page, role());
    await page.locator(`${SCREEN} [data-person-row="p3"]`).click();
    await page.locator('wiskey-person-drawer [data-person-tab="access"]').click();
    await expect(page.locator('wiskey-person-drawer [data-person-station="mgmt"]')).toBeVisible();
    await compare(page, info, 'drawer-access');
  });

  test('a names-level operator: the list and the page without the sensitive fields, is pixel-stable', async ({ page }, info) => {
    await open(page, role('operator'));
    await compare(page, info, 'operator-list');
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await expect(page.locator('wiskey-person-drawer [data-person-section="details"]')).toBeVisible();
    await compare(page, info, 'operator-drawer');
  });

  test('the cards view is pixel-stable', async ({ page }, info) => {
    await open(page, role());
    await page.locator(`${SCREEN} [data-people-view="cards"]`).click();
    await expect(page.locator(`${SCREEN} [data-wiskey-people-cards]`)).toBeVisible();
    await compare(page, info, 'cards');
  });

  test('the selection bar is pixel-stable', async ({ page }, info) => {
    await open(page, role('admin', { messaging: true }));
    await page.locator(`${SCREEN} [data-people-select-mode]`).click();
    await page.locator(`${SCREEN} [data-person-select="p1"]`).click();
    await page.locator(`${SCREEN} [data-person-select="p2"]`).click();
    await compare(page, info, 'selection');
  });

  test('empty, error and forbidden states are pixel-stable', async ({ page }, info) => {
    await open(page, role('admin', { mode: 'empty' }), { ready: false });
    await expect(page.locator(`${SCREEN} [data-wiskey-people-empty]`)).toBeVisible();
    await compare(page, info, 'state-empty');
    const p2 = await page.context().newPage();
    await open(p2, role('admin', { mode: 'error' }), { ready: false });
    await expect(p2.locator(`${SCREEN} [data-wiskey-state="load_error"]`)).toBeVisible();
    await compare(p2, info, 'state-error');
    const p3 = await page.context().newPage();
    await open(p3, role('viewer'), { ready: false });
    await expect(p3.locator(`${SCREEN} [data-wiskey-state="no_permission"]`)).toBeVisible();
    await compare(p3, info, 'state-forbidden');
  });

  test('the loading skeleton is pixel-stable', async ({ page }, info) => {
    await open(page, role('admin', { delay: 30_000 }), { ready: false });
    await expect(page.locator(`${SCREEN} [data-people-skeleton]`)).toBeVisible({ timeout: 20_000 });
    await compare(page, info, 'state-loading');
  });

  test('the stale strip (the service dropped after a list was shown) is pixel-stable', async ({ page }, info) => {
    const st = role('admin', { mode: 'down_after_ready' });
    await open(page, st);
    await expect.poll(() => st.sockets.length).toBeGreaterThan(0);
    await page.waitForTimeout(1200);
    const { push } = await import('./wiskey-people-mock');
    push(st);
    await expect(page.locator(`${SCREEN} [data-wiskey-stale]`)).toBeVisible({ timeout: 10_000 });
    await compare(page, info, 'state-stale');
  });

  test('the message dialog: single idle, sent, quota; bulk preview, is pixel-stable', async ({ page }, info) => {
    const st = role('admin', { messaging: true });
    await open(page, st);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await page.locator('wiskey-person-drawer [data-person-message]').click();
    const d = page.locator('wiskey-message-dialog');
    await expect(d.locator('[data-msg-recipient]')).toBeVisible();
    await d.locator('[data-msg-template="card_ready"]').click();
    await compare(page, info, 'msg-single');
    await d.locator('[data-msg-send]').click();
    await expect(d.locator('[data-msg-line="sent"]')).toBeVisible();
    await compare(page, info, 'msg-sent');
    await d.locator('[data-msg-cancel]').click();
    await page.keyboard.press('Escape');
    st.msg.quota = { limit: 3, used: 3 };
    await page.locator(`${SCREEN} [data-person-row="p2"] [data-person-message-row]`).first().click();
    await expect(d.locator('[data-msg-line="rate"]')).toBeVisible();
    await compare(page, info, 'msg-quota');
    await d.locator('[data-msg-cancel]').click();
    st.msg.quota = { limit: 6, used: 1 };
    await page.locator(`${SCREEN} [data-people-select-mode]`).click();
    for (const id of ['p1', 'p2', 'p4', 'p5']) await page.locator(`${SCREEN} [data-person-select="${id}"]`).click();
    await page.locator(`${SCREEN} [data-people-bulk-message]`).click();
    await expect(d.locator('[data-msg-preview]')).toBeVisible();
    await d.locator('[data-msg-template="closure"]').click();
    await compare(page, info, 'msg-bulk');
  });
});
