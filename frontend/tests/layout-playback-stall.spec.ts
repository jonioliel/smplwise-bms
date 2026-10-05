import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { mock, openAndPlay, overlay, setAdv } from './playback-stall-mock';

// 2.0.0 stall states (docs/changes/PLAYBACK-STALL-RESUME.md): the layout guard (tests/layout-guard.ts) over the recordings screen's stage
// while it shows "מתחבר מחדש" and "הניגון נעצר" + retry, in all four skins x light and dark x widths 320 / 390 / 1440 (LAYOUT_FULL=1: the
// usual ten widths). FAILS on escape / overflow / clipped (every skin) and target (bubble, the guard's 44 px skin). Only the stage is
// measured (`within`); the overlay stays inside the picture and never covers the controls bar under it. Mocked backend.
//   npm run build; SW_BASE_URL=http://127.0.0.1:5291/ npx playwright test tests/layout-playback-stall.spec.ts --project=desktop
const WIDTHS = process.env.LAYOUT_FULL ? [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440] : [320, 390, 1440];
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const THEMES = ['light', 'dark'] as const;
const SHOTS = process.env.SW_SHOTS ?? '';
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// the stage's own pre-existing controls (sw-button internals, the speed pills) are covered by the playback specs; this guard is about the new overlay
const SKIP = 'sw-live-player, .bar, .stamp, .center';

async function measure(page: Page, ctx: string, keep: Finding['cls'][], skin: string, theme: string, state: string): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: height(w) });
    await settle(page);
    await page.waitForTimeout(80);
    const found = await page.evaluate(inPageCheck, { ctx: `${ctx} ${w}`, skip: SKIP, bubble: '.stall .box', roots: ['investigate-playback'], within: '.stage' });
    out.push(...found.filter((f) => keep.includes(f.cls)));
    // the overlay inside the picture, above the controls bar, inside the viewport
    const box = (await overlay(page).boundingBox())!;
    const bar = (await page.locator('investigate-playback .stage .bar .inner').boundingBox())!;
    const inner = (await overlay(page).locator('.box').boundingBox())!;
    expect(box.y + box.height, `${ctx} ${w}: the overlay ends above the controls bar`).toBeLessThanOrEqual(bar.y + 1);
    expect(inner.x, `${ctx} ${w}`).toBeGreaterThanOrEqual(box.x - 1);
    expect(inner.x + inner.width, `${ctx} ${w}`).toBeLessThanOrEqual(box.x + box.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${ctx} ${w}: no sideways scroll`).toBeLessThanOrEqual(0);
    if (SHOTS && (w === 320 || w === 1440)) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `stall-${state}-${skin}-${theme}-${w}.png`) });
    }
  }
  return out;
}

test.describe('playback stall states layout guard', () => {
  test.describe.configure({ timeout: 15 * 60_000 });
  for (const skin of SKINS) {
    test(`reconnecting and gave up [${skin}]`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const keep: Finding['cls'][] = skin === 'bubble' ? ['escape', 'overflow', 'clipped', 'target'] : ['escape', 'overflow', 'clipped'];
      const results: Finding[] = [];
      for (const theme of THEMES) {
        // reconnecting: the seek succeeds but the new generation never plays (the overlay stays for the 20 s attempt window)
        await page.setViewportSize({ width: 1440, height: 900 });
        const st = await mock(page);
        await openAndPlay(page, '', `design=a&skin=${skin}&scheme=${theme}`);
        await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
        await setAdv(page, false);
        await expect(overlay(page)).toHaveAttribute('data-stall', /stalled|reconnecting/, { timeout: 5000 });
        results.push(...(await measure(page, `reconnecting ${skin} ${theme}`, keep, skin, theme, 'reconnecting')));
        // gave up: every attempt fails
        st.seekFails = true;
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.setViewportSize({ width: 1440, height: 900 });
        const st2 = await mock(page);
        st2.seekFails = true;
        await openAndPlay(page, '', `design=a&skin=${skin}&scheme=${theme}`);
        await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
        await setAdv(page, false);
        await expect(overlay(page)).toHaveAttribute('data-stall', 'gave_up', { timeout: 15000 });
        results.push(...(await measure(page, `gave_up ${skin} ${theme}`, keep, skin, theme, 'gave-up')));
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      }
      const { byCls, lines } = summarize(results);
      console.log(`playback stall layout [${skin}]: ${THEMES.length * 2 * WIDTHS.length} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      expect(errors, 'no page errors').toEqual([]);
      expect(results.length, lines.join('\n')).toBe(0);
    });
  }
});
