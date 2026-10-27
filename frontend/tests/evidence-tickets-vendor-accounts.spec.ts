import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url, type Persona } from './tickets-mocks';
import { drawnSkin } from './helpers/frozen-skins';

// TK258 evidence: "חשבון ספקים" (#/tickets/accounts) - the REAL build against a fake API (invented vendors and amounts only): per
// vendor and currency what is to pay / paid / awaiting approval (two currencies, never added up), the claims with links, the filters
// as the server's query, the bulk "mark as paid" (a summary per currency, a result per item), the CSV of the filter, and the empty /
// loading / error / forbidden states. Desktop 1440 and phone 390, light and dark.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-vendor-accounts.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-vendor-accounts');
const S = 'sw-app tickets-vendor-accounts';
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

interface Row {
  claim_id: string; ticket_id: string; number: number; title: string; department_id: string; department: string; vendor_key: string; vendor: string;
  status: 'submitted' | 'approved' | 'paid'; currency: string; amount_minor: number; revision: number; submitted_at: string; approved_at: string | null;
  paid_at: string | null; payment_date: string | null; payment_ref: string | null; period_at: string; can_mark_paid: boolean;
}

function rows(canMark: boolean): Row[] {
  const mk = (i: number, vk: string, v: string, dept: [string, string], status: Row['status'], currency: string, minor: number, title: string): Row => {
    const at = `2026-10-${String(10 - (i % 9)).padStart(2, '0')}T08:00:00Z`;
    return {
      claim_id: `claim0000000000${i}`, ticket_id: `000000000000c0${String(i).padStart(2, '0')}`, number: 1200 + i, title, department_id: dept[0], department: dept[1],
      vendor_key: vk, vendor: v, status, currency, amount_minor: minor, revision: 3, submitted_at: at, approved_at: status === 'submitted' ? null : at,
      paid_at: status === 'paid' ? at : null, payment_date: status === 'paid' ? at.slice(0, 10) : null, payment_ref: status === 'paid' ? 'העברה 100' : null, period_at: at,
      can_mark_paid: canMark && status === 'approved',
    };
  };
  const m: [string, string] = ['dept-maintenance', 'אחזקה'];
  const c: [string, string] = ['dept-cleaning', 'ניקיון'];
  return [
    mk(1, 'v-north', 'קירור הצפון', m, 'approved', 'ILS', 138_709, 'החלפת מסנן מזגן - חדר ישיבות'),
    mk(2, 'v-north', 'קירור הצפון', m, 'approved', 'ILS', 42_480, 'מזגן לא מקרר - חדר 102'),
    mk(3, 'v-north', 'קירור הצפון', m, 'submitted', 'ILS', 21_240, 'בדיקת מדחס'),
    mk(4, 'v-oren', 'חשמל אורן', m, 'paid', 'ILS', 141_600, 'נורה מהבהבת בלובי'),
    mk(5, 'v-oren', 'חשמל אורן', c, 'approved', 'ILS', 35_400, 'שקע שרוף במטבחון'),
    mk(6, 'v-atlas', 'Atlas Elevators', m, 'approved', 'USD', 120_000, 'טיפול תקופתי במעלית'),
    mk(7, 'v-atlas', 'Atlas Elevators', m, 'paid', 'USD', 80_000, 'החלפת כבל מעלית'),
  ];
}

interface Opts { persona?: Persona; perms?: string[]; empty?: boolean; fail?: boolean; slow?: boolean; staleClaim?: string }
interface Fake { calls: { method: string; path: string; body: unknown }[]; rows: Row[] }

async function go(page: Page, o: Opts = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<Fake> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const perms = o.perms ?? ['tickets.costs.view', 'tickets.costs'];
  await installTicketsMock(page, { persona: o.persona ?? 'admin', name: NAME, extraPerms: perms });
  const fake: Fake = { calls: [], rows: o.empty ? [] : rows(perms.includes('tickets.costs')) };
  let failing = !!o.fail;
  // registered after the tickets mock, so it answers the cost routes first
  await page.route('**/api/v1/tickets/costs/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/^.*\/api\/v1\//, '');
    const body: unknown = req.method() === 'POST' ? req.postDataJSON() : null;
    fake.calls.push({ method: req.method(), path: p + u.search, body });
    if (p === 'tickets/costs/claims') {
      if (!perms.includes('tickets.costs.view')) return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'mock', details: {} }, 403);
      if (failing) {
        failing = false;
        return json(route, { code: 'internal', user_message: 'שגיאה בשרת', retryable: true, correlation_id: 'mock', details: {} }, 500);
      }
      if (o.slow) await new Promise((r) => setTimeout(r, 2500));
      const q = u.searchParams;
      const st = q.get('status')?.split(',');
      const base = fake.rows.filter((r) => (!st || st.includes(r.status)) && (!q.get('currency') || r.currency === q.get('currency')));
      const out = base.filter((r) => (!q.get('vendor') || r.vendor_key === q.get('vendor')) && (!q.get('department') || r.department_id === q.get('department')));
      const vendors = [...new Map(base.map((r) => [r.vendor_key, r.vendor])).entries()].map(([key, label]) => ({ key, label }));
      const departments = [...new Map(base.map((r) => [r.department_id, r.department])).entries()].map(([id, name]) => ({ id, name }));
      return json(route, { rows: out, truncated: false, vendors, departments, can_mark_paid: perms.includes('tickets.costs') });
    }
    if (p === 'tickets/costs/mark-paid') {
      const b = body as { items: { ticket_id: string; claim_id: string; revision: number }[]; payment_ref: string; payment_date: string };
      const results = b.items.map((it) => {
        const r = fake.rows.find((x) => x.claim_id === it.claim_id);
        if (!r) return { ...it, result: 'not_found' };
        if (it.claim_id === o.staleClaim) return { ...it, number: r.number, result: 'stale', revision: r.revision + 1 };
        Object.assign(r, { status: 'paid', paid_at: '2026-10-13T09:00:00Z', payment_ref: b.payment_ref, payment_date: b.payment_date, can_mark_paid: false, revision: r.revision + 1 });
        return { ...it, number: r.number, result: 'paid', revision: r.revision };
      });
      const paid = results.filter((x) => x.result === 'paid').length;
      return json(route, { results, paid, already_paid: 0, failed: results.length - paid });
    }
    if (p === 'tickets/costs/export.csv') {
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="ticket-costs-20261013-0942.csv"' },
        body: '﻿"ספק","סה״כ"\r\n"\'=HYPERLINK(1)","1.00"\r\n' });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  await page.goto('about:blank');
  await page.goto(url('/tickets/accounts', skin, scheme));
  return fake;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`), fullPage: true });
}

const last = (f: Fake, method: string, re: RegExp) => [...f.calls].reverse().find((c) => c.method === method && re.test(c.path));
const ready = (page: Page) => page.waitForSelector(`${S} [data-va-state="ready"]`);

test.describe('vendors account (TK258)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(180_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('ready: a block per currency, never added up; light / dark; the tab is active', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, {}, scheme);
      await ready(page);
      await expect(page.locator(`${S} [data-va-currency-block]`)).toHaveCount(2);
      const ils = page.locator(`${S} [data-va-currency-block="ILS"]`);
      const usd = page.locator(`${S} [data-va-currency-block="USD"]`);
      // ILS to pay: 1,387.09 + 424.80 + 354.00 = 2,165.89 ; USD to pay: 1,200.00 - each in its own block
      await expect(ils.locator('sw-table tr[data-row-id="total:ILS"]')).toContainText('2,165.89');
      await expect(usd.locator('sw-table tr[data-row-id="total:USD"]')).toContainText('1,200.00');
      await expect(ils).not.toContainText('3,365.89');
      await expect(page.locator(`${S} sw-table[data-va-claims] tr[data-row-id]`)).toHaveCount(7);
      await shot(page, 'ready', scheme);
    }
    await go(page, {}, 'light', drawnSkin('bubble')); // BUBBLE-FREEZE-295: domus while frozen
    await ready(page);
    await shot(page, 'ready', 'light', drawnSkin('bubble'));
  });

  test('each row links to its item', async ({ page }) => {
    await go(page);
    await ready(page);
    await expect(page.locator(`${S} [data-va-link="000000000000c001"]`)).toHaveAttribute('href', '#/tickets/000000000000c001');
    await expect(page.locator(`${S} [data-va-link="000000000000c001"]`)).toHaveText('#1201');
  });

  test('the filters are the server query; a vendor row narrows to that vendor', async ({ page }) => {
    const f = await go(page);
    await ready(page);
    await page.locator(`${S} [data-va-status]`).selectOption('due');
    await expect.poll(() => last(f, 'GET', /costs\/claims/)?.path).toContain('status=approved');
    await page.locator(`${S} [data-va-currency]`).selectOption('USD');
    await expect.poll(() => last(f, 'GET', /costs\/claims/)?.path).toContain('currency=USD');
    await expect(page.locator(`${S} [data-va-currency-block]`)).toHaveCount(1);
    await page.locator(`${S} [data-va-currency]`).selectOption('');
    await page.locator(`${S} [data-va-status]`).selectOption('');
    await page.locator(`${S} [data-va-department]`).selectOption('dept-cleaning');
    await expect.poll(() => last(f, 'GET', /costs\/claims/)?.path).toContain('department=dept-cleaning');
    await page.locator(`${S} [data-va-department]`).selectOption('');
    await page.locator(`${S} [data-va-from]`).fill('2026-10-01');
    await page.locator(`${S} [data-va-from]`).dispatchEvent('change');
    await expect.poll(() => last(f, 'GET', /costs\/claims/)?.path).toContain('from=2026-10-01');
    await page.locator(`${S} [data-va-currency-block="ILS"] tr[data-row-id="v:v-oren"]`).click();
    await expect.poll(() => last(f, 'GET', /costs\/claims/)?.path).toContain('vendor=v-oren');
    await expect(page.locator(`${S} [data-va-vendor]`)).toHaveValue('v-oren');
  });

  test('bulk mark as paid: a sum per currency, the revisions sent, a result per item', async ({ page }) => {
    const f = await go(page, { staleClaim: 'claim00000000002' });
    await ready(page);
    await expect(page.locator(`${S} [data-va-mark]`)).toHaveAttribute('disabled', '');
    // approved rows only carry a box
    await expect(page.locator(`${S} [data-va-select]`)).toHaveCount(4);
    // UXFIX-A11Y-295: the checkbox sits in a 44 px label (sw-hit) whose hit ring covers it on touch; a tap lands on the label, which toggles it
    for (const id of ['claim00000000001', 'claim00000000002', 'claim00000000006']) await page.locator(`${S} [data-va-select="${id}"]`).check({ force: true });
    await page.locator(`${S} [data-va-mark]`).click();
    const dlg = page.locator(`${S} sw-dialog[data-va-dialog]`);
    await expect(dlg.locator('[data-va-sum]')).toHaveCount(2);
    await expect(dlg.locator('[data-va-sum="ILS"]')).toContainText('1,811.89');
    await expect(dlg.locator('[data-va-sum="USD"]')).toContainText('1,200.00');
    await expect(dlg.locator('[data-va-confirm]')).toHaveAttribute('disabled', '');
    await dlg.locator('[data-va-ref]').fill('העברה 7781');
    if (test.info().project.name === 'mobile') await shot(page, 'dialog');
    await dlg.locator('[data-va-confirm]').click();
    await expect.poll(() => last(f, 'POST', /costs\/mark-paid/)?.body).toMatchObject({
      payment_ref: 'העברה 7781',
      items: [{ claim_id: 'claim00000000001', revision: 3 }, { claim_id: 'claim00000000002', revision: 3 }, { claim_id: 'claim00000000006', revision: 3 }],
    });
    await expect(page.locator(`${S} [data-va-ok]`)).toContainText('2');
    await expect(page.locator(`${S} [data-va-error]`)).toContainText('#1202');
    await expect(page.locator(`${S} [data-va-select="claim00000000001"]`)).toHaveCount(0);
    await shot(page, 'after-paid');
  });

  test('CSV of the current filter', async ({ page }) => {
    const f = await go(page);
    await ready(page);
    await page.locator(`${S} [data-va-currency]`).selectOption('ILS');
    await expect.poll(() => last(f, 'GET', /costs\/claims/)?.path).toContain('currency=ILS');
    const dl = page.waitForEvent('download');
    await page.locator(`${S} [data-va-csv]`).click();
    expect((await dl).suggestedFilename()).toBe('ticket-costs-20261013-0942.csv');
    const call = last(f, 'GET', /costs\/export\.csv/)?.path ?? '';
    expect(call).toContain('group_by=vendor');
    expect(call).toContain('currency=ILS');
    expect(call).toContain('rows=claim');
  });

  test('view only: no boxes and no bulk action', async ({ page }) => {
    await go(page, { perms: ['tickets.costs.view'] });
    await ready(page);
    await expect(page.locator(`${S} [data-va-select]`)).toHaveCount(0);
    await expect(page.locator(`${S} [data-va-mark]`)).toHaveCount(0);
    await expect(page.locator(`${S} [data-va-csv]`)).toBeVisible();
  });

  test('states: loading, empty, error with retry, forbidden', async ({ page }) => {
    await go(page, { slow: true });
    await page.waitForSelector(`${S} [data-va-state="loading"]`);
    await shot(page, 'loading');
    await go(page, { empty: true });
    await page.waitForSelector(`${S} [data-va-state="empty"]`);
    await shot(page, 'empty');
    await go(page, { fail: true });
    await page.waitForSelector(`${S} [data-va-state="error"]`);
    await shot(page, 'error');
    await page.locator(`${S} sw-state-panel[data-va-state="error"] sw-button`).click();
    await ready(page);
    await go(page, { perms: [] });
    await page.waitForSelector(`${S} [data-va-state="forbidden"]`);
    await shot(page, 'forbidden', 'dark');
  });
});
