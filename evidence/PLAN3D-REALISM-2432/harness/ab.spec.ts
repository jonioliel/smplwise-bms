import { test, expect, type Page, type Locator } from 'C:/cloude/smplwise-3drealism/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-3drealism/frontend/src/map/scene-builder';
import { houseInput, houseLabels } from 'C:/cloude/smplwise-3drealism/frontend/tests/lookdev/house';

// In-page A/B of the room glow: the same view, the glow shown / hidden, interleaved (the machine is shared: alternating
// cancels the drift). Median of N alternations of benchFrames(20).
const OUT = process.env.SHOT_OUT ?? '.';
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.setTimeout(600_000);

test('ab', async ({ page }) => {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; (n as any).minFps = 0; });
  const rows: string[] = [];
  for (const rung of ['[data-quality-3]', '[data-quality-3-lite]']) {
    await el.locator(rung).click();
    const desc = buildScene(houseInput({ level: 'L0', walk: false, realistic: true }));
    await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = 'L0'; e.labels = a.labels; e.description = a.desc; e.timeManual = { hour: 21, ymd: [2026, 10, 13] }; }, { desc, labels: houseLabels() });
    await el.locator('[data-preset-iso]').click();
    await el.evaluate((n) => (n as any).applySun());
    await expect.poll(() => el.evaluate((n) => (n as any).view?.realPending ?? 0), { timeout: 120_000 }).toBe(0);
    await page.waitForTimeout(1500);
    const r = await el.evaluate((n) => {
      const v = (n as any).view;
      const g = v.realBuilt?.glow;
      const on: number[] = [], off: number[] = [];
      let callsOn = 0, callsOff = 0;
      v.benchFrames(5);
      for (let i = 0; i < 9; i++) {
        g.root.visible = false; off.push(v.benchFrames(15)); callsOff = v.lastFrameInfo.calls;
        g.root.visible = true; on.push(v.benchFrames(15)); callsOn = v.lastFrameInfo.calls;
      }
      const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
      return { on: Math.round(med(on) * 100) / 100, off: Math.round(med(off) * 100) / 100, callsOn, callsOff, stats: g.stats(), rung: n.getAttribute('data-rung') };
    });
    rows.push(`| ${r.rung} | night iso | ${r.off} | ${r.on} | ${r.callsOff} | ${r.callsOn} | ${JSON.stringify(r.stats)} |`);
  }
  fs.writeFileSync(`${OUT}/ab-glow.md`, rows.join('\n') + '\n');
});
