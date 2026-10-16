import { test, expect, type Page } from '@playwright/test';
import { installTicketsMock, url, SKINS } from './tickets-mocks';

// TKUI1 (2.6.0): the layout guard of the v5 request drawer (IA §4.1 / owner decision 16.10): EXACTLY ONE scroll container per tab, in every
// size (520 / 640 / full) and on the phone (full sheet, half sheet), in all five skins, light and dark, with no horizontal overflow; the
// status block and the tabs stay fixed (outside the scroller). Plus the keyboard / screen-reader contract: an ARIA tab list with the badge
// in the accessible name, the arrow keys, 44 px targets on the phone, Escape closes the "⋯" menu before the drawer.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-tickets-drawer.spec.ts --workers=1
const ID = '0000000000000a01'; // waiting for a part, an ETA, a handler's note
const L = 'sw-app tickets-list ticket-detail';
const TABS = ['overview', 'conv', 'costs', 'history'] as const;
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

async function open(page: Page, hash: string, skin = 'classic', scheme: 'light' | 'dark' = 'light', ui: Record<string, string> = {}): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installTicketsMock(page, { ui });
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  await page.locator(`${L} [data-status-block]`).waitFor();
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
    const td = find(document, 'ticket-detail') as HTMLElement; // (a selector never crosses a shadow root: the one drawer of the list)
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

async function eachTab(page: Page, label: string): Promise<void> {
  for (const tab of TABS) {
    await page.locator(`${L} [role="tab"][data-tab="${tab}"]`).click();
    await expect(page.locator(`${L} [data-tab-panel="${tab}"]`)).toBeVisible();
    const s = await scrollers(page);
    expect(s, `${label} / ${tab}: exactly one scroll container (${s.join(', ')})`).toHaveLength(1);
    expect(s[0], `${label} / ${tab}: the drawer body is the scroller`).toBe('div.body');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${label} / ${tab}: horizontal overflow`).toBeLessThanOrEqual(1);
  }
}

test.describe('TKUI1 drawer layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('one scroll container per tab - every desktop size / the phone sheets', async ({ page }) => {
    await open(page, `/tickets/all?t=${ID}`);
    if (isPhone(page)) {
      await eachTab(page, 'phone full sheet');
      // the half sheet: header + status block + the Now rows + "הצג הכול" (no tabs), still one scroller
      await page.locator(`${L} [data-sheet-toggle]`).click();
      await expect(page.locator(`${L} [data-half-sheet]`)).toBeVisible();
      await expect(page.locator(`${L} [role="tablist"]`)).toHaveCount(0);
      expect(await scrollers(page)).toHaveLength(1);
      await page.locator(`${L} [data-show-all]`).click();
      await expect(page.locator(`${L} [role="tablist"]`)).toBeVisible();
      return;
    }
    for (const size of ['drawer', 'wide', 'full'] as const) {
      await page.locator(`${L} [data-size-btn="${size}"]`).click();
      const w = await page.locator(`${L} sw-drawer`).evaluate((d) => d.shadowRoot!.querySelector('dialog')!.getBoundingClientRect().width);
      const vw = page.viewportSize()!.width;
      expect(Math.round(w), `${size} width`).toBe(size === 'drawer' ? Math.min(520, vw) : size === 'wide' ? Math.min(640, vw) : vw);
      await eachTab(page, size);
    }
  });

  test('five skins x light / dark: one scroller, no overflow, the block and the tabs fixed above the scroller', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
    for (const skin of SKINS)
      for (const scheme of ['light', 'dark'] as const) {
        await open(page, `/tickets/all?t=${ID}`, skin, scheme);
        const s = await scrollers(page);
        expect(s, `${skin}/${scheme}`).toEqual(['div.body']);
        // the status block and the tabs are not inside the scroller: scrolling the body leaves them where they are
        const before = await page.locator(`${L} [data-status-block]`).boundingBox();
        await page.locator(`${L} sw-drawer`).evaluate((d) => { const b = d.shadowRoot!.querySelector('.body') as HTMLElement; b.scrollTop = b.scrollHeight; });
        const after = await page.locator(`${L} [data-status-block]`).boundingBox();
        expect(after?.y, `${skin}/${scheme}: the status block is fixed`).toBe(before?.y);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${skin}/${scheme}: horizontal overflow`).toBeLessThanOrEqual(1);
      }
  });

  test('keyboard and screen reader: tab list, arrows, badge in the name, one live sentence, the menu, 44 px on the phone', async ({ page }) => {
    await open(page, `/tickets/all?t=${ID}`);
    const d = page.locator(L);
    await expect(d.locator('[role="tablist"] [role="tab"]')).toHaveCount(4);
    await expect(d.locator('[role="tab"][aria-selected="true"]')).toHaveAttribute('data-tab', 'overview');
    await expect(d.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await expect(d.locator('[role="tabpanel"]')).toHaveAttribute('aria-labelledby', 'dtab-overview');
    await expect(d.locator('[data-status-block]')).toHaveAttribute('role', 'group');
    await expect(d.locator('[aria-live="polite"]')).toHaveCount(1);
    await expect(d.locator('[data-status-chip]')).toHaveCount(1);
    await expect(d.locator('[data-primary]')).toHaveCount(1);
    expect(await d.locator('[data-quiet]').count()).toBeLessThanOrEqual(1);
    // arrows in the reading direction (RTL: ArrowLeft = next), Home / End
    await d.locator('[role="tab"][data-tab="overview"]').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(d.locator('[role="tab"][aria-selected="true"]')).toHaveAttribute('data-tab', 'conv');
    await expect(d.locator('[role="tab"][data-tab="conv"]')).toBeFocused();
    await page.keyboard.press('End');
    await expect(d.locator('[role="tab"][aria-selected="true"]')).toHaveAttribute('data-tab', 'history');
    await page.keyboard.press('Home');
    await expect(d.locator('[role="tab"][aria-selected="true"]')).toHaveAttribute('data-tab', 'overview');
    // the "⋯" menu: Escape closes the menu, not the drawer
    await d.locator('[data-more]').click();
    await expect(d.locator('[data-drawer-menu] [role="menuitem"]').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(d.locator('[data-drawer-menu]')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`t=${ID}`));
    await expect(d.locator('[data-status-block]')).toBeVisible();
    if (isPhone(page)) {
      for (const sel of ['[role="tab"]', '[data-primary]', '[data-more]', '[data-sheet-toggle]']) {
        const boxes = await d.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        for (const h of boxes) expect(h, `${sel}: 44 px target`).toBeGreaterThanOrEqual(44);
      }
    }
    // Escape (no menu) closes the drawer and returns to the list
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/t=/);
  });
});
