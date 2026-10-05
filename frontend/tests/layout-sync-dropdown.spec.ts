import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { mock } from './playback-stall-mock';

// 2.0.1 (owner approval 2026-10-05): the layout guard (tests/layout-guard.ts) over the synchronized-playback screen's camera picker -
// closed with four picks, open at the limit (disabled options, the foot with the count / "נקה" / "סיום") - in all four skins x light
// and dark x two dropdown styles (`auto` and one of the six per skin) x widths 320 / 390 / 1440 (LAYOUT_FULL=1: the usual ten widths).
// FAILS on escape / overflow / clipped / target (44 px on touch widths, the desktop dial above) in every skin; floating is not kept (the
// open list floats over the cards by design). Only the picker's row is measured (`within`). Mocked backend. SW_SHOTS=<dir> saves the
// 390 / 1440 screenshots (the before / after evidence).
//   npm run build; SW_BASE_URL=http://127.0.0.1:5291/ npx playwright test tests/layout-sync-dropdown.spec.ts --project=desktop
const WIDTHS = process.env.LAYOUT_FULL ? [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440] : [320, 390, 1440];
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const THEMES = ['light', 'dark'] as const;
const STYLE_OF: Record<(typeof SKINS)[number], string> = { classic: 'field', domus: 'pill', tesla: 'prefix', bubble: 'capsule' };
const SHOTS = process.env.SW_SHOTS ?? '';
const MORE = [{ name: 'מחסן' }, { name: 'לובי' }, { name: 'מעלית' }, { name: 'גג' }, { name: 'חצר אחורית' }, { name: 'מסדרון' }, { name: 'שער' }];
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const pick = (page: Page) => page.locator('investigate-sync sw-dropdown[data-sync-pick-cameras]');
const KEEP: Finding['cls'][] = ['escape', 'overflow', 'clipped', 'target'];

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function measure(page: Page, ctx: string, skin: string, theme: string, style: string): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: height(w) });
    // the 32 px desktop touch dial is a desktop choice: on a touch layout (<= 1100 px) the rows are 44 px whatever the dial says, so the
    // guard measures the dial only on the wide widths (the capsule guard does the same); bubble keeps 44 everywhere
    await page.evaluate((v) => (v ? document.documentElement.style.setProperty('--sw-touch-desktop', v) : document.documentElement.style.removeProperty('--sw-touch-desktop')), w > 1100 && skin !== 'bubble' ? '32px' : '');
    await settle(page);
    await page.waitForTimeout(80);
    // closed
    out.push(...(await page.evaluate(inPageCheck, { ctx: `${ctx} ${w} closed`, roots: ['investigate-sync'], within: '.filters' })).filter((f) => KEEP.includes(f.cls)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${ctx} ${w}: no sideways scroll`).toBeLessThanOrEqual(0);
    // the row of the picker is one line tall at every width (the chips of 2.0.0 took a row per camera): no taller than 2 chips
    const row = (await page.locator('investigate-sync .filters').boundingBox())!;
    expect(row.height, `${ctx} ${w}: the picker's row stays compact`).toBeLessThanOrEqual(100);
    if (w === 390 || w === 1440) await shot(page, `sync-${skin}-${theme}-${style}-${w}-closed`);
    // open at the limit
    await pick(page).locator('.chip').click();
    await expect(pick(page).locator('[role=listbox]')).toBeVisible();
    await page.waitForTimeout(350); // the sheet's slide-up
    await settle(page);
    out.push(...(await page.evaluate(inPageCheck, { ctx: `${ctx} ${w} open`, roots: ['investigate-sync'], within: '.filters', skip: '.grab' })).filter((f) => KEEP.includes(f.cls)));
    if (w === 390 || w === 1440) await shot(page, `sync-${skin}-${theme}-${style}-${w}-open`);
    await page.keyboard.press('Escape');
    await expect(pick(page).locator('.chip')).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(260);
  }
  return out;
}

test.describe('synchronized playback picker layout guard', () => {
  test.describe.configure({ timeout: 15 * 60_000 });
  for (const skin of SKINS) {
    test(`closed and open at the limit [${skin}]`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const results: Finding[] = [];
      let checks = 0;
      for (const theme of THEMES) {
        for (const style of ['auto', STYLE_OF[skin]]) {
          await page.setViewportSize({ width: 1440, height: 900 });
          await mock(page, { cameras: MORE, settings: { 'ui.dd_style': style } });
          await page.goto('about:blank');
          await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#/investigate/playback/sync`);
          await expect(pick(page).locator('.chip')).toBeVisible({ timeout: 20000 });
          await page.waitForTimeout(1500); // the shell recreates the screen once after the session settles
          await expect(pick(page)).toHaveAttribute('dd-style', style);
          // four picks (the limit), then closed
          await pick(page).locator('.chip').click();
          for (const id of ['c1', 'c2', 'c3', 'c4']) await pick(page).locator(`[role=option][data-id="${id}"]`).click();
          await expect(page.locator('investigate-sync [data-sync-pick]')).toHaveCount(4);
          await pick(page).locator('[data-dd-done]').click();
          await expect(pick(page).locator('.chip')).toHaveAttribute('aria-expanded', 'false');
          await page.waitForTimeout(260);
          results.push(...(await measure(page, `${skin} ${theme} ${style}`, skin, theme, style)));
          checks += WIDTHS.length * 2;
          await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
      }
      const { byCls, lines } = summarize(results);
      console.log(`sync picker layout [${skin}]: ${checks} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      expect(errors, 'no page errors').toEqual([]);
      expect(results.length, lines.join('\n')).toBe(0);
    });
  }
});
