import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installMulti } from './multi-nvr-mock';

// CR-024 (multi-NVR): the layout guard (tests/layout-guard.ts) over the screens this change touched, with two recorders - the recorders
// card (list, an open connection form, the add dialog), the camera settings table with its recorder filter, the wall with its recorder
// filter and the event log with its recorder filter - in all four skins x light and dark x widths 320..1440. FAILS on escape / overflow /
// clipped (every skin) and target (bubble, the guard's 44 px skin). Only the touched components are measured (`within`).
//   ~/run_remote.sh spec <branch> tests/layout-multi-nvr.spec.ts --project=desktop      (LAYOUT_QUICK=1: four widths)
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SKIP = 'sw-button, sw-toggle, nvr-undo-toast, .vh, .trap, sw-camera-tile';

interface Screen {
  name: string;
  route: string;
  ready: string;
  within: string;
  prep?: (p: Page) => Promise<void>;
}
const CARD = 'sw-app system-setup nvr-recorders-card';
const SCREENS: Screen[] = [
  { name: 'recorders', route: '/system/setup', ready: `${CARD} [data-recorder="nvr-2"]`, within: 'nvr-recorders-card' },
  { name: 'recorder-connection', route: '/system/setup', ready: `${CARD} [data-recorder="nvr-2"]`, within: 'nvr-recorders-card',
    prep: async (p) => { await p.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-connection]`).click(); await p.locator(`${CARD} [data-recorder="nvr-2"] [data-conn-summary]`).waitFor(); } },
  { name: 'recorder-rename', route: '/system/setup', ready: `${CARD} [data-recorder="nvr-2"]`, within: 'nvr-recorders-card',
    prep: async (p) => { await p.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-rename]`).click(); } },
  { name: 'cameras-table', route: '/system/security/cameras', ready: 'sw-app system-security-cameras [data-nvr-cameras][data-state="ready"]', within: 'system-security-cameras' },
  { name: 'wall', route: '/live/wall', ready: 'live-wall sw-camera-tile[data-cam]', within: 'live-wall' },
  { name: 'events', route: '/investigate/events', ready: 'investigate-events select[data-filter-recorder]', within: 'investigate-events' },
];

test.describe('multi-NVR layout guard', () => {
  test.describe.configure({ timeout: 40 * 60_000 });
  for (const skin of SKINS) {
    test(`touched screens with two recorders [${skin}]`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const results: Finding[] = [];
      let runs = 0;
      await installMulti(page);
      await page.addInitScript(() => localStorage.setItem('sw.wall.count', '9'));
      const keep: Finding['cls'][] = skin === 'bubble' ? ['escape', 'overflow', 'clipped', 'target'] : ['escape', 'overflow', 'clipped'];
      for (const theme of THEMES) {
        for (const s of SCREENS) {
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#${s.route}`);
          await page.waitForSelector('sw-app');
          await expect(page.locator(s.ready).first()).toBeAttached({ timeout: 20_000 });
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await settle(page);
            await page.waitForTimeout(80);
            runs++;
            const found = await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, skip: SKIP, roots: [s.within], within: s.within });
            results.push(...found.filter((f) => keep.includes(f.cls)));
          }
        }
      }
      // the add dialog (a modal in the top layer): its own box inside the viewport at a phone and a desktop width
      for (const w of [360, 1280]) {
        await page.setViewportSize({ width: w, height: height(w) });
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=light#/system/setup`);
        await page.locator(`${CARD} [data-recorder-add]`).click();
        const box = await page.locator(`${CARD} sw-dialog[open][data-recorder-add-dialog]`).evaluate((el) => {
          const dlg = el.shadowRoot?.querySelector('dialog, .panel, [role="dialog"]') as HTMLElement | null;
          const r = (dlg ?? (el as HTMLElement)).getBoundingClientRect();
          return { left: r.left, right: r.right, vw: innerWidth };
        });
        runs++;
        if (box.left < -0.5 || box.right > box.vw + 0.5) results.push({ cls: 'escape', el: 'add dialog', detail: `${Math.round(box.left)}..${Math.round(box.right)} of ${box.vw}`, ctx: `add-dialog ${skin} ${w}` });
      }
      const { byCls, lines } = summarize(results);
      console.log(`multi-NVR layout [${skin}]: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
