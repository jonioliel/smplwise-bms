import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { PIXEL_SKINS, pixelTitle, skinCheck } from './helpers/pixel-skins';
import { LEGACY_FILE, NOW_ISO, installLegacyMock, type LegacyMock } from './legacy-import-mock';

// LEGACY-IMPORT-UI-2550 pixel baselines: the card "ייבוא מהמערכת הישנה" of Settings › גיבוי ושחזור (#/system/diagnostics?tab=backup) - the
// dry-run report (every pixel skin, light; classic dark), the apply dialog, the result and the honest 409 "changed since the dry run" -
// desktop 1440 and phone 390, against the mocked backend (tests/legacy-import-mock.ts, fixed clock, performance:full). The card alone is
// compared (the rest of the tab has its own specs); the dialog is compared on the whole viewport. Linux baselines are made on the runner
// with --update-snapshots; on an OS without a baseline the compare is skipped (the design-foundation rule).
//   npx playwright test tests/pixel-legacy-import-2550.spec.ts --project=desktop --project=mobile [--update-snapshots]
const CARD = 'sw-legacy-import';
const HASH = '#/system/diagnostics?tab=backup';

const noBaseline = (info: TestInfo, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, skin: string, scheme: 'light' | 'dark', setup?: (m: LegacyMock) => void): Promise<LegacyMock> {
  const m = await installLegacyMock(page, { runs: true });
  setup?.(m);
  await page.clock.setFixedTime(new Date(NOW_ISO));
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}${HASH}`);
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${CARD} [data-legacy-pick]`)).toBeVisible({ timeout: 30_000 });
  const chooser = page.waitForEvent('filechooser');
  await page.locator(`${CARD} [data-legacy-choose]`).click();
  await (await chooser).setFiles(LEGACY_FILE);
  await expect(page.locator(`${CARD} sw-table[data-legacy-items]`)).toBeVisible();
  await page.locator(CARD).scrollIntoViewIfNeeded();
  await settlePage(page);
  return m;
}

async function compare(page: Page, info: TestInfo, name: string, whole = false) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) {
    test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
    return;
  }
  const opts = { maxDiffPixels: 40, animations: 'disabled' as const };
  // the phone: the viewport (the card is taller than the phone screen; the shell's bottom bar sits over its end)
  if (whole || info.project.name === 'mobile') await expect(page).toHaveScreenshot(file, opts);
  else await expect(page.locator(CARD)).toHaveScreenshot(file, opts);
}

test.describe('pixel: the legacy import card', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const skin of PIXEL_SKINS) {
    test(pixelTitle(skin, 'the legacy import report'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, skin, 'light');
      await check(() => compare(page, info, `legacy-${skin}-report`), CARD);
    });
  }

  test('classic is pixel-stable: the report in dark, the apply dialog, the result, the 409', async ({ page }, info) => {
    await open(page, 'classic', 'dark');
    await compare(page, info, 'legacy-classic-report-dark');
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    await open(page, 'classic', 'light');
    await page.locator(`${CARD} [data-legacy-apply-open]`).click();
    await page.locator(`${CARD} [data-legacy-confirm]`).fill('ייבוא מהמערכת הישנה');
    await settlePage(page);
    await compare(page, info, 'legacy-classic-dialog', true);
    await page.locator(`${CARD} [data-legacy-apply]`).click();
    await expect(page.locator(`${CARD} [data-legacy-result]`)).toBeVisible();
    await settlePage(page);
    await compare(page, info, 'legacy-classic-result');
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    await open(page, 'classic', 'light', (m) => { m.apply = 'changed'; });
    await page.locator(`${CARD} [data-legacy-apply-open]`).click();
    await page.locator(`${CARD} [data-legacy-confirm]`).fill('ייבוא מהמערכת הישנה');
    await page.locator(`${CARD} [data-legacy-apply]`).click();
    await expect(page.locator(`${CARD} [data-legacy-rerun]`)).toBeVisible();
    await settlePage(page);
    await compare(page, info, 'legacy-classic-changed');
  });
});
