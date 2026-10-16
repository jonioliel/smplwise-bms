import { test, expect, type Page } from '@playwright/test';
import { url } from './tickets-mocks';
import { installRfqMock } from './tickets-rfq-mocks';

// TKRFQ4 layout: the work-order step of an awarded request at 1440 / 1024 / 390 - no horizontal page scroll, RTL, every control named
// for a screen reader and a 44 px target on a phone (the card form, the created card, the preview dialog).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-tickets-rfq4.spec.ts --workers=1
const S = 'sw-app tickets-rfqs';
const O = `${S} tickets-rfq-board tickets-rfq-order`;
const RFQ5 = 'rfq0000000000005';

async function open(page: Page): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installRfqMock(page);
  await page.goto('about:blank');
  await page.goto(url(`/tickets/rfqs?rfq=${RFQ5}`));
  await page.waitForSelector(`${O} [data-rfq-order-card]`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

/** The visible controls of the order step (its shadow tree and the dialog's light DOM inside it). */
async function controls(page: Page): Promise<{ name: string; w: number; h: number; tag: string; inText: boolean }[]> {
  return page.evaluate(() => {
    const out: { name: string; w: number; h: number; tag: string; inText: boolean }[] = [];
    const host = document.querySelector('sw-app')?.shadowRoot?.querySelector('tickets-rfqs')?.shadowRoot?.querySelector('tickets-rfq-board')?.shadowRoot
      ?.querySelector('tickets-rfq-order');
    host?.shadowRoot?.querySelectorAll('button, a[href], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, select').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') return;
      const lab = (el as HTMLInputElement).labels?.[0]?.innerText ?? '';
      const name = (el.getAttribute('aria-label') || lab || (el as HTMLElement).innerText || el.getAttribute('title') || '').trim();
      out.push({ name, w: r.width, h: r.height, tag: el.tagName.toLowerCase(), inText: !!el.closest('.note, p') });
    });
    return out;
  });
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('RFQ work order layout (TKRFQ4)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the order form, the created card and the preview: no overflow, RTL, named controls, 44 px targets on a phone', async ({ page }, info) => {
    await open(page);
    const check = async (stage: string) => {
      expect(await overflow(page), `${stage}: horizontal page overflow`).toBeLessThanOrEqual(1);
      const ctl = await controls(page);
      expect(ctl.length, stage).toBeGreaterThan(0);
      const unnamed = ctl.filter((c) => !c.name);
      expect(unnamed, `${stage}: ${JSON.stringify(unnamed)}`).toEqual([]);
      if (info.project.name === 'mobile') {
        const small = ctl.filter((c) => !c.inText && c.tag !== 'textarea' && c.h < 43.5);
        expect(small, `${stage}: ${JSON.stringify(small.slice(0, 8))}`).toEqual([]);
      }
    };
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe('rtl');
    await check('form');
    await page.locator(`${O} [data-rfq-order-create]`).click();
    await page.locator(`${O} [data-rfq-order-card][data-ostate="created"]`).waitFor();
    await check('created');
    await page.locator(`${O} [data-rfq-order-preview]`).click();
    await page.locator(`${O} [data-rfq-order-preview-text]`).waitFor();
    expect(await overflow(page), 'dialog: horizontal page overflow').toBeLessThanOrEqual(1);
    await expect(page.locator(`${O} [data-rfq-order-send]`)).toBeEnabled();
    if (info.project.name === 'mobile') {
      const box = await page.locator(`${O} [data-rfq-order-send]`).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('keyboard: the order form is reachable and the create button works with Enter', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a keyboard on the desktop');
    await open(page);
    const btn = page.locator(`${O} [data-rfq-order-create]`);
    await btn.focus();
    await expect(btn).toBeFocused();
    await page.keyboard.press('Enter');
    await page.locator(`${O} [data-rfq-order-card][data-ostate="created"]`).waitFor();
  });
});
