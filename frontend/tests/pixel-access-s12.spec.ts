import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { installAccessMock, NOW, SKINS, type MockOptions } from './access-control-mocks';
import { installParityMock, type ParityMock } from './access-parity-mocks';
import { settlePage } from './pixel-settle';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';

// CR-036 S12 pixel baselines, NEW states only: the stations-screen display card and the parity report (a report, another user's) in
// Settings › כללי › מתגי מסכי כניסה, every skin, and the intercom action log narrowed to one person (classic) - desktop 1440 and phone 390,
// against the mocked backend (deterministic data, fixed clock, performance:full). Each image is of the element itself, so the switches card above
// (not changed here) does not take part. Baselines are per OS: the Linux ones are generated on the runner with `--update-snapshots`, looked at,
// then committed; on an OS without a baseline the check is skipped instead of failing on a missing file.
//   ~/run_remote.sh spec <branch> tests/pixel-access-s12.spec.ts --project=desktop --project=mobile [--update-snapshots]
const D = 'sw-app system-diagnostics';
const SETTINGS = '/system/diagnostics?tab=access-control';

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, opts: MockOptions, skin: string, ready: string, hash = SETTINGS, mode: ParityMock['mode'] = 'ready') {
  const mock = await installAccessMock(page, opts);
  await installParityMock(page, mock, mode);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { timeout: 30_000 });
  await settlePage(page);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string, target?: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) {
    test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
    return;
  }
  if (target) await expect(page.locator(target).first()).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

test.describe('pixel: CR-036 S12', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const skin of SKINS) {
    // GATELANES-297: pixels for the skins in helpers/pixel-skins.ts (classic, domus), the structural smoke for the others
    test(pixelTitle(skin, 'the display card and a parity report'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, {}, skin, `${D} system-access-display sw-card[data-access-display="ready"]`);
      await check(() => compare(page, info, `s12-${skin}-display`, `${D} system-access-display sw-card`), `${D} system-access-display sw-card`);
      await page.locator(`${D} system-access-parity sw-button[data-parity-run]`).click();
      await page.waitForSelector(`${D} system-access-parity sw-card[data-parity-state="ready"]`, { timeout: 20_000 });
      await settlePage(page);
      const parity = `${D} system-access-parity sw-card[data-access-card="parity"]`;
      await check(() => compare(page, info, `s12-${skin}-parity`, parity), parity);
    });
  }

  test('classic is pixel-stable: another user\'s report, the checklist and the action log narrowed to a person', async ({ page }, info) => {
    await open(page, {}, 'classic', `${D} system-access-parity sw-dropdown[data-parity-subject]`);
    const dd = page.locator(`${D} system-access-parity sw-dropdown[data-parity-subject]`);
    await dd.locator('[data-dropdown-chip]').click();
    await dd.locator('[role="option"][data-id="u-operator-a"]').click();
    await page.locator(`${D} system-access-parity sw-button[data-parity-run]`).click();
    await page.waitForSelector(`${D} system-access-parity sw-card[data-parity-state="ready"]`, { timeout: 20_000 });
    await settlePage(page);
    await compare(page, info, 's12-classic-parity-operator', `${D} system-access-parity sw-card[data-access-card="parity"]`);
    await compare(page, info, 's12-classic-checklist', `${D} system-access-parity sw-card[data-access-card="parity-checklist"]`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, {}, 'classic', 'sw-app system-access-audit [data-access-audit-person="u1"]', '/system/access-control/audit');
    await page.locator('sw-app system-access-audit [data-access-audit-person="u1"]').click();
    await page.waitForSelector('sw-app system-access-audit [data-access-audit-person-chip]', { timeout: 20_000 });
    await settlePage(page);
    await compare(page, info, 's12-classic-audit-person');
  });
});
