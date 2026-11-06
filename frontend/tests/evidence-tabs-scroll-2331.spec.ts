import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SETTINGS-TABS-SCROLL-2331 (owner request 2026-11-01): a long tab strip (sw-tabs, bar forms) shows a scroll arrow at each side that hides
// tabs (RTL-correct), scrolls sideways with a vertical mouse wheel, a finger swipe and the arrow keys, and keeps the active tab in view on
// load and on a route change. Demo mode (no backend), the built app - every project:
//   npm run build; npx vite preview --host 127.0.0.1 --port 4202 --strictPort   then
//   $env:SW_BASE_URL='http://127.0.0.1:4202/'; npx playwright test tests/evidence-tabs-scroll-2331.spec.ts --workers=3
// Screenshots: docs/evidence/SETTINGS-TABS-SCROLL-2331/after-<project>-*.png
const OUT = process.env.SW_SHOTS ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/SETTINGS-TABS-SCROLL-2331');
const STRIP = 'sw-tabs[data-settings-tabs]';

interface Probe {
  more: string;
  fade: string;
  scroll: number;
  max: number;
  startArrow: boolean;
  endArrow: boolean;
  activeInView: boolean;
  active: string;
  focused: string;
}

async function go(page: Page, tab: string) {
  await page.goto(`./?skin=domus&scheme=light#/system/diagnostics?tab=${tab}`);
  await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('main'));
  await page.waitForTimeout(1500);
}

async function probe(page: Page, sel = STRIP): Promise<Probe> {
  return page.evaluate((s) => {
    const find = (root: Document | ShadowRoot, q: string): Element | null => {
      const hit = root.querySelector(q);
      if (hit) return hit;
      for (const x of root.querySelectorAll('*')) {
        if (x.shadowRoot) {
          const r = find(x.shadowRoot, q);
          if (r) return r;
        }
      }
      return null;
    };
    const host = find(document, s) as HTMLElement;
    const root = host.shadowRoot!;
    const vp = root.querySelector<HTMLElement>('[data-tabs-viewport]')!;
    const box = vp.getBoundingClientRect();
    const shown = (side: string) => {
      const a = root.querySelector<HTMLElement>(`[data-tabs-arrow=${side}]`)!;
      const cs = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      return cs.visibility === 'visible' && cs.pointerEvents !== 'none' && r.width > 0 && r.left >= box.left - 1 && r.right <= box.right + 1;
    };
    const on = root.querySelector<HTMLElement>('.on')!;
    const r = on.getBoundingClientRect();
    return {
      more: host.getAttribute('data-more') ?? '',
      fade: host.getAttribute('data-fade') ?? '',
      scroll: Math.round(vp.scrollLeft),
      max: vp.scrollWidth - vp.clientWidth,
      startArrow: shown('start'),
      endArrow: shown('end'),
      activeInView: r.left >= box.left - 1 && r.right <= box.right + 1,
      active: on.textContent?.trim() ?? '',
      focused: (root.activeElement as HTMLElement | null)?.textContent?.trim() ?? '',
    };
  }, sel);
}

async function arrowBox(page: Page, side: 'start' | 'end') {
  return page.locator(`${STRIP} [data-tabs-arrow=${side}]`).boundingBox();
}

async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(OUT, { recursive: true });
  const h = project === 'mobile' ? 360 : 260;
  await page.screenshot({ path: path.join(OUT, `after-${project}-${name}.png`), clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: h } });
}

test('the settings strip overflows: only the end arrow at the start, the start tab active and in view', async ({ page }, info) => {
  await go(page, 'general');
  const p = await probe(page);
  expect(p.max).toBeGreaterThan(20);
  expect(p.more).toBe('end');
  expect(p.endArrow).toBe(true);
  expect(p.startArrow).toBe(false);
  expect(p.activeInView).toBe(true);
  // RTL: the end arrow is the LEFT one
  const end = (await arrowBox(page, 'end'))!;
  const vp = (await page.locator(`${STRIP} [data-tabs-viewport]`).boundingBox())!;
  expect(end.x).toBeLessThan(vp.x + vp.width / 2);
  await shot(page, 'general', info.project.name);
});

test('the end arrow scrolls toward the end (left in RTL) and then both arrows show', async ({ page }, info) => {
  await go(page, 'general');
  const before = await probe(page);
  const end = (await arrowBox(page, 'end'))!;
  await page.mouse.click(end.x + end.width / 2, end.y + end.height / 2);
  await page.waitForTimeout(700);
  const after = await probe(page);
  expect(after.scroll).toBeLessThan(before.scroll); // RTL scrollLeft goes negative toward the end
  expect(after.more === 'both' || after.more === 'start').toBe(true);
  expect(after.startArrow).toBe(true);
  // the start arrow brings it back
  const start = (await arrowBox(page, 'start'))!;
  for (let i = 0; i < 6 && (await probe(page)).scroll < 0; i++) {
    await page.mouse.click(start.x + start.width / 2, start.y + start.height / 2);
    await page.waitForTimeout(500);
  }
  expect((await probe(page)).scroll).toBe(0);
  await page.mouse.click(end.x + end.width / 2, end.y + end.height / 2);
  await page.waitForTimeout(700);
  await shot(page, 'scrolled', info.project.name);
});

test('the active last tab is revealed on load and on a route change', async ({ page }, info) => {
  await go(page, 'support');
  let p = await probe(page);
  expect(p.activeInView).toBe(true);
  expect(p.startArrow).toBe(true);
  expect(p.more).toMatch(/start|both/);
  await shot(page, 'support', info.project.name);
  // a route change back to the first tab brings the start back into view
  await page.evaluate(() => (window.location.hash = '#/system/diagnostics?tab=general'));
  await page.waitForTimeout(1200);
  p = await probe(page);
  expect(p.activeInView).toBe(true);
  // and on to a middle one
  await page.evaluate(() => (window.location.hash = '#/system/diagnostics?tab=remote'));
  await page.waitForTimeout(1200);
  p = await probe(page);
  expect(p.activeInView).toBe(true);
});

test('a vertical mouse wheel over the strip scrolls it sideways', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'a mouse wheel: desktop and tablet');
  await go(page, 'general');
  const vp = (await page.locator(`${STRIP} [data-tabs-viewport]`).boundingBox())!;
  await page.mouse.move(vp.x + vp.width / 2, vp.y + vp.height / 2);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(400);
  const p = await probe(page);
  expect(p.scroll).toBeLessThan(0);
  // at the start edge, wheeling up leaves the strip alone (the page keeps the wheel)
  await page.mouse.wheel(0, -2000);
  await page.waitForTimeout(400);
  expect((await probe(page)).scroll).toBe(0);
});

test('a finger swipe scrolls the strip', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'touch: the phone project');
  await go(page, 'general');
  const vp = (await page.locator(`${STRIP} [data-tabs-viewport]`).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const y = vp.y + vp.height / 2;
  // RTL: dragging the finger to the right reveals the tabs at the end (on the left)
  const swipe = async (dx: number) => {
    const x0 = Math.round(vp.x + vp.width / 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 10, y }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
  };
  await swipe(150);
  const moved = (await probe(page)).scroll;
  expect(moved).toBeLessThan(0);
  expect((await probe(page)).startArrow).toBe(true);
  await swipe(-150); // and back toward the start
  expect((await probe(page)).scroll).toBeGreaterThan(moved);
});

test('the keyboard walks the tabs: ArrowLeft is the next tab in RTL, End the last one (kept in view)', async ({ page }) => {
  await go(page, 'general');
  await page.locator(`${STRIP} a.on, ${STRIP} button.on`).first().focus();
  await page.keyboard.press('ArrowLeft');
  expect((await probe(page)).focused).toBe('לשוניות');
  await page.keyboard.press('ArrowRight');
  expect((await probe(page)).focused).toBe('מראה ותצוגה');
  await page.keyboard.press('End');
  await page.waitForTimeout(700);
  const p = await probe(page);
  expect(p.focused).toBe('תמיכה');
  const box = (await page.locator(`${STRIP} [data-tabs-viewport]`).boundingBox())!;
  const last = (await page.locator(`${STRIP} .row > *`).last().boundingBox())!;
  expect(last.x).toBeGreaterThanOrEqual(box.x - 1);
  expect(last.x + last.width).toBeLessThanOrEqual(box.x + box.width + 1);
  await page.keyboard.press('Home');
  await page.waitForTimeout(700);
  expect((await probe(page)).focused).toBe('מראה ותצוגה');
});

test('the shell area strip (the settings sections, pill) gets the same arrows', async ({ page }) => {
  await go(page, 'general');
  const p = await probe(page, 'sw-tabs[data-area-tabs]');
  if (p.max <= 1) test.skip(true, 'the section strip fits this width');
  expect(p.more).toMatch(/start|end|both/);
  expect(p.startArrow || p.endArrow).toBe(true);
  expect(p.activeInView).toBe(true);
});

test('a strip that fits shows no arrow', async ({ page }) => {
  await go(page, 'general');
  const p = await page.evaluate(async () => {
    const el = document.createElement('sw-tabs') as HTMLElement & { items: unknown[]; active: string };
    el.items = [{ id: 'a', label: 'אחת' }, { id: 'b', label: 'שתיים' }];
    el.active = 'a';
    el.style.cssText = 'position:fixed;top:0;right:0;z-index:99';
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 300));
    const arrows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-tabs-arrow]')].map((a) => getComputedStyle(a).visibility);
    const res = { more: el.getAttribute('data-more'), arrows };
    el.remove();
    return res;
  });
  expect(p.more).toBeNull();
  expect(p.arrows).toEqual(['hidden', 'hidden']);
});

test('FOLLOWUPS-2406: the automatic reveal does not depend on the widths the strip passed through', async ({ page }) => {
  // The shell's top strip changes width while it settles (the title-row chips from 1100 px, the fit pump); which width the first
  // resize callback saw used to decide the final scroll position (installer-lifecycle-1440 drew the strip scrolled in 1 of 2 runs).
  await go(page, 'general');
  const r = await page.evaluate(async () => {
    const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 120))));
    const make = (width: number) => {
      const box = document.createElement('div');
      box.style.cssText = `position:fixed;top:0;right:0;z-index:99;width:${width}px`;
      const el = document.createElement('sw-tabs') as HTMLElement & { items: unknown[]; active: string };
      el.items = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, label: `לשונית מספר ${i + 1}` }));
      el.active = 't7';
      box.appendChild(el);
      document.body.appendChild(box);
      return { box, el };
    };
    const scrollOf = (el: HTMLElement) => Math.round(el.shadowRoot!.querySelector<HTMLElement>('[data-tabs-viewport]')!.scrollLeft);
    const overflow = (el: HTMLElement) => {
      const vp = el.shadowRoot!.querySelector<HTMLElement>('[data-tabs-viewport]')!;
      return vp.scrollWidth - vp.clientWidth;
    };
    // straight to the final width
    const fresh = make(560);
    await frames();
    const direct = scrollOf(fresh.el);
    const directOverflow = overflow(fresh.el);
    fresh.box.remove();
    // narrow first (the reveal scrolls further), then the final width
    const moved = make(260);
    await frames();
    const narrow = scrollOf(moved.el);
    moved.box.style.width = '560px';
    await frames();
    const settled = scrollOf(moved.el);
    // after the person scrolled, a resize only keeps the active tab in view (it does not jump back)
    moved.el.shadowRoot!.querySelector<HTMLElement>('[data-tabs-viewport]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    moved.box.style.width = '300px';
    await frames();
    moved.box.style.width = '560px';
    await frames();
    const vp = moved.el.shadowRoot!.querySelector<HTMLElement>('[data-tabs-viewport]')!.getBoundingClientRect();
    const on = moved.el.shadowRoot!.querySelector<HTMLElement>('.on')!.getBoundingClientRect();
    const afterManual = on.left >= vp.left - 1 && on.right <= vp.right + 1;
    moved.box.remove();
    return { direct, directOverflow, narrow, settled, afterManual };
  });
  expect(r.directOverflow, 'the final width still overflows (otherwise the check proves nothing)').toBeGreaterThan(20);
  expect(r.narrow, 'the narrow width needed a further scroll').not.toBe(r.direct);
  expect(r.settled).toBe(r.direct);
  expect(r.afterManual, 'the active tab stays in view after a manual scroll and a resize').toBe(true);
});
