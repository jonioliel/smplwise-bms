import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settlePage } from './pixel-settle';
import { installGeneratorMock, url as genUrl } from './generator-mocks';
import { installWaterMock, waterUrl } from './wkwater-mocks';
import { installElectricityMock, PERMS as ELEC_PERMS, url as elecUrl } from './electricity-mocks';

// DATA-RULES-2-2550: the before / after captures of the compare page (private/planning/data-rules-2-2550_compare_2026-11-26.html) - the
// generator thresholds section, the water and the electricity account page, against mocked backends only. Only with SW_SHOTS=1:
//   SW_SHOTS=1 SW_SHOTS_PHASE=before|after SW_SHOTS_DIR=<dir> npx playwright test tests/data-rules-2-2550-shots.spec.ts --project=desktop --project=mobile

const DIR = process.env.SW_SHOTS_DIR ?? 'test-results/data-rules-2-2550-shots';
const PHASE = process.env.SW_SHOTS_PHASE ?? 'after';
const GAP = [{ from: '2026-09-11', to: '2026-09-20' }];

async function shot(page: Page, name: string, scheme: string) {
  await settlePage(page);
  await page.mouse.move(0, 0);
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: path.join(DIR, `${PHASE}-${name}-${test.info().project.name}-${scheme}.png`) });
}

test.describe('DATA-RULES-2-2550 compare captures', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(process.env.SW_SHOTS !== '1', 'captures only on request');
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`generator thresholds ${scheme}`, async ({ page }) => {
      await installGeneratorMock(page, { battery: { nominal: null, known: 24 } });
      await page.goto('about:blank');
      await page.goto(genUrl('/system/infra/generator/thresholds', 'classic', scheme));
      await page.locator('sw-app gen-settings [data-section="thresholds"]').waitFor({ timeout: 30_000 });
      await shot(page, 'gen-thresholds', scheme);
    });

    test(`water account ${scheme}`, async ({ page }) => {
      await installWaterMock(page, { gaps: GAP });
      await page.goto('about:blank');
      await page.goto(waterUrl('/infra/water/accounts/ac1', 'classic', scheme));
      await page.locator('[data-water="account"], [data-acc-meters]').first().waitFor({ timeout: 30_000 });
      await shot(page, 'water-account', scheme);
    });

    test(`electricity account ${scheme}`, async ({ page }) => {
      await installElectricityMock(page, { perms: ELEC_PERMS.bills });
      const account = {
        id: 'acc1', name: 'דירה 4', customer: null, formula: { ast: { m: 'm1' }, text: '[לוח ראשי]', sentence_he: 'לוח ראשי', meter_ids: ['m1'] },
        tariff: { id: 't1', name: 'תעריף כללי' }, period_months: 1, period_anchor_day: 1, period_anchor_month: 1, first_period_start: '2026-01-01',
        timezone: 'Asia/Jerusalem', auto_mode: 'draft', status: 'active', revision: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        next_period: { from: '2026-11-01', to: '2026-11-30' }, last_bill: null,
      };
      const status = { period: { from: '2026-10-01', to: '2026-10-31' }, kwh_so_far: '120.50', notes: [], billing_gaps: GAP,
        meters: [{ meter_id: 'm1', name: 'לוח ראשי', kwh: '120.50', last_report_at: null, reporting: true }] };
      const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      await page.route('**/api/v1/energy/accounts/acc1', (r) => r.fulfill(json(account)));
      await page.route('**/api/v1/energy/accounts/acc1/status', (r) => r.fulfill(json(status)));
      await page.goto('about:blank');
      await page.goto(elecUrl('/infra/electricity/accounts/acc1', 'classic', scheme));
      await page.locator('elec-account-page [data-state="ready"], elec-account-page[data-state], [data-elec="account"][data-state="ready"]').first().waitFor({ timeout: 30_000 });
      await shot(page, 'elec-account', scheme);
    });
  }
});
