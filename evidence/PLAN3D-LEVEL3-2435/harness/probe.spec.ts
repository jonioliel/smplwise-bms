import { test, expect, type Page, type Locator } from 'C:/cloude/smplwise-3dlevel3/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-3dlevel3/frontend/src/map/scene-builder';
import { houseInput } from 'C:/cloude/smplwise-3dlevel3/frontend/tests/lookdev/house';

// PLAN3D-LEVEL3-2435 tuning probe: one close-up, a list of in-page variants (PROBE env: JSON [[name, js-body], ...]), one
// picture each. Not product code; the variants are evaluated with `v` = the SceneView, `e` = the element.
const OUT = process.env.SHOT_OUT ?? 'C:/cloude/smplwise-3dlevel3/evidence/PLAN3D-LEVEL3-2435/probe';
const DRY = new Set(['r-living', 'r-office', 'r-hall', 'r-corr', 'r-gallery', 'r-ucorr']);
const VARIANTS: [string, string][] = JSON.parse(process.env.PROBE ?? '[["base",""]]');
const EYE = JSON.parse(process.env.EYE ?? '[10.8, 2.3, 5.6]');
const AT = JSON.parse(process.env.AT ?? '[6.2, 0.35, 2.4]');
const HOUR = Number(process.env.HOUR ?? 13);
const RUNG = process.env.RUNG ?? '3';
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.setTimeout(900_000);

async function settle(el: Locator, page: Page) {
  await expect.poll(() => el.evaluate((n) => (n as any).view?.realPending ?? 0), { timeout: 180_000 }).toBe(0);
  await page.waitForTimeout(1200);
}

test('probe', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); });
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; (n as any).minFps = 0; });
  await el.locator(`[data-quality-${RUNG}]`).click();
  const inp = houseInput({ level: 'L0', walk: false, realistic: true });
  for (const r of inp.doc.rooms) if (DRY.has(r.id)) delete r.floor_material_id;
  const desc = buildScene(inp);
  await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = 'L0'; e.labels = {}; e.description = a.desc; e.timeManual = { hour: a.h, ymd: [2026, 10, 13] }; e.applySun(); }, { desc, h: HOUR });
  await settle(el, page);
  for (const [name, body] of VARIANTS) {
    if (EYE === 'iso') await el.locator('[data-preset-iso]').click();
    else {
      await el.locator('[data-preset-persp]').click();
      await el.evaluate((n, a) => { const v = (n as any).view; v.userCamera = true; v.persp.position.set(a.eye[0], a.eye[1], a.eye[2]); v.controls.target.set(a.at[0], a.at[1], a.at[2]); v.controls.update(); v.invalidate?.(); }, { eye: EYE, at: AT });
    }
    const r = await el.evaluate((n, b) => { const e = n as any; const v = e.view; return String(new Function('v', 'e', b)(v, e) ?? ''); }, body);
    await settle(el, page);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    if (r) console.log(name, r);
  }
});
