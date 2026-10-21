import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url } from './tickets-mocks';
import { installS4Mock, serveBuiltApp } from './tickets-s4-mocks';

// VENDMARK-295 evidence (owner GRANTS3 Q1): the permanent / temporary vendor marker in the vendor list, the filter and the editor, against
// the MOCK layer (invented data). Desktop + phone, light / dark. Screenshots: docs/design/evidence/VENDMARK-295/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-vendmark-295.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/VENDMARK-295');
const H = 'sw-app tickets-handlers';
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };

async function go(page: Page, hash: string, scheme: 'light' | 'dark'): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const base = test.info().project.use.baseURL;
  if (process.env.SW_DIST_ROUTE === '1' && base) await serveBuiltApp(page, new URL(base).origin);
  await installTicketsMock(page, { persona: 'admin', name: NAME });
  await installS4Mock(page, {});
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
}

async function shot(page: Page, name: string, scheme: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`), fullPage: true });
}

test.describe('permanent vendor marker', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(180_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`vendors: chips, filter, editor - ${scheme}`, async ({ page }) => {
      await go(page, '/tickets/handlers?seg=vendors', scheme);
      const list = `${H} tickets-contacts[kind="vendor"]`;
      await page.waitForSelector(`${list} [data-contacts-list]`);
      await expect(page.locator(`${list} [data-contact-card="c000000000000v01"] [data-contact-marker="permanent"]`)).toBeVisible();
      await expect(page.locator(`${list} [data-contact-card="c000000000000v02"] [data-contact-marker="temporary"]`)).toBeVisible();
      await shot(page, 'vendors-list', scheme);
      await page.locator(`${list} [data-marker-filter="permanent"]`).click();
      await expect(page.locator(`${list} [data-contact-card]`)).toHaveCount(1);
      await shot(page, 'vendors-filter-permanent', scheme);
      await page.locator(`${list} [data-marker-filter="temporary"]`).click();
      await expect(page.locator(`${list} [data-contact-card="c000000000000v01"]`)).toHaveCount(0);
      await page.locator(`${list} [data-marker-filter="all"]`).click();
      await page.locator(`${list} [data-contact-item="c000000000000v01"]`).click();
      await page.waitForSelector(`${list} [data-card="contact-editor"] [data-field="marker:permanent"]`);
      await expect(page.locator(`${list} [data-field="marker:permanent"]`)).toHaveAttribute('aria-checked', 'true');
      await shot(page, 'vendor-editor', scheme);
    });
  }

  test('persons list shows the chip; no ticket action with the module off', async ({ page }) => {
    await go(page, '/tickets/handlers?seg=contacts', 'light');
    const list = `${H} tickets-contacts[kind="person"]`;
    await page.waitForSelector(`${list} [data-contacts-list]`);
    await expect(page.locator(`${list} [data-contact-item="c000000000000p01"] [data-contact-marker="permanent"]`)).toBeVisible();
    await shot(page, 'contacts-list', 'light');
  });
});
