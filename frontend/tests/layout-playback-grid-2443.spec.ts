import { test, expect, type Page } from '@playwright/test';
import { mock, openAndPlay } from './playback-stall-mock';

// CR-NOSCROLL-LISTS-2443 (code review 06:PLAY-2 grid height, owner decision O12 = a; the CSS fix is PAGING-SETTING-2439 7d33316fe): the
// recordings screen's comparison grid at 2x2 (the lead camera + three picks) keeps the single video's height budget
// (max(200px, 100dvh - 560px)), so the page never scrolls and the timeline stays in the window - at 1920x1080 (the row's "2x2 at
// 1080p"), 1440x900 and 1366x768. Mocked backend (tests/playback-stall-mock.ts), classic light.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-playback-grid-2443.spec.ts --project=desktop --workers=1
const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
] as const;
const MORE = [{ name: 'מחסן' }, { name: 'לובי' }];

/** The vertical overflow of the document, the shell's <main> and the screen element; the grid and the timeline boxes. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const over = (el: Element | null | undefined) => (el ? el.scrollHeight - el.clientHeight : 0);
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const findDeep = (root: ParentNode, sel: string): Element | null => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const x = findDeep(el.shadowRoot, sel); if (x) return x; }
      return null;
    };
    const screen = findDeep(document, 'investigate-playback') as HTMLElement | null;
    const grid = screen?.shadowRoot?.querySelector('[data-pb-grid]')?.getBoundingClientRect();
    const tl = screen?.shadowRoot?.querySelector('sw-timeline')?.getBoundingClientRect();
    return {
      doc: over(document.scrollingElement), main: over(main), screen: over(screen),
      gridH: grid ? Math.round(grid.height) : -1, gridW: grid ? Math.round(grid.width) : -1, tlBottom: tl ? Math.round(tl.bottom) : -1, vh: innerHeight,
    };
  });

test.describe('the comparison grid at 2x2 fits the window (CR-NOSCROLL-LISTS-2443)', () => {
  for (const vp of VIEWPORTS) {
    test(`2x2 at ${vp.name}: the grid keeps the stage budget, the page does not scroll, the timeline is in view`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the viewports are set by the test itself');
      test.setTimeout(120_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      // the 0.1.68 stage budget (100dvh - 560px) is defined without the diagnostics row under the player (an installation setting,
      // `playback.diagnostics`): that row's own overflow is a separate item (RELEASE-2439-TRAIN note, owner question); hidden here
      const st = await mock(page, { cameras: MORE, settings: { 'playback.diagnostics': 'hidden' } });
      await openAndPlay(page, '&extra=c2,c3,c4', 'design=a&skin=classic&scheme=light');
      await expect.poll(() => st.groups.length).toBeGreaterThanOrEqual(1);
      await expect(page.locator('investigate-playback [data-pb-grid="4"]')).toBeVisible({ timeout: 20_000 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await measure(page);
      if (process.env.NOSCROLL_LOG) console.log(`2x2 ${vp.name}: ${JSON.stringify(m)}`);
      const budget = Math.max(200, vp.height - 560);
      expect(m.gridH, `grid height at ${vp.name} (budget ${budget})`).toBeGreaterThan(0);
      expect(m.gridH, `grid height at ${vp.name} (budget ${budget})`).toBeLessThanOrEqual(budget + 1);
      expect(Math.max(m.doc, m.main, m.screen), `page overflow at ${vp.name}: ${JSON.stringify(m)}`).toBeLessThanOrEqual(1);
      expect(m.tlBottom, `the timeline ends inside the window at ${vp.name}`).toBeLessThanOrEqual(m.vh);
    });
  }
});
