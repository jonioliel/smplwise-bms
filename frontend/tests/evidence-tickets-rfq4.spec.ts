import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockRfq } from '../src/api/tickets-rfq-mock';
import { mockTicketDetail, url } from './tickets-mocks';
import { installRfqMock, RFQ7, type RfqMock, type RfqMockOptions } from './tickets-rfq-mocks';

// TKRFQ4 evidence (RFQ stage C4, contract v1.2 section 16): the work-order step on an awarded request - the REAL build against the fake
// server of tests/tickets-rfq-mocks.ts (fake data only). One card per selected vendor (scope, baseline, dates from the quote's window,
// agreed documents as text); "open the vendor's item" sends NOTHING; the preview shows the exact text (the link as a placeholder, never
// an amount) and only its button sends; a split gives one item per vendor; a refusal stays in the card; without the cost permission no
// amount; the item drawer says "נפתחה מבקשת הצעת מחיר RFQ-05". Desktop 1440 and phone 390, light and dark.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-rfq4.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-rfq4');
const S = 'sw-app tickets-rfqs';
const RFQ5 = 'rfq0000000000005';
const O = `${S} tickets-rfq-board tickets-rfq-order`;

async function go(page: Page, hash: string, o: RfqMockOptions = {}, scheme: 'light' | 'dark' = 'light', before?: () => Promise<void>): Promise<RfqMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const m = await installRfqMock(page, o);
  if (before) await before();
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  return m;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', full = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-classic.png`), fullPage: full });
}

const boardReady = (page: Page) => page.waitForSelector(`${S} tickets-rfq-board [data-phase="ready"]`);
const posts = (m: RfqMock, re: RegExp) => m.calls.filter((c) => c.method !== 'GET' && re.test(c.path));

test.describe('requests for quotation - the work order (TKRFQ4)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(240_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the order card: scope, baseline, the quote\'s dates, documents as text; the vendor not selected gets nothing; light / dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, `/tickets/rfqs?rfq=${RFQ5}`, {}, scheme);
      await boardReady(page);
      const card = page.locator(`${O} [data-rfq-order-card]`);
      await expect(card).toHaveCount(1);
      await expect(card).toHaveAttribute('data-ostate', 'form');
      await expect(card.locator('[data-oscope]')).toContainText('ההצעה במלואה');
      await expect(card.locator('[data-obaseline]')).toContainText('4,700');
      await expect(card.locator('[data-order-from]')).not.toHaveValue('');
      await expect(page.locator(`${O} [data-order-not-selected]`)).toContainText('(1)');
      await expect(page.locator(`${O} [data-rfq-order-create]`)).toBeEnabled();
      await shot(page, 'order-form', scheme);
    }
  });

  test('opening the vendor\'s item sends nothing; the preview shows the exact text; only its button sends, once', async ({ page }) => {
    const m = await go(page, `/tickets/rfqs?rfq=${RFQ5}`);
    await boardReady(page);
    const card = page.locator(`${O} [data-rfq-order-card]`);
    await card.locator('[data-order-docs]').fill('נוהל עבודה בגובה, אישור כניסת קבלנים');
    await card.locator('[data-rfq-order-create]').click();
    await expect(card).toHaveAttribute('data-ostate', 'created');
    const created = posts(m, /\/order$/);
    expect(created).toHaveLength(1);
    expect(created[0].body).toMatchObject({ documents: 'נוהל עבודה בגובה, אישור כניסת קבלנים' });
    expect((created[0].body as { request_key: string }).request_key).toMatch(/^rfq-/);
    expect(posts(m, /order\/send$|messages$/)).toHaveLength(0); // the create sent nothing
    await expect(card.locator('[data-rfq-order-ticket-link]')).toContainText('#2044');
    await expect(card.locator('[data-ochip]')).toContainText('טרם נשלחה');
    await expect(page.locator(`${S} tickets-rfq-board [data-rfq-state="ordered"]`)).toBeVisible();
    await shot(page, 'order-created');
    await card.locator('[data-rfq-order-preview]').click();
    const dlg = page.locator(`${O} [data-rfq-order-dialog]`);
    const text = dlg.locator('[data-rfq-order-preview-text]');
    await expect(text).toContainText('[קישור]');
    await expect(text).toContainText('צביעת חדר המדרגות הצפוני');
    await expect(text).not.toContainText('₪');
    await expect(dlg.locator('[data-order-channel]')).toContainText('WhatsApp');
    expect(posts(m, /order\/send$/)).toHaveLength(0); // the preview is no send
    await shot(page, 'order-preview', 'light', false);
    await dlg.locator('[data-rfq-order-send]').click();
    await expect(card).toHaveAttribute('data-ostate', 'sent');
    await expect(card.locator('[data-ochip]')).toContainText('נשלחה לספק');
    expect(posts(m, /order\/send$/)).toHaveLength(1);
    await expect(card.locator('[data-rfq-order-preview]')).toHaveCount(0); // sent once: no second send button
    await shot(page, 'order-sent');
  });

  test('a split award: one card per vendor, the request stays awarded until the last item is opened', async ({ page }) => {
    await go(page, `/tickets/rfqs?rfq=${RFQ7}`, {}, 'light', async () => {
      const cmp = await mockRfq.comparison(RFQ7);
      const [q1, q2] = cmp.quotes;
      await mockRfq.award(RFQ7, { quote_id: q1.quote_id, revision: q1.revision, kinds: ['labor'], finalize: false });
      await mockRfq.award(RFQ7, { quote_id: q2.quote_id, revision: q2.revision, kinds: ['parts'], finalize: true });
    });
    await boardReady(page);
    const cards = page.locator(`${O} [data-rfq-order-card]`);
    await expect(cards).toHaveCount(2);
    await expect(page.locator(`${O} [data-order-split]`)).toContainText('2');
    await expect(cards.first().locator('[data-oscope]')).toContainText('בלבד');
    await shot(page, 'order-split');
    await cards.first().locator('[data-rfq-order-create]').click();
    await expect(cards.first()).toHaveAttribute('data-ostate', 'created');
    await expect(page.locator(`${S} tickets-rfq-board [data-rfq-state="awarded"]`)).toBeVisible();
    await cards.nth(1).locator('[data-rfq-order-create]').click();
    await expect(cards.nth(1)).toHaveAttribute('data-ostate', 'created');
    await expect(page.locator(`${S} tickets-rfq-board [data-rfq-state="ordered"]`)).toBeVisible();
    const links = await page.locator(`${O} [data-rfq-order-ticket-link]`).allTextContents();
    expect(new Set(links).size).toBe(2);
    await shot(page, 'order-split-created');
  });

  test('a refusal stays in the card in plain words; without the cost permission no amount is shown', async ({ page }) => {
    await go(page, `/tickets/rfqs?rfq=${RFQ5}`, { orderRefusal: 'vendor_not_allowed' });
    await boardReady(page);
    const card = page.locator(`${O} [data-rfq-order-card]`);
    await card.locator('[data-rfq-order-create]').click();
    await expect(card.locator('[data-order-error]')).toContainText('אי אפשר לשלוח הזמנת עבודה');
    await expect(card).toHaveAttribute('data-ostate', 'form');
    await shot(page, 'order-refused');
    await go(page, `/tickets/rfqs?rfq=${RFQ5}`, { noAmounts: true });
    await boardReady(page);
    await expect(page.locator(`${O} [data-obaseline]`)).toHaveCount(0);
    await shot(page, 'order-no-amounts');
  });

  test('the item drawer: "opened from request for quotation RFQ-05" with a link back, and the other items of a split', async ({ page }) => {
    const id = '0000000000000a03';
    await go(page, `/tickets/all?t=${id}`, {}, 'light', async () => {
      await page.route(new RegExp(`/api/v1/tickets/${id}(\\?.*)?$`), async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const d = mockTicketDetail(id, 'admin') ?? {};
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...d,
          rfq_origin: { id: RFQ5, number: 5, ref: 'RFQ-05', work_from: null, work_to: null, siblings: [{ id: '0000000000000a01', number: 1042 }] } }) });
      });
    });
    const dr = page.locator('sw-app tickets-list ticket-detail');
    await dr.locator('[data-tab-panel="overview"]').waitFor();
    const fact = dr.locator('[data-fact="rfq-origin"]');
    await expect(fact).toContainText('מבקשת הצעת מחיר RFQ-05');
    await expect(fact.locator('[data-rfq-origin]')).toHaveAttribute('href', `#/tickets/rfqs?rfq=${RFQ5}`);
    await expect(fact.locator('[data-rfq-sibling]')).toContainText('#1042');
    await fact.scrollIntoViewIfNeeded();
    await shot(page, 'drawer-origin', 'light', false);
  });
});
