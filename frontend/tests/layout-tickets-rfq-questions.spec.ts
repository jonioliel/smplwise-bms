import { test, expect, type Page } from '@playwright/test';
import { url } from './tickets-mocks';
import { installRfqMock, RFQ7 } from './tickets-rfq-mocks';

// RFQQUESTIONS layout: a vendor question is unmistakable at 1440 / 1024 / 390 - the "שאלות ממתינות" section at the top of the request
// (inside the viewport without scrolling, no page overflow, 44 px targets on a phone), the list row's badge, the comparison column's
// badge, the navigation badges (the RFQ tab, the tickets area icon) and the answer dialog with its "send to" choice and the preview.
// The fake server replays the demo store (two pending questions on RFQ-07: one sent with a quote, one by WhatsApp).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-tickets-rfq-questions.spec.ts --workers=1
const S = 'sw-app tickets-rfqs';

async function open(page: Page, hash: string, ready: string): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installRfqMock(page);
  await page.goto('about:blank');
  await page.goto(url(hash));
  await page.waitForSelector(ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('RFQ questions layout (RFQQUESTIONS)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the board: the pending section is at the top, in view, without page overflow; its buttons are 44 px on a phone', async ({ page }, info) => {
    await open(page, `/tickets/rfqs?rfq=${RFQ7}`, `${S} tickets-rfq-board [data-phase="ready"]`);
    const sec = page.locator(`${S} tickets-rfq-board [data-rfq-questions]`);
    await expect(sec).toBeVisible();
    await expect(sec).toHaveAttribute('data-rfq-questions', '2');
    const box = await sec.boundingBox();
    const vh = page.viewportSize()?.height ?? 0;
    expect(box && box.y < vh, 'the section starts inside the first screen').toBe(true);
    expect(await overflow(page), 'horizontal page overflow').toBeLessThanOrEqual(1);
    await expect(page.locator(`${S} tickets-rfq-board [data-rfq-q-badge="header"]`)).toBeVisible();
    await expect(page.locator(`${S} tickets-rfq-board [data-rfq-q-badge="vendor"]`).first()).toBeVisible();
    if (info.project.name === 'mobile') {
      for (const b of await sec.locator('button').all()) {
        const r = await b.boundingBox();
        expect(r && r.height >= 43.5, 'a 44 px target').toBe(true);
        expect(r && r.x >= 0 && r.x + r.width <= 391, 'inside the phone width').toBe(true);
      }
    }
  });

  test('the list row and the comparison column carry the badge; the nav shows the count', async ({ page }) => {
    await open(page, '/tickets/rfqs', `${S} [data-rfq-list]`);
    const row = page.locator(`${S} [data-rfq-row="${RFQ7}"] [data-rfq-q-badge="row"]`);
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('data-n', '2');
    await expect(page.locator(`${S} [data-kpi="questions"]`)).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    // the navigation (the shell polls the summary once the module is on): the RFQ tab's badge and the area icon's count
    // (the rail and the bottom bar both carry the area count; only the one of the current layout is shown, so the first VISIBLE match counts)
    await expect(page.locator('sw-app [data-tab-badge="rfqs"], sw-app [data-nav-badge="tickets"]').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    await open(page, `/tickets/rfqs?rfq=${RFQ7}&view=compare`, `${S} tickets-rfq-compare [data-phase="ready"]`);
    await expect(page.locator(`${S} tickets-rfq-compare [data-cmp-q-badge]`).first()).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });

  test('the answer dialog: vendor-only by default, "every vendor" shows the editable question; the preview lists each recipient', async ({ page }) => {
    await open(page, `/tickets/rfqs?rfq=${RFQ7}`, `${S} tickets-rfq-board [data-phase="ready"]`);
    await page.locator(`${S} tickets-rfq-board [data-rfq-q-answer]`).first().click();
    const dlg = page.locator(`${S} tickets-rfq-board tickets-rfq-question-dialog [data-rfq-question-dialog="form"]`);
    // (the sw-dialog host itself has no box: its backdrop is fixed - the dialog is visible when its answer field is)
    await expect(dlg.locator('[data-rfq-answer-text]')).toBeVisible();
    await expect(dlg.locator('[data-rfq-answer-scope="vendor"] input')).toBeChecked();
    await expect(dlg.locator('[data-rfq-answer-shown]')).toHaveCount(0);
    await dlg.locator('[data-rfq-answer-text]').fill('כן, אפשר לתאם.');
    await dlg.locator('[data-rfq-answer-scope="all"] input').check();
    await expect(dlg.locator('[data-rfq-answer-shown]')).toBeVisible();
    await expect(dlg.locator('[data-rfq-answer-named]')).not.toBeChecked();
    await page.locator(`${S} tickets-rfq-board tickets-rfq-question-dialog [data-rfq-answer-preview]`).click();
    const confirm = page.locator(`${S} tickets-rfq-board tickets-rfq-question-dialog [data-rfq-question-dialog="confirm"]`);
    await expect(confirm.locator('[data-rfq-answer-to]').first()).toBeVisible();
    expect(await confirm.locator('[data-rfq-answer-to]').count()).toBeGreaterThan(1);
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    await page.locator(`${S} tickets-rfq-board tickets-rfq-question-dialog [data-rfq-answer-send]`).click();
    await expect(page.locator(`${S} tickets-rfq-board [data-rfq-questions]`)).toHaveAttribute('data-rfq-questions', '1');
  });

  test('the award confirmation warns about an unanswered question', async ({ page }) => {
    await open(page, `/tickets/rfqs?rfq=${RFQ7}&view=compare`, `${S} tickets-rfq-compare [data-phase="ready"]`);
    await page.locator(`${S} tickets-rfq-compare [data-cmp-pick]`).first().check();
    await page.locator(`${S} tickets-rfq-compare [data-cmp-approve]`).click();
    await expect(page.locator(`${S} tickets-rfq-compare [data-cmp-q-warn]`)).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });
});
