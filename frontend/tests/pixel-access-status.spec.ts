import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { installAccessMock, NOW, SKINS, type MockOptions } from './access-control-mocks';
import { settlePage } from './pixel-settle';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';

// CR-036 S10 pixel baselines: the Settings page "בקרת כניסה" - the status page and a station's health card in every skin the product has, and the
// log, the groups, the lower half of the status (sync counts and conflicts), the muted alerts, a stale copy and the states (busy, not connected,
// empty, forbidden) in the classic skin - desktop 1440 and phone 390, against the mocked backend (deterministic data, fixed clock, performance:full).
// Baselines are per OS (fonts and text shaping differ): the Linux ones are generated on the runner with `--update-snapshots`; on an OS without a
// baseline the check is skipped instead of failing on a missing file (the design-foundation rule).
//   ~/run_remote.sh spec <branch> tests/pixel-access-status.spec.ts --project=desktop --project=mobile [--update-snapshots]
const PAGE = 'sw-app system-access-control';
const STATUS = `${PAGE} system-access-status`;
const HOME = '/system/access-control';

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, opts: MockOptions, skin: string, ready: string, hash = HOME) {
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

const READY = `${STATUS} [data-access-status="ready"]`;

test.describe('pixel: the access-control Settings page', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const skin of SKINS) {
    // "pixel-stable" in the title: the release gate runs its pixel group with --grep pixel-stable (a title without it ran zero tests)
    // GATELANES-297: pixels for the skins in helpers/pixel-skins.ts (classic, domus), the structural smoke for the others
    test(pixelTitle(skin, "the status page and a station's card"), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, {}, skin, READY);
      await check(() => compare(page, info, `status-${skin}-list`), READY);
      await page.locator(`${STATUS} [data-access-station="entry-c"]`).click();
      const health = `${STATUS} sw-drawer[open] system-access-health [data-health-strip]`;
      await page.waitForSelector(health, { timeout: 20_000 });
      await settlePage(page);
      await check(() => compare(page, info, `status-${skin}-drawer`), health);
    });
  }

  test('classic is pixel-stable: the intercom log, the groups and the policy', async ({ page }, info) => {
    await open(page, {}, 'classic', `${PAGE} system-access-audit [data-access-audit-table]`, `${HOME}/audit`);
    await compare(page, info, 'status-classic-audit');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, {}, 'classic', `${PAGE} system-access-groups [data-access-versions]`, `${HOME}/groups`);
    await compare(page, info, 'status-classic-groups');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, {}, 'classic', `${PAGE} system-access-policy [data-access-policy]`, `${HOME}/policy`);
    await compare(page, info, 'status-classic-policy');
  });

  test('classic is pixel-stable: a stale copy, the lower half of the status and the muted alerts', async ({ page }, info) => {
    const mock = await installAccessMock(page, {});
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=light#${HOME}`);
    await page.waitForSelector(READY, { timeout: 30_000 });
    // a copy that stopped being current, at the top of the page (nothing has scrolled yet)
    mock.opts.status = 'rate';
    await page.locator(`${PAGE} [data-access-refresh]`).click();
    await page.waitForSelector(`${STATUS} [data-access-stale="page"]`, { timeout: 10_000 });
    await settlePage(page);
    await compare(page, info, 'status-classic-stale');
    mock.opts.status = 'ready';
    await page.locator(`${STATUS} [data-access-stale="page"] sw-button`).click();
    await page.waitForSelector(`${STATUS} [data-access-stale="page"]`, { state: 'detached', timeout: 10_000 });
    // the alerts with the muted one shown, then the lower half: the sync counts and the conflicts
    await page.locator(`${STATUS} [data-access-alerts-muted]`).click();
    await page.waitForSelector(`${STATUS} [data-access-alert][data-tone="muted"]`, { timeout: 10_000 });
    await settlePage(page);
    await compare(page, info, 'status-classic-muted');
    await page.locator(`${STATUS} [data-access-card="conflicts"]`).scrollIntoViewIfNeeded();
    await settlePage(page);
    await compare(page, info, 'status-classic-lower');
  });

  test('classic is pixel-stable: the busy, not connected, empty and forbidden states', async ({ page }, info) => {
    await open(page, { status: 'rate' }, 'classic', `${STATUS} [data-access-state="rate"]`);
    await compare(page, info, 'status-classic-busy');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { status: 'not_configured' }, 'classic', `${STATUS} [data-access-state="not_configured"]`);
    await compare(page, info, 'status-classic-not-connected');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { status: 'empty' }, 'classic', `${STATUS} [data-access-card="health"] .empty`);
    await compare(page, info, 'status-classic-empty');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { persona: 'viewer' }, 'classic', `${PAGE} sw-state-panel[data-access-state="no_permission"]`);
    await compare(page, info, 'status-classic-forbidden');
  });
});
