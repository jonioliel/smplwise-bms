import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './tickets-mocks';
import { installBoardMock } from './tickets-board-mocks';

// MGRDASH phase 4 evidence (DASH45-290): the payments card (GET /tickets/dashboard/payments) of the manager overview, the payment rows of
// "overdue" (card 9) and "the next two weeks" (card 10), against the board's mock layer plus mocked summary / payments answers (invented
// data, no real person). Desktop 1440 and phone 390, light and dark. Asserts: the three groups, the late / due chips, amounts, the links
// (an instalment opens its request, a demand the request's costs tab), the overdue row, the agenda's payment date, no card without the
// payment permissions, "not available" when the payments route fails, no horizontal scroll. Writes screenshots to
// docs/design/evidence/dash4.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-overview-p4.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/dash4');
const O = 'sw-app tickets-overview';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = Date.parse('2026-10-13T10:42:00Z');
const at = (h: number) => new Date(NOW + h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
const day = (d: number) => new Date(NOW + d * 86_400_000).toISOString().slice(0, 10);
const PAY = ['tickets.costs.view', 'tickets.costs'];

function summary(dept: string | null) {
  const first = new Date(NOW - 13 * 86_400_000);
  const days = Array.from({ length: 14 }, (_, i) => ({ date: new Date(first.getTime() + i * 86_400_000).toISOString().slice(0, 10), opened: 0, closed: 0 }));
  const g = { count: 0, items: [] };
  return { period: '7d', days: 7, since: at(-168), now: at(0), department_id: dept, throughput: { rows: [], total: { done: 0, closed: 0, returned: 0, median_seconds: null } },
    daily: { days, net: 0, since: first.toISOString() }, approvals: { quotes: g, claims: g, second: g }, rfqs: { count: 0, decide: 0, questions: 0, items: [] },
    departments: null, all_departments: false, truncated: false, generated_at: at(0) };
}

const inst = (n: number, ref: number, title: string, vendor: string, kind: string, days: number, amount: number, demand = 'none') => ({
  id: `aw${ref}:${n}`, kind: 'instalment', award_id: `aw${ref}`, index: n, instalment_kind: kind, rfq: { id: `r${ref}`, number: ref, ref: `RFQ-0${ref}`, title },
  department_id: 'dept-maintenance', vendor, due_date: day(days), days, demand, moved: false, amount_minor: amount, currency: 'ILS' });

function payments(dept: string | null) {
  return {
    schedule_on: true, today: day(0), department_id: dept,
    overdue: { count: 1, items: [inst(0, 5, 'צביעת חדר המדרגות הצפוני', 'צבעי הגליל', 'advance', -3, 141000, 'open')] },
    upcoming: { count: 3, tomorrow: 1, items: [inst(1, 5, 'צביעת חדר המדרגות הצפוני', 'צבעי הגליל', 'progress', 1, 188000),
      inst(0, 7, 'החלפת מזגן בחדר הישיבות (קומה 2)', 'קליימה-טק מיזוג אוויר', 'advance', 4, 72000),
      inst(1, 7, 'החלפת מזגן בחדר הישיבות (קומה 2)', 'קליימה-טק מיזוג אוויר', 'final', 11, 168000)] },
    claims: { count: 1, items: [{ id: 'c1', kind: 'claim', ticket: { id: 't000000000000003', number: 1038, title: 'ניקוי חלונות חזית' }, department_id: 'dept-maintenance',
      vendor: 'שירותי ניקיון הצפון', since: at(-50), instalment_index: null, amount_minor: 390000, currency: 'ILS' }] },
    generated_at: at(0),
  };
}

async function go(page: Page, o: { pay?: boolean; fails?: boolean } = {}, scheme: 'light' | 'dark' = 'light'): Promise<string[]> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.clock.setFixedTime(new Date(NOW));
  await installBoardMock(page, { extraPerms: o.pay === false ? [] : PAY });
  const calls: string[] = [];
  await page.route('**/api/v1/tickets/contacts**', (route) => json(route, { contacts: [] }));
  await page.route('**/api/v1/tickets/handler-load**', (route) => json(route, { days: 7, default_days: 7, since: at(-168), now: at(0), handled: {}, truncated: false }));
  await page.route((u) => u.pathname.endsWith('/api/v1/tickets/rfqs'), (route) => json(route, { items: [], next_cursor: null }));
  await page.route('**/api/v1/tickets/costs/claims**', (route) => json(route, { rows: [] }));
  await page.route('**/api/v1/tickets/dashboard**', (route) => {
    const u = new URL(route.request().url());
    const dept = u.searchParams.get('department_id');
    if (u.pathname.endsWith('/dashboard/payments')) {
      calls.push('payments');
      if (o.fails) return json(route, { code: 'internal', user_message: 'x', retryable: true, correlation_id: 'mock', details: {} }, 500);
      return json(route, payments(dept));
    }
    return json(route, summary(dept));
  });
  await page.goto('about:blank');
  await page.goto(url('/tickets/overview', 'classic', scheme));
  return calls;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`), fullPage: true });
}

test.describe('manager overview evidence (MGRDASH phase 4)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the payments card, the overdue payment row and the payment dates - light / dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, {}, scheme);
      await page.waitForSelector(`${O} [data-payments="upcoming"]`);
      await shot(page, 'overview-p4', scheme);
      for (const k of ['payments', 'overdue', 'upcoming']) {
        await page.locator(`${O} [data-widget="${k}"]`).scrollIntoViewIfNeeded();
        await page.locator(`${O} [data-widget="${k}"]`).screenshot({ path: path.join(OUT, `card-${k}-${test.info().project.name}-${scheme}.png`) });
      }
    }
    for (const g of ['overdue', 'upcoming', 'claims']) await expect(page.locator(`${O} [data-payments="${g}"]`)).toHaveCount(1);
    await expect(page.locator(`${O} [data-widget="payments"] [data-count]`)).toHaveText('5');
    await expect(page.locator(`${O} [data-pay-row="instalment"][data-days="-3"] [data-when]`)).toHaveText('באיחור של 3 ימים');
    await expect(page.locator(`${O} [data-pay-row="instalment"][data-days="1"] [data-when]`)).toHaveText('מחר');
    await expect(page.locator(`${O} [data-pay-row="instalment"]`).first()).toHaveAttribute('href', /rfq=r5/);
    await expect(page.locator(`${O} [data-pay-row="claim"]`)).toHaveAttribute('href', /t=t000000000000003.*tab=costs/);
    await expect(page.locator(`${O} [data-widget="payments"] [data-amount]`)).toHaveCount(5);
    // card 9: the instalment past its day; card 10: the payment dates of the next two weeks
    await expect(page.locator(`${O} [data-overdue-row="pay"]`)).toHaveCount(1);
    await expect(page.locator(`${O} [data-agenda-row="payment"]`)).toHaveCount(3);
    // the numbers row's "waiting for my approval" is unchanged by the payments (owner decision: as built in phase 3)
    await expect(page.locator(`${O} [data-kpi="approval"] .n`).first()).toHaveText('0');
  });

  test('without the payment permissions: no payments card, the route is never read', async ({ page }) => {
    const calls = await go(page, { pay: false });
    await page.waitForSelector(`${O} [data-widget="approvals"]`);
    await page.waitForTimeout(300);
    await expect(page.locator(`${O} [data-widget="payments"]`)).toHaveCount(0);
    expect(calls).toEqual([]);
  });

  test('the payments route failed: only its card says "not available"', async ({ page }) => {
    await go(page, { fails: true });
    await page.waitForSelector(`${O} [data-widget="payments"] [data-unavailable]`);
    await expect(page.locator(`${O} [data-widget="approvals"] [data-unavailable]`)).toHaveCount(0);
    await page.locator(`${O} [data-widget="payments"]`).screenshot({ path: path.join(OUT, `card-payments-failed-${test.info().project.name}-light.png`) });
  });
});
