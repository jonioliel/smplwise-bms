import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './tickets-mocks';
import { installBoardMock, type BoardMock, type BoardMockOptions } from './tickets-board-mocks';

// MGRDASH phase 3 evidence (DASH3-290): the cards of the summary route GET /tickets/dashboard on the manager overview, from the REAL build
// against the board's mock layer plus a mocked summary (invented data, no real person). Desktop 1440 and phone 390, light and dark.
// Asserts: cards 5 (how much was handled, the period chips re-read the route and are remembered), 6 (opened vs closed: the net in the
// title, the screen-reader table), 7 (waiting for my approval: the three groups, amounts only where the answer carries them, the costs
// tab link), 8 (requests for quotation: the state in words, the vendor-question chip), 11 (the comparison with "waiting for a decision" and
// "handled in 7 days"), the numbers row's approval tile, the partial state (summary failed: only its cards say "not available"), the phone
// rows instead of tables, no horizontal scroll. Writes screenshots to docs/design/evidence/dash3.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-overview-p3.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/dash3');
const O = 'sw-app tickets-overview';
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = Date.parse('2026-10-13T10:42:00Z');
const at = (h: number) => new Date(NOW + h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');

const DAILY = [[4, 3], [6, 5], [5, 6], [3, 2], [1, 1], [0, 0], [5, 4], [7, 4], [6, 6], [4, 5], [5, 3], [2, 2], [0, 1], [3, 2]];
const THROUGHPUT: Record<string, [string, string, string, number, number, number, number | null][]> = {
  today: [['user:a-2', 'user', 'יוסי מזרחי', 2, 1, 0, 6000], ['user:a-3', 'user', 'רונית לוי', 1, 2, 0, 10800]],
  '7d': [['user:a-2', 'user', 'יוסי מזרחי', 11, 9, 1, 100800], ['user:a-3', 'user', 'רונית לוי', 6, 8, 0, 176400], ['contact:a-1', 'contact', 'קליימה-טק מיזוג אוויר', 4, 3, 1, 280800], ['user:a-4', 'user', 'אבי כהן', 5, 4, 0, 68400]],
  '30d': [['user:a-2', 'user', 'יוסי מזרחי', 38, 35, 3, 108000], ['user:a-3', 'user', 'רונית לוי', 22, 27, 1, 158400], ['contact:a-1', 'contact', 'קליימה-טק מיזוג אוויר', 14, 12, 2, 266400], ['user:a-4', 'user', 'אבי כהן', 19, 17, 1, 75600], ['user:a-5', 'user', 'דנה פרץ', 12, 11, 0, null]],
};

function summary(period: string, dept: string | null, costs: boolean) {
  const rows = (THROUGHPUT[period] ?? THROUGHPUT['7d']).map(([key, kind, name, done, closed, returned, med]) => ({ key, kind, name, done, closed, returned, median_seconds: med }));
  const sum = (k: 'done' | 'closed' | 'returned') => rows.reduce((s, r) => s + r[k], 0);
  const first = new Date(NOW - 13 * 86_400_000);
  const days = DAILY.map(([o, c], i) => { const d = new Date(first.getTime() + i * 86_400_000); return { date: d.toISOString().slice(0, 10), opened: o, closed: c }; });
  const money = (n: number) => (costs ? { amount_minor: n, currency: 'ILS' } : { amount_minor: null, currency: null });
  return {
    period, days: period === 'today' ? 1 : period === '30d' ? 30 : 7, since: at(-24 * 7), now: at(0), department_id: dept,
    throughput: { rows, total: { done: sum('done'), closed: sum('closed'), returned: sum('returned'), median_seconds: 129600 } },
    daily: { days, net: days.reduce((s, d) => s + d.opened - d.closed, 0), since: first.toISOString() },
    approvals: {
      quotes: { count: 2, items: [
        { id: 'q1', ticket: { id: 't000000000000001', number: 1042, title: 'מזגן לא מקרר - חדר 102' }, department_id: 'dept-maintenance', vendor: 'קליימה-טק מיזוג אוויר', since: at(-72), ...money(240000) },
        { id: 'q2', ticket: { id: 't000000000000002', number: 1047, title: 'גנרטור: בדיקת הנעה חודשית' }, department_id: 'dept-maintenance', vendor: 'אלקטרו-גן', since: at(-26), ...money(115000) }] },
      claims: { count: 1, items: [{ id: 'c1', ticket: { id: 't000000000000003', number: 1038, title: 'ניקוי חלונות חזית' }, department_id: 'dept-cleaning', vendor: 'שירותי ניקיון הצפון', since: at(-120), ...money(390000) }] },
      second: { count: 1, items: [{ id: 'w1', rfq: { id: 'r5', number: 5, ref: 'RFQ-05', title: 'צביעת חדר המדרגות הצפוני' }, department_id: 'dept-maintenance', vendor: 'צבעי הגליל', since: at(-48), ...money(470000) }] },
    },
    rfqs: { count: 4, decide: 2, questions: 1, items: [
      { id: 'r5', number: 5, ref: 'RFQ-05', title: 'צביעת חדר המדרגות הצפוני', department: { id: 'dept-maintenance', name: 'אחזקה' }, state: 'collecting', stage: 'second', due_at: at(-120), work_from: at(50), invited: 3, quoted: 3, declined: 0, questions: 0 },
      { id: 'r8', number: 8, ref: 'RFQ-08', title: 'ניקוי חלונות חיצוני - בניין A', department: { id: 'dept-cleaning', name: 'ניקיון' }, state: 'due_passed', stage: 'decide', due_at: at(-20), work_from: null, invited: 3, quoted: 2, declined: 0, questions: 0 },
      { id: 'r7', number: 7, ref: 'RFQ-07', title: 'החלפת מזגן בחדר הישיבות (קומה 2)', department: { id: 'dept-maintenance', name: 'אחזקה' }, state: 'collecting', stage: 'questions', due_at: at(30), work_from: null, invited: 4, quoted: 3, declined: 0, questions: 1 },
      { id: 'r6', number: 6, ref: 'RFQ-06', title: 'בדיקת מערכת כיבוי אש שנתית', department: { id: 'dept-maintenance', name: 'אחזקה' }, state: 'sent', stage: 'collecting', due_at: at(170), work_from: null, invited: 3, quoted: 0, declined: 0, questions: 0 }] },
    departments: dept ? null : [
      { id: 'dept-maintenance', name: 'אחזקה', open: 24, stuck: 7, overdue: 4, waiting: 3, done_7d: 19, busy_handlers: 2 },
      { id: 'dept-cleaning', name: 'ניקיון', open: 9, stuck: 2, overdue: 1, waiting: 1, done_7d: 11, busy_handlers: 0 }],
    all_departments: true, truncated: false, generated_at: at(0),
  };
}

interface Opts extends BoardMockOptions { costs?: boolean; summaryFails?: boolean }

async function go(page: Page, hash: string, o: Opts = {}, scheme: 'light' | 'dark' = 'light'): Promise<{ mock: BoardMock; periods: string[] }> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.clock.setFixedTime(new Date(NOW));
  const mock = await installBoardMock(page, o);
  const periods: string[] = [];
  await page.route('**/api/v1/tickets/contacts**', (route) => json(route, { contacts: [{ id: 'a-1', kind: 'vendor', name: 'קליימה-טק מיזוג אוויר', company: 'קליימה-טק' }] }));
  await page.route('**/api/v1/tickets/handler-load**', (route) => json(route, { days: 7, default_days: 7, since: at(-24 * 7), now: at(0), handled: { 'user:a-2': 3 }, truncated: false }));
  await page.route((u) => u.pathname.endsWith('/api/v1/tickets/rfqs'), (route) => json(route, { items: [], next_cursor: null }));
  await page.route('**/api/v1/tickets/dashboard**', (route) => {
    const q = new URL(route.request().url()).searchParams;
    periods.push(q.get('period') ?? '');
    if (o.summaryFails) return json(route, { code: 'internal', user_message: 'x', retryable: true, correlation_id: 'mock', details: {} }, 500);
    return json(route, summary(q.get('period') ?? '7d', q.get('department_id'), o.costs ?? true));
  });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  return { mock, periods };
}

async function unfold(page: Page, key: string): Promise<void> {
  const w = page.locator(`${O} [data-widget="${key}"]`);
  if (await w.evaluate((el) => el.classList.contains('folded'))) await page.locator(`${O} [data-fold="${key}"]`).click();
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', full = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`), fullPage: full });
}

test.describe('manager overview evidence (MGRDASH phase 3)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the summary cards 5-8 and 11 - light / dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/tickets/overview', {}, scheme);
      await page.waitForSelector(`${O} [data-rfqs]`);
      for (const k of ['throughput', 'daily', 'departments']) await unfold(page, k);
      await page.waitForSelector(`${O} [data-throughput]`);
      await shot(page, 'overview-p3', scheme);
      for (const k of ['departments', 'approvals', 'rfqs', 'throughput', 'daily']) {
        await page.locator(`${O} [data-widget="${k}"]`).scrollIntoViewIfNeeded();
        await page.locator(`${O} [data-widget="${k}"]`).screenshot({ path: path.join(OUT, `card-${k}-${test.info().project.name}-${scheme}.png`) });
      }
    }
    // the numbers row: waiting for my approval = quotes 2 + demands 1 + second approvals 1
    await expect(page.locator(`${O} [data-kpi="approval"] .n`).first()).toHaveText('4');
    // card 7: the three groups, amounts as sent, the costs tab of the request
    for (const g of ['quotes', 'claims', 'second']) await expect(page.locator(`${O} [data-approvals="${g}"]`)).toHaveCount(1);
    await expect(page.locator(`${O} [data-approval-row="quote"]`).first()).toHaveAttribute('href', /t=t000000000000001.*tab=costs/);
    await expect(page.locator(`${O} [data-approval-row="second"]`).first()).toHaveAttribute('href', /rfq=r5/);
    await expect(page.locator(`${O} [data-amount]`)).toHaveCount(4);
    // card 8: the state in words, the vendor question
    await expect(page.locator(`${O} [data-rfq-row="decide"] [data-stage]`)).toHaveText('עבר המועד - לבחור');
    await expect(page.locator(`${O} [data-rfq-row="second"] [data-stage]`)).toHaveText('ממתין לאישור שני');
    await expect(page.locator(`${O} [data-rfq-row="collecting"] [data-stage]`)).toHaveText('אוספת הצעות · 0 מתוך 3');
    await expect(page.locator(`${O} [data-rfq-row="questions"] [data-question]`)).toHaveText('שאלה מספק');
    // card 6: the net in the title and the table for screen readers (14 days)
    await expect(page.locator(`${O} [data-net-badge]`)).toHaveText('+7 בשבועיים');
    await expect(page.locator(`${O} [data-daily-table] tbody tr`)).toHaveCount(14);
    // card 11: the summary's comparison
    await expect(page.locator(`${O} [data-compare="summary"]`)).toHaveCount(1);
    if (isPhone(page)) {
      await expect(page.locator(`${O} [data-dept-card="dept-maintenance"]`)).toBeVisible();
      await expect(page.locator(`${O} [data-tp-card="user:a-2"]`)).toBeVisible();
    } else {
      await expect(page.locator(`${O} [data-dept-row="dept-maintenance"] td`).nth(5)).toHaveText('19');
      await expect(page.locator(`${O} [data-tp-total] td`).nth(1)).toHaveText('26');
    }
  });

  test('the period chips of "how much was handled" re-read the route and are remembered', async ({ page }) => {
    const { periods } = await go(page, '/tickets/overview');
    await page.waitForSelector(`${O} [data-widget="throughput"]`);
    await unfold(page, 'throughput');
    await page.locator(`${O} [data-period="30d"]`).click();
    await expect.poll(() => periods.includes('30d')).toBe(true);
    await expect(page.locator(`${O} [data-throughput="30d"]`)).toHaveCount(1);
    await expect(page.locator(`${O} [data-period="30d"]`)).toHaveAttribute('aria-checked', 'true');
    await page.locator(`${O} [data-widget="throughput"]`).screenshot({ path: path.join(OUT, `card-throughput-30d-${test.info().project.name}-light.png`) });
    await page.reload();
    await page.waitForSelector(`${O} [data-widget="throughput"]`);
    await expect(page.locator(`${O} [data-period="30d"]`)).toHaveAttribute('aria-checked', 'true');
  });

  test('without the costs permission: counts only, no amount', async ({ page }) => {
    await go(page, '/tickets/overview', { costs: false });
    await page.waitForSelector(`${O} [data-approvals="quotes"]`);
    await expect(page.locator(`${O} [data-amount]`)).toHaveCount(0);
    await expect(page.locator(`${O} [data-approvals="quotes"] h4`)).toContainText('2');
    await page.locator(`${O} [data-widget="approvals"]`).screenshot({ path: path.join(OUT, `card-approvals-nocosts-${test.info().project.name}-light.png`) });
  });

  test('the summary failed: the board cards stay, only the summary cards say "not available"', async ({ page }) => {
    await go(page, '/tickets/overview', { summaryFails: true });
    await page.waitForSelector(`${O} [data-widget="approvals"] [data-unavailable]`);
    for (const k of ['approvals', 'rfqs']) await expect(page.locator(`${O} [data-widget="${k}"] [data-unavailable]`)).toBeVisible();
    for (const k of ['stuck', 'waits', 'load', 'overdue', 'upcoming']) await expect(page.locator(`${O} [data-widget="${k}"] [data-unavailable]`)).toHaveCount(0);
    await shot(page, 'overview-p3-partial', 'light');
  });
});
