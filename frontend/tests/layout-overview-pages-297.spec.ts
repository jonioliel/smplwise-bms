import { test, expect, type Page } from '@playwright/test';
import { installOverviewMock } from './tickets-overview-mocks';

// OVERVIEWFIT-297 (owner rule: a control screen never scrolls on a desktop; owner option א): the service management overview
// (`#/tickets/overview`) shows two rows of widgets and pages through the rest. This spec checks the pages themselves - the page-scroll
// numbers are layout-noscroll-297's: the pager (buttons, dots, the arrows in the reading direction, Home / End), a sideways trackpad
// scroll, the numbers row bringing a widget's page on screen, folding inside a page, and that the tablet and the phone keep the one
// scrolling grid. Mock data only.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-overview-pages-297.spec.ts --project=desktop --project=tablet --project=mobile

const O = 'sw-app tickets-overview';

const clocked = new WeakSet<Page>();
async function open(page: Page, worst = false): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (!clocked.has(page)) {
    clocked.add(page);
    await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
  }
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installOverviewMock(page, { worst });
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=classic#/tickets/overview');
  await page.locator(`${O} [data-widget="payments"]`).waitFor();
}

/** the page on screen: the pager's current dot, and which page's box sits inside the track's box */
const shown = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('sw-app')?.shadowRoot?.querySelector('tickets-overview')?.shadowRoot;
    const tr = root?.querySelector<HTMLElement>('[data-overview-pages]');
    if (!root || !tr) return { dot: -1, inView: -1 };
    const b = tr.getBoundingClientRect();
    const pages = [...root.querySelectorAll<HTMLElement>('[data-overview-pages] > [data-page]')];
    const inView = pages.findIndex((p) => Math.abs(p.getBoundingClientRect().left - b.left) < 4);
    const dot = [...root.querySelectorAll('[data-page-dot]')].findIndex((d) => d.getAttribute('aria-current') === 'page');
    return { dot, inView };
  });

const pageOf = (page: Page, key: string) =>
  page.evaluate((k) => {
    const root = document.querySelector('sw-app')?.shadowRoot?.querySelector('tickets-overview')?.shadowRoot;
    const w = root?.querySelector(`[data-widget="${k}"]`);
    return Number(w?.closest('[data-page]')?.getAttribute('data-page') ?? -1);
  }, key);

test.describe('the overview pages (OVERVIEWFIT-297)', () => {
  test('desktop: two rows a page, the pager, the keys, a sideways scroll, the numbers row', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the desktop layout');
    for (const vp of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(vp);
      await open(page);
      const n = await page.locator(`${O} [data-page-dot]`).count();
      expect(n, 'more than one page with the full widget set').toBeGreaterThan(1);
      // every widget is in the document and on exactly one page; no page holds more than two rows
      const rows = await page.evaluate(() => {
        const root = document.querySelector('sw-app')?.shadowRoot?.querySelector('tickets-overview')?.shadowRoot;
        return [...(root?.querySelectorAll<HTMLElement>('[data-overview-pages] > [data-page]') ?? [])].map((p) => new Set([...p.children].map((c) => Math.round(c.getBoundingClientRect().top))).size);
      });
      expect(rows.every((r) => r >= 1 && r <= 2), `rows per page: ${rows.join(',')}`).toBe(true);
      expect(await shown(page)).toEqual({ dot: 0, inView: 0 });
      await expect(page.locator(`${O} [data-page-prev]`)).toBeDisabled();
      // the next button, then the dots
      await page.locator(`${O} [data-page-next]`).click();
      await expect.poll(() => shown(page)).toEqual({ dot: 1, inView: 1 });
      await page.locator(`${O} [data-page-dot="${n - 1}"]`).click();
      await expect.poll(() => shown(page)).toEqual({ dot: n - 1, inView: n - 1 });
      await expect(page.locator(`${O} [data-page-next]`)).toBeDisabled();
      // the keys on the pager: RTL - the right arrow goes back, the left arrow forward, Home / End
      await page.locator(`${O} [data-page-dot="${n - 1}"]`).focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => shown(page)).toEqual({ dot: n - 2, inView: n - 2 });
      await page.keyboard.press('Home');
      await expect.poll(() => shown(page)).toEqual({ dot: 0, inView: 0 });
      await page.keyboard.press('ArrowLeft');
      await expect.poll(() => shown(page)).toEqual({ dot: 1, inView: 1 });
      await page.keyboard.press('End');
      await expect.poll(() => shown(page)).toEqual({ dot: n - 1, inView: n - 1 });
      // a sideways trackpad scroll of more than half a page over the widgets snaps to the next page and the dots follow (RTL: towards the
      // start = a positive delta; less than half a page snaps back, as any carousel)
      await page.locator(`${O} [data-page="${n - 1}"]`).hover();
      await page.mouse.wheel(Math.round(vp.width * 0.75), 0);
      await expect.poll(() => shown(page)).toEqual({ dot: n - 2, inView: n - 2 });
      // the "overdue" number brings the overdue widget's page on screen
      const odPage = await pageOf(page, 'overdue');
      await page.locator(`${O} [data-page-dot="${odPage === 0 ? n - 1 : 0}"]`).click();
      await page.locator(`${O} [data-kpi="overdue"]`).click();
      await expect.poll(() => shown(page)).toEqual({ dot: odPage, inView: odPage });
      // folding a widget inside a page keeps it on its page and the page scroll at 0
      await page.locator(`${O} [data-fold="overdue"]`).click();
      await expect(page.locator(`${O} [data-widget="overdue"]`)).toHaveClass(/folded/);
      await page.locator(`${O} [data-fold="overdue"]`).click();
      await expect(page.locator(`${O} [data-widget="overdue"]`)).not.toHaveClass(/folded/);
      const over = await page.evaluate(() => {
        const el = document.querySelector('sw-app')?.shadowRoot?.querySelector<HTMLElement>('tickets-overview');
        return el ? el.scrollHeight - el.clientHeight : -1;
      });
      expect(over).toBeLessThanOrEqual(1);
    }
  });

  test('desktop, worst case: the long lists scroll inside their widgets and the controls row stays one row', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the desktop layout');
    await open(page, true);
    const m = await page.evaluate(() => {
      const root = document.querySelector('sw-app')?.shadowRoot?.querySelector('tickets-overview')?.shadowRoot;
      const det = root?.querySelector<HTMLElement>('.dh-det');
      const wb = root?.querySelector<HTMLElement>('[data-widget="departments"] > .wb');
      const pages = root?.querySelector<HTMLElement>('[data-overview-pages]');
      return { det: det?.getBoundingClientRect().height ?? 0, inner: wb ? wb.scrollHeight - wb.clientHeight : 0, pagesH: pages?.getBoundingClientRect().height ?? 0, docW: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(m.det, 'the controls row is one row').toBeLessThan(60);
    expect(m.inner, 'the 25 departments scroll inside the comparison').toBeGreaterThan(0);
    expect(m.pagesH).toBeGreaterThan(400);
    expect(m.docW, 'no sideways page scroll').toBeLessThanOrEqual(1);
  });

  test('tablet and phone: the one grid as before, no pager', async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'the tablet and phone layouts');
    await open(page);
    await expect(page.locator(`${O} [data-overview-pager]`)).toHaveCount(0);
    await expect(page.locator(`${O} [data-overview-pages]`)).toHaveCount(0);
    await expect(page.locator(`${O} .wgrid [data-widget="daily"]`)).toHaveCount(1);
  });
});
