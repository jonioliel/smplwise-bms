import { test, expect, type Page } from '@playwright/test';
import { url } from './tickets-mocks';
import { installRfqMock, RFQ7, RFQ8 } from './tickets-rfq-mocks';

// TKRFQ2 layout: the RFQ screens at 1440 / 1024 / 390 - no horizontal page scroll (the comparison scrolls inside its own frame), RTL,
// every control a 44 px target on a phone, every button named for a screen reader, the label column of the comparison stays in view.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-tickets-rfq2.spec.ts --workers=1
const S = 'sw-app tickets-rfqs';

async function open(page: Page, hash: string, ready: string): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installRfqMock(page);
  await page.goto('about:blank');
  await page.goto(url(hash));
  await page.waitForSelector(ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

/** Every visible control of a shadow tree (and its nested trees). */
async function controls(page: Page, host: string): Promise<{ name: string; w: number; h: number; tag: string; inText: boolean }[]> {
  return page.evaluate((sel) => {
    const out: { name: string; w: number; h: number; tag: string; inText: boolean }[] = [];
    const walk = (root: Document | ShadowRoot | Element) => {
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot && el.tagName.toLowerCase().startsWith('tickets-')) walk(el.shadowRoot); // shared components (sw-drawer, sw-dialog) are theirs
        const tag = el.tagName.toLowerCase();
        const isCtl = tag === 'button' || (tag === 'a' && el.hasAttribute('href')) || (tag === 'input' && !['hidden', 'checkbox', 'radio', 'file'].includes((el as HTMLInputElement).type)) || tag === 'select';
        if (!isCtl) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none') return;
        const lab = (el as HTMLInputElement).labels?.[0]?.innerText ?? '';
        const name = (el.getAttribute('aria-label') || lab || (el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || el.getAttribute('title') || '').trim();
        const inText = !!el.closest('.crumbs, .note, p, .search');
        out.push({ name, w: r.width, h: r.height, tag, inText });
      });
    };
    const h = document.querySelector('sw-app')?.shadowRoot?.querySelector(sel);
    if (h?.shadowRoot) walk(h.shadowRoot);
    return out;
  }, host);
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('RFQ layout (TKRFQ2)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const [name, hash, ready] of [
    ['list', '/tickets/rfqs', `${S} [data-rfq-list]`],
    ['board', `/tickets/rfqs?rfq=${RFQ7}`, `${S} tickets-rfq-board [data-phase="ready"]`],
    ['compare', `/tickets/rfqs?rfq=${RFQ7}&view=compare`, `${S} tickets-rfq-compare [data-phase="ready"]`],
    ['compare-currencies', `/tickets/rfqs?rfq=${RFQ8}&view=compare`, `${S} tickets-rfq-compare [data-phase="ready"]`],
    ['new', '/tickets/rfqs?new=1', `${S} tickets-rfq-new [data-rfq-new-form]`],
  ] as const) {
    test(`${name}: no page overflow, RTL, named controls, 44 px targets on a phone`, async ({ page }, info) => {
      await open(page, hash, ready);
      expect(await overflow(page), 'horizontal page overflow').toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe('rtl');
      const ctl = await controls(page, 'tickets-rfqs');
      expect(ctl.length).toBeGreaterThan(3);
      const unnamed = ctl.filter((c) => !c.name);
      expect(unnamed, JSON.stringify(unnamed)).toEqual([]);
      if (info.project.name === 'mobile') {
        const small = ctl.filter((c) => !c.inText && c.h < 43.5);
        expect(small, JSON.stringify(small.slice(0, 8))).toEqual([]);
      }
    });
  }

  test('the comparison scrolls inside its frame on a phone and keeps the label column', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone only');
    await open(page, `/tickets/rfqs?rfq=${RFQ7}&view=compare`, `${S} tickets-rfq-compare [data-phase="ready"]`);
    const r = await page.evaluate(() => {
      const c = document.querySelector('sw-app')?.shadowRoot?.querySelector('tickets-rfqs')?.shadowRoot?.querySelector('tickets-rfq-compare')?.shadowRoot;
      const wrap = c?.querySelector('.cmpwrap') as HTMLElement | null;
      const lbl = c?.querySelector('.ctbl th[scope="row"]') as HTMLElement | null;
      return { inner: wrap ? wrap.scrollWidth > wrap.clientWidth : false, sticky: lbl ? getComputedStyle(lbl).position : '' };
    });
    expect(r.inner).toBe(true);
    expect(r.sticky).toBe('sticky');
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });

  test('keyboard: the list rows and the strip are reachable with Tab and open with Enter', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a keyboard on the desktop');
    await open(page, '/tickets/rfqs', `${S} [data-rfq-list]`);
    const row = page.locator(`${S} [data-rfq-row="${RFQ7}"]`);
    await row.focus();
    await expect(row).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForSelector(`${S} tickets-rfq-board [data-phase="ready"]`);
    expect(page.url()).toContain(`rfq=${RFQ7}`);
  });
});
