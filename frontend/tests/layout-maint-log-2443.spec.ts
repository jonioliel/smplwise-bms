import { test, expect, type Page } from '@playwright/test';
import { installMaintenanceMock } from './maintenance-mocks';

// CR-NOSCROLL-LISTS-2443 (code review 08:F23, owner decision O12 = a): the maintenance reminder log with more lines than a desktop
// window holds (4 fixture lines + 60 generated). Paged (the default): the log's panel does not scroll, the pager shows "1 / N", the
// next page draws other rows and the page itself never scrolls. `?long_lists=scroll`: no pager, every row drawn, the table scrolls
// inside its panel, and the page still never scrolls. 1366x768 and 1440x900, classic light, mocked backend.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-maint-log-2443.spec.ts --project=desktop --workers=1
const M = 'sw-app tickets-maintenance';
const LINES = 64;
const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;

async function open(page: Page, query = '') {
  await installMaintenanceMock(page, { longLog: LINES - 4 });
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=classic&scheme=light${query}#/tickets/maintenance/log`);
  await expect(page.locator(`${M} [data-maint-page="log"]`)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`${M} [data-maint-log-row]`).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** The document, the shell's main and the log's panel (`.scroller` inside maint-log-page): how much each has to scroll. */
const over = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const find = (root: ParentNode, sel: string): Element | null => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const x = find(el.shadowRoot, sel); if (x) return x; }
      return null;
    };
    const log = find(document, 'maint-log-page');
    const scroller = log?.shadowRoot?.querySelector('.scroller');
    const d = (el: Element | null | undefined) => (el ? el.scrollHeight - el.clientHeight : 0);
    return { doc: d(document.scrollingElement), main: d(main), host: d(log), panel: d(scroller), panelOverflow: scroller ? getComputedStyle(scroller).overflowY : '' };
  });

test.describe('the maintenance reminder log never scrolls the page (CR-NOSCROLL-LISTS-2443)', () => {
  for (const vp of VIEWPORTS) {
    test(`paged at ${vp.name}: whole rows per page, the pager moves between them`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the viewports are set by the test itself');
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page);
      const rows = page.locator(`${M} [data-maint-log-row]`);
      await expect.poll(() => rows.count(), { timeout: 10_000 }).toBeLessThan(LINES);
      const first = await rows.count();
      expect(first).toBeGreaterThan(3);
      const pager = page.locator(`${M} sw-pager[data-maint-log-pager]`);
      await expect(pager).toBeVisible();
      const o = await over(page);
      expect(o.panelOverflow, 'the panel clips instead of scrolling').toBe('hidden');
      expect(Math.max(o.doc, o.main, o.host), `page overflow ${JSON.stringify(o)}`).toBeLessThanOrEqual(1);
      expect(o.panel, `the drawn rows fit the panel ${JSON.stringify(o)}`).toBeLessThanOrEqual(1);
      const firstId = await rows.first().getAttribute('data-maint-log-row');
      await pager.locator('[data-pager-next]').click();
      await expect.poll(() => rows.first().getAttribute('data-maint-log-row')).not.toBe(firstId);
      const o2 = await over(page);
      expect(Math.max(o2.doc, o2.main, o2.host, o2.panel), `page 2 overflow ${JSON.stringify(o2)}`).toBeLessThanOrEqual(1);
    });

    test(`long lists set to scroll at ${vp.name}: every row, the panel scrolls, the page does not`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the viewports are set by the test itself');
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page, '&long_lists=scroll');
      await expect(page.locator(`${M} [data-maint-log-row]`)).toHaveCount(LINES);
      await expect(page.locator(`${M} sw-pager[data-maint-log-pager]`)).toHaveCount(0);
      const o = await over(page);
      expect(Math.max(o.doc, o.main, o.host), `page overflow ${JSON.stringify(o)}`).toBeLessThanOrEqual(1);
      expect(o.panel, 'the table scrolls inside its panel').toBeGreaterThan(8);
    });
  }
});
