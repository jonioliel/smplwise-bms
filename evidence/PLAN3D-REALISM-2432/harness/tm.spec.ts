import { test, expect } from 'C:/cloude/smplwise-3drealism/frontend/node_modules/@playwright/test/index.mjs';
import { buildScene } from 'C:/cloude/smplwise-3drealism/frontend/src/map/scene-builder';
import { houseInput, houseLabels } from 'C:/cloude/smplwise-3drealism/frontend/tests/lookdev/house';

// Tone mapping comparison: the same view under Neutral (7), AgX (6), ACES (4), at a given exposure multiplier.
const OUT = process.env.SHOT_OUT ?? '.';
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.setTimeout(600_000);

test('tm', async ({ page }) => {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; (n as any).minFps = 0; });
  if (process.env.SHOT_EXTRA) await el.evaluate((n, x) => Object.assign(n as any, JSON.parse(x)), process.env.SHOT_EXTRA);
  await el.locator('[data-quality-3]').click();
  const desc = buildScene(houseInput({ level: 'L0', walk: false, realistic: true }));
  await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = 'L0'; e.labels = a.labels; e.description = a.desc; }, { desc, labels: houseLabels() });
  await el.locator('[data-preset-iso]').click();
  for (const h of [13, 21]) {
    await el.evaluate((n, hh) => { const e = n as any; e.timeManual = { hour: hh, ymd: [2026, 10, 13] }; e.applySun(); }, h);
    await expect.poll(() => el.evaluate((n) => (n as any).view?.realPending ?? 0), { timeout: 120_000 }).toBe(0);
    await page.waitForTimeout(1200);
    for (const [tm, name] of [[7, 'neutral'], [6, 'agx'], [4, 'aces']] as const) {
      await el.evaluate((n, t) => { const v = (n as any).view; v.renderer.toneMapping = t; v.post?.composer.passes.forEach((p: any) => { if (p.constructor.name.includes('Output') || p._toneMapping !== undefined) p._toneMapping = null; }); v.benchFrames(1); }, tm);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/tm-${h}-${name}.png` });
    }
    await el.evaluate((n) => { (n as any).view.renderer.toneMapping = 7; });
  }
});
