import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url, SKINS } from './tickets-mocks';
import { installRfqMock, RFQ7, RFQ8, type RfqMock, type RfqMockOptions } from './tickets-rfq-mocks';
import { drawnSkin } from './helpers/frozen-skins';

// TKRFQ2 evidence (release 2.6.1): "בקשות הצעת מחיר" - the REAL build against a fake server that answers contract v0.9 (fake data only):
// the list (state strip, KPI tiles, vendor status bars) in five skins, light and dark; the new-request sheet (the preview, the checks,
// the send confirmation - nothing leaves without it); the vendors board (tiles, table, timeline, dialogs); the comparison (lowest /
// earliest, another currency in its own group, never summed), the award (confirmation, second approval pending, the message drafts -
// never an automatic send); the states (loading, empty, error, not available, no amounts). Desktop 1440 and phone 390.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-rfq2.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-rfq2');
const S = 'sw-app tickets-rfqs';

async function go(page: Page, hash: string, o: RfqMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<RfqMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const m = await installRfqMock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return m;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic', full = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`), fullPage: full });
}

const listReady = (page: Page) => page.waitForSelector(`${S} [data-rfq-list]`);
const boardReady = (page: Page) => page.waitForSelector(`${S} tickets-rfq-board [data-phase="ready"]`);
const compareReady = (page: Page) => page.waitForSelector(`${S} tickets-rfq-compare [data-phase="ready"]`);
const posts = (m: RfqMock, re: RegExp) => m.calls.filter((c) => c.method !== 'GET' && re.test(c.path));

test.describe('requests for quotation - manager UI (TKRFQ2)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(240_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('list: state strip with counts, KPI tiles, one row per request with the vendors bar; light / dark; the tab is active', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/tickets/rfqs', {}, scheme);
      await listReady(page);
      await expect(page.locator(`${S} [data-rfq-row]`)).toHaveCount(4); // open: RFQ-08, 07, 06, 05 (04 is cancelled)
      await expect(page.locator(`${S} [data-rfq-strip] [data-state="open"] small`)).toHaveText('4');
      await expect(page.locator(`${S} [data-rfq-strip] [data-state="all"] small`)).toHaveText('5');
      await expect(page.locator(`${S} [data-kpi="open"] b`)).toHaveText('4');
      await expect(page.locator(`${S} [data-rfq-row="rfq0000000000007"] [data-rfq-vbar]`)).toContainText('הגישו 3');
      await expect(page.locator(`${S} [data-rfq-row="rfq0000000000007"] [data-rfq-lowest]`)).toContainText('7,500');
      await shot(page, 'list', scheme);
    }
    // the filters are the address: closed / cancelled, a department, the text
    await page.locator(`${S} [data-rfq-strip] [data-state="cancelled"]`).click();
    await expect(page.locator(`${S} [data-rfq-row]`)).toHaveCount(1);
    expect(page.url()).toContain('state=cancelled');
    await page.locator(`${S} [data-rfq-strip] [data-state="all"]`).click();
    await page.locator(`${S} [data-rfq-search]`).fill('RFQ-07');
    await expect(page.locator(`${S} [data-rfq-row]`)).toHaveCount(1);
    await page.locator(`${S} [data-rfq-search]`).fill('אין כזה');
    await expect(page.locator(`${S} [data-rfq-state="no-match"]`)).toBeVisible();
    await shot(page, 'list-no-match');
  });

  test('list in the five skins (light)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'skins once, on the desktop');
    for (const skin of SKINS) {
      await go(page, '/tickets/rfqs', {}, 'light', skin);
      await listReady(page);
      await shot(page, 'list', 'light', skin, false);
    }
    await go(page, '/tickets/rfqs', {}, 'dark', drawnSkin('bubble')); // BUBBLE-FREEZE-295: domus while frozen
    await listReady(page);
    await shot(page, 'list', 'dark', drawnSkin('bubble'), false);
  });

  test('list states: loading, empty, error with retry, not available on this server, no amounts', async ({ page }) => {
    await go(page, '/tickets/rfqs', { slowList: true });
    await page.waitForSelector(`${S} [data-rfq-state="loading"]`);
    await shot(page, 'state-loading');
    await go(page, '/tickets/rfqs', { empty: true });
    await page.waitForSelector(`${S} [data-rfq-state="empty"]`);
    await shot(page, 'state-empty');
    await go(page, '/tickets/rfqs', { failList: true });
    await page.waitForSelector(`${S} [data-rfq-state="error"]`);
    await shot(page, 'state-error');
    await page.locator(`${S} [data-rfq-retry]`).click();
    await listReady(page);
    await go(page, '/tickets/rfqs', { unavailable: true });
    await page.waitForSelector(`${S} [data-rfq-state="unavailable"]`);
    await shot(page, 'state-unavailable');
    await go(page, '/tickets/rfqs', { noAmounts: true });
    await listReady(page);
    await expect(page.locator(`${S} [data-rfq-lowest]`)).toHaveCount(0);
  });

  test('new request: the sheet, the preview, the checks, then the send confirmation (nothing is sent before it)', async ({ page }) => {
    const m = await go(page, '/tickets/rfqs');
    await listReady(page);
    await page.locator(`${S} [data-rfq-new-btn]`).click();
    const sheet = page.locator(`${S} tickets-rfq-new`);
    await expect(sheet.locator('[data-rfq-new-form]')).toBeVisible();
    // the employee of the directory is never offered (an employee does not quote)
    await expect(sheet.locator('[data-rfq-vendor]')).toHaveCount(4);
    await expect(sheet.locator('[data-rfq-vendor="ct-staff"]')).toHaveCount(0);
    await sheet.locator('[data-rfq-to-send]').click();
    await expect(sheet.locator('[data-rfq-err="title"]')).toBeVisible();
    await expect(sheet.locator('[data-rfq-err="vendors"]')).toBeVisible();
    await shot(page, 'new-errors', 'light', 'classic', false);
    await sheet.locator('[data-rfq-title]').fill('תחזוקת גנרטור חצי שנתית');
    await sheet.locator('[data-rfq-description]').fill('בדיקת שמן, מסננים והפעלה בעומס. כולל דוח.');
    await sheet.locator('[data-rfq-place]').fill('חדר מכונות · מרתף');
    await sheet.locator('[data-rfq-kinds] [data-kind="travel"]').click();
    await sheet.locator('[data-rfq-vendor="ct-alon"] input[type="checkbox"]').first().check();
    await sheet.locator('[data-rfq-vendor="ct-kortek"] input[type="checkbox"]').first().check();
    await expect(sheet.locator('[data-rfq-chosen]')).toContainText('2');
    // the code of a vendor whose own setting requires it is locked on
    await expect(sheet.locator('[data-rfq-code="ct-kortek"] input')).toBeDisabled();
    await expect(sheet.locator('[data-rfq-preview]')).toContainText('תחזוקת גנרטור חצי שנתית');
    await expect(sheet.locator('[data-rfq-preview]')).toContainText('אלון ד.');
    await expect(sheet.locator('[data-rfq-preview]')).not.toContainText('₪');
    await shot(page, 'new-filled', 'light', 'classic', false);
    expect(posts(m, /tickets\/rfqs/)).toHaveLength(0);
    await sheet.locator('[data-rfq-to-send]').click();
    await expect(sheet.locator('[data-rfq-send-dialog] [data-rfq-send-mode="auto"]')).toBeVisible(); // the dialog host has no box of its own
    await expect(sheet.locator('[data-rfq-send-preview]')).toBeVisible();
    await shot(page, 'new-confirm', 'light', 'classic', false);
    expect(posts(m, /tickets\/rfqs/)).toHaveLength(0); // still nothing - the confirmation is the only way out
    await sheet.locator('[data-rfq-send-confirm]').click();
    await boardReady(page);
    const create = posts(m, /^tickets\/rfqs\/$/)[0];
    expect(create?.body).toMatchObject({ title: 'תחזוקת גנרטור חצי שנתית', allowed_line_kinds: ['labor', 'parts', 'travel'] });
    expect((create?.body as { vendors: unknown[] }).vendors).toHaveLength(2);
    const send = posts(m, /\/send$/)[0];
    expect(send?.body).toMatchObject({ channel: 'auto' });
    await expect(page.locator(`${S} [data-rfq-toast]`)).toContainText('הבקשה נשלחה');
    await shot(page, 'new-sent-board');
  });

  test('contract v0.9 server: vendor page off - only manual contact; the directory decides channel and code; save as draft', async ({ page }) => {
    const m = await go(page, '/tickets/rfqs?new=1', { contract: true });
    const sheet = page.locator(`${S} tickets-rfq-new`);
    await expect(sheet.locator('[data-rfq-new-form]')).toBeVisible();
    await expect(sheet.locator('[data-rfq-files]')).toHaveCount(0); // C2 gap: no attachments route yet
    await sheet.locator('[data-rfq-title]').fill('צביעת לובי');
    await sheet.locator('[data-rfq-vendor="ct-aklim"] input[type="checkbox"]').first().check();
    await expect(sheet.locator('[data-rfq-vendor="ct-aklim"] [data-rfq-channel-ro]')).toBeVisible();
    await expect(sheet.locator('[data-rfq-vendor="ct-aklim"] [data-rfq-channel]')).toHaveCount(0);
    await sheet.locator('[data-rfq-to-send]').click();
    await expect(sheet.locator('[data-rfq-send-mode="auto"] input')).toBeDisabled();
    await expect(sheet.locator('[data-rfq-send-mode="manual"] input')).toBeChecked();
    await shot(page, 'new-confirm-contract', 'light', 'classic', false);
    await sheet.locator('[data-rfq-send-dialog] .btn.quiet').click();
    await sheet.locator('[data-rfq-save-draft]').click();
    await boardReady(page);
    expect(posts(m, /\/send$/)).toHaveLength(0);
    const create = posts(m, /^tickets\/rfqs\/$/)[0];
    expect(create?.body).toMatchObject({ vendors: [{ contact_id: 'ct-aklim' }] });
    expect(JSON.stringify(create?.body)).not.toContain('require_code');
    await expect(page.locator(`${S} tickets-rfq-board [data-rfq-state="draft"]`)).toBeVisible();
    await shot(page, 'board-draft');
  });

  test('vendors board: tiles, the table with states and reasons, the timeline; reminder and message dialogs; light / dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, `/tickets/rfqs?rfq=${RFQ7}`, {}, scheme);
      await boardReady(page);
      const b = page.locator(`${S} tickets-rfq-board`);
      await expect(b.locator('[data-kpi="invited"] b')).toHaveText('6');
      await expect(b.locator('[data-kpi="quoted"] b')).toHaveText('3');
      await expect(b.locator('[data-kpi="lowest"] b')).toContainText('7,500');
      await expect(b.locator('[data-rfq-vendor-row="rv-nm"]')).toContainText('אין זמינות החודש');
      await expect(b.locator('[data-rfq-timeline] li').first()).toBeVisible();
      await shot(page, 'board', scheme);
    }
    const m = await go(page, `/tickets/rfqs?rfq=${RFQ7}`);
    await boardReady(page);
    const b = page.locator(`${S} tickets-rfq-board`);
    await b.locator('[data-rfq-remind-all]').click();
    await expect(b.locator('[data-rfq-dialog="remind"]')).toContainText('2');
    await shot(page, 'board-remind', 'light', 'classic', false);
    expect(posts(m, /remind/)).toHaveLength(0);
    await b.locator('[data-dlg-ok="remind"]').click();
    await expect(page.locator(`${S} [data-rfq-toast]`)).toBeVisible();
    expect(posts(m, /remind/)[0]?.body).toMatchObject({ vendor_ids: ['rv-tz', 'rv-bz'] });
    await b.locator('[data-rfq-vendor-more="rv-alon"]').click();
    await shot(page, 'board-vendor-menu', 'light', 'classic', false);
    await b.locator('[data-vmore="message"]').click();
    const md = b.locator('tickets-rfq-message-dialog');
    await expect(md.locator('[data-rfq-thread]')).toContainText('כולל פינוי');
    await md.locator('[data-rfq-message-text]').fill('האם אפשר להתחיל ביום ראשון?');
    await shot(page, 'board-message', 'light', 'classic', false);
    await md.locator('[data-rfq-message-send]').click();
    await expect(md.locator('[data-rfq-message-dialog]')).toHaveCount(0);
    expect(posts(m, /messages$/)[0]?.body).toMatchObject({ text: 'האם אפשר להתחיל ביום ראשון?', notify: true });
  });

  test('quote on the vendor\'s behalf and decline on behalf (the manual channel)', async ({ page }) => {
    const m = await go(page, `/tickets/rfqs?rfq=${RFQ7}`);
    await boardReady(page);
    const b = page.locator(`${S} tickets-rfq-board`);
    await b.locator('[data-rfq-vendor-more="rv-tz"]').click();
    await b.locator('[data-vmore="quote"]').click();
    const q = b.locator('tickets-rfq-quote-dialog');
    await q.locator('[data-q-line="0"] [data-q-field="hours"]').fill('6');
    await q.locator('[data-q-line="0"] [data-q-field="rate"]').fill('250');
    await q.locator('[data-q-add]').click();
    await q.locator('[data-q-line="1"] [data-q-kind]').selectOption('parts');
    await q.locator('[data-q-line="1"] [data-q-field="description"]').fill('יחידה פנימית');
    await q.locator('[data-q-line="1"] [data-q-field="unit_price"]').fill('5900');
    await expect(q.locator('[data-q-total]')).toContainText('7,400');
    await shot(page, 'board-quote-on-behalf', 'light', 'classic', false);
    await q.locator('[data-q-submit]').click();
    await expect(b.locator('[data-rfq-vendor-row="rv-tz"]')).toHaveAttribute('data-vstate', 'quoted');
    const body = posts(m, /vendors\/rv-tz\/quotes$/)[0]?.body as { lines: Record<string, string>[] };
    expect(body.lines).toEqual([{ kind: 'labor', hours: '6', rate: '250' }, { kind: 'parts', description: 'יחידה פנימית', quantity: '1', unit_price: '5900' }]);
    await b.locator('[data-rfq-vendor-more="rv-bz"]').click();
    await b.locator('[data-vmore="decline"]').click();
    await b.locator('[data-dlg-reason]').fill('לא עובד באזור');
    await b.locator('[data-dlg-ok="decline"]').click();
    await expect(b.locator('[data-rfq-vendor-row="rv-bz"]')).toHaveAttribute('data-vstate', 'declined');
  });

  test('comparison and award: lowest / earliest, scope "labour only", the confirmation, then the drafts - nothing sent by itself', async ({ page }) => {
    const m = await go(page, `/tickets/rfqs?rfq=${RFQ7}&view=compare`);
    await compareReady(page);
    const c = page.locator(`${S} tickets-rfq-compare`);
    await expect(c.locator('[data-cmp-lowest]')).toHaveCount(1);
    await expect(c.locator('[data-cmp-earliest]')).toHaveCount(1);
    await expect(c.locator('[data-cmp-group]')).toHaveCount(1);
    await shot(page, 'compare');
    for (const scheme of ['dark'] as const) {
      await go(page, `/tickets/rfqs?rfq=${RFQ7}&view=compare`, {}, scheme);
      await compareReady(page);
      await shot(page, 'compare', scheme);
    }
    const m2 = await go(page, `/tickets/rfqs?rfq=${RFQ7}&view=compare`);
    await compareReady(page);
    const cols = await c.locator('[data-cmp-pick]').all();
    expect(cols.length).toBe(3);
    // pick the lowest (the price sort puts it first) and approve labour only
    await cols[0].check();
    await c.locator('[data-cmp-scope] [data-scope="labor"]').click();
    await expect(c.locator('[data-cmp-sum]')).toContainText('עבודה בלבד');
    await shot(page, 'compare-picked');
    await c.locator('[data-cmp-approve]').click();
    await expect(c.locator('[data-cmp-confirm]')).toContainText('בסיס העלות');
    await expect(c.locator('[data-cmp-second="off"]')).toBeVisible(); // the maintenance department has no threshold: one approval
    await shot(page, 'compare-confirm', 'light', 'classic', false);
    expect(posts(m2, /awards/)).toHaveLength(0);
    await c.locator('[data-cmp-confirm-ok]').click();
    const drafts = c.locator('[data-cmp-drafts]');
    await expect(c.locator('[data-cmp-drafts] [data-cmp-draft]').first()).toBeVisible();
    await expect(c.locator('[data-draft-kind="winner"] [data-draft-send]')).toBeChecked();
    for (const x of await c.locator('[data-draft-kind="other"] [data-draft-send]').all()) await expect(x).not.toBeChecked();
    await shot(page, 'compare-drafts', 'light', 'classic', false);
    const award = posts(m2, /awards$/)[0];
    expect(award?.body).toMatchObject({ kinds: ['labor'], finalize: true });
    expect(posts(m2, /messages$/)).toHaveLength(0); // the award itself sent nothing
    await c.locator('[data-cmp-draft]').first().locator('[data-draft-text]').fill('שלום, ההצעה אושרה לעבודה בלבד. נתאם מועד.');
    await c.locator('[data-draft-send-all]').click();
    await expect(drafts).toHaveCount(0);
    const msgs = posts(m2, /messages$/);
    expect(msgs).toHaveLength(1); // the winner only - the not-selected drafts stayed unchecked
    expect(msgs[0].body).toMatchObject({ text: 'שלום, ההצעה אושרה לעבודה בלבד. נתאם מועד.', source: { kind: 'award' } });
    void m;
    await page.goto(url(`/tickets/rfqs?rfq=${RFQ7}`));
    await boardReady(page);
    await expect(page.locator(`${S} tickets-rfq-board [data-rfq-awarded]`)).toContainText('ההצעה שנבחרה היא בסיס העלות המאושר');
    await shot(page, 'board-awarded');
  });

  test('another currency stays apart (never summed); above the department threshold the award waits for a second approval', async ({ page }) => {
    const m = await go(page, `/tickets/rfqs?rfq=${RFQ8}&view=compare`);
    await compareReady(page);
    const c = page.locator(`${S} tickets-rfq-compare`);
    await expect(c.locator('[data-cmp-group]')).toHaveCount(2);
    await expect(c.locator('[data-cmp-group="USD"]')).toContainText('מוצגת ולא מדורגת');
    await expect(c.locator('[data-cmp-group="USD"] [data-cmp-lowest]')).toHaveCount(0);
    await shot(page, 'compare-currencies');
    // a split across two currencies: the bar shows each amount apart
    const ils = c.locator('[data-cmp-group="ILS"] [data-cmp-pick]').first();
    await ils.check();
    await c.locator('[data-cmp-group="USD"] [data-cmp-pick]').first().check();
    await expect(c.locator('[data-cmp-currency-note]')).toBeVisible();
    await c.locator('[data-cmp-group="USD"] [data-cmp-pick]').first().uncheck();
    await c.locator('[data-cmp-approve]').click();
    await expect(c.locator('[data-cmp-second="maybe"]')).toBeVisible();
    await shot(page, 'compare-confirm-second', 'light', 'classic', false);
    await c.locator('[data-cmp-confirm-ok]').click();
    await expect(c.locator('[data-cmp-drafts]')).toHaveCount(0); // pending: no draft, the vendor sees nothing
    await expect(page.locator(`${S} [data-rfq-toast]`)).toContainText('אישור שני');
    await page.goto(url(`/tickets/rfqs?rfq=${RFQ8}`));
    await boardReady(page);
    const b = page.locator(`${S} tickets-rfq-board`);
    await expect(b.locator('[data-rfq-pending-second]')).toBeVisible();
    await shot(page, 'board-pending-second');
    await b.locator('[data-rfq-second-confirm]').click();
    await expect(b.locator('[data-rfq-awarded]')).toBeVisible();
    expect(posts(m, /confirm$/)).toHaveLength(1);
  });

  test('without the cost permission: no amounts on the board, the comparison is refused', async ({ page }) => {
    await go(page, `/tickets/rfqs?rfq=${RFQ7}`, { noAmounts: true });
    await boardReady(page);
    const b = page.locator(`${S} tickets-rfq-board`);
    await expect(b.locator('[data-kpi="lowest"]')).toHaveCount(0);
    await expect(b.locator('[data-rfq-compare-n]')).toHaveCount(0);
    await shot(page, 'board-no-amounts');
    await page.goto(url(`/tickets/rfqs?rfq=${RFQ7}&view=compare`));
    await page.waitForSelector(`${S} tickets-rfq-compare [data-phase="forbidden"]`);
  });

  test('close and cancel ask first; cancel offers the short notice to vendors who quoted', async ({ page }) => {
    const m = await go(page, `/tickets/rfqs?rfq=${RFQ7}`);
    await boardReady(page);
    const b = page.locator(`${S} tickets-rfq-board`);
    await b.locator('[data-rfq-more]').click();
    await shot(page, 'board-more', 'light', 'classic', false);
    await b.locator('[data-more="cancel"]').click();
    await expect(b.locator('[data-cancel-notify]')).toBeChecked();
    await shot(page, 'board-cancel', 'light', 'classic', false);
    await b.locator('[data-dlg-reason]').fill('התקציב הוקפא');
    await b.locator('[data-dlg-ok="cancel"]').click();
    await expect(b.locator('[data-rfq-state="cancelled"]')).toBeVisible();
    expect(posts(m, /cancel$/)[0]?.body).toMatchObject({ notify: true, reason: 'התקציב הוקפא' });
  });
});
