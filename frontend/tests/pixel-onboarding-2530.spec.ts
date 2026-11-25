import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { installOnboardingMock } from './onboarding-mocks';
import { settlePage } from './pixel-settle';
import { url } from './tickets-mocks';

// DOCS-ONBOARDING-2530 (T071): the first-run getting-started checklist (#/system/onboarding), the shell's row that leads to it, the
// first landing of a fresh installation and Settings › Support, against the mocked backend (tests/onboarding-mocks.ts).
// The behaviour tests run everywhere; the pixel baselines are the NEW screens only (Linux baselines made on the runner with
// --update-snapshots, looked at, then committed; on an OS without a baseline the check is skipped). Every pixel title says
// "pixel-stable" (the release gate's pixel lane selects with -g pixel-stable). The interface build id on the support tab changes with
// every build, so it is masked.
//   npx playwright test tests/pixel-onboarding-2530.spec.ts --project=desktop --project=mobile [--update-snapshots]

const OB = 'sw-app system-onboarding';
const SUP = 'sw-app system-diagnostics';

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, name: string) {
  const info = test.info();
  const file = `${name}.png`;
  if (noBaseline(info, file)) {
    info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
    return;
  }
  // RELEASE-2530-TRAIN: the interface build is the add-on version (vite __ARX_BUILD__ = config.yaml), so its text - and with it the width
  // of the mask box - changed with every version bump (2.52.0 -> 2.53.0: 283 px). A fixed stand-in keeps the box the same size.
  await page.locator('[data-version="ui"]').evaluateAll((els) => { for (const e of els) e.textContent = '0.0.0'; });
  await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', mask: [page.locator('[data-version="ui"]')] });
}

async function openChecklist(page: Page, scheme: 'light' | 'dark' = 'light') {
  await page.goto(url('/system/onboarding', 'domus', scheme));
  await expect(page.locator(`${OB} [data-onboarding-item="support"]`)).toBeVisible({ timeout: 30_000 });
  await page.mouse.move(0, 0);
  await settlePage(page);
}

async function openSupport(page: Page) {
  await page.goto(url('/system/diagnostics?tab=support', 'domus'));
  await expect(page.locator(`${SUP} [data-version="bridge"]`)).toHaveText('0.10.9', { timeout: 30_000 });
  await expect(page.locator(`${SUP} health-log-export [data-log-export]`)).toBeVisible({ timeout: 30_000 });
  await page.mouse.move(0, 0);
  await settlePage(page);
}

test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

test.describe('getting started (DOCS-ONBOARDING-2530)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the checklist: the wizard first, the readiness checks in order, the support page last; progress counts the required items', async ({ page }) => {
    await installOnboardingMock(page);
    await openChecklist(page);
    const ids = await page.locator(`${OB} [data-onboarding-item]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-onboarding-item')));
    expect(ids).toEqual(['connect', 'time', 'places', 'people', 'notifications', 'backup', 'handover', 'support']);
    await expect(page.locator(`${OB} [data-onboarding-item="connect"]`)).toHaveAttribute('data-state', 'open'); // go2rtc still to do
    await expect(page.locator(`${OB} [data-onboarding-item="backup"] [data-onboarding-link]`)).toHaveAttribute('href', '#/system/diagnostics?tab=backup');
    await expect(page.locator(`${OB} [data-onboarding-summary]`)).toHaveAttribute('heading', /3 .* 6/);
    // the shell's row is not drawn on the checklist itself
    await expect(page.locator('sw-app [data-onboarding-row]')).toHaveCount(0);
  });

  test('a fresh installation lands on the checklist (a default landing only); hiding it is the user\'s own and removes the row', async ({ page }, info) => {
    const m = await installOnboardingMock(page);
    await page.goto('/?design=a&skin=domus');
    await expect(page).toHaveURL(/#\/system\/onboarding$/, { timeout: 30_000 });
    await expect(page.locator(`${OB} [data-onboarding-dismiss]`)).toBeVisible({ timeout: 30_000 });
    // an address of its own is never replaced, and the row leads back
    await page.goto(url('/system/readiness', 'domus'));
    await expect(page).toHaveURL(/#\/system\/readiness/);
    const row = page.locator('sw-app [data-onboarding-row]');
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('sw-app [data-setup-hint]')).toHaveCount(0); // the checklist stands in for the setup hint
    if (info.project.name === 'desktop') {
      await expect(row).toBeVisible();
      await row.locator('[data-onboarding-row-dismiss]').click();
    } else {
      // the phone hides the row (design a: the setup progress lives in the personal menu as a pill); hide it from the checklist
      await expect(row).toBeHidden();
      await page.goto(url('/system/onboarding', 'domus'));
      await page.locator(`${OB} [data-onboarding-dismiss]`).click();
      await expect(page.locator(`${OB} [data-onboarding-restore]`)).toBeVisible();
      await page.goto(url('/system/readiness', 'domus'));
    }
    await expect(row).toHaveCount(0);
    expect(m.puts).toContainEqual({ 'onboarding.dismissed': true });
    // hidden: no landing any more
    await page.goto('/?design=a&skin=domus');
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/#\/system\/onboarding/);
  });

  test('an existing installation (the switch off) never lands on it and has no row; the screen says where to turn it on', async ({ page }) => {
    await installOnboardingMock(page, { enabled: false });
    await page.goto('/?design=a&skin=domus');
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/#\/system\/onboarding/);
    await expect(page.locator('sw-app [data-onboarding-row]')).toHaveCount(0);
    await openChecklist(page);
    await expect(page.locator(`${OB} [data-onboarding-off]`)).toBeVisible();
  });

  test('without the readiness report the checklist keeps the wizard and the support page, with a note', async ({ page }) => {
    await installOnboardingMock(page, { readinessFails: true });
    await openChecklist(page);
    await expect(page.locator(`${OB} [data-onboarding-item]`)).toHaveCount(2);
    await expect(page.locator(`${OB} [data-onboarding-partial]`)).toBeVisible();
  });

  test('Settings › Support: the switch saves at once and the versions, the log export and the report steps are there', async ({ page }) => {
    const m = await installOnboardingMock(page, { enabled: true });
    await openSupport(page);
    await expect(page.locator(`${SUP} [data-version="home"]`)).toHaveText('2026.11.2');
    await expect(page.locator(`${SUP} [data-support-report] ol li`)).toHaveCount(5);
    await page.locator(`${SUP} sw-toggle[data-set-onboarding]`).click();
    await expect.poll(() => m.patches).toContainEqual({ 'onboarding.enabled': 'false' });
    await expect(page.locator(`${SUP} sw-toggle[data-set-onboarding]`)).not.toHaveAttribute('checked', '');
  });

  test('pixel-stable: the checklist, light and dark, desktop and phone', async ({ page }, info) => {
    await installOnboardingMock(page);
    if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
    const w = info.project.name === 'desktop' ? '1440' : '390';
    await openChecklist(page, 'light');
    await compare(page, `onboarding-light-${w}`);
    await openChecklist(page, 'dark');
    await compare(page, `onboarding-dark-${w}`);
  });

  test('pixel-stable: Settings › Support, desktop and phone', async ({ page }, info) => {
    await installOnboardingMock(page);
    if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
    await openSupport(page);
    await compare(page, `support-light-${info.project.name === 'desktop' ? '1440' : '390'}`);
  });

  test('pixel-stable: the getting-started row under the tab row (desktop)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the row is the phone menu\'s pill on a phone');
    await installOnboardingMock(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url('/system/readiness', 'domus'));
    await expect(page.locator('sw-app [data-onboarding-row]')).toBeVisible({ timeout: 30_000 });
    await page.mouse.move(0, 0);
    await settlePage(page);
    await compare(page, 'onboarding-row-1440');
  });
});
