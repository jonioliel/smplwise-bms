import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url, type TicketsMockOptions } from './tickets-mocks';

// SERVICEIA2-295 (slice 2 of the service-management reorganisation) evidence: שלי · המחלקה · הכול are no longer three level-1 tabs but the
// request list's OWN scope filter - the area's page row is רשימה · לוח מנהל, the scope segment offers exactly the scopes the old tabs were
// offered for (capability parity L-02), every old address keeps working (#/tickets/mine|department|all are the filter's own addresses,
// #/tickets/list is a redirect), and the section / page rows fit a 390 px phone. Real build against the mock layer, desktop 1440 and phone 390.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-serviceia2-list.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/serviceia2-list');
const L = 'sw-app tickets-list';
const PAGES = 'sw-app sw-tabs[data-tickets-pages]';
const SECTIONS = 'sw-app sw-tabs[data-tickets-sections]';
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

async function go(page: Page, hash: string, o: TicketsMockOptions = {}, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installTicketsMock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`) });
}

test.describe('service area: the scopes are the list filter (slice 2)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('a manager: the page row is רשימה · לוח מנהל, the segment has the scopes, none of the three scopes is a tab any more', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/tickets/department', { persona: 'admin' }, scheme);
      await page.waitForSelector(`${L} ticket-card, ${L} [data-state]`);
      await expect(page.locator(`${L} [data-scope-seg] button[data-scope]`)).toHaveCount(3);
      await expect(page.locator(`${L} button[data-scope="department"]`)).toHaveAttribute('aria-checked', 'true');
      const pages = page.locator(PAGES);
      await expect(pages).toContainText('רשימה');
      await expect(pages).toContainText('לוח מנהל');
      for (const gone of ['שלי', 'המחלקה', 'הכול']) await expect(pages, `"${gone}" is not a page tab`).not.toContainText(gone);
      await expect(pages.locator('[aria-selected="true"], [aria-current="page"]').first()).toContainText('רשימה');
      await shot(page, 'manager-department', scheme);
    }
  });

  test('the scope segment keeps the filter: a click writes the scope address, the page tab stays on רשימה, nothing is lost', async ({ page }) => {
    await go(page, '/tickets/mine', { persona: 'admin' });
    await page.waitForSelector(`${L} ticket-card`);
    for (const [scope, label] of [['department', 'המחלקה'], ['all', 'הכול'], ['mine', 'שלי']] as const) {
      await page.locator(`${L} button[data-scope="${scope}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#/tickets/${scope}`));
      await expect(page.locator(`${L} button[data-scope="${scope}"]`)).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator(`${L} button[data-scope="${scope}"]`)).toContainText(label);
      await expect(page.locator(PAGES).locator('[aria-selected="true"], [aria-current="page"]').first()).toContainText('רשימה');
    }
    // the other filters survive a scope change (status, search) exactly as before
    await page.locator(`${L} [data-status-filter="closed"]`).click();
    await page.locator(`${L} button[data-scope="department"]`).click();
    await expect(page).toHaveURL(/#\/tickets\/department\?status=closed/);
  });

  test('parity L-02: a user without "הכול" is not offered it (as the old tab was hidden); a direct link still shows where he is', async ({ page }) => {
    await go(page, '/tickets/mine', { persona: 'operator' });
    await page.waitForSelector(`${L} ticket-card`);
    await expect(page.locator(`${L} button[data-scope]`)).toHaveCount(2);
    await expect(page.locator(`${L} button[data-scope="all"]`)).toHaveCount(0);
    // one section with one page: neither row is drawn (the list needs no navigation of its own)
    await expect(page.locator(SECTIONS)).toHaveCount(0);
    await expect(page.locator(PAGES)).toHaveCount(0);
    await go(page, '/tickets/all', { persona: 'operator' });
    await page.waitForSelector(`${L} [data-scope-seg]`);
    await expect(page.locator(`${L} button[data-scope="all"]`)).toHaveAttribute('aria-checked', 'true');
    await shot(page, 'operator-no-all');
  });

  test('the old addresses work: #/tickets/list redirects to the first scope offered (query kept); the scope addresses stay', async ({ page }) => {
    await go(page, '/tickets/list?status=closed', { persona: 'operator' });
    await expect(page).toHaveURL(/#\/tickets\/mine\?status=closed/);
    await go(page, '/tickets/requests', { persona: 'admin' });
    await expect(page).toHaveURL(/#\/tickets\/mine/);
    for (const scope of ['mine', 'department', 'all']) {
      await go(page, `/tickets/${scope}`, { persona: 'admin' });
      await page.waitForSelector(`${L} [data-scope-seg]`);
      await expect(page).toHaveURL(new RegExp(`#/tickets/${scope}$`));
      await expect(page.locator(`${L} [data-screen="tickets-list"]`)).toHaveAttribute('data-scope', scope);
    }
  });

  test('the board is a page of the same row; "רשימה" returns to the list on the first scope', async ({ page }) => {
    await go(page, '/tickets/board', { persona: 'admin' });
    await expect(page.locator(PAGES).locator('[aria-selected="true"], [aria-current="page"]').first()).toContainText('לוח מנהל');
    await page.locator(PAGES).getByText('רשימה').first().click();
    await expect(page).toHaveURL(/#\/tickets\/mine/);
    await page.waitForSelector(`${L} [data-scope-seg]`);
  });

  test('phone 390: the section row (short labels) and the page row fit without sideways scroll or clipped entries', async ({ page }) => {
    test.skip(!isPhone(page), 'phone only');
    await go(page, '/tickets/all', { persona: 'admin' });
    await page.waitForSelector(`${L} [data-scope-seg]`);
    for (const sel of [SECTIONS, PAGES]) {
      const el = page.locator(sel);
      if (!(await el.count())) continue;
      const box = await el.first().boundingBox();
      expect(box, sel).not.toBeNull();
      expect(box!.x, `${sel} starts inside the screen`).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width, `${sel} ends inside the screen`).toBeLessThanOrEqual(391);
      const clipped = await el.first().evaluate((host) => {
        const root = host.shadowRoot ?? host;
        return Array.from(root.querySelectorAll('[role="tab"]')).filter((t) => { const r = t.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1); }).length;
      });
      expect(clipped, `${sel}: entries outside the screen`).toBe(0);
    }
    const rows = page.locator(PAGES);
    await expect(rows).toContainText('רשימה');
    await expect(rows).toContainText('לוח מנהל');
    // the section row uses the short phone label
    await expect(page.locator(SECTIONS)).toContainText('בקשות');
    await shot(page, 'phone-rows');
  });
});
