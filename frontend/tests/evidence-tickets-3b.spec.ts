import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKINS, url } from './tickets-mocks';
import { CID, installCostsTabMock, type CostsMock, type Scenario } from './tickets-costs-tab-mocks';

// TKUI3B (2.6.x) evidence, from the REAL build against the mock layer (fake data only):
//   1. the internal owner ("אחראי בארגון") on the drawer's Overview - the card, the picker over the one assignee list, the plain
//      confirmation, PUT /tickets/{id}/owner with the request's revision; "no owner yet" for a manager; none on a closed request;
//   2. a quote a manager enters ON THE VENDOR'S BEHALF from the Costs tab - the empty quote stage, the card's "…" menu, the line editor (only
//      the allowed kinds, labour always), the VAT mode, the optional work window, the plain "another person has to approve it" notice, and
//      the self-approval rule (the viewer's own entry has no approve); never for a staff assignment or a closed request.
// Desktop 1440 and phone 390, light and dark, the five skins. Screenshots: docs/design/evidence/tickets-ui3b/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-3b.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-ui3b');
const L = 'sw-app tickets-list ticket-detail';
const T = `${L} ticket-costs-tab`;
const FORM = `${T} ticket-quote-form`;
const OWNER_DLG = `${L} sw-dialog[data-dialog="owner"]`;
const people = `${L} [data-ov="people"]`;

async function open(page: Page, scenario: Scenario, tab: 'overview' | 'costs', scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<CostsMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installCostsTabMock(page, scenario);
  await page.goto('about:blank');
  await page.goto(url(`/tickets/all?t=${CID}&tab=${tab}`, skin, scheme));
  if (tab === 'costs') await page.locator(`${T} [data-costs-tab]:not([data-costs-state="loading"])`).waitFor();
  else await page.locator(people).waitFor();
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`) });
}

/** A `datetime-local` value `days` from now in the browser's zone (the same clock the server-side window check follows). */
function local(days: number, hour = 9): string {
  const d = new Date(Date.now() + days * 86_400_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(hour)}:00`;
}

/** A `YYYY-MM-DD` date input value `days` from today in the browser's zone. */
function day(days: number): string {
  return local(days).slice(0, 10);
}

const posts = (m: CostsMock, re: RegExp) => m.calls.filter((c) => re.test(c.path));

test.describe('TKUI3B evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  // ------------------------------------------------------------ the internal owner

  test('owner: the card in People, the picker over the one assignee list, a plain confirmation, PUT with the revision', async ({ page }) => {
    for (const skin of SKINS)
      for (const scheme of ['light', 'dark'] as const) {
        await open(page, 'quote', 'overview', scheme, skin);
        if (skin === 'classic' || skin === 'domus' || scheme === 'light') await shot(page, 'owner-card', scheme, skin);
      }
    const m = await open(page, 'quote', 'overview');
    const card = page.locator(`${people} [data-person="owner"]`);
    await expect(card).toContainText('דנה פרץ');
    await expect(card).toContainText('אחראי בארגון');
    await page.locator(`${people} [data-ov-owner-change]`).click();
    const dlg = page.locator(OWNER_DLG);
    await expect(dlg.locator('[data-owner-help]')).toContainText('אינו המטפל');
    // the one assignee list: account holders, the current owner first and marked; nothing is picked yet, so nothing can be saved
    await expect(dlg.locator('[data-owner-choice]').first()).toHaveAttribute('data-owner-choice', 'u-dana');
    await expect(dlg.locator('[data-owner-choice="u-dana"]')).toContainText('האחראי הנוכחי');
    await expect(dlg.locator('[data-owner-choice="none"]')).toContainText('ללא אחראי');
    await expect(dlg.locator('[data-dialog-ok]')).toBeDisabled();
    await dlg.locator('[data-owner-choice="u-dana"] input').check();
    await expect(dlg.locator('[data-dialog-ok]')).toBeDisabled(); // the owner stays: nothing to save
    await dlg.locator('[data-owner-choice="u-avi"] input').check();
    await expect(dlg.locator('[data-owner-confirm]')).toContainText('האחראי בארגון יהיה אבי כהן');
    await dlg.locator('[data-owner-reason]').fill('עבר לטפל בנושא המיזוג');
    await shot(page, 'owner-dialog');
    await dlg.locator('[data-dialog-ok]').click();
    await expect(page.locator(OWNER_DLG)).toHaveCount(0);
    expect(posts(m, /\/owner$/).find((c) => c.method === 'PUT')?.body).toEqual({ user_id: 'u-avi', reason: 'עבר לטפל בנושא המיזוג', revision: 5 });
    await expect(card).toContainText('אבי כהן');
    await expect(page.locator(`${L} [data-flash]`)).toContainText('האחראי בארגון עודכן');
    // the handler is not touched by an owner change
    expect(m.calls.filter((c) => /\/assign$/.test(c.path))).toHaveLength(0);
  });

  test('owner: "no owner" is a choice; a manager sees "no owner yet" with a button; a closed request offers no change', async ({ page }) => {
    const m = await open(page, 'quote', 'overview');
    await page.locator(`${people} [data-ov-owner-change]`).click();
    const dlg = page.locator(OWNER_DLG);
    await dlg.locator('[data-owner-choice="none"] input').check();
    await expect(dlg.locator('[data-owner-confirm]')).toContainText('לא יהיה אחראי בארגון');
    await dlg.locator('[data-dialog-ok]').click();
    await expect.poll(() => posts(m, /\/owner$/).find((c) => c.method === 'PUT')?.body).toEqual({ user_id: null, revision: 5 });
    await expect(page.locator(`${people} [data-owner="none"]`)).toContainText('אין עדיין אחראי בארגון');
    await expect(page.locator(`${people} [data-ov-owner-change]`)).toHaveText(/קביעת אחראי/);
    await shot(page, 'owner-none');
    // setting one again
    await page.locator(`${people} [data-ov-owner-change]`).click();
    await page.locator(`${OWNER_DLG} [data-owner-choice="u-yossi"] input`).check();
    await page.locator(`${OWNER_DLG} [data-dialog-ok]`).click();
    await expect(page.locator(`${people} [data-person="owner"]`)).toContainText('יוסי מזרחי');
    // a closed request: the owner is shown, the change is not offered
    await open(page, 'closed', 'overview');
    await expect(page.locator(`${people} [data-person="owner"]`)).toContainText('דנה פרץ');
    await expect(page.locator(`${people} [data-ov-owner-change]`)).toHaveCount(0);
  });

  test('owner: a stale revision is answered in the dialog and the request is re-read', async ({ page }) => {
    const m = await open(page, 'quote', 'overview');
    await page.locator(`${people} [data-ov-owner-change]`).click();
    const dlg = page.locator(OWNER_DLG);
    await dlg.locator('[data-owner-choice="u-avi"] input').check();
    // someone else changed the owner meanwhile: the mock's revision moves under the open dialog
    await page.evaluate(async (id) => { await fetch(`/api/v1/tickets/${id}/owner`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: 'u-yossi', revision: 5 }) }); }, CID);
    await dlg.locator('[data-dialog-ok]').click();
    await expect(dlg.locator('[data-dialog-error]')).toContainText('השתנתה בינתיים');
    expect(posts(m, /\/owner$/).filter((c) => c.method === 'PUT').length).toBe(2);
  });

  // ------------------------------------------------------------ a quote on the vendor's behalf

  test('on behalf: the empty quote stage offers it; allowed kinds only, labour on, VAT mode, work window, the plain notice', async ({ page }) => {
    for (const skin of SKINS)
      for (const scheme of ['light', 'dark'] as const) {
        await open(page, 'empty', 'costs', scheme, skin);
        await page.locator(`${T} [data-ob-entry]`).click();
        await page.locator(`${FORM} [data-ob-notice]`).waitFor();
        if (skin === 'classic' || skin === 'domus' || scheme === 'light') await shot(page, 'onbehalf-dialog', scheme, skin);
      }
    const m = await open(page, 'empty', 'costs');
    await page.locator(`${T} [data-ob-entry]`).click();
    const f = page.locator(FORM);
    await expect(f.locator('[data-ob-notice]')).toContainText('אדם אחר צריך לאשר אותה');
    await expect(f.locator('[data-ob-notice]')).toContainText('קירור הצפון');
    // the department allows labour + parts: the kind list has exactly those, labour first and on the first line
    await expect(f.locator('[data-line="0"] [data-line-kind-select] option')).toHaveText(['עבודה', 'חלקים']);
    await expect(f.locator('[data-line="0"]')).toHaveAttribute('data-line-kind', 'labor');
    // an empty line is refused before anything is sent
    await f.locator('[data-dialog-ok]').click();
    await expect(f.locator('[data-ob-error]')).toContainText('שורה אחת תקינה');
    expect(posts(m, /\/quotes$/)).toHaveLength(0);
    const rows = f.locator('[data-line="0"]');
    await rows.locator('[data-line-field="hours"]').fill('3');
    await rows.locator('[data-line-field="rate"]').fill('200');
    await f.locator('[data-line-add]').click();
    const second = f.locator('[data-line="1"]');
    await expect(second).toHaveAttribute('data-line-kind', 'parts');
    await second.locator('[data-line-field="description"]').fill('מדחס רוטורי');
    await second.locator('[data-line-field="unit_price"]').fill('950');
    await expect(f.locator('[data-preview-net]')).toContainText('1,550');
    await f.locator('[data-ob-vat="included"]').click();
    await expect(f.locator('[data-ob-vat="included"]')).toHaveAttribute('aria-checked', 'true');
    // the work window: the end before the start, then outside the allowed range, then fine
    await f.locator('[data-ob-work-from]').fill(local(3));
    await f.locator('[data-ob-work-to]').fill(local(2));
    await f.locator('[data-dialog-ok]').click();
    await expect(f.locator('[data-ob-work-error]')).toContainText('לפני התחלתה');
    await f.locator('[data-ob-work-to]').fill(local(800));
    await expect(f.locator('[data-ob-work-error]')).toContainText('מחוץ לטווח');
    await shot(page, 'onbehalf-error');
    await f.locator('[data-ob-work-to]').fill(local(3, 15));
    // TKQVALID: the validity - a bad one is refused in place, a day within the range is sent as the end of that day
    await expect(f.locator('[data-ob-valid-hint]')).toBeVisible();
    await f.locator('[data-ob-valid-until]').fill(day(500));
    await f.locator('[data-dialog-ok]').click();
    await expect(f.locator('[data-ob-valid-error]')).toContainText('שנה קדימה');
    expect(posts(m, /\/quotes$/)).toHaveLength(0);
    await f.locator('[data-ob-valid-until]').fill(day(-5));
    await expect(f.locator('[data-ob-valid-error]')).toBeVisible();
    await shot(page, 'onbehalf-valid-error');
    await f.locator('[data-ob-valid-until]').fill(day(14));
    await expect(f.locator('[data-ob-valid-error]')).toHaveCount(0);
    await f.locator('[data-ob-note]').fill('הוזן לפי שיחת טלפון');
    await f.locator('[data-dialog-ok]').click();
    await expect(page.locator(FORM)).toHaveCount(0);
    const body = posts(m, /\/quotes$/)[0].body as Record<string, unknown>;
    expect(body).toMatchObject({ assignment_id: 'asg-v', amounts_include_vat: true, note: 'הוזן לפי שיחת טלפון' });
    expect(body.lines).toEqual([{ kind: 'labor', hours: '3', rate: '200' }, { kind: 'parts', description: 'מדחס רוטורי', quantity: '1', unit_price: '950' }]);
    expect(String(body.work_from)).toMatch(/Z$/);
    expect(Object.keys(body).sort()).toEqual(['amounts_include_vat', 'assignment_id', 'lines', 'note', 'valid_until', 'work_from', 'work_to']);
    expect(String(body.valid_until)).toMatch(/Z$/);
    // the quote is on the card as entered by the manager, and the viewer is told plainly that someone else must approve it
    const t = page.locator(T);
    await expect(t.locator('[data-quote-by-manager]')).toContainText('רונית לוי');
    await expect(t.locator('[data-valid-until]')).toBeVisible();
    await expect(t.locator('[data-quote-expired-chip]')).toHaveCount(0);
    await expect(t.locator('[data-costs-flash]')).toContainText('אדם אחר צריך לאשר אותה');
    await expect(t.locator('[data-quote-own]')).toContainText('אדם אחר צריך לאשר');
    await expect(t.locator('[data-quote-approve]')).toHaveCount(0);
    await expect(t.locator('[data-quote-partial]')).toHaveCount(0);
    await shot(page, 'onbehalf-entered');
  });

  test('on behalf: the menu of the vendor\'s own quote offers a new version, which replaces the pending one', async ({ page }) => {
    const m = await open(page, 'quote', 'costs');
    const t = page.locator(T);
    await expect(t.locator('[data-quote-approve]')).toBeVisible(); // a vendor's quote can be approved by this manager
    await t.locator('[data-quote-more]').click();
    await shot(page, 'onbehalf-menu');
    await t.locator('[data-quote-on-behalf]').click();
    const f = page.locator(FORM);
    await expect(f.locator('[data-ob-replaces]')).toBeVisible();
    await f.locator('[data-line="0"] [data-line-field="hours"]').fill('2');
    await f.locator('[data-line="0"] [data-line-field="rate"]').fill('150');
    await f.locator('[data-dialog-ok]').click();
    await expect(page.locator(FORM)).toHaveCount(0);
    expect(posts(m, /\/quotes$/)).toHaveLength(1);
    await expect(t.locator('[data-quote-state="submitted"]')).toHaveCount(1);
    await expect(t.locator('[data-quote-by-manager]')).toBeVisible();
    await expect(t.locator('[data-quote-older] [data-older-quote]')).toHaveCount(2);
  });

  test('on behalf: a quote the viewer entered has no approve; a correction request is still possible; the server rule is shown if reached', async ({ page }) => {
    const m = await open(page, 'own', 'costs');
    const t = page.locator(T);
    await expect(t.locator('[data-quote-by-manager]')).toContainText('רונית לוי');
    await expect(t.locator('[data-quote-own]')).toContainText('את ההצעה הזנת בעצמך');
    await expect(t.locator('[data-quote-approve]')).toHaveCount(0);
    await expect(t.locator('[data-quote-partial]')).toHaveCount(0);
    await expect(t.locator('[data-quote-fix]')).toBeVisible();
    await shot(page, 'onbehalf-own');
    // the server refuses anyway (409 self_approval): the plain message appears in the dialog
    await page.evaluate(async (id) => {
      const r = await fetch(`/api/v1/tickets/${id}/quotes/q-7/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: 1 }) });
      (window as unknown as { __status: number }).__status = r.status;
    }, CID);
    expect(await page.evaluate(() => (window as unknown as { __status: number }).__status)).toBe(409);
    expect(posts(m, /q-7\/approve$/)).toHaveLength(1);
    // the entry stays available from the menu (a new version is another entry by the same person)
    await t.locator('[data-quote-more]').click();
    await expect(t.locator('[data-quote-on-behalf]')).toBeVisible();
  });

  test('validity: a quote past its valid-until shows the chip; approving it asks for the explicit sentence, never blocked silently', async ({ page }) => {
    const m = await open(page, 'expired', 'costs');
    const t = page.locator(T);
    await expect(t.locator('[data-quote-expired-chip]')).toBeVisible();
    await expect(t.locator('[data-valid-until]')).toBeVisible();
    await expect(t.locator('[data-quote-approve]')).toBeEnabled(); // nothing is hidden or disabled by the expiry
    await shot(page, 'validity-expired-card');
    await t.locator('[data-quote-approve]').click();
    const dlg = page.locator(`${T} sw-dialog[data-dialog="quote-approve"]`);
    await expect(dlg.locator('[data-quote-expired-confirm]')).toContainText('אני מאשר/ת הצעה שתוקפה פג');
    await shot(page, 'validity-expired-dialog');
    await dlg.locator('[data-dialog-ok]').click(); // without the tick: a plain message in the dialog, nothing is sent
    await expect(dlg.locator('[data-quote-error]')).toContainText('לסמן את האישור');
    expect(posts(m, /q-8\/approve$/)).toHaveLength(0);
    await dlg.locator('[data-quote-expired-ok]').check();
    await dlg.locator('[data-dialog-ok]').click();
    await expect.poll(() => posts(m, /q-8\/approve$/).length).toBe(1);
    expect(posts(m, /q-8\/approve$/)[0].body).toMatchObject({ revision: 1, confirm_expired: true });
  });

  test('validity: rejecting or sending back an expired quote needs no confirmation, and a quote with a future validity shows no chip', async ({ page }) => {
    const m = await open(page, 'expired', 'costs');
    const t = page.locator(T);
    await t.locator('[data-quote-fix]').click();
    const dlg = page.locator(`${T} sw-dialog[data-dialog="quote-fix"]`);
    await expect(dlg.locator('[data-quote-expired-confirm]')).toHaveCount(0);
    await dlg.locator('textarea').first().fill('נא לחדש את ההצעה');
    await dlg.locator('[data-dialog-ok]').click();
    await expect.poll(() => posts(m, /q-8\/request-fix$/).length).toBe(1);
    expect(posts(m, /q-8\/request-fix$/)[0].body).not.toHaveProperty('confirm_expired');
    await open(page, 'quote', 'costs');
    await expect(page.locator(T).locator('[data-quote-expired-chip]')).toHaveCount(0);
  });

  test('on behalf: never for a staff assignment, never for a closed request', async ({ page }) => {
    for (const scenario of ['staff', 'closed'] as const) {
      await open(page, scenario, 'costs');
      const t = page.locator(T);
      for (const sel of ['[data-ob-entry]', '[data-quote-on-behalf]', 'ticket-quote-form']) await expect(t.locator(sel), `${scenario} ${sel}`).toHaveCount(0);
    }
    // a vendor request that is approved already: the quote stage is closed for entries too
    await open(page, 'demand', 'costs');
    await expect(page.locator(`${T} [data-ob-entry], ${T} [data-quote-on-behalf]`)).toHaveCount(0);
  });
});
