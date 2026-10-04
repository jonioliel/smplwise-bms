import { expect, type Page } from '@playwright/test';

/** Drives the new-account wizard forward to `step` (1-6) with the fixture's meters (the studio board and the lobby lighting), the first tariff and a new (or an existing) customer. */
export async function wizardTo(page: Page, step: number, o: { customer?: 'new' | 'existing'; name?: string } = {}): Promise<void> {
  const next = page.locator('[data-next]');
  const at = async (n: number) => expect(page.locator('[data-elec="wizard"]')).toHaveAttribute('data-step', String(n));
  if (step >= 2) {
    await page.locator('[data-picker-item="m2"]').click();
    await page.locator('[data-picker-item="m3"]').click();
    await next.click();
    await at(2);
  }
  if (step >= 3) {
    await expect(page.locator('[data-formula-state="ok"]')).toBeVisible();
    await next.click();
    await at(3);
  }
  if (step >= 4) {
    await page.locator('[data-tariff-row="t1"]').click();
    await next.click();
    await at(4);
  }
  if (step >= 5) {
    await next.click();
    await at(5);
  }
  if (step >= 6) {
    if ((o.customer ?? 'new') === 'new') await page.locator('#c-name').fill('לקוח בדיקה');
    else {
      await page.locator('[data-cust-mode="existing"]').click();
      await page.locator('[data-cust-row="c2"]').click();
    }
    await page.locator('[data-account-name]').fill(o.name ?? 'חשבון בדיקה');
    await next.click();
    await at(6);
  }
}
