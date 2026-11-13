import { test, expect } from 'C:/cloude/smplwise-3drealism2/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-3drealism2/frontend/src/map/scene-builder';
import { houseInput, houseLabels } from 'C:/cloude/smplwise-3drealism2/frontend/tests/lookdev/house';
import { denseDesc } from './dense';

// In-page A/B of the baked AO (PLAN3D-REALISM2-2433 S1): the same view, the bake on (GTAO stepped down) / off (GTAO as before),
// interleaved (the machine is shared: alternating cancels the drift). Median of 9 alternations of benchFrames(15).
const OUT = process.env.SHOT_OUT ?? 'C:/cloude/smplwise-3drealism2/evidence/PLAN3D-REALISM2-2433';
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.setTimeout(900_000);

test('ab', async ({ page }) => {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; (n as any).minFps = 0; });
  const rows: string[] = [];
  for (const scene of ['house', 'dense']) for (const rung of ['[data-quality-3]', '[data-quality-3-lite]']) {
    await el.locator(rung).click();
    const desc = scene === 'dense' ? denseDesc('L0') : buildScene(houseInput({ level: 'L0', walk: false, realistic: true }));
    await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = 'L0'; e.labels = a.labels; e.description = a.desc; e.timeManual = { hour: 13, ymd: [2026, 10, 13] }; },
      { desc, labels: scene === 'dense' ? {} : houseLabels() });
    await el.locator('[data-preset-iso]').click();
    await el.evaluate((n) => (n as any).applySun());
    await expect.poll(() => el.evaluate((n) => (n as any).view?.realPending ?? 0), { timeout: 180_000 }).toBe(0);
    await page.waitForTimeout(1500);
    const r = await el.evaluate((n) => {
      const v = (n as any).view;
      const on: number[] = [], off: number[] = [];
      let callsOn = 0, callsOff = 0;
      v.setBakedAo(true); v.benchFrames(5); v.setBakedAo(false); v.benchFrames(5);
      for (let i = 0; i < 9; i++) {
        v.setBakedAo(false); off.push(v.benchFrames(15)); callsOff = v.lastFrameInfo.calls;
        v.setBakedAo(true); on.push(v.benchFrames(15)); callsOn = v.lastFrameInfo.calls;
      }
      const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
      return { on: Math.round(med(on) * 100) / 100, off: Math.round(med(off) * 100) / 100, callsOn, callsOff, ao: v.bakedAo, rung: n.getAttribute('data-rung') };
    });
    rows.push(`| ${scene} | ${r.rung} | ${r.off} | ${r.on} | ${Math.round((r.on - r.off) * 100) / 100} | ${r.callsOff} / ${r.callsOn} | ${r.ao?.dims?.join('x')} | ${r.ao?.bytes} | ${r.ao?.source} ${r.ao?.bakeMs} ms bake, ${r.ao?.ms} ms total | ${JSON.stringify(r.ao?.gtao)} |`);
  }
  fs.writeFileSync(`${OUT}/ab-ao.md`, '| Scene | Rung | AO off ms (GTAO 6 / full blend) | AO on ms (GTAO 4 / 0.6 blend) | Cost | Calls off / on | Volume | Bytes | First bake | GTAO with AO |\n|---|---|---|---|---|---|---|---|---|---|\n' + rows.join('\n') + '\n');
});
