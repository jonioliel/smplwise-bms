/**
 * FLAKY-S12-FIX-2441: a picture of an element that is TALLER than the phone viewport, taken in the phone's own state.
 *
 * What goes wrong without it (Playwright 1.63, Chromium, a project with `isMobile` / `hasTouch` such as `mobile` = Pixel 7): for an
 * element that does not fit the viewport, the element screenshot enlarges the viewport for the shot and puts it back afterwards - and
 * putting it back drops the touch emulation of the page. `(pointer: coarse)` and `(hover: none)` turn false (navigator.maxTouchPoints
 * goes 1 -> 10) and stay false, so every rule of the phone layer that asks for a coarse pointer lets go: text fields fall from the xl
 * tier (18 px) to their desktop size, a five-line box loses 15 px, 44 px targets shrink. A plain page.setViewportSize() does NOT do
 * this, nor does a shot of an element that fits.
 *
 * toHaveScreenshot() shoots until two shots in a row are equal, so on a quiet machine it sees [phone state, let-go state, let-go
 * state] and compares the let-go state - which is what the old baselines hold (366x1244 for the S12 display card). On a loaded
 * runner the page has not yet re-laid itself out when the second shot is taken: two equal shots of the phone state (366x1259), a
 * "stable" picture 15 px taller than the baseline, red. Alone it passes, in a full gate it fails - FLAKY-S12-PIXEL-2412.
 *
 * So the element is given room BEFORE the shot, with setViewportSize: the viewport grows until the element is whole inside its
 * scroll area, the shot needs no enlargement, and the page is a phone before, during and after it. phoneRoom() returns the way back
 * to the viewport the test had. stillAPhone() is the tripwire: it fails the moment anything has dropped the touch emulation.
 */
import { expect, type Page } from '@playwright/test';

/** Grow the viewport until the first element of `target` is whole inside its scroll area and the viewport. Returns `restore()`. */
export async function phoneRoom(page: Page, target: string): Promise<() => Promise<void>> {
  const before = page.viewportSize();
  if (!before) throw new Error('phoneRoom: the page has no fixed viewport');
  const el = page.locator(target).first();
  for (let round = 0; round < 5; round++) {
    // how much of the element is cut by the viewport or by a scroll area around it (shadow roots included), after bringing its top up
    const missing = await el.evaluate((node) => {
      node.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
      const r = node.getBoundingClientRect();
      let top = 0;
      let bottom = window.innerHeight;
      let n: Node | null = node.parentNode ?? (node.getRootNode() as ShadowRoot).host ?? null;
      while (n) {
        if (n instanceof Element && n !== document.documentElement && n !== document.body) {
          const cs = getComputedStyle(n);
          if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) {
            const b = n.getBoundingClientRect();
            top = Math.max(top, b.top + n.clientTop);
            bottom = Math.min(bottom, b.top + n.clientTop + n.clientHeight);
          }
        }
        n = n.parentNode ?? (n as ShadowRoot).host ?? null;
      }
      // under one pixel is the rounding of a scroll offset, not a cut
      const cut = Math.max(0, top - r.top) + Math.max(0, r.bottom - bottom);
      return cut < 1 ? 0 : Math.ceil(cut);
    });
    if (missing === 0) break;
    if (round === 4) throw new Error(`phoneRoom: ${target} is still cut by ${missing} px after 4 rounds`);
    const now = page.viewportSize()!;
    await page.setViewportSize({ width: now.width, height: now.height + missing + 16 });
  }
  return async () => {
    const now = page.viewportSize();
    if (now && now.height !== before.height) await page.setViewportSize(before);
  };
}

/** The page is still the phone the project asked for (a coarse pointer that cannot hover). */
export async function stillAPhone(page: Page, when: string): Promise<void> {
  const m = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, noHover: matchMedia('(hover: none)').matches }));
  expect(m, `${when}: the touch emulation of the page is gone (a screenshot of an element taller than the viewport drops it)`).toEqual({ coarse: true, noHover: true });
}
