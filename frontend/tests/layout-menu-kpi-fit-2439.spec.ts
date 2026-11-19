import { test, expect, type Page } from '@playwright/test';
import { settle } from './helpers/settle';

// FIX-FLAKY-POLISH-WORSTCASE-2439: the regressions behind the layout-worstcase-screens-297 flake (the gates of 2.43.8), in demo mode:
//  1. a user menu or a notification centre that was never opened is never visible - its first style used to run the delayed hide
//     that is meant for closing, so the closed overlay stayed visible (accessibility tree, layout and contrast checks) for the first
//     transition time of every page load; a close after an open still keeps the panel visible while it slides away;
//  2. a view choice with three options (the building screen with the live plan) keeps its label whole: "תצוגה" was squeezed to
//     11 px of the 300 px popover and ran under the control;
//  3. a counter tile fits its figures again when a web font lands after the fit (the tile keeps its size, so neither a render nor
//     the ResizeObserver used to run the fit again: the figures stayed cut by a few pixels).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-menu-kpi-fit-2439.spec.ts --project=desktop --project=tablet --project=mobile

const MENU = 'sw-app sw-user-menu';

async function openBuilding(page: Page) {
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode whatever runs on the preview's proxy target
  await page.addInitScript(() => {
    // every frame of the load: is a closed overlay (the user menu, the notification centre) computed visible?
    const w = window as unknown as { __closedVisible: string[]; __seen: string[] };
    w.__closedVisible = [];
    w.__seen = [];
    const find = (root: Document | ShadowRoot, out: Element[] = []): Element[] => {
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === 'SW-USER-MENU' || el.tagName === 'NOTIFY-CENTER') out.push(el);
        if (el.shadowRoot) find(el.shadowRoot, out);
      }
      return out;
    };
    const tick = () => {
      for (const m of find(document)) {
        const tag = m.tagName.toLowerCase();
        if (!w.__seen.includes(tag)) w.__seen.push(tag);
        if (!m.hasAttribute('open') && !m.hasAttribute('data-was-open') && getComputedStyle(m).visibility !== 'hidden') {
          w.__closedVisible.push(`${tag} ${performance.now().toFixed(0)} ms`);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('about:blank');
  await page.goto('/?design=a#/devices/building');
  await expect(page.locator('sw-app devices-building sw-kpi').first()).toBeAttached({ timeout: 30_000 });
  await expect(page.locator(MENU)).toBeAttached();
  await page.waitForTimeout(1000);
  await settle(page);
}

test('a closed user menu or notification centre is never visible while the page loads; a close still slides the open panel away', async ({ page }) => {
  await openBuilding(page);
  const load = await page.evaluate(() => {
    const w = window as unknown as { __closedVisible: string[]; __seen: string[] };
    return { visible: w.__closedVisible, seen: [...w.__seen].sort() };
  });
  expect(load.seen, 'both overlays are on the page').toEqual(['notify-center', 'sw-user-menu']);
  expect(load.visible, 'frames with a closed overlay visible').toEqual([]);
  await page.locator('sw-app [data-profile-menu]:visible, sw-app [data-nav-me]:visible').first().click();
  await expect(page.locator(`${MENU} [data-user-menu]`)).toBeVisible();
  await settle(page);
  await page.keyboard.press('Escape');
  await expect(page.locator(`${MENU} [data-user-menu]`)).toBeHidden();
  // a closed menu that has been open keeps the delayed hide (the panel stays visible while it slides away); one never opened has none
  const delay = (m: Element) => [getComputedStyle(m).transitionProperty, parseFloat(getComputedStyle(m).transitionDelay)] as const;
  const [prop, wait] = await page.locator(MENU).evaluate(delay);
  expect(prop).toBe('visibility');
  expect(wait, 'the delayed hide after a close').toBeGreaterThan(0);
  const fresh = await page.evaluate(async () => {
    const out: string[][] = [];
    for (const tag of ['sw-user-menu', 'notify-center']) {
      const m = document.createElement(tag) as HTMLElement & { updateComplete: Promise<boolean> };
      document.body.appendChild(m);
      await m.updateComplete;
      const cs = getComputedStyle(m);
      out.push([tag, cs.visibility, cs.transitionProperty]);
      m.remove();
    }
    return out;
  });
  expect(fresh, 'an overlay never opened: hidden, no delayed hide').toEqual([['sw-user-menu', 'hidden', 'none'], ['notify-center', 'hidden', 'none']]);
});

test('a view choice with three options keeps its label whole inside the menu', async ({ page }) => {
  await openBuilding(page);
  // a menu of its own (the shell re-renders its menu with the screen's real choices - two in demo mode, no live plan)
  const row = await page.evaluate(async () => {
    const menu = document.createElement('sw-user-menu') as HTMLElement & { screenViews: unknown[]; open: boolean; name: string; updateComplete: Promise<boolean> };
    menu.name = 'בדיקה';
    menu.screenViews = [{ id: 'probe-view', label: 'תצוגה', icon: 'layers', current: 'cards', options: [{ value: 'cards', label: 'כרטיסים' }, { value: 'tiles', label: 'אריחים' }, { value: 'plan', label: 'תוכנית' }] }];
    document.body.appendChild(menu);
    await menu.updateComplete;
    menu.open = true;
    await menu.updateComplete;
    const li = menu.shadowRoot!.querySelector('[data-menu-screen-view="probe-view"]') as HTMLElement;
    const txt = li.querySelector('.txt') as HTMLElement;
    const seg = li.querySelector('.seg') as HTMLElement;
    const r = (el: Element) => el.getBoundingClientRect();
    const [lr, tr, sr] = [r(li), r(txt), r(seg)];
    const out = {
      label: txt.scrollWidth - txt.clientWidth,
      overlap: tr.right > sr.left + 0.5 && sr.right > tr.left + 0.5 && tr.bottom > sr.top + 0.5 && sr.bottom > tr.top + 0.5,
      segInside: sr.left >= lr.left - 0.5 && sr.right <= lr.right + 0.5,
      buttons: seg.querySelectorAll('button').length,
    };
    menu.open = false;
    await menu.updateComplete;
    menu.remove();
    return out;
  });
  expect(row.buttons).toBe(3);
  expect(row.label, 'the label is never cut (content wider than its box)').toBeLessThanOrEqual(1);
  expect(row.overlap, 'the label never runs under the control').toBe(false);
  expect(row.segInside, 'the control stays inside its row').toBe(true);
});

test('a counter tile fits its figures again when a web font lands after the fit', async ({ page }) => {
  await openBuilding(page);
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.id = 'kpi-font-probe';
    box.setAttribute('dir', 'rtl');
    // an unknown family: the fallback font draws the figures first, as before a web font has arrived
    box.style.cssText = 'position:fixed;inset-block-start:8px;inset-inline-start:8px;z-index:99999;inline-size:150px;font-family:SwLateFontProbe,sans-serif;background:var(--sw-bg)';
    // the tile keeps its size when the font lands, as in a grid of counters (fixed block size: no ResizeObserver callback either)
    box.innerHTML = '<sw-kpi layout="compact" icon="info" label="אורות" value="12 / 377" style="block-size:96px;box-sizing:border-box"></sw-kpi>';
    document.body.appendChild(box);
  });
  await settle(page);
  const clipped = () =>
    page.evaluate(() => {
      const v = document.querySelector('#kpi-font-probe sw-kpi')!.shadowRoot!.querySelector('.value') as HTMLElement;
      const cs = getComputedStyle(v);
      return { over: v.scrollWidth - v.clientWidth, cut: v.scrollWidth > v.clientWidth + 1 && cs.textOverflow !== 'ellipsis', fit: v.getAttribute('data-fit') };
    });
  expect((await clipped()).cut, 'the fallback-font figures fit their tile').toBe(false);
  // the web font arrives: its figures are drawn much wider than the fallback's (size-adjust), the tile keeps its size
  await page.evaluate(async () => {
    const face = new FontFace('SwLateFontProbe', `url(${new URL('fonts/heebo-latin-700.woff2', document.baseURI).href})`, { weight: '100 900', sizeAdjust: '170%' } as FontFaceDescriptors); // size-adjust: a Chromium descriptor the DOM typings lack
    document.fonts.add(face);
    await face.load();
  });
  await settle(page);
  const after = await clipped();
  expect(after.cut, `the figures after the font arrived (${after.over}px over, fit ${after.fit})`).toBe(false);
});
