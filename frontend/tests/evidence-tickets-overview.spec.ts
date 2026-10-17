import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './tickets-mocks';
import { installBoardMock, type BoardMock, type BoardMockOptions } from './tickets-board-mocks';

// MGRDASH phase 1 evidence: the manager overview ("סקירה", the first tab of the service area) from the REAL build against the board's mock
// layer (fake data), desktop 1440 and phone 390, light and dark. Asserts: the tab first and for managers only, the numbers row, the cards of
// phase 1 (where stuck with the reason chips filtering the places, handler load with the vendor tag, who waits for whom, overdue, the next two
// weeks with the RFQ dates), the department comparison under the numbers row for the all-departments manager, the folded cards on a phone,
// the "not a manager" state, no horizontal scroll. Writes screenshots to docs/design/evidence/mgrdash-p1.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-overview.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/mgrdash-p1');
const O = 'sw-app tickets-overview';
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = Date.parse('2026-10-13T10:42:00Z');
const at = (h: number) => new Date(NOW + h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');

async function go(page: Page, hash: string, o: BoardMockOptions = {}, scheme: 'light' | 'dark' = 'light'): Promise<BoardMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.clock.setFixedTime(new Date(NOW));
  const mock = await installBoardMock(page, o);
  // the overview's extra reads (existing routes): the vendors of the directory, the requests for quotation, the handled counts
  await page.route('**/api/v1/tickets/contacts**', (route) => json(route, { contacts: [{ id: 'a-1', kind: 'vendor', name: 'קליימה-טק מיזוג אוויר', company: 'קליימה-טק' }] }));
  await page.route('**/api/v1/tickets/handler-load**', (route) => json(route, { days: 7, default_days: 7, since: at(-24 * 7), now: at(0), handled: { 'user:a-2': 3 }, truncated: false }));
  await page.route((u) => u.pathname.endsWith('/api/v1/tickets/rfqs'), (route) => {
    const state = new URL(route.request().url()).searchParams.get('state');
    const base = { department: { id: 'dept-maintenance', name: 'אחזקה' }, place_text: null, work_to: null, created_at: at(-100), updated_at: at(-2), internal_owner: { id: 'u-ronit', name: 'רונית לוי' },
      kpis: { invited: 3, sent: 3, opened: 2, quoted: 1, declined: 0, no_response: 1, lowest_total_minor: null, currency: null } };
    const items = state === 'open'
      ? [{ ...base, id: 'r1', number: 8, ref: 'RFQ-08', state: 'due_passed', title: 'ניקוי חלונות חיצוני', due_at: at(-20), work_from: null },
        { ...base, id: 'r2', number: 7, ref: 'RFQ-07', state: 'collecting', title: 'החלפת מזגן בחדר הישיבות', due_at: at(30), work_from: null }]
      : state === 'awarded' ? [{ ...base, id: 'r3', number: 5, ref: 'RFQ-05', state: 'awarded', title: 'צביעת חדר המדרגות', due_at: at(-200), work_from: at(50) }] : [];
    return json(route, { items, next_cursor: null });
  });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', full = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`), fullPage: full });
}

test.describe('manager overview evidence (MGRDASH phase 1)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the overview: the tab first, the numbers row and the phase-1 cards - light / dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/tickets/overview', {}, scheme);
      await page.waitForSelector(`${O} [data-kpis]`);
      await shot(page, 'overview', scheme);
    }
    await expect(page.locator('sw-app sw-tabs').first()).toContainText('סקירה');
    await expect(page.locator(`${O} [data-kpi="open"] .n`).first()).toHaveText('9');
    await expect(page.locator(`${O} [data-kpi="stuck"] .n`).first()).toHaveText('2');
    await expect(page.locator(`${O} [data-kpi="waiting"] .n`).first()).toHaveText('4');
    for (const w of ['stuck', 'waits', 'load', 'overdue', 'upcoming']) await expect(page.locator(`${O} [data-widget="${w}"]`)).toHaveCount(1);
    // the all-departments manager: the comparison right under the numbers row (owner decision a), folded on a phone
    await expect(page.locator(`${O} [data-widget="departments"]`)).toHaveCount(1);
    if (isPhone(page)) await expect(page.locator(`${O} [data-widget="departments"]`)).toHaveClass(/folded/);
    // the vendor carries the tag in the same list (default)
    await expect(page.locator(`${O} [data-handler="contact:a-1"] [data-vendor-tag]`)).toBeVisible();
    // the RFQ deadline passed without a decision is overdue; the open one's deadline is in the next two weeks
    await expect(page.locator(`${O} [data-overdue-row="rfq"]`)).toHaveCount(1);
    await expect(page.locator(`${O} [data-agenda-row="rfq_due"]`)).toHaveCount(1);
    await expect(page.locator(`${O} [data-agenda-row="work_start"]`)).toHaveCount(1);
  });

  test('a reason chip filters the places of "where stuck"', async ({ page }) => {
    await go(page, '/tickets/overview');
    await page.waitForSelector(`${O} [data-reasons]`);
    const before = await page.locator(`${O} [data-place]`).count();
    await page.locator(`${O} [data-reason="unassigned"]`).click();
    await expect(page.locator(`${O} [data-reason="unassigned"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator(`${O} [data-place]`).count()).toBeLessThanOrEqual(before);
    await shot(page, 'overview-reason', 'light', false);
  });

  test('a department chip narrows the board read and the address', async ({ page }) => {
    const mock = await go(page, '/tickets/overview');
    await page.waitForSelector(`${O} [data-dept-chips]`);
    await page.locator(`${O} [data-dept="dept-maintenance"]`).click();
    await expect(page).toHaveURL(/dept=dept-maintenance/);
    await expect.poll(() => mock.calls.some((c) => c.path.includes('department_id=dept-maintenance'))).toBe(true);
    await expect(page.locator(`${O} [data-widget="departments"]`)).toHaveCount(0);
  });

  test('folding a card is remembered', async ({ page }) => {
    await go(page, '/tickets/overview');
    await page.waitForSelector(`${O} [data-fold="load"]`);
    await page.locator(`${O} [data-fold="load"]`).click();
    await expect(page.locator(`${O} [data-widget="load"]`)).toHaveClass(/folded/);
    await page.reload();
    await page.waitForSelector(`${O} [data-widget="load"]`);
    await expect(page.locator(`${O} [data-widget="load"]`)).toHaveClass(/folded/);
  });

  test('not a manager: no tab, and a direct link shows the managers-only state', async ({ page }) => {
    await go(page, '/tickets/overview', { persona: 'operator' });
    await expect(page.locator(`${O} [data-overview-state="forbidden"]`)).toContainText('הסקירה פתוחה למנהלי מחלקות');
    await expect(page.locator('sw-app sw-tabs').first()).not.toContainText('סקירה');
    await shot(page, 'overview-forbidden', 'light', false);
  });

  test('the empty installation: one state card', async ({ page }) => {
    await go(page, '/tickets/overview', { emptyBoard: true });
    await expect(page.locator(`${O} [data-overview-state="empty"]`)).toBeVisible();
    await shot(page, 'overview-empty', 'light', false);
  });
});
