import { test, expect, type Page } from '@playwright/test';
import type { SkinId } from '../src/design/skins';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EL, HARNESS } from './electricity-ui';

// Needs the Vite DEV server: the electricity harness page is served from /tests/electricity-harness/ (the release gate runs it
// in its dev phase on every project: --project=desktop --project=tablet --project=mobile).
// MEDIA-polish (2026-10-10), the electricity part that drives the harness: accounts with the history chart, bills, a bill, the
// wizard, the prices settings. Split out of evidence-media-polish.spec.ts in 2.4.6 so the release gate classifies it in its dev
// phase (on the dist preview the harness page does not exist); the rest of that spec stays on the preview. Same test, same
// screenshots: docs/design/evidence/media-polish/<phase>/elec-*-<skin>-<scheme>-<width>.png.
//   SW_POLISH_PHASE=before SW_BASE_URL=http://127.0.0.1:5190/ npx playwright test tests/evidence-media-polish-electricity.spec.ts --workers=1
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
/** No horizontal page overflow (RTL layouts must not scroll sideways). */
async function noOverflow(page: Page, where: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(over, `horizontal overflow on ${where}`).toBeLessThanOrEqual(1);
}

const MATRIX: [Skin, Scheme][] = [['classic', 'light'], ['classic', 'dark'], ['domus', 'light'], ['domus', 'dark'], ['tesla', 'light'], ['crystal', 'light'], ['crystal', 'dark']];

test.describe('media-polish evidence', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.setTimeout(300_000); // the test walks a whole skin / scheme matrix on a cold dev server
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

  test('electricity: accounts, history, bills, a bill, the wizard, prices', async ({ page }, info) => {
    const go = async (route: string, skin: Skin, scheme: Scheme, screen: string, state = 'ready') => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('sw.demo.electricity', JSON.stringify({}));
        } catch {
          /* storage unavailable */
        }
      });
      await page.goto('about:blank');
      await page.goto(`${HARNESS}?skin=${skin}&scheme=${scheme}#${route}`);
      await page.waitForSelector('[data-harness]');
      await expect(page.locator(`[data-elec="${screen}"]`).first()).toHaveAttribute('data-state', state, { timeout: 20_000 });
    };
    for (const [skin, scheme] of MATRIX) {
      if (phone(info) && skin !== 'classic') continue;
      const tag = `${skin}-${scheme}-${view(info)}`;
      await go(`${EL}/accounts`, skin, scheme, 'accounts');
      await shot(page, `elec-accounts-${tag}`);
      await go(`${EL}/accounts/a1/history`, skin, scheme, 'account');
      await shot(page, `elec-account-history-${tag}`);
      await noOverflow(page, 'account history');
      await go(`${EL}/bills`, skin, scheme, 'bills');
      await shot(page, `elec-bills-${tag}`);
      await noOverflow(page, 'bills');
      if (skin === 'classic') {
        await go(`${EL}/accounts/a1`, skin, scheme, 'account');
        await shot(page, `elec-account-status-${tag}`);
        await go(`${EL}/bills/b104`, skin, scheme, 'bill');
        await shot(page, `elec-bill-${tag}`);
        await go(`${EL}/accounts/new`, skin, scheme, 'wizard');
        await shot(page, `elec-wizard-1-${tag}`);
        await go('/system/infra/prices', skin, scheme, 'settings-prices');
        await shot(page, `elec-settings-prices-${tag}`);
      }
    }
  });
});
