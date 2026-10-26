import { test, expect, type Page } from '@playwright/test';
import type { SkinId } from '../src/design/skins';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installElectricityMock, url as elecUrl } from './electricity-mocks';

// MEDIA-polish (2026-10-10): the before / after evidence of the design pass on the three feature areas - multimedia (screens, players,
// groups, the player panel with its queue), the notification centre (sheet, detail, states, the settings screen) and electricity (meters,
// the meter card, accounts with the history chart, bills, a bill, the wizard, the prices settings). Demo / mock mode, no backend.
//   SW_POLISH_PHASE=before SW_BASE_URL=http://127.0.0.1:5190/ npx playwright test tests/evidence-media-polish.spec.ts --project=desktop --project=mobile --workers=1
// Screenshots: docs/design/evidence/media-polish/<phase>/<area>-<screen>-<skin>-<scheme>-<width>.png. The default phase is `after`.
const PHASE = process.env.SW_POLISH_PHASE || 'after';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/media-polish', PHASE);
type Scheme = 'light' | 'dark';
type Skin = SkinId;
const view = (info: { project: { name: string } }) => (info.project.name === 'mobile' ? '390' : '1440');
const phone = (info: { project: { name: string } }) => info.project.name === 'mobile';

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function open(page: Page, hash: string, skin: Skin = 'classic', scheme: Scheme = 'light') {
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
}
/** No horizontal page overflow (RTL layouts must not scroll sideways). */
async function noOverflow(page: Page, where: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(over, `horizontal overflow on ${where}`).toBeLessThanOrEqual(1);
}

const MATRIX: [Skin, Scheme][] = [['classic', 'light'], ['classic', 'dark'], ['domus', 'light'], ['domus', 'dark'], ['tesla', 'light'], ['crystal', 'light'], ['crystal', 'dark']];

test.describe('media-polish evidence', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.setTimeout(300_000); // each test walks a whole skin / scheme matrix on a cold dev server
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('sw.nav.order');
        sessionStorage.setItem('sw-notify-mock', JSON.stringify({}));
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('multimedia: screens, players, groups, the player panel', async ({ page }, info) => {
    for (const [skin, scheme] of MATRIX) {
      if (phone(info) && skin !== 'classic') continue;
      const tag = `${skin}-${scheme}-${view(info)}`;
      await open(page, '/multimedia/screens', skin, scheme);
      await page.locator('sw-app multimedia-screens media-screen-card').first().waitFor({ timeout: 15_000 });
      await shot(page, `media-screens-${tag}`);
      await noOverflow(page, 'screens');
      await open(page, '/multimedia/players', skin, scheme);
      await page.locator('sw-app multimedia-players media-player-card').first().waitFor({ timeout: 15_000 });
      await shot(page, `media-players-${tag}`);
      await noOverflow(page, 'players');
      if (skin === 'classic') {
        // the player panel (queue, library, group) of the living-room player
        await page.locator('sw-app multimedia-players media-player-card').first().locator('button.cov').click();
        await page.locator('sw-app media-player-panel [data-pn-state]:not([data-pn-state="loading"])').first().waitFor({ timeout: 10_000 }).catch(() => undefined);
        await page.waitForTimeout(600);
        await shot(page, `media-panel-${tag}`);
        await open(page, '/multimedia/groups', skin, scheme);
        await page.locator('sw-app multimedia-groups [data-group-card], sw-app multimedia-groups [data-preset]').first().waitFor({ timeout: 15_000 });
        await shot(page, `media-groups-${tag}`);
        await noOverflow(page, 'groups');
      }
    }
  });

  test('multimedia: list views and the empty state', async ({ page }, info) => {
    await open(page, '/multimedia/players?state=unavailable', 'classic', 'light');
    await page.waitForTimeout(800);
    await shot(page, `media-players-filtered-classic-light-${view(info)}`);
  });

  test('notifications: the centre, a detail, states, the settings screen', async ({ page }, info) => {
    const me = () => page.locator(phone(info) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]');
    const openCenter = async () => {
      await me().click();
      await page.locator('sw-app sw-user-menu [data-menu-alerts]').click();
      await expect(page.locator('sw-app notify-center')).toHaveAttribute('open', '');
      await page.waitForTimeout(500);
    };
    for (const [skin, scheme] of MATRIX) {
      if (phone(info) && skin !== 'classic') continue;
      const tag = `${skin}-${scheme}-${view(info)}`;
      await open(page, '/devices/building', skin, scheme);
      await openCenter();
      await expect(page.locator('sw-app notify-center [data-center-state="ready"]')).toBeVisible({ timeout: 10_000 });
      await shot(page, `notify-center-${tag}`);
      if (skin === 'classic') {
        await page.locator('sw-app notify-center notify-row [data-row-open]').first().click();
        await page.waitForTimeout(500);
        await shot(page, `notify-detail-${tag}`);
        await page.keyboard.press('Escape');
        await page.locator('sw-app notify-center [data-source-filter]').click();
        await page.waitForTimeout(300);
        await shot(page, `notify-source-menu-${tag}`);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await open(page, '/system/notifications', skin, scheme);
        await page.waitForTimeout(800);
        await shot(page, `notify-settings-${tag}`);
        await noOverflow(page, 'notification settings');
      }
    }
    for (const state of ['loading', 'empty', 'error'] as const) {
      await page.addInitScript((s) => sessionStorage.setItem('sw-notify-mock', JSON.stringify({ state: s })), state);
      await open(page, '/devices/building');
      await openCenter();
      await shot(page, `notify-state-${state}-classic-light-${view(info)}`);
    }
  });

  test('electricity: meters, the meter card, retention', async ({ page }, info) => {
    const P = 'sw-app elec-meters-page';
    for (const [skin, scheme] of MATRIX) {
      if (phone(info) && skin !== 'classic') continue;
      const tag = `${skin}-${scheme}-${view(info)}`;
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await installElectricityMock(page, {});
      await page.goto('about:blank');
      await page.goto(elecUrl('/infra/electricity/meters', skin, scheme));
      await page.waitForSelector(`${P} [data-state="ready"]`, { timeout: 20_000 });
      await shot(page, `elec-meters-table-${tag}`);
      await noOverflow(page, 'meters');
      if (!phone(info)) {
        await page.locator(`${P} [data-view="cards"]`).click();
        await page.waitForTimeout(400);
        await shot(page, `elec-meters-cards-${tag}`);
      }
      if (skin === 'classic') {
        await page.goto('about:blank');
        await page.goto(elecUrl('/infra/electricity/meters?meter=m2', skin, scheme));
        await page.waitForSelector(`${P} elec-meter-card [data-meter-card="m2"]`, { timeout: 20_000 });
        await shot(page, `elec-meter-card-${tag}`);
      }
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installElectricityMock(page, { meters: 'empty' });
    await page.goto('about:blank');
    await page.goto(elecUrl('/infra/electricity/meters'));
    await page.waitForSelector(`${P} [data-state="empty"]`, { timeout: 20_000 });
    await shot(page, `elec-meters-empty-classic-light-${view(info)}`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installElectricityMock(page, { meters: 'error' });
    await page.goto('about:blank');
    await page.goto(elecUrl('/infra/electricity/meters'));
    await page.waitForSelector(`${P} [data-state="error"]`, { timeout: 20_000 });
    await shot(page, `elec-meters-error-classic-light-${view(info)}`);
  });
  // 2.4.6: the harness-driven electricity test (accounts, history, bills, a bill, the wizard, prices) lives in
  // evidence-media-polish-electricity.spec.ts, which needs the Vite dev server (the gate runs it in its dev phase)
});
