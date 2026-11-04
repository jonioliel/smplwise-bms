import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { D, FOLDS, installCardsMock, openAccess } from './settings-cards-mocks';
import { settlePage } from './pixel-settle';

// SETTINGS-INTERCOM-CARDS-2401 pixel baselines, NEW states only: Settings › "מתגי מסכי כניסה" in layout a (the cards: the switches card, the
// announcements card at 1440x900, the stations-screen display card at 1366x768, the phone at 390) and layout b's second tab "הכרזות וקול",
// classic light, against the mocked backend (deterministic data, fixed clock, performance:full). Whole-page images: the layout is the subject.
// Every test title says "pixel-stable": the release gate's pixel lane selects its tests with -g pixel-stable (a title without it
// ran 0 tests there, 2.40.1 gate shard pixel_10).
// Baselines are per OS: the Linux ones are generated on the runner with `--update-snapshots`, looked at, then committed; on an OS without a
// baseline the check is skipped instead of failing on a missing file.
//   ~/run_remote.sh spec <branch> tests/pixel-settings-intercom-cards-2401.spec.ts --project=desktop --project=mobile [--update-snapshots]

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, name: string) {
  const info = test.info();
  const file = `${name}.png`;
  if (noBaseline(info, file)) {
    info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
    return;
  }
  await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function openCard(page: Page, id: string) {
  const head = page.locator(`${FOLDS} [data-fold-toggle="${id}"]`);
  await head.click({ timeout: 30_000 });
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.move(0, 0);
  await settlePage(page);
}

async function ready(page: Page) {
  await page.locator(`${FOLDS} [data-fold-toggle="screens"]`).waitFor({ timeout: 30_000 });
  await expect(page.locator(`${FOLDS} [data-fold-summary="calls"]`)).not.toHaveText('טוען…', { timeout: 20_000 });
  await expect(page.locator(`${FOLDS} [data-fold-summary="pairing"]`)).not.toHaveText('טוען…', { timeout: 20_000 });
  await settlePage(page);
}

test.describe('pixel: SETTINGS-INTERCOM-CARDS-2401', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('classic is pixel-stable: layout a, the switches and the announcements at 1440x900, the display at 1366x768', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop sizes');
    await page.setViewportSize({ width: 1440, height: 900 });
    await installCardsMock(page);
    await openAccess(page);
    await ready(page);
    await compare(page, 'cards-screens-1440');
    await openCard(page, 'announce');
    await compare(page, 'cards-announce-1440');
    await page.setViewportSize({ width: 1366, height: 768 });
    await openCard(page, 'display');
    await compare(page, 'cards-display-1366');
  });

  test('classic is pixel-stable: layout a on the phone, the cards stack', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone');
    await installCardsMock(page);
    await openAccess(page);
    await ready(page);
    await compare(page, 'cards-screens-390');
  });

  test('classic is pixel-stable: layout b, the second tab "הכרזות וקול"', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop size');
    await page.setViewportSize({ width: 1440, height: 900 });
    await installCardsMock(page, { layout: 'tabs' });
    await openAccess(page, '/system/diagnostics?tab=access-voice');
    await page.locator(`${D} [data-access-voice] system-access-display[show="announce"] [data-access-display-tts-engine]`).waitFor({ timeout: 30_000 });
    await page.locator(`${D} [data-access-voice] system-call-banner sw-card[data-call-banner-setting="ready"]`).waitFor({ timeout: 20_000 });
    await page.mouse.move(0, 0);
    await settlePage(page);
    await compare(page, 'tabs-voice-1440');
  });
});
