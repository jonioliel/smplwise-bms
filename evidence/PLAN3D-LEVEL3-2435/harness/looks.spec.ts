import { test, expect, type Page, type Locator } from 'C:/cloude/smplwise-3dlevel3/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-3dlevel3/frontend/src/map/scene-builder';
import { houseInput, houseLabels } from 'C:/cloude/smplwise-3dlevel3/frontend/tests/lookdev/house';

// PLAN3D-LEVEL3-2435 evidence: the look-dev house with its dry rooms left to the installation's floor finish (as a home
// without per-room picks), realistic + lite rungs, overview and close-up views, each with its draw calls / triangles /
// frame time. SHOT_OUT / SHOT_TAG name the run (before = the base commit, after = this branch); the same harness both times.
const OUT = process.env.SHOT_OUT ?? 'C:/cloude/smplwise-3dlevel3/evidence/PLAN3D-LEVEL3-2435/after';
const TAG = process.env.SHOT_TAG ?? 'after';
const ONLY = process.env.SHOT_ONLY ?? '';
const DRY = new Set(['r-living', 'r-office', 'r-hall', 'r-corr', 'r-gallery', 'r-ucorr']);
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.setTimeout(900_000);

async function settle(el: Locator, page: Page) {
  await expect.poll(() => el.evaluate((n) => (n as any).view?.realPending ?? 0), { timeout: 180_000 }).toBe(0);
  await page.waitForTimeout(1500);
}
const rows: string[] = [];
async function snap(el: Locator, page: Page, name: string) {
  if (ONLY && !name.includes(ONLY)) return;
  await settle(el, page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const i = await el.evaluate((n) => {
    const v = (n as any).view;
    const runs: number[] = [];
    for (let k = 0; k < 5; k++) runs.push(v.benchFrames(20));
    runs.sort((a, b) => a - b);
    v.benchFrames(1);
    return { ms: Math.round(runs[2] * 100) / 100, calls: v.lastFrameInfo?.calls, tris: v.lastFrameInfo?.triangles, rung: n.getAttribute('data-rung') };
  });
  rows.push(`| ${TAG} | ${name} | ${i.rung} | ${i.ms} | ${i.calls} | ${i.tris} |`);
}
/** A hand-placed perspective camera (eye, target in world metres). */
async function cam(el: Locator, eye: number[], at: number[]) {
  await el.locator('[data-preset-persp]').click();
  await el.evaluate((n, a) => {
    const v = (n as any).view;
    v.userCamera = true;
    v.persp.position.set(a.eye[0], a.eye[1], a.eye[2]);
    v.controls.target.set(a.at[0], a.at[1], a.at[2]);
    v.controls.update();
    v.invalidate?.();
  }, { eye, at });
}
const hour = (el: Locator, h: number) => el.evaluate((n, hh) => { const e = n as any; e.timeManual = { hour: hh, ymd: [2026, 10, 13] }; e.applySun(); }, h);

test('looks', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; (n as any).minFps = 0; });
  const inp = houseInput({ level: 'L0', walk: false, realistic: true });
  for (const r of inp.doc.rooms) if (DRY.has(r.id)) delete r.floor_material_id;
  const desc = buildScene(inp);
  for (const rung of ['3', '3-lite']) {
    const sfx = rung === '3' ? '' : '-lite';
    await el.locator(`[data-quality-${rung}]`).click();
    await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = 'L0'; e.labels = {}; e.description = a.desc; }, { desc });
    for (const finish of rung === '3' ? ['marble', 'ceramic'] : ['marble']) {
      await el.evaluate((n, f) => (n as any).view.setRealSettings({ floorFinish: f }), finish);
      await hour(el, 13);
      await el.locator('[data-preset-iso]').click();
      await snap(el, page, `${finish}-iso-day${sfx}`);
      await el.locator('[data-preset-persp]').click();
      await snap(el, page, `${finish}-persp-day${sfx}`);
      await cam(el, [10.8, 2.3, 5.6], [6.2, 0.35, 2.4]);
      await snap(el, page, `${finish}-living-day${sfx}`);
      if (finish === 'marble') {
        await cam(el, [6.0, 2.6, 5.4], [9.6, 0.45, 8.6]);
        await snap(el, page, `${finish}-kitchen-day${sfx}`);
        await hour(el, 21);
        await cam(el, [10.8, 2.3, 5.6], [6.2, 0.35, 2.4]);
        await snap(el, page, `${finish}-living-night${sfx}`);
        await el.locator('[data-preset-iso]').click();
        await snap(el, page, `${finish}-iso-night${sfx}`);
      }
    }
  }
  const gpu = await el.evaluate((n) => (n as any).view?.rendererInfo?.());
  fs.writeFileSync(`${OUT}/looks.md`, `renderer: ${JSON.stringify(gpu)}\n\n| run | shot | rung | ms (median of 5 x 20) | calls | triangles |\n|---|---|---|---|---|---|\n` + rows.join('\n') + '\n');
});
