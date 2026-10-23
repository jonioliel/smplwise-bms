import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url } from './tickets-mocks';
import { installS4Mock } from './tickets-s4-mocks';

// MAINT215B (owner review 24.10): the supplier-insurance MARK of the tickets assignee picker - a red mark for an expired or missing insurance,
// nothing blocked, no confirmation - from the REAL build against the tickets mock layer (fake data only).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-maintenance-picker.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/maintenance');
const FRESH = '0000000000000a02';
const D = 'sw-app tickets-list ticket-detail';
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };

test.describe('assignee picker insurance marks', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach((_, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
  });

  for (const marks of [true, false]) {
    test(`the picker ${marks ? 'marks' : 'does not mark'} a supplier whose insurance lapsed - and never blocks`, async ({ page }) => {
      test.setTimeout(120_000);
      await installTicketsMock(page, { persona: 'admin', name: NAME });
      const mock = await installS4Mock(page, { insuranceMarks: marks });
      await page.goto('about:blank');
      await page.goto(url(`/tickets/mine?t=${FRESH}`, 'classic', 'light'));
      await page.waitForSelector(`${D} [data-ticket-detail="${FRESH}"]`);
      await page.locator(`${D} [data-assign]`).click();
      await page.locator(`${D} [data-assign-kind="person"]`).click();
      const row = page.locator(`${D} [data-contact="c000000000000p01"]`);
      await expect(row).toBeVisible();
      if (marks) {
        await expect(row.locator('[data-insurance-mark]')).toContainText('ביטוח פג תוקף ב־10.01.2027');
        await expect(row.locator('[data-insurance-mark]')).toHaveAttribute('data-look', 'alarm');
        await page.screenshot({ path: path.join(OUT, `picker-insurance-${test.info().project.name}.png`) });
      } else await expect(page.locator(`${D} [data-insurance-mark]`)).toHaveCount(0);
      // marking only: the row is chosen like any other and the assignment goes through without a confirmation
      await row.locator('input').check();
      await page.waitForSelector(`${D} [data-assign-preview]`);
      await expect(page.locator(`${D} [data-dialog-ok]`)).toBeEnabled();
      await page.locator(`${D} [data-dialog-ok]`).click();
      await expect.poll(() => mock.calls.some((c) => c.method === 'POST' && new RegExp(`^tickets/${FRESH}/assign$`).test(c.path))).toBe(true);
    });
  }
});
