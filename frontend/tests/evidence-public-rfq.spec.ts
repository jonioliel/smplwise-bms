import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundle, dropBundle, iso, open, ORIGIN, quoteOf, RfqFake, rfqView, RID, SESSION, type Json } from './public-rfq-fixtures';

// TKRFQVP (2.6.0) evidence: the request-for-quotation mode of the public vendor page (contract section 15) - the BUILT page against a
// fake public listener (tests/public-rfq-fixtures.ts): the request card and the quote form -> send -> the confirmation with the SERVER's
// amounts -> update (base_version) ; the quote changed meanwhile ; withdraw ; "not interested" ; the clarification thread ; the code gate ;
// the e-mail redeem of an RFQ link ; the end states (closed shows no price at all, cancelled, selected with his approved part, deadline
// passed read-only) ; the uniform "unavailable". No server, no backend, no network.
//   npx playwright test -c playwright.public.config.ts tests/evidence-public-rfq.spec.ts --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.SW_EVIDENCE_OUT || path.resolve(HERE, '../../docs/design/evidence/tickets-rfqvp');
const DAY = 86_400_000;

async function shot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`), fullPage: true });
}

async function fillQuote(page: Page): Promise<void> {
  const form = page.locator('[data-rfq-form]');
  await form.locator('[data-quote-field="hours"]').first().fill('8');
  await form.locator('[data-quote-field="rate"]').first().fill('150');
  await form.locator('[data-rfq-add="parts"]').click();
  const last = form.locator('.swc-line').last();
  await last.locator('[data-quote-field="description"]').fill('יחידה 2.5 כ״ס');
  await last.locator('[data-quote-field="unit_price"]').fill('6400');
}

const TOTAL_KEYS = /total|subtotal|vat_minor|net_minor|_minor/;

test.describe('TKRFQVP: the public vendor page - request for quotation', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    buildBundle();
  });
  test.afterAll(() => dropBundle());
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(180_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    (page as unknown as { __errors: string[] }).__errors = errors;
  });
  test.afterEach(async ({ page }) => {
    const errors = (page as unknown as { __errors?: string[] }).__errors ?? [];
    expect(errors.filter((e) => /Content Security Policy|Refused to|TypeError|ReferenceError/i.test(e)), 'no CSP violation, no script error').toEqual([]);
  });

  test('open request: the card, the form, send -> the confirmation with the server amounts; the body carries inputs only', async ({ page }) => {
    const fake = await open(page, new RfqFake());
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(page.url()).toBe(`${ORIGIN}/t/`); // the token left the address bar
    await expect(page.locator('[data-rfq-ref]')).toContainText('RFQ-07');
    await expect(page.locator('[data-rfq-title]')).toContainText('החלפת מזגן');
    await expect(page.locator('[data-rfq-request]')).toContainText('בקשה להצעת מחיר');
    await expect(page.locator('[data-rfq-left]')).toContainText('נותרו 2 ימים');
    await expect(page.locator('[data-rfq-kinds]')).toContainText('עבודה');
    await expect(page.locator('[data-rfq-files]')).toHaveCount(0); // attachments: [] -> nothing
    await expect(page.locator('[data-rfq-add]')).toHaveCount(2); // only the allowed kinds
    await expect(page.locator('body')).not.toContainText('דרישת עלות');
    await expect(page.locator('body')).not.toContainText('Home Assistant');
    await shot(page, 'rfq-open');
    await fillQuote(page);
    // a work date outside the wanted window: a gentle warning, still sendable
    const zoneDay = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(ms));
    await page.locator('[data-rfq-work-from]').fill(zoneDay(Date.now() + 1 * DAY));
    await page.locator('[data-rfq-work-from]').dispatchEvent('change');
    await expect(page.locator('[data-rfq-window-warn]')).toBeVisible();
    await page.locator('[data-rfq-work-from]').fill(zoneDay(Date.now() + 4 * DAY));
    await page.locator('[data-rfq-work-from]').dispatchEvent('change');
    await page.locator('[data-rfq-work-to]').fill(zoneDay(Date.now() + 5 * DAY));
    await page.locator('[data-rfq-work-to]').dispatchEvent('change');
    await expect(page.locator('[data-rfq-window-warn]')).toBeHidden();
    const validDay = zoneDay(Date.now() + 20 * DAY);
    await page.locator('[data-rfq-valid-until]').fill(validDay);
    await page.locator('[data-rfq-valid-until]').dispatchEvent('change');
    await page.locator('[data-rfq-vendor-ref]').fill('Q-2231');
    await expect(page.locator('[data-rfq-figures]')).toContainText('8,968'); // the preview (display only)
    await shot(page, 'rfq-form-filled');
    await page.locator('[data-rfq-send]').click();
    await expect(page.locator('[data-rfq-sent="submitted"]')).toBeVisible();
    await expect(page.locator('[data-banner="sentOk"]')).toBeVisible();
    await expect(page.locator('[data-rfq-total]')).toHaveAttribute('data-rfq-total', '896800');
    await expect(page.locator('[data-rfq-decline]')).toHaveCount(0); // no "not interested" with a live quote
    const post = fake.posts('/t/api/rfq/quote')[0];
    const b = post.body as Json;
    expect(Object.keys(b).filter((k) => TOTAL_KEYS.test(k)), 'no totals in the body').toEqual([]);
    for (const l of b.lines as Json[]) expect(Object.keys(l).filter((k) => TOTAL_KEYS.test(k))).toEqual([]);
    expect(b.base_version).toBeNull();
    expect(b.client_request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(b.currency).toBeUndefined(); // one currency: not sent
    expect(b.amounts_include_vat).toBe(false);
    expect(b.vendor_ref).toBe('Q-2231');
    expect(String(b.valid_until)).toMatch(/T2[01]:59:59Z$/); // 23:59:59 in Jerusalem
    expect(post.headers['x-ticket-token']).toBeTruthy();
    await shot(page, 'rfq-sent');

    // update: the form starts from his quote; the body names the current version
    await page.locator('[data-rfq-edit]').click();
    await expect(page.locator('[data-rfq-form] [data-quote-field="hours"]').first()).toHaveValue('8');
    await page.locator('[data-rfq-form] [data-quote-field="hours"]').first().fill('10');
    await page.locator('[data-rfq-send]').click();
    await expect(page.locator('[data-rfq-version="2"]')).toBeVisible();
    const second = fake.posts('/t/api/rfq/quote')[1].body as Json;
    expect(second.base_version).toBe(1);
    expect(second.client_request_id).not.toBe(b.client_request_id);
  });

  test('the quote changed meanwhile: the page reloads, says so, and keeps his inputs against the new version', async ({ page }) => {
    const fake = await open(page, new RfqFake(rfqView({ quote: quoteOf(), can: { quote: true, withdraw: true, decline: false, ask: true } })));
    await page.locator('[data-rfq-edit]').click();
    fake.failNext = { path: '/t/api/rfq/quote', status: 409, body: { code: 'quote_changed', version: 2 } };
    fake.view = { ...fake.view, quote: quoteOf({ version: 2, id: 'q-2' }) };
    const gets = fake.calls.filter((c) => c.path === '/t/api/rfq').length;
    await page.locator('[data-rfq-send]').click();
    await expect(page.locator('[data-banner="r_e_quote_changed"]')).toBeVisible();
    expect(fake.calls.filter((c) => c.path === '/t/api/rfq').length).toBeGreaterThan(gets); // reloaded
    await expect(page.locator('[data-rfq-form]')).toBeVisible();
    await shot(page, 'rfq-quote-changed');
    await page.locator('[data-rfq-send]').click();
    await expect(page.locator('[data-rfq-version="3"]')).toBeVisible();
    expect((fake.posts('/t/api/rfq/quote')[1].body as Json).base_version).toBe(2);
  });

  test('withdraw asks first; then a new quote can be sent', async ({ page }) => {
    const fake = await open(page, new RfqFake(rfqView({ quote: quoteOf(), can: { quote: true, withdraw: true, decline: false, ask: true } })));
    await page.locator('[data-rfq-withdraw]').click();
    await expect(page.locator('[data-rfq-withdraw-confirm]')).toBeVisible();
    expect(fake.posts('/t/api/rfq/withdraw')).toHaveLength(0);
    await page.locator('[data-rfq-withdraw-yes]').click();
    await expect(page.locator('[data-rfq-withdrawn]')).toBeVisible();
    await expect(page.locator('[data-rfq-form]')).toBeVisible();
    const w = fake.posts('/t/api/rfq/withdraw')[0].body as Json;
    expect(w.quote_id).toBe('q-1');
    expect(w.client_request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('"not interested": a confirm step with an optional reason; the declined state still allows quoting', async ({ page }) => {
    const fake = await open(page, new RfqFake());
    await page.locator('[data-rfq-decline]').click();
    await page.locator('[data-rfq-decline-reason]').fill('אין זמינות החודש');
    await shot(page, 'rfq-decline-confirm');
    await page.locator('[data-rfq-decline-yes]').click();
    await expect(page.locator('[data-rfq-screen="declined"]')).toBeVisible();
    await expect(page.locator('[data-rfq-state="declined"]')).toContainText('סימנתם שאינכם מעוניינים');
    await expect(page.locator('[data-rfq-form]')).toBeVisible();
    const d = fake.posts('/t/api/rfq/decline')[0].body as Json;
    expect(d.reason).toBe('אין זמינות החודש');
    expect(d.client_request_id).toMatch(/^[0-9a-f-]{36}$/);
    await shot(page, 'rfq-declined');
  });

  test('clarification thread: his questions and the organisation answers; a question is posted once', async ({ page }) => {
    const fake = await open(page, new RfqFake(rfqView({ messages: [
      { id: 'm1', mine: true, text: 'האם המחיר צריך לכלול פינוי?', at: iso(Date.now() - 5 * 3_600_000) },
      { id: 'm2', mine: false, text: 'כן, כולל פינוי והובלה', at: iso(Date.now() - 4 * 3_600_000) },
    ] })));
    await expect(page.locator('[data-rfq-msg="mine"]')).toHaveCount(1);
    await expect(page.locator('[data-rfq-msg="theirs"]')).toContainText('כולל פינוי');
    await page.locator('[data-rfq-ask]').fill('אפשר לעבוד ביום שישי?');
    await page.locator('[data-rfq-ask-send]').click();
    await expect(page.locator('[data-rfq-msg="mine"]')).toHaveCount(2);
    await expect(page.locator('[data-banner="asked"]')).toBeVisible();
    expect(fake.posts('/t/api/rfq/message')).toHaveLength(1);
    expect((fake.posts('/t/api/rfq/message')[0].body as Json).text).toBe('אפשר לעבוד ביום שישי?');
    await shot(page, 'rfq-thread');
  });

  test('code gate: the minimal card (reference, organisation, department) until the code; then the request, with the session header', async ({ page }) => {
    const fake = await open(page, new RfqFake(rfqView({ code_required: true })));
    await expect(page.locator('[data-rfq-screen="code"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('RFQ-07');
    await expect(page.locator('body')).not.toContainText('החלפת מזגן');
    await shot(page, 'rfq-code');
    await page.locator('[data-code-send]').click();
    await expect(page.locator('[data-code-message="codeSentWa"]')).toBeVisible();
    await page.locator('[data-code-input]').fill('000000');
    await page.locator('[data-code-verify]').click();
    await expect(page.locator('[data-code-message="codeWrong"]')).toBeVisible();
    await page.locator('[data-code-input]').fill('123456');
    await page.locator('[data-code-verify]').click();
    await expect(page.locator('[data-rfq-screen="open"]')).toBeVisible();
    await expect(page.locator('[data-rfq-title]')).toContainText('החלפת מזגן');
    const last = fake.calls.filter((c) => c.path === '/t/api/rfq').at(-1)!;
    expect(last.headers['x-ticket-session']).toBe(SESSION);
  });

  test('the e-mail form of an RFQ link: the redeem answer of kind "rfq" opens the request', async ({ page }) => {
    const fake = await open(page, new RfqFake(), { url: `${ORIGIN}/t/r/${RID}` });
    await page.locator('[data-redeem]').click();
    await expect(page.locator('[data-rfq-screen="open"]')).toBeVisible();
    expect(fake.calls.some((c) => c.path === '/t/api/rfq')).toBe(true);
    expect(fake.calls.some((c) => c.path === '/t/api/ticket')).toBe(false);
  });

  test('closed: "the request is closed" only - no price, no quote, no hint about others', async ({ page }) => {
    await open(page, new RfqFake(rfqView({ page_state: 'closed', read_only: true, read_only_until: iso(Date.now() + DAY), quote: quoteOf(),
      can: { quote: false, withdraw: false, decline: false, ask: false } })));
    await expect(page.locator('[data-rfq-state="closed"]')).toContainText('הבקשה נסגרה');
    await expect(page.locator('[data-rfq-summary], [data-rfq-form], [data-rfq-request], [data-rfq-thread-card]')).toHaveCount(0);
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/₪|8,968|7,600|נבחר/);
    await shot(page, 'rfq-closed');
  });

  test('cancelled, selected (his approved part) and deadline passed (read-only with his quote)', async ({ page }) => {
    await open(page, new RfqFake(rfqView({ page_state: 'cancelled', can: { quote: false, withdraw: false, decline: false, ask: false } })));
    await expect(page.locator('[data-rfq-state="cancelled"]')).toContainText('הבקשה בוטלה');
    await expect(page.locator('[data-rfq-form]')).toHaveCount(0);
    await shot(page, 'rfq-cancelled');

    const approved = { line_indexes: [0], subtotal_minor: 120000, vat_minor: 21600, total_minor: 141600 };
    await open(page, new RfqFake(rfqView({ page_state: 'awarded', quote: quoteOf({ state: 'partially_awarded', approved }), can: { quote: false, withdraw: false, decline: false, ask: false } })));
    await expect(page.locator('[data-rfq-state="awarded"]')).toContainText('ההצעה שלכם נבחרה');
    await expect(page.locator('[data-rfq-approved="141600"]')).toBeVisible();
    await expect(page.locator('[data-rfq-approved]')).toContainText('התקנה והפעלה');
    await expect(page.locator('[data-rfq-approved]')).not.toContainText('יחידה 2.5');
    await expect(page.locator('[data-rfq-edit], [data-rfq-withdraw], [data-rfq-form]')).toHaveCount(0);
    await shot(page, 'rfq-awarded');

    await open(page, new RfqFake(rfqView({ page_state: 'due_passed', quote: quoteOf(), can: { quote: false, withdraw: false, decline: false, ask: false } })));
    await expect(page.locator('[data-rfq-state="due_passed"]')).toContainText('המועד האחרון להגשה עבר');
    await expect(page.locator('[data-rfq-summary]')).toBeVisible();
    await expect(page.locator('[data-rfq-edit], [data-rfq-withdraw], [data-rfq-form], [data-rfq-decline], [data-rfq-ask]')).toHaveCount(0);
    await shot(page, 'rfq-due-passed');
  });

  test('a refusal at the deadline reloads into the read-only state; a dead link is the uniform "unavailable"', async ({ page }) => {
    const fake = await open(page, new RfqFake());
    await fillQuote(page);
    fake.failNext = { path: '/t/api/rfq/quote', status: 409, body: { code: 'rfq_due_passed' } };
    fake.view = { ...fake.view, page_state: 'due_passed', can: { quote: false, withdraw: false, decline: false, ask: false } };
    await page.locator('[data-rfq-send]').click();
    await expect(page.locator('[data-banner="r_e_due_passed"]')).toBeVisible();
    await expect(page.locator('[data-rfq-screen="due_passed"]')).toBeVisible();

    await open(page, new RfqFake(), { url: `${ORIGIN}/t/#q.${'Z'.repeat(32)}` });
    await expect(page.locator('[data-state-title="unavailableTitle"]')).toBeVisible();
  });

  test('English and Arabic: the direction follows the language; Arabic carries the preliminary-translation line', async ({ page }) => {
    await open(page, new RfqFake(rfqView({ lang: 'en', dir: 'ltr' })));
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('[data-rfq-request]')).toContainText('Request for quotation');
    await shot(page, 'rfq-open-en');
    await open(page, new RfqFake(rfqView({ lang: 'ar', dir: 'rtl' })));
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-prelim]')).toBeVisible();
    await shot(page, 'rfq-open-ar');
  });
});
