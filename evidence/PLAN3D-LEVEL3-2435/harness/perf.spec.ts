import { test, expect, type Page, type Locator } from 'C:/cloude/smplwise-3dlevel3/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-3dlevel3/frontend/src/map/scene-builder';
import { houseInput, houseLabels } from 'C:/cloude/smplwise-3dlevel3/frontend/tests/lookdev/house';
import { denseDesc } from './dense';

// PLAN3D-LEVEL3-2435 evidence: draw calls / triangles / frame time of the demo floors, level 3 both rungs, plus the
// realised graph's composition (merged / instanced / model meshes). SHOT_OUT, SHOT_TAG name the run.
const OUT = process.env.SHOT_OUT ?? 'C:/cloude/smplwise-3dlevel3/evidence/PLAN3D-LEVEL3-2435/after';
const TAG = process.env.SHOT_TAG ?? 'after';
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.setTimeout(900_000);

async function open(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; });
  await page.waitForTimeout(800);
  return el;
}
async function settle(el: Locator, page: Page) {
  await expect.poll(() => el.evaluate((n) => (n as any).view?.realPending ?? 0), { timeout: 180_000 }).toBe(0);
  await page.waitForTimeout(1500);
}
const rows: string[] = [];
async function snap(el: Locator, page: Page, name: string, shot = true) {
  await settle(el, page);
  if (shot) await page.screenshot({ path: `${OUT}/${name}.png` });
  const i = await el.evaluate((n) => {
    const v = (n as any).view;
    const runs: number[] = [];
    for (let k = 0; k < 5; k++) runs.push(v.benchFrames(30));
    runs.sort((a, b) => a - b);
    v.benchFrames(1);
    const comp: Record<string, number> = {};
    v.realBuilt?.root.traverse((o: any) => {
      if (!o.isMesh) return;
      const k = String(o.name).split('|')[0].split(':')[0] || 'other';
      comp[k] = (comp[k] ?? 0) + 1;
    });
    return { ms: Math.round(runs[2] * 100) / 100, calls: v.lastFrameInfo?.calls, tris: v.lastFrameInfo?.triangles, rung: n.getAttribute('data-rung'), comp: Object.entries(comp).sort().map(([k, c]) => `${k} ${c}`).join(', '), stats: JSON.stringify(v.realStats) };
  });
  rows.push(`| ${TAG} | ${name} | ${i.rung} | ${i.ms} | ${i.calls} | ${i.tris} | ${i.comp} | ${i.stats} |`);
}
async function house(el: Locator, level: string | null) {
  const desc = buildScene(houseInput({ level, walk: false, realistic: true }));
  await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = a.level; e.labels = a.labels; e.description = a.desc; }, { desc, labels: houseLabels(), level });
}
async function dense(el: Locator, level: string | null) {
  await el.evaluate((n, d) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 3.2 }]; e.activeLevel = d.level; e.labels = {}; e.description = d.desc; }, { desc: denseDesc(level), level });
}
const hour = (el: Locator, h: number) => el.evaluate((n, hh) => { const e = n as any; e.timeManual = { hour: hh, ymd: [2026, 10, 13] }; e.applySun(); }, h);

test('perf', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const el = await open(page);
  await el.evaluate((n) => { (n as any).minFps = 0; });
  for (const rung of ['3', '3-lite']) {
    await el.locator(`[data-quality-${rung}]`).click();
    await hour(el, 13);
    await dense(el, 'L0');
    await el.locator('[data-preset-iso]').click();
    await snap(el, page, `dense-L0-iso-${rung}`);
    await dense(el, null);
    await el.locator('[data-preset-iso]').click();
    await snap(el, page, `dense-both-iso-${rung}`);
    await house(el, 'L0');
    await el.locator('[data-preset-iso]').click();
    await snap(el, page, `house-L0-iso-${rung}`);
    await house(el, null);
    await el.locator('[data-preset-iso]').click();
    await snap(el, page, `house-both-iso-${rung}`);
    await el.locator('[data-preset-persp]').click();
    await snap(el, page, `house-both-persp-${rung}`);
  }
  const gpu = await el.evaluate((n) => (n as any).view?.rendererInfo?.());
  fs.writeFileSync(`${OUT}/perf.md`, `renderer: ${JSON.stringify(gpu)}\n\n| run | shot | rung | ms (median of 5 x 30) | calls | triangles | real graph meshes | realStats |\n|---|---|---|---|---|---|---|---|\n` + rows.join('\n') + '\n');
});
