import { test, expect, type Page } from '@playwright/test';
import { buildBundle, dropBundle, open, quoteOf, RfqFake, rfqView } from './public-rfq-fixtures';

// TKRFQVP layout: the request-for-quotation mode of the public vendor page at phone width (375 px) - no horizontal scroll, every touch
// target at least 44 px, right to left in Hebrew - on the open form, the confirmation, the decline step, the code gate and an end state.
//   npx playwright test -c playwright.public.config.ts tests/layout-public-rfq.spec.ts --project=mobile --workers=1

async function check(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(150);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button, select, input:not([type="hidden"]), textarea')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue; // not displayed
      if (r.height < 43.5 || (el.tagName === 'BUTTON' && r.width < 43.5)) out.push(`${el.tagName.toLowerCase()}[${[...el.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).join(',')}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small, `${name}: touch targets under 44 px`).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
}

test.describe('TKRFQVP layout: the RFQ vendor page at 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.beforeAll(() => buildBundle());
  test.afterAll(() => dropBundle());
  test.beforeEach(({ page: _p }, info) => {
    test.setTimeout(180_000);
    test.skip(info.project.name !== 'mobile', 'phone width only');
  });

  test('open form, confirmation, decline step, code gate and the deadline-passed state fit the phone', async ({ page }) => {
    await open(page, new RfqFake());
    await page.locator('[data-rfq-add="parts"]').click();
    await check(page, 'open form');
    await page.locator('[data-rfq-decline]').click();
    await check(page, 'decline step');

    await open(page, new RfqFake(rfqView({ quote: quoteOf(), can: { quote: true, withdraw: true, decline: false, ask: true } })));
    await check(page, 'confirmation');
    await page.locator('[data-rfq-withdraw]').click();
    await check(page, 'withdraw confirm');

    await open(page, new RfqFake(rfqView({ code_required: true })));
    await page.locator('[data-code-send]').click();
    await check(page, 'code gate');

    await open(page, new RfqFake(rfqView({ page_state: 'due_passed', quote: quoteOf(), can: { quote: false, withdraw: false, decline: false, ask: false } })));
    await check(page, 'deadline passed');
  });
});
