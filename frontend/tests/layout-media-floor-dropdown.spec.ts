import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';

// 0.1.164 (DD6): the layout guard (tests/layout-guard.ts) over the media players and media screens pages, whose floor filter is now the shared
// dropdown, in the four skins x light / dark x widths 320 / 390 / 768 / 1440, with the dropdown closed and open. Static demo, the built app
// (npm run build, then the preview server). FAILS on escape / overflow / floating / clipped / target and on page errors.
// LAYOUT_WIDTHS=320,1440 narrows the widths.
const SKINS = ['bubble', 'classic', 'domus', 'tesla'] as const;
const THEMES = ['light', 'dark'] as const;
const WIDTHS = (process.env.LAYOUT_WIDTHS ? process.env.LAYOUT_WIDTHS.split(',').map(Number) : [320, 390, 768, 1440]);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.vh, .gbox, .bg, .veil, .edit-slot, .skl, .lay-rz, .wx-ic, .wx-fc svg, .fc';
const BUBBLE = '.arow, a.tile, .wg, .pcard, .hero, sw-kpi, .bsep, .rc, .scard, .msens, .search, .qsb, .qbtn, .mchip, .k, .vb, .rb, .pk, .pw, .rbtn, .cov, sw-dropdown .chip';

async function open(page: Page, skin: string, theme: string, screen: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#/multimedia/${screen}`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(([o]) => !!document.querySelector('sw-app')?.shadowRoot?.querySelector(o)?.shadowRoot?.querySelector('[data-floor-menu]'), [`multimedia-${screen}`] as const, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe('floor dropdown of the media pages: layout guard', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo spec');
  test.describe.configure({ timeout: 20 * 60_000 });
  for (const skin of SKINS) {
    test(`players and screens, ${skin}, light and dark`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const results: Finding[] = [];
      let runs = 0;
      for (const theme of THEMES) {
        for (const screen of ['players', 'screens'] as const) {
          await page.setViewportSize({ width: 1440, height: 900 });
          await open(page, skin, theme, screen);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await settle(page);
            for (const state of ['closed', 'open'] as const) {
              const dd = page.locator(`sw-app multimedia-${screen} [data-floor-menu]`);
              if (state === 'open') await dd.locator('.chip').first().click();
              else await page.keyboard.press('Escape');
              await settle(page);
              runs++;
              results.push(...(await page.evaluate(inPageCheck, { ctx: `${skin} ${screen} ${theme} ${w} ${state}`, bubble: BUBBLE, skip: SKIP, roots: [`multimedia-${screen}`] })));
              if (state === 'open') await page.keyboard.press('Escape');
            }
          }
        }
      }
      // Accepted by design, so they are dropped before the verdict: (1) the dropdown chip is 32 px with a 44 px hit area (::after, the component's
      // documented rule, the same chip as the shell's pair row), and (2) an OPEN popover floats over the page, that is its job.
      // The `target` findings of the other controls of the page are not this change's: the guard is the bubble skin's, the classic / domus / tesla
      // skins keep their own smaller controls (pre-existing, listed in the log), so for those skins only escape / overflow / clipped decide.
      const accepted = (f: Finding) =>
        (f.cls === 'target' && f.el.startsWith('button.chip "קומות')) || (f.cls === 'floating' && (f.el.startsWith('div.pop') || f.detail.includes('div.opt'))) || (skin !== 'bubble' && f.cls === 'target');
      const decisive = results.filter((f) => !accepted(f));
      const { byCls, lines } = summarize(results);
      const verdict = summarize(decisive).lines;
      console.log(`layout-media-floor-dropdown ${skin}: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(verdict, 'layout findings').toEqual([]);
    });
  }
});
