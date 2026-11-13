import { test, expect, type Page, type Locator } from 'C:/cloude/smplwise-3dlevel3/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-3dlevel3/frontend/src/map/scene-builder';
import { houseInput } from 'C:/cloude/smplwise-3dlevel3/frontend/tests/lookdev/house';
import { denseDesc } from './dense';

// PLAN3D-LEVEL3-2435: the floor reflections' frame cost, in-page A/B (the workstation is shared: absolute numbers swing, so the
// on / off frames are interleaved on the same scene) - 9 pairs of benchFrames(15), median of each side.
const OUT = process.env.SHOT_OUT ?? 'C:/cloude/smplwise-3dlevel3/evidence/PLAN3D-LEVEL3-2435/after';
const DRY = new Set(['r-living', 'r-office', 'r-hall', 'r-corr', 'r-gallery', 'r-ucorr']);
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.setTimeout(900_000);

async function settle(el: Locator, page: Page) {
  await expect.poll(() => el.evaluate((n) => (n as any).view?.realPending ?? 0), { timeout: 180_000 }).toBe(0);
  await page.waitForTimeout(1200);
}
const rows: string[] = [];
async function ab(el: Locator, page: Page, name: string) {
  await settle(el, page);
  const r = await el.evaluate((n) => {
    const v = (n as any).view;
    const on: number[] = [];
    const off: number[] = [];
    v.benchFrames(5);
    for (let k = 0; k < 9; k++) {
      v.post.setReflections(true);
      on.push(v.benchFrames(15));
      v.post.setReflections(false);
      off.push(v.benchFrames(15));
    }
    v.post.setReflections(true);
    const med = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    v.benchFrames(1);
    return { on: Math.round(med(on) * 100) / 100, off: Math.round(med(off) * 100) / 100, calls: v.lastFrameInfo?.calls, tris: v.lastFrameInfo?.triangles, passes: v.postPasses.join(' > ') };
  });
  rows.push(`| ${name} | ${r.off} | ${r.on} | ${Math.round((r.on - r.off) * 100) / 100} | ${r.calls} | ${r.tris} | ${r.passes} |`);
}

test('ab-reflections', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; (n as any).minFps = 0; });
  await el.locator('[data-quality-3]').click();
  const inp = houseInput({ level: 'L0', walk: false, realistic: true });
  for (const r of inp.doc.rooms) if (DRY.has(r.id)) delete r.floor_material_id;
  const desc = buildScene(inp);
  await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = 'L0'; e.labels = {}; e.description = a.desc; e.timeManual = { hour: 13, ymd: [2026, 10, 13] }; e.applySun(); }, { desc });
  await el.locator('[data-preset-iso]').click();
  await ab(el, page, 'house L0 iso (marble)');
  await el.locator('[data-preset-persp]').click();
  await el.evaluate((n) => { const v = (n as any).view; v.userCamera = true; v.persp.position.set(6.3, 1.5, 5.3); v.controls.target.set(9.6, 0.3, 2.8); v.controls.update(); });
  await ab(el, page, 'house dining close-up (marble)');
  await el.evaluate((n, d) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 3.2 }]; e.activeLevel = 'L0'; e.description = d; }, denseDesc('L0'));
  await el.locator('[data-preset-iso]').click();
  await ab(el, page, 'dense floor iso');
  const gpu = await el.evaluate((n) => (n as any).view?.rendererInfo?.());
  fs.writeFileSync(`${OUT}/ab-reflections.md`, `renderer: ${JSON.stringify(gpu)}\n\nrealistic rung, 1280 x 800, 9 interleaved pairs of benchFrames(15), median ms\n\n| scene | reflections off | on | cost | calls | triangles | passes |\n|---|---|---|---|---|---|---|\n` + rows.join('\n') + '\n');
});
