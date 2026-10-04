import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installElectricityMock, PERMS, SKINS, url, type MockOptions } from './electricity-mocks';

// CR-023 electricity UI, meters half: evidence screenshots from the REAL build against the mock layer (fake data only), one file per state,
// per project (desktop 1440 / tablet 1024 / mobile 390), light and dark; the four skins on the main screen.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-electricity-meters.spec.ts      (Vite dev server or dist preview)
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/electricity-ui-meters');
const P = 'sw-app elec-meters-page';

test.describe('electricity evidence: meters, add, retention, permissions', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  async function shoot(page: Page, hash: string, name: string, wait: string, opts: MockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic', then?: (p: Page) => Promise<void>, final?: string) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installElectricityMock(page, opts);
    await page.goto('about:blank');
    await page.goto(url(hash, skin, scheme));
    await page.waitForSelector(wait, { timeout: 20_000 });
    if (then) await then(page);
    if (final) await page.waitForSelector(final, { timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    const project = test.info().project.name;
    await page.screenshot({ path: path.join(OUT, `${name}-${project}-${scheme}${skin === 'classic' ? '' : `-${skin}`}.png`) });
  }

  const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 900;

  test('meters: table, cards, states, view-only', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await shoot(page, '/infra/electricity/meters', 'meters-table', `${P} [data-state="ready"]`, {}, scheme);
    }
    if (!phone(page)) await shoot(page, '/infra/electricity/meters', 'meters-cards', `${P} [data-state="ready"]`, {}, 'light', 'classic', async (p) => void (await p.locator(`${P} [data-view="cards"]`).click()));
    await shoot(page, '/infra/electricity/meters', 'meters-loading', `${P} [data-state="loading"]`, { meters: 'slow' });
    await shoot(page, '/infra/electricity/meters', 'meters-empty', `${P} [data-state="empty"]`, { meters: 'empty' });
    await shoot(page, '/infra/electricity/meters', 'meters-error', `${P} [data-state="error"]`, { meters: 'error' });
    await shoot(page, '/infra/electricity/meters', 'meters-viewonly', `${P} [data-state="ready"]`, { perms: PERMS.view });
    await shoot(page, '/infra/electricity/bills', 'meters-viewonly-forbidden', 'sw-app infra-electricity [data-state="forbidden"]', { perms: PERMS.view });
    await shoot(page, '/infra/electricity/meters', 'meters-area-filter', `${P} [data-state="ready"]`, {}, 'light', 'classic', async (p) => {
      if (phone(p)) await p.locator(`${P} [data-area-select]`).selectOption('a-bakery');
      else await p.locator(`${P} [data-area-tree] [data-area="a-bakery"]`).click();
      await expect(p.locator(P)).toBeVisible();
    });
    if (!phone(page)) await shoot(page, '/infra/electricity/meters', 'meters-floor-collapsed', `${P} [data-state="ready"]`, {}, 'light', 'classic', async (p) => void (await p.locator(`${P} [data-area-tree] [data-floor="f-0"]`).click()));
  });

  test('meter card and add a meter', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await shoot(page, '/infra/electricity/meters?meter=m2', 'meter-card', `${P} elec-meter-card [data-meter-card="m2"]`, {}, scheme);
    }
    await shoot(page, '/infra/electricity/meters?meter=m3', 'meter-card-replace', `${P} elec-meter-card [data-meter-card="m3"]`, {}, 'light', 'classic', async (p) => void (await p.locator(`${P} elec-meter-card [data-meter-replace]`).click()), `${P} elec-meter-card [data-replace-save]`);
    await shoot(page, '/infra/electricity/meters?meter=m2', 'meter-card-remove-refused', `${P} elec-meter-card [data-meter-card="m2"]`, {}, 'light', 'classic', async (p) => {
      await p.locator(`${P} elec-meter-card [data-meter-remove]`).click();
      await p.locator(`${P} elec-meter-card [data-meter-remove-confirm]`).click();
      await p.waitForTimeout(300);
    });
    for (const scheme of ['light', 'dark'] as const) {
      await shoot(page, '/infra/electricity/meters?add=1', 'meter-add', `${P} [data-add-dialog] [data-picker-list]`, {}, scheme, 'classic', async (p) => void (await p.locator(`${P} [data-add-dialog] [data-picker-item="sensor.gym_energy"]`).click()));
    }
    await shoot(page, '/infra/electricity/meters?add=1', 'meter-add-kw', `${P} [data-add-dialog] [data-picker-list]`, {}, 'light', 'classic', async (p) => {
      await p.locator(`${P} [data-add-dialog] [data-picker-item="sensor.main_power"]`).click({ force: true });
    }, `${P} [data-add-dialog] [data-picker-reject]`);
  });

  test('retention settings and the permission rows', async ({ page }) => {
    const S = 'sw-app system-infra elec-settings-retention';
    for (const scheme of ['light', 'dark'] as const) {
      await shoot(page, '/system/infra/retention', 'retention', `${S} [data-state="ready"]`, { perms: PERMS.admin }, scheme);
    }
    await shoot(page, '/system/infra/retention', 'retention-error', `${S} [data-state="ready"]`, { perms: PERMS.admin }, 'light', 'classic', async (p) => void (await p.locator(`${S} [data-retention-input="raw_retention_days"]`).fill('400')), `${S} [data-retention-error]`);
    await shoot(page, '/system/infra/retention', 'retention-estimate', `${S} [data-state="ready"]`, { perms: PERMS.admin }, 'light', 'classic', async (p) => void (await p.locator(`${S} [data-retention-input="raw_retention_days"]`).fill('120')), `${S} [data-estimate]`);
    await shoot(page, '/system/infra/retention', 'retention-load-error', `${S} [data-state="error"]`, { perms: PERMS.admin, settings: 'error' });
    await shoot(page, '/system/access', 'permission-rows', 'sw-app system-access [data-access-tabs]', { perms: PERMS.admin }, 'light', 'classic', async (p) => {
      await p.locator('sw-app system-access [data-access-tabs]').getByText('תפקידים').first().click();
    }, 'sw-app system-access elec-permission-rows [data-energy-permissions]');
  });

  test('the four skins on the meters screen', async ({ page }) => {
    test.skip(test.info().project.name === 'tablet', 'desktop and phone show the skins');
    for (const skin of SKINS) for (const scheme of ['light', 'dark'] as const) {
      await shoot(page, '/infra/electricity/meters', 'skin-meters', `${P} [data-state="ready"]`, {}, scheme, skin);
    }
  });
});
