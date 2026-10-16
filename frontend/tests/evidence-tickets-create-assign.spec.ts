import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url } from './tickets-mocks';
import { installS4Mock, type S4Mock, type S4MockOptions } from './tickets-s4-mocks';

// TKUI1 (owner requirement 16.10) evidence: the new-request sheet's handler choice in three headed groups (with an account / without an
// account / vendors and outside contacts) and the safe two-step vendor flow - the request is created UNASSIGNED, the drawer opens on it
// with the existing external-assign dialog prefilled with the vendor; cancelling leaves it unassigned. Screenshots:
// docs/design/evidence/tickets-ui1/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-create-assign.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-ui1');
const L = 'sw-app tickets-list';
const C = `${L} ticket-create`;
const D = `${L} ticket-detail`;
const VENDOR = 'c000000000000p01';

async function go(page: Page, hash: string, o: S4MockOptions = {}, scheme: 'light' | 'dark' = 'light'): Promise<{ s4: S4Mock; base: { calls: { method: string; path: string; body: unknown }[] } }> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const base = await installTicketsMock(page, { persona: o.persona ?? 'admin' });
  const s4 = await installS4Mock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  return { s4, base };
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-classic.png`) });
}

test.describe('TKUI1 new request: the handler groups and the vendor flow', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the groups under headings, "assign later" first; a vendor creates the request unassigned and opens the prefilled send dialog', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/tickets/mine?new=1', {}, scheme);
      await page.locator(`${C} [data-create-group="vendor"]`).waitFor();
      await page.locator(`${C} [data-create-assignee]`).scrollIntoViewIfNeeded();
      await shot(page, 'create-groups', scheme);
    }
    const { base, s4 } = await go(page, '/tickets/mine?new=1');
    const picker = page.locator(`${C} [data-create-assignee]`);
    await picker.locator('[data-create-group="vendor"]').waitFor();
    // "assign later" is the first option and the default
    await expect(picker.locator('[data-create-option]').first()).toHaveAttribute('data-create-option', 'later');
    await expect(picker.locator('[data-create-option="later"] input')).toBeChecked();
    await expect(picker.locator('[data-create-group]')).toHaveText(['עם חשבון', 'ללא חשבון', 'ספקים וגורמים חיצוניים']);
    await expect(picker.locator(`[data-create-vendor="${VENDOR}"]`)).toBeVisible();
    // the vendor flow
    await page.locator(`${C} [data-create-title]`).fill('מזגן מטפטף בחדר השרתים');
    await picker.locator(`[data-create-vendor="${VENDOR}"] input`).check();
    await expect(picker.locator('[data-create-vendor-note]')).toBeVisible();
    await shot(page, 'create-vendor-picked');
    await page.locator(`${C} [data-create-submit]`).click();
    await expect.poll(() => base.calls.find((c) => c.method === 'POST' && c.path === 'tickets')?.body).toMatchObject({ title: 'מזגן מטפטף בחדר השרתים', assign: null });
    const dlg = page.locator(`${D} sw-dialog[data-dialog="assign"]`);
    await expect(dlg.locator('[data-assign-kind="person"]')).toHaveAttribute('aria-checked', 'true');
    await expect(dlg.locator(`[data-contact="${VENDOR}"] input`)).toBeChecked();
    await expect(page, 'the step-two parameter leaves the address once used').not.toHaveURL(/assign=/);
    await expect(page).toHaveURL(/[?&]t=/);
    await shot(page, 'create-vendor-step2');
    // cancelling leaves the request unassigned: no assign call at all
    await dlg.locator('[data-dialog-cancel]').click();
    await expect(dlg).toHaveCount(0);
    expect([...base.calls, ...s4.calls].some((c) => c.method === 'POST' && /\/assign$/.test(c.path))).toBe(false);
  });

  test('without the outside permission the vendor group is shown disabled with its reason', async ({ page }) => {
    await go(page, '/tickets/mine?new=1', { persona: 'manager' });
    const picker = page.locator(`${C} [data-create-assignee]`);
    await picker.locator('[data-create-group="vendor"]').waitFor();
    await expect(picker.locator('[data-create-vendor-blocked]')).toBeVisible();
    await expect(picker.locator('[data-create-vendor]')).toHaveCount(0);
    await picker.scrollIntoViewIfNeeded();
    await shot(page, 'create-vendor-blocked');
  });
});
