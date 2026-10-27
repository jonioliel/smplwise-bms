import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { installAccessMock, NOW, SKINS, type MockOptions } from './access-control-mocks';
import { settlePage } from './pixel-settle';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';

// CR-036 S8 pixel baselines: the entry log's NEW screens - the list and the drawer with the event picture in every skin the product has, and the
// states (empty, error, forbidden, stale, the export dialog, the custom period, the table) in the classic skin - desktop 1440 and phone 390,
// against the mocked backend (deterministic data, fixed clock, performance:full). Baselines are per OS (fonts and text shaping differ): the
// Linux ones are generated on the runner with `--update-snapshots`; on an OS without a baseline the check is skipped instead of failing on a
// missing file (the design-foundation rule).
//   ~/run_remote.sh spec <branch> tests/pixel-access-events.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SCREEN = 'sw-app wiskey-events';

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, opts: MockOptions, skin: string, ready: string, hash = '/wiskey/events') {
  await installAccessMock(page, opts);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { timeout: 30_000 });
  await settlePage(page);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

test.describe('pixel: the entry log', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const skin of SKINS) {
    // "pixel-stable" in the title: the release gate runs its pixel group with --grep pixel-stable (a title without it ran zero tests)
    // GATELANES-297: pixels for the skins in helpers/pixel-skins.ts (classic, domus), the structural smoke for the others
    test(pixelTitle(skin, 'the list and the drawer with the picture'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, {}, skin, `${SCREEN} button.row[data-row-id="ev-0001"]`);
      await check(() => compare(page, info, `events-${skin}-list`), SCREEN);
      await page.locator(`${SCREEN} button.row[data-row-id="ev-0001"]`).click();
      await page.waitForSelector(`${SCREEN} sw-drawer[open] [data-ev-portrait="ready"]`, { timeout: 20_000 });
      await settlePage(page);
      await check(() => compare(page, info, `events-${skin}-drawer`), `${SCREEN} sw-drawer[open] [data-ev-portrait="ready"]`);
    });
  }

  test('classic is pixel-stable: the empty, error and forbidden states', async ({ page }, info) => {
    await open(page, { events: 'empty' }, 'classic', `${SCREEN} sw-state-panel[data-wiskey-events-empty]`);
    await compare(page, info, 'events-classic-empty');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { events: 'error' }, 'classic', `${SCREEN} sw-state-panel[data-wiskey-state="load_error"]`);
    await compare(page, info, 'events-classic-error');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { persona: 'viewer' }, 'classic', `${SCREEN} sw-state-panel[data-wiskey-state="no_permission"]`);
    await compare(page, info, 'events-classic-forbidden');
  });

  test('classic is pixel-stable: the stale rows, the export dialog and the custom period', async ({ page }, info) => {
    const mock = await installAccessMock(page, {});
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto('/?design=a&look=performance:full&skin=classic&scheme=light#/wiskey/events');
    await page.waitForSelector(`${SCREEN} button.row[data-row-id="ev-0001"]`, { timeout: 30_000 });
    mock.opts.events = 'unavailable';
    await page.locator(`${SCREEN} [data-wiskey-events-refresh]`).click();
    await page.waitForSelector(`${SCREEN} [data-wiskey-stale]`, { timeout: 10_000 });
    await settlePage(page);
    await compare(page, info, 'events-classic-stale');
    mock.opts.events = 'ready';
    await page.locator(`${SCREEN} [data-wiskey-stale] sw-button`).click();
    await page.waitForSelector(`${SCREEN} [data-wiskey-stale]`, { state: 'detached', timeout: 10_000 });
    await page.locator(`${SCREEN} [data-wiskey-export]`).click();
    await page.waitForSelector(`${SCREEN} wiskey-events-export sw-dialog[open] [data-ev-export-go]`, { timeout: 20_000 });
    await settlePage(page);
    await compare(page, info, 'events-classic-export');
    await page.locator(`${SCREEN} wiskey-events-export [data-ev-export-cancel]`).click();
    const dd = page.locator(`${SCREEN} sw-dropdown[data-wiskey-filter="range"]`);
    await dd.locator('[data-dropdown-chip]').click();
    await dd.locator('[role="option"][data-id="custom"]').click();
    await page.waitForSelector(`${SCREEN} sw-dialog[data-wiskey-custom-range][open] [data-wiskey-filter-start]`, { timeout: 20_000 });
    await settlePage(page);
    await compare(page, info, 'events-classic-period');
  });

  test('classic is pixel-stable: the table', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'a phone has no table');
    await installAccessMock(page, {});
    await page.addInitScript(() => localStorage.setItem('sw.wiskey.events.view', 'table'));
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto('/?design=a&look=performance:full&skin=classic&scheme=light#/wiskey/events');
    await page.waitForSelector(`${SCREEN} sw-table[data-wiskey-events-table] tbody tr`, { timeout: 30_000 });
    await settlePage(page);
    await compare(page, info, 'events-classic-table');
  });
});
