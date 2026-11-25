import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { B, RES, homeOf, openHomeList, openResident } from './mb-filter-2520-mocks';

// MULTI-BUILDING-FILTER-2520 pixel baselines: the views this branch changes, with the server's building filter answered (an invented
// multi-building site, tests/mb-filter-2520-mocks.ts; fixed clock) - the home interface's notice board and shared rooms on tower B
// (desktop 1440 and phone 390), and the resident's phone room list on tower B (phone 390), light and dark. Without the filter these
// screens are the screens of before (pixel-home-next-2500 / pixel-home-fb-2431 keep their baselines). Baselines are per OS: the Linux
// ones are generated on the runner with `--update-snapshots`; on an OS without a baseline the check is skipped, not failed.
//   npx playwright test tests/pixel-mb-filter-2520.spec.ts --project=desktop --project=mobile -u --workers=1

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, target: ReturnType<Page['locator']>, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  await settle(page);
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(target).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', caret: 'hide', timeout: 15_000 });
}

test.describe('pixel-stable: the building filter of the home lists and the resident calendar', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`home notice board on tower B ${scheme}`, async ({ page }, info) => {
      await openHomeList(page, 'notices', { after: true, scheme });
      await homeOf(page).locator('[data-act="p2NtTab"][data-v="all"]').click();
      await homeOf(page).locator(`[data-act="p2NtBld"][data-v="${B}"]`).click();
      await expect(homeOf(page).locator(`[data-act="p2NtBld"][data-v="${B}"]`)).toHaveAttribute('aria-pressed', 'true');
      await compare(page, info, homeOf(page).locator('main'), `mb-filter-home-notices-${scheme}`);
    });

    test(`home shared rooms on tower B ${scheme}`, async ({ page }, info) => {
      await openHomeList(page, 'calendar/book', { after: true, scheme });
      await homeOf(page).locator(`[data-act="p2CalBld"][data-v="${B}"]`).click();
      await expect(homeOf(page).locator(`[data-act="p2CalBld"][data-v="${B}"]`)).toHaveAttribute('aria-pressed', 'true');
      await compare(page, info, homeOf(page).locator('main'), `mb-filter-home-rooms-${scheme}`);
    });

    test(`resident phone room list on tower B ${scheme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'the resident flow is the phone');
      await openResident(page, true, scheme);
      const f = page.locator(`${RES} sw-building-filter`);
      await f.locator(`[data-building="${B}"]`).click();
      await expect(f.locator(`[data-building="${B}"]`)).toHaveAttribute('aria-checked', 'true');
      await compare(page, info, page.locator(RES), `mb-filter-res-rooms-${scheme}`);
    });
  }
});
