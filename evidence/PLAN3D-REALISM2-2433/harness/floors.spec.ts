import { test, expect, type Page, type Locator } from 'C:/cloude/smplwise-3drealism2/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-3drealism2/frontend/src/map/scene-builder';
import { houseInput, houseLabels } from 'C:/cloude/smplwise-3drealism2/frontend/tests/lookdev/house';

// PLAN3D-REALISM2-2433 evidence, the floor finish (owner 2026-11-11): the look-dev house with its dry rooms left to the
// installation's finish (their own floor_material_id removed: what a home without per-room picks has), one iso and one
// perspective shot per finish (wood / marble / ceramic), headed GPU Chromium 1280 x 800 (pw.config.ts).
const OUT = process.env.SHOT_OUT ?? 'C:/cloude/smplwise-3drealism2/evidence/PLAN3D-REALISM2-2433/floors';
const DRY = new Set(['r-living', 'r-office', 'r-hall', 'r-corr', 'r-gallery', 'r-ucorr']);
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.setTimeout(900_000);

async function settle(el: Locator, page: Page) {
  await expect.poll(() => el.evaluate((n) => (n as any).view?.realPending ?? 0), { timeout: 180_000 }).toBe(0);
  await page.waitForTimeout(1500);
}

test('floors', async ({ page }) => {
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
  await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = 'L0'; e.labels = a.labels; e.description = a.desc; e.timeManual = { hour: 13, ymd: [2026, 10, 13] }; e.applySun(); }, { desc, labels: houseLabels() });
  const rows: string[] = [];
  for (const finish of ['marble', 'ceramic', 'wood']) {
    await el.evaluate((n, f) => (n as any).view.setRealSettings({ floorFinish: f }), finish);
    for (const preset of ['iso', 'persp']) {
      await el.locator(`[data-preset-${preset}]`).click();
      await settle(el, page);
      await page.screenshot({ path: `${OUT}/${finish}-${preset}-day.png` });
      const ms = await el.evaluate((n) => { const v = (n as any).view; return [v.benchFrames(30), v.benchFrames(30), v.benchFrames(30)].sort((a: number, b: number) => a - b)[1]; });
      rows.push(`| ${finish} | ${preset} | ${Math.round(ms * 100) / 100} |`);
    }
  }
  fs.writeFileSync(`${OUT}/perf.md`, `| finish | view | ms/frame (median of 3 x 30) |\n|---|---|---|\n${rows.join('\n')}\n`);
});
