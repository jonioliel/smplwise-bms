import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKINS, url } from './tickets-mocks';
import { CID, installCostsTabMock, type CostsMock, type Scenario } from './tickets-costs-tab-mocks';

// TKUI3 (2.6.0) evidence: the request's Costs tab from the REAL build against the mock layer (fake data only) - the stage chip and the
// read-only stepper, the vendor's quote (approve / partial approval / ask for a correction / reject), the approved cost baseline, the payment
// demand against it (the exceptional line, the difference, approve with / without the exception), and the dialog "לשלוח הודעה לספק?" after
// every decision: its default is NOT sending ("לא עכשיו", Esc, ✕ write nothing - the calls list proves it); only "שלח לספק" posts the
// vendor message with the draft's source. Staff (an employee without an account) get no money surface. The settings card of the allowed
// line kinds. Desktop 1440 and phone 390, light and dark, the five skins. Screenshots: docs/design/evidence/tickets-ui3/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-costs.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-ui3');
const L = 'sw-app tickets-list ticket-detail';
const T = `${L} ticket-costs-tab`;
const CARD = `${T} ticket-cost-card`;
const COSTS = `/tickets/all?t=${CID}&tab=costs`;
const vendorPosts = (m: CostsMock) => m.calls.filter((c) => /vendor-message$/.test(c.path));

async function go(page: Page, scenario: Scenario, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<CostsMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installCostsTabMock(page, scenario);
  await page.goto('about:blank');
  await page.goto(url(COSTS, skin, scheme));
  await page.locator(`${T} [data-costs-tab]:not([data-costs-state="loading"])`).waitFor();
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`) });
}

test.describe('TKUI3 costs tab evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('staff (an employee without an account): no quote, no demand, no requirement, no cost action at all', async ({ page }) => {
    await go(page, 'staff');
    const t = page.locator(T);
    await expect(t.locator('[data-costs-tab]')).toHaveAttribute('data-costs-state', 'staff');
    await expect(t.locator('[data-costs-empty]')).toContainText('עובד ללא חשבון');
    for (const sel of ['[data-quote]', '[data-quote-actions]', '[data-requirement-fold]', '[data-kinds-fold]', '[data-ask-quote]', 'ticket-cost-card', 'button']) await expect(t.locator(sel)).toHaveCount(0);
    await shot(page, 'costs-staff');
  });

  test('a quote waits: chip, stepper, lines, the older version; five skins, light and dark', async ({ page }) => {
    for (const skin of SKINS)
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, 'quote', scheme, skin);
        if (skin === 'classic' || skin === 'domus' || scheme === 'light') await shot(page, 'costs-quote', scheme, skin);
      }
    const t = page.locator(T);
    await expect(t.locator('[data-stage-chip]')).toHaveText('הצעת מחיר ממתינה לאישורך');
    await expect(t.locator('[data-step]')).toHaveCount(4);
    await expect(t.locator('[data-step="quote"]')).toHaveAttribute('aria-current', 'step');
    await expect(t.locator('[data-quote="q-2"] [data-quote-line]')).toHaveCount(3);
    await expect(t.locator('[data-quote-older] [data-older-quote]')).toHaveCount(1);
    await expect(t.locator('[data-quote-approve]')).toHaveText(/אישור ההצעה/);
    await expect(t.locator('[data-quote-reject]')).toHaveCount(0); // reject lives behind "…"
    await t.locator('[data-quote-more]').click();
    await expect(t.locator('[data-quote-reject]')).toBeVisible();
    await expect(t).not.toContainText('דרישת עלות');
  });

  test('approve → the send dialog with the server draft; "לא עכשיו" sends nothing (and neither does Esc)', async ({ page }) => {
    const m = await go(page, 'quote');
    const t = page.locator(T);
    await t.locator('[data-quote-approve]').click();
    await t.locator('sw-dialog[data-dialog="quote-approve"] [data-dialog-ok]').click();
    const send = t.locator('sw-dialog[data-dialog="send-vendor"]');
    await expect(send).toHaveAttribute('data-send-decision', 'approved');
    await expect(send.locator('[data-send-text]')).toHaveValue(/ההצעה שלכם/);
    await shot(page, 'costs-send-dialog');
    await send.locator('[data-send-cancel]').click();
    await expect(t.locator('sw-dialog[data-dialog="send-vendor"]')).toHaveCount(0);
    await expect(t.locator('[data-costs-flash]')).toContainText('לא נשלחה הודעה לספק');
    expect(m.calls.some((c) => /quotes\/q-2\/approve$/.test(c.path))).toBe(true);
    expect(vendorPosts(m), 'an approval never sends a message by itself').toHaveLength(0);
    await expect(t.locator('[data-stage-chip]')).toHaveText('בעבודה · לפי הצעה מאושרת');
    await expect(t.locator('[data-baseline]')).toBeVisible();
    // Esc on a second decision's dialog: nothing sent either
    const m2 = await go(page, 'quote');
    await page.locator(T).locator('[data-quote-fix]').click();
    const fix = page.locator(`${T} sw-dialog[data-dialog="quote-fix"]`);
    await fix.locator('[data-dialog-ok]').click();
    await expect(fix.locator('.err')).toContainText('חובה'); // the reason is required
    await fix.locator('[data-quote-reason-input]').fill('חסר פירוט של הגז');
    await fix.locator('[data-dialog-ok]').click();
    await expect(page.locator(`${T} sw-dialog[data-dialog="send-vendor"]`)).toHaveAttribute('data-send-decision', 'fix_requested');
    await page.keyboard.press('Escape');
    await expect(page.locator(`${T} sw-dialog[data-dialog="send-vendor"]`)).toHaveCount(0);
    expect(m2.calls.find((c) => /request-fix$/.test(c.path))?.body).toMatchObject({ reason: 'חסר פירוט של הגז' });
    expect(vendorPosts(m2)).toHaveLength(0);
  });

  test('partial approval: pick lines, the live total, the subset is sent; then an edited draft is sent with its source', async ({ page }) => {
    const m = await go(page, 'quote');
    const t = page.locator(T);
    await t.locator('[data-quote-partial]').click();
    await expect(t.locator('[data-pick-line]')).toHaveCount(3);
    await expect(t.locator('[data-pick-approve]')).toBeDisabled(); // all lines picked = a full approval, not a partial one
    await t.locator('[data-pick-line="2"]').uncheck();
    await expect(t.locator('[data-pick-approve]')).toBeEnabled();
    await shot(page, 'costs-partial');
    await t.locator('[data-pick-approve]').click();
    await t.locator('sw-dialog[data-dialog="quote-partial"] [data-dialog-ok]').click();
    expect(m.calls.find((c) => /quotes\/q-2\/approve$/.test(c.path))?.body).toMatchObject({ revision: 1, line_indexes: [0, 1] });
    const send = t.locator('sw-dialog[data-dialog="send-vendor"]');
    await expect(send).toHaveAttribute('data-send-decision', 'partially_approved');
    await send.locator('[data-send-text]').fill('שלום, אושרו העבודה והמדחס. אפשר מחר מ-08:00.');
    await send.locator('[data-send-notify]').uncheck();
    await send.locator('[data-send-ok]').click();
    await expect(t.locator('sw-dialog[data-dialog="send-vendor"]')).toHaveCount(0);
    const posts = vendorPosts(m);
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ text: 'שלום, אושרו העבודה והמדחס. אפשר מחר מ-08:00.', notify: false, source: { kind: 'quote', id: 'q-2' } });
    await expect(t.locator('[data-quote="q-2"]')).toHaveAttribute('data-quote-state', 'partially_approved');
    await expect(t.locator('[data-quote-line="2"]')).toHaveAttribute('data-line-mark', 'not');
  });

  test('the payment demand against the baseline: exceptional line, difference, approve WITHOUT the exception (light / dark)', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, 'demand', scheme, 'classic');
      await shot(page, 'costs-demand', scheme);
    }
    const m = await go(page, 'demand');
    const t = page.locator(T);
    await expect(t.locator('[data-stage-chip]')).toHaveText('דרישת תשלום ממתינה לאישורך');
    await expect(t.locator('[data-quote="q-9"]')).toHaveAttribute('data-quote-state', 'approved');
    const card = page.locator(CARD);
    await expect(card.locator('[data-exc="2"]')).toHaveAttribute('data-exc-review', 'pending');
    await expect(card.locator('[data-exc="2"]')).toContainText('לבדיקה');
    await expect(card.locator('[data-claim-delta]')).toContainText('+');
    await expect(card.locator('[data-requirement]')).toHaveCount(0); // the tab's own fold holds the requirements
    await card.locator('[data-cost-approve-noexc]').click();
    const dlg = card.locator('sw-dialog[data-dialog="cost-approve"]');
    await expect(dlg.locator('[data-dialog-ok]')).toHaveText('אישור כולל החריג');
    await dlg.locator('[data-dialog-ok-noexc]').click();
    expect(m.calls.find((c) => /costs\/clm-1\/approve$/.test(c.path))?.body).toMatchObject({ exceptional: 'exclude', revision_id: 'rev-1' });
    const send = t.locator('sw-dialog[data-dialog="send-vendor"]');
    await expect(send).toHaveAttribute('data-send-subject', 'claim');
    await send.locator('[data-send-cancel]').click();
    expect(vendorPosts(m)).toHaveLength(0);
  });

  test('a manager sets the items the vendor may charge and the requirements (folds)', async ({ page }) => {
    const m = await go(page, 'quote');
    const t = page.locator(T);
    await t.locator('[data-kinds-fold] summary').click();
    await expect(t.locator('[data-kind-toggle="labor"]')).toBeDisabled();
    await t.locator('[data-kind-toggle="travel"]').click();
    await expect.poll(() => m.calls.find((c) => /allowed-line-kinds$/.test(c.path))?.body).toEqual({ kinds: ['labor', 'parts', 'travel'] });
    await expect(t.locator('[data-kinds-level]')).toHaveAttribute('data-kinds-level', 'request');
    await t.locator('[data-requirement-fold] summary').click();
    await t.locator('[data-mode="quote:asg-v:off"]').click();
    await expect.poll(() => m.calls.find((c) => /quotes\/requirement$/.test(c.path))?.body).toEqual({ assignment_id: 'asg-v', mode: 'off' });
    await shot(page, 'costs-folds');
  });

  test('nothing waits: the empty state with the quiet "בקשת הצעת מחיר"', async ({ page }) => {
    const m = await go(page, 'empty');
    const t = page.locator(T);
    await expect(t.locator('[data-costs-tab]')).toHaveAttribute('data-costs-state', 'empty');
    await expect(t.locator('[data-costs-empty]')).toHaveText('לא נדרשת הצעת מחיר או דרישת תשלום');
    await shot(page, 'costs-empty');
    await t.locator('[data-ask-quote]').click();
    await expect.poll(() => m.calls.find((c) => /quotes\/requirement$/.test(c.path))?.body).toEqual({ assignment_id: 'asg-v', mode: 'required' });
  });
});
