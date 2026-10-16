import { test, expect, type Page } from '@playwright/test';
import { url, SKINS } from './tickets-mocks';
import { installConvMock, VID } from './tickets-conv-mocks';

// TKUI2 (2.6.0): the layout guard of the Conversation and History tabs (IA §4.1 / §4.2, the v4 one-scroller rule): EXACTLY ONE scroll
// container (the drawer body) on both sub-tabs and on History - in every desktop size and on the phone, five skins, light and dark, no
// horizontal overflow; the composer is sticky at the bottom of that scroller; RTL sides (incoming at the start, outgoing at the end);
// 44 px targets on the phone; the keyboard (the sub-tab toggles, focus after a switch and after "שלח לספק").
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-tickets-conversation.spec.ts --workers=1
const L = 'sw-app tickets-list ticket-detail';
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

async function open(page: Page, tab: 'conv' | 'history', skin = 'classic', scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installConvMock(page);
  await page.goto('about:blank');
  await page.goto(url(`/tickets/all?t=${VID}&tab=${tab}`, skin, scheme));
  await page.locator(`${L} [data-tab-panel="${tab}"]`).waitFor();
}

/** The scroll containers inside the open drawer's dialog (through shadow roots and slots), top-layer menus and dialogs excluded. */
async function scrollers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const find = (root: ParentNode, sel: string): Element | null => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.matches(sel)) return el;
        if (el.shadowRoot) {
          const f = find(el.shadowRoot, sel);
          if (f) return f;
        }
      }
      return null;
    };
    const td = find(document, 'ticket-detail') as HTMLElement;
    const dlg = td.shadowRoot!.querySelector('sw-drawer')!.shadowRoot!.querySelector('dialog')!;
    const out: string[] = [];
    const scrolls = (e: Element) => {
      const cs = getComputedStyle(e);
      return /(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX);
    };
    const walk = (n: ParentNode) => {
      for (const e of Array.from(n.children)) {
        if (e.matches('[popover], sw-dialog, tickets-delete-dialog')) continue;
        if (scrolls(e)) out.push(`${e.tagName.toLowerCase()}.${(e as HTMLElement).className || ''}`.trim());
        if (e instanceof HTMLSlotElement) for (const a of e.assignedElements({ flatten: true })) {
          if (a.matches('[popover], sw-dialog, tickets-delete-dialog')) continue;
          if (scrolls(a)) out.push(`slotted ${a.tagName.toLowerCase()}`);
          if (a.shadowRoot) walk(a.shadowRoot);
          walk(a);
        }
        if (e.shadowRoot) walk(e.shadowRoot);
        walk(e);
      }
    };
    walk(dlg);
    return out;
  });
}

async function oneScroller(page: Page, label: string): Promise<void> {
  const s = await scrollers(page);
  expect(s, `${label}: exactly one scroll container (${s.join(', ')})`).toEqual(['div.body']);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(1);
}

const body = (page: Page) => page.locator(`${L} sw-drawer`);
const scrollBody = (page: Page, to: 'top' | 'bottom') => body(page).evaluate((d, where) => {
  const b = d.shadowRoot!.querySelector('.body') as HTMLElement;
  b.scrollTop = where === 'top' ? 0 : b.scrollHeight;
}, to);

test.describe('TKUI2 conversation / history layout', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('one scroll container: both sub-tabs (folded and expanded) and History, every desktop size / the phone', async ({ page }) => {
    const sizes = isPhone(page) ? (['phone'] as const) : (['drawer', 'wide', 'full'] as const);
    for (const size of sizes) {
      await open(page, 'conv');
      if (size !== 'phone') await page.locator(`${L} [data-size-btn="${size}"]`).click();
      await oneScroller(page, `${size} / vendor`);
      await page.locator(`${L} [data-conv-older]`).click();
      await oneScroller(page, `${size} / vendor expanded`);
      await page.locator(`${L} [data-conv-sub="team"]`).click();
      await oneScroller(page, `${size} / team`);
      await page.locator(`${L} [role="tab"][data-tab="history"]`).click();
      await page.locator(`${L} [data-history-filters]`).waitFor();
      await oneScroller(page, `${size} / history`);
    }
  });

  test('five skins x light / dark: one scroller, no overflow on the conversation and History', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
    for (const skin of SKINS)
      for (const scheme of ['light', 'dark'] as const) {
        await open(page, 'conv', skin, scheme);
        await oneScroller(page, `${skin}/${scheme} conv`);
        await page.locator(`${L} [role="tab"][data-tab="history"]`).click();
        await oneScroller(page, `${skin}/${scheme} history`);
      }
  });

  test('the composer is sticky at the bottom of the scroller; incoming at the start side, outgoing at the end side (RTL)', async ({ page }) => {
    await open(page, 'conv');
    await page.locator(`${L} [data-conv-older]`).click();
    for (const where of ['top', 'bottom'] as const) {
      await scrollBody(page, where);
      const view = await body(page).evaluate((d) => (d.shadowRoot!.querySelector('.body') as HTMLElement).getBoundingClientRect());
      const comp = await page.locator(`${L} [data-composer="vendor"]`).boundingBox();
      expect(comp, 'the composer is on screen').not.toBeNull();
      expect(comp!.y + comp!.height, `${where}: the composer's bottom inside the scroller`).toBeLessThanOrEqual(view.bottom + 1);
      expect(comp!.y, `${where}: the composer is visible`).toBeGreaterThanOrEqual(view.top - 1);
    }
    const dir = await page.locator(L).evaluate((el) => getComputedStyle(el).direction);
    const inBox = await page.locator(`${L} [data-dir="in"]`).last().boundingBox();
    const outBox = await page.locator(`${L} [data-dir="out"]`).last().boundingBox();
    if (dir === 'rtl') expect(inBox!.x + inBox!.width, 'incoming hugs the start (right) edge').toBeGreaterThan(outBox!.x + outBox!.width);
  });

  test('keyboard and screen reader: a toggle group (not a second tab list), the log, focus after "שלח לספק", 44 px on the phone', async ({ page }) => {
    await open(page, 'conv');
    const d = page.locator(L);
    await expect(d.locator('[role="tablist"]')).toHaveCount(1); // the request's own tab list stays the only one
    await expect(d.locator('[data-conv-subs]')).toHaveAttribute('role', 'group');
    await expect(d.locator('[data-conv-log]')).toHaveAttribute('role', 'log');
    await d.locator('[data-conv-sub="team"]').focus();
    await page.keyboard.press('Enter');
    await expect(d.locator('[data-conv-sub="team"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(d.locator('[data-conv-sub="team"]')).toBeFocused(); // the switch keeps the focus where the user is
    await d.locator('[data-note-forward]').last().focus();
    await page.keyboard.press('Enter');
    await expect(d.locator('[data-composer="vendor"] [data-composer-text]')).toBeFocused();
    if (isPhone(page)) {
      await d.locator('[data-composer-text]').fill('x');
      for (const sel of ['[data-conv-sub]', '[data-composer-send]', '[data-composer-photo]']) {
        const hs = await d.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        for (const h of hs) expect(h, `${sel}: 44 px target`).toBeGreaterThanOrEqual(44);
      }
      await d.locator('[data-conv-sub="team"]').click();
      const fw = await d.locator('[data-note-forward]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      for (const h of fw) expect(h, 'forward: 44 px target').toBeGreaterThanOrEqual(44);
      await d.locator('[role="tab"][data-tab="history"]').click();
      const chips = await d.locator('[data-history-filter]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      for (const h of chips) expect(h, 'filter chip: 44 px target').toBeGreaterThanOrEqual(44);
    }
  });
});
