import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';

// Unreleased (owner request 2026-10-04): the layout guard (tests/layout-guard.ts) over the `capsule` dropdown style in EVERY skin
// (classic / domus / tesla / bubble), light and dark, every size (sm / md / lg), at a phone and a desktop width, with the 44 and the 32 px
// desktop touch dial, closed AND open (the popover on a wide screen, the bottom sheet on the phone). FAILS on escape / overflow / floating /
// clipped / target. One page load per skin x scheme x width; the three sizes are three dropdowns on the stage (closed) and one dropdown whose
// size is switched (open: a popover floats over its neighbours by design, so only one is mounted then).
// Needs the Vite DEV server:  ~/run_remote.sh spec <branch> tests/layout-dropdown-capsule.spec.ts --project=desktop
//   LAYOUT_QUICK=1 sweeps two skins and two widths only.
const QUICK = !!process.env.LAYOUT_QUICK;
const SKINS = QUICK ? ['classic', 'bubble'] : ['classic', 'domus', 'tesla', 'bubble'];
const SCHEMES = ['light', 'dark'] as const;
const WIDTHS = QUICK ? [390, 1280] : [320, 390, 1280];
const SIZES = ['sm', 'md', 'lg'] as const;
const height = (w: number) => (w <= 480 ? 844 : 900);

const ITEMS = [
  { id: 'all', label: 'כל הקומות', icon: 'home', count: 14 },
  { id: 'd1', label: '', divider: true },
  { id: 'f0', label: 'קומת קרקע', icon: 'layers', count: 6 },
  { id: 'f1', label: 'קומה ראשונה', icon: 'layers', count: 5 },
  { id: 'f2', label: 'גג', icon: 'layers', count: 3 },
];

async function stage(page: Page, skin: string, scheme: string, width: number) {
  await page.setViewportSize({ width, height: height(width) });
  await page.goto('about:blank');
  await page.goto(`./?design=a&skin=${skin}&scheme=${scheme}#/devices/building`);
  await page.waitForFunction(() => !!customElements.get('sw-dropdown') && !!customElements.get('sw-tabs'));
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px;display:flex;flex-direction:column;gap:20px;align-items:flex-start';
    document.body.appendChild(st);
    document.documentElement.setAttribute('data-dd-phone', 'sheet'); // the default is the small list (2026-10-05); keep guarding the sheet
  });
}

async function mountSizes(page: Page, sizes: readonly string[]) {
  await page.evaluate(
    ([list, items]) => {
      const st = document.querySelector('#stage') as HTMLElement;
      st.replaceChildren();
      for (const z of list as string[]) {
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.setAttribute('variant', 'dropdown');
        t.setAttribute('dd-style', 'capsule');
        t.setAttribute('dd-size', z);
        t.setAttribute('group-label', 'קומה');
        t.setAttribute('data-t', z);
        t.items = items;
        t.active = 'all';
        st.appendChild(t);
      }
    },
    [sizes as string[], ITEMS] as [string[], unknown[]],
  );
  await page.waitForTimeout(250);
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function check(page: Page, results: Finding[], ctx: string) {
  await settle(page);
  results.push(...(await page.evaluate(inPageCheck, { ctx, within: '#stage', skip: '.grab' })));
}

for (const skin of SKINS) {
  for (const scheme of SCHEMES) {
    test(`capsule layout guard: ${skin} ${scheme}, three sizes, closed and open, ${WIDTHS.join('/')} px, touch dial 44 and 32`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'one project: the widths are set here');
      const results: Finding[] = [];
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      let runs = 0;
      for (const w of WIDTHS) {
        await stage(page, skin, scheme, w);
        for (const dial of w > 1100 ? [44, 32] : [44]) {
          await page.evaluate((d) => document.documentElement.style.setProperty('--sw-touch-desktop', `${d}px`), dial);
          // closed: the three sizes together
          await mountSizes(page, SIZES);
          await check(page, results, `${skin}/${scheme}/${w}px/touch${dial}/closed`);
          runs++;
          // the capsule itself is never narrower than its label and never taller than the size says (the chip box is at least the touch target)
          const boxes = await page.evaluate(() => [...document.querySelectorAll('#stage sw-tabs')].map((t) => {
            const c = (t.shadowRoot!.querySelector('sw-dropdown') as HTMLElement).shadowRoot!.querySelector('.chip') as HTMLElement;
            const r = c.getBoundingClientRect();
            return { z: (t as HTMLElement).dataset.t, w: Math.round(r.width), h: Math.round(r.height) };
          }));
          for (const b of boxes) expect(b.h, `${skin}/${scheme}/${w}/${dial}: ${b.z} chip box`).toBeGreaterThanOrEqual(w <= 1100 ? 44 : dial);
          // open: one dropdown, each size in turn
          for (const z of SIZES) {
            await mountSizes(page, [z]);
            const chip = page.locator(`#stage sw-tabs[data-t="${z}"] sw-dropdown .chip`);
            await chip.click();
            await expect(page.locator(`#stage sw-tabs[data-t="${z}"] sw-dropdown [role=listbox]`)).toBeVisible();
            await check(page, results, `${skin}/${scheme}/${w}px/touch${dial}/open/${z}`);
            runs++;
            await page.keyboard.press('Escape');
          }
        }
      }
      const { byCls, lines } = summarize(results);
      console.log(`capsule ${skin}/${scheme}: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
}
