import { test, expect, type Page } from '@playwright/test';
import { url } from './tickets-mocks';
import { installRfqMock, RFQ7, type RfqMock, type RfqMockOptions } from './tickets-rfq-mocks';

// TKRFQVP (contract 15.6): the per-vendor verification-code switch on the RFQ vendors board - the REAL build against the fake server of
// tests/tickets-rfq-mocks.ts (the demo store): a manager turns the code on / off for a vendor (POST .../vendors/{rv}/options with the
// request's revision); a vendor whose code the directory demands answers 409 vendor_code_locked and the off-switch is then disabled with a
// short message; a server without vendor options (contract-only meta) shows no switch.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-rfq-code.spec.ts --project=desktop --project=mobile --workers=1
const S = 'sw-app tickets-rfqs';

async function go(page: Page, o: RfqMockOptions = {}): Promise<RfqMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const m = await installRfqMock(page, o);
  await page.goto('about:blank');
  await page.goto(url(`/tickets/rfqs?rfq=${RFQ7}`, 'classic', 'light'));
  await page.waitForSelector(`${S} tickets-rfq-board [data-phase="ready"]`);
  return m;
}

test.describe('RFQ board: the per-vendor verification code (TKRFQVP)', () => {
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(180_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('on / off for a vendor; the directory\'s demand cannot be lowered (409 vendor_code_locked disables the off-switch)', async ({ page }) => {
    const m = await go(page);
    const b = page.locator(`${S} tickets-rfq-board`);
    const alon = b.locator('[data-rfq-code-toggle="rv-alon"]');
    await expect(alon).toHaveAttribute('aria-pressed', 'false');
    await alon.click();
    await expect(alon).toHaveAttribute('aria-pressed', 'true');
    const post = m.calls.find((c) => c.method === 'POST' && /vendors\/rv-alon\/options/.test(c.path));
    expect(post?.body).toMatchObject({ require_code: true });
    expect(typeof (post?.body as { revision?: unknown }).revision).toBe('number');
    await alon.click();
    await expect(alon).toHaveAttribute('aria-pressed', 'false');

    const kortek = b.locator('[data-rfq-code-toggle="rv-kortek"]');
    await expect(kortek).toHaveAttribute('aria-pressed', 'true');
    await kortek.click();
    await expect(kortek).toBeDisabled();
    await expect(b.locator('[data-rfq-code-locked]')).toBeVisible();
    await expect(kortek).toHaveAttribute('aria-pressed', 'true');
  });

  test('a server without vendor options shows no switch', async ({ page }) => {
    await go(page, { contract: true });
    await expect(page.locator(`${S} tickets-rfq-board [data-rfq-code-toggle]`)).toHaveCount(0);
  });
});
