import { test, expect, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { installGeneratorMock, url as genUrl } from './generator-mocks';
import { installWaterMock, waterUrl } from './wkwater-mocks';
import { installElectricityMock, PERMS as ELEC_PERMS, url as elecUrl } from './electricity-mocks';

// DATA-RULES-2-2550 (docs/changes/DATA-RULES-2-2550.md): the screens of the row against MOCKED backends only (tests/generator-mocks.ts,
// tests/wkwater-mocks.ts, tests/electricity-mocks.ts + two electricity account answers here: invented data, no device, no server).
//  (1) generator settings › alert thresholds: the starter battery's system "automatic / 12 V / 24 V" (default automatic, what the server
//      detected named in the hint); a choice is saved as `battery_nominal_v` (24 / 12 / null) and nothing else;
//  (2) the electricity and the water account status: a warning names the days between issued bills that no bill covers.
// The ELEMENT is compared (the battery field, the warning), not the page around it. Desktop 1440 and phone 390, light and dark.
// "pixel-stable" in every title: the release gate runs its pixel group with --grep pixel-stable.
// Baselines are per OS: the Linux ones are generated on the runner; on an OS without a baseline the check is skipped, not failed:
//   run_smart.py linux-pixel <branch> tests/pixel-data-rules-2-2550.spec.ts --project=desktop --project=mobile --update-snapshots

const wide = (info: TestInfo) => (info.project.name === 'mobile' ? '390' : '1440');
const noBaseline = (info: TestInfo, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function compare(el: Locator, info: TestInfo, name: string) {
  await settlePage(el.page());
  const file = `${name}-${wide(info)}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(el).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

/** At rest for a photograph: no hover, no focus ring left by a click. */
async function rest(page: Page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    (a as HTMLElement | null)?.blur?.();
  });
}

const GAP = [{ from: '2026-09-11', to: '2026-09-20' }];

test.describe('DATA-RULES-2-2550: battery system choice, billing gap warning', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`classic ${scheme} is pixel-stable: the generator battery system choice, saved as battery_nominal_v`, async ({ page }, info) => {
      const mock = await installGeneratorMock(page, { battery: { nominal: null, known: 24 } });
      await page.goto('about:blank');
      await page.goto(genUrl('/system/infra/generator/thresholds', 'classic', scheme));
      const sec = page.locator('sw-app gen-settings [data-section="thresholds"]');
      const fld = sec.locator('[data-battery-system]');
      const seg = fld.locator('sw-segmented');
      await expect(fld).toHaveAttribute('data-battery-system', 'auto', { timeout: 30_000 }); // the default: automatic (today's behaviour)
      await expect(fld.locator('[data-battery-hint]')).toContainText(/זוהה: ⁦?24 V/); // the unit run is a left-to-right isolate
      await expect(sec.locator('[data-save-thresholds]')).toHaveAttribute('disabled', ''); // nothing changed yet
      await page.evaluate(() => document.fonts.ready);
      await rest(page);
      await compare(fld, info, `gen-battery-auto-${scheme}`);

      const puts = () => mock.calls.filter((c) => c.method === 'PUT' && c.path.startsWith('devices/')).map((c) => c.body);
      await fld.locator('[data-bat="24"]').click();
      await expect(fld).toHaveAttribute('data-battery-system', '24');
      await sec.locator('[data-save-thresholds]').click();
      await expect.poll(puts).toEqual([{ battery_nominal_v: 24 }]); // the choice only - the thresholds are not sent when untouched
      await expect(page.locator('sw-app gen-settings [data-saved]')).toBeVisible();
      await expect(seg).not.toHaveAttribute('disabled', '');
      await expect(fld).toHaveAttribute('data-battery-system', '24');
      await rest(page);
      await compare(fld, info, `gen-battery-24-${scheme}`);

      await fld.locator('[data-bat="auto"]').click(); // back to automatic: null on the wire
      await sec.locator('[data-save-thresholds]').click();
      await expect.poll(puts).toEqual([{ battery_nominal_v: 24 }, { battery_nominal_v: null }]);
    });

    test(`classic ${scheme} is pixel-stable: the water account warns about days no bill covers`, async ({ page }, info) => {
      await installWaterMock(page, { gaps: GAP });
      await page.goto('about:blank');
      await page.goto(waterUrl('/infra/water/accounts/ac1', 'classic', scheme));
      const warn = page.locator('[data-billing-gap="2026-09-11"]');
      await expect(warn).toBeVisible({ timeout: 30_000 });
      await expect(warn).toContainText('11.09.2026');
      await expect(warn).toContainText('20.09.2026');
      await page.evaluate(() => document.fonts.ready);
      await rest(page);
      await compare(warn, info, `water-gap-${scheme}`);
    });

    test(`classic ${scheme} is pixel-stable: the electricity account warns about days no bill covers`, async ({ page }, info) => {
      await installElectricityMock(page, { perms: ELEC_PERMS.bills });
      const account = {
        id: 'acc1', name: 'דירה 4', customer: null, formula: { ast: { m: 'm1' }, text: '[לוח ראשי]', sentence_he: 'לוח ראשי', meter_ids: ['m1'] },
        tariff: { id: 't1', name: 'תעריף כללי' }, period_months: 1, period_anchor_day: 1, period_anchor_month: 1, first_period_start: '2026-01-01',
        timezone: 'Asia/Jerusalem', auto_mode: 'draft', status: 'active', revision: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        next_period: { from: '2026-11-01', to: '2026-11-30' }, last_bill: null,
      };
      const status = {
        period: { from: '2026-10-01', to: '2026-10-31' }, kwh_so_far: '120.50', notes: [], billing_gaps: GAP,
        meters: [{ meter_id: 'm1', name: 'לוח ראשי', kwh: '120.50', last_report_at: null, reporting: true }],
      };
      await page.route('**/api/v1/energy/accounts/acc1', (r) => json(r, account));
      await page.route('**/api/v1/energy/accounts/acc1/status', (r) => json(r, status));
      await page.goto('about:blank');
      await page.goto(elecUrl('/infra/electricity/accounts/acc1', 'classic', scheme));
      const gap = page.locator('[data-billing-gap="2026-09-11"]');
      await expect(gap).toBeVisible({ timeout: 30_000 });
      await expect(gap).toContainText('20.09.2026');
      const warn = page.locator('elec-account-page .alert', { has: gap });
      await page.evaluate(() => document.fonts.ready);
      await rest(page);
      await compare(warn, info, `elec-gap-${scheme}`);
    });
  }
});
