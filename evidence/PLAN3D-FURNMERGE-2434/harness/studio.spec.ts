import { test, expect, type Page, type Locator } from 'C:/cloude/smplwise-furnmerge/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-furnmerge/frontend/src/map/scene-builder';
import { houseInput, houseLabels } from 'C:/cloude/smplwise-furnmerge/frontend/tests/lookdev/house';

// PLAN3D-FURNMERGE-2434 evidence: the studio backdrop on the realistic level (iso / persp, day / night, both rungs),
// the zoom buttons, and the in-page A/B of the furniture merge (interleaved pairs, mergeFurniture on / off).
const OUT = process.env.SHOT_OUT ?? 'C:/cloude/smplwise-furnmerge/evidence/PLAN3D-FURNMERGE-2434/after';
const ONLY = process.env.SHOT_ONLY ?? '';
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
  await page.waitForTimeout(1200);
}
async function house(el: Locator, level: string | null) {
  const desc = buildScene(houseInput({ level, walk: false, realistic: true }));
  await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = a.level; e.labels = a.labels; e.description = a.desc; }, { desc, labels: houseLabels(), level });
}
const hour = (el: Locator, h: number) => el.evaluate((n, hh) => { const e = n as any; e.timeManual = { hour: hh, ymd: [2026, 10, 13] }; e.applySun(); }, h);
const shot = async (el: Locator, page: Page, name: string) => { await settle(el, page); await page.screenshot({ path: `${OUT}/${name}.png` }); };

test('studio and zoom', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const el = await open(page);
  await el.evaluate((n) => { (n as any).minFps = 0; (n as any).backdrop = 'studio'; });
  if (!ONLY || ONLY === 'studio') {
    for (const rung of ['3', '3-lite']) {
      await el.locator(`[data-quality-${rung}]`).click();
      await house(el, 'L0');
      await hour(el, 13);
      await el.locator('[data-preset-iso]').click();
      await shot(el, page, `studio-iso-day-${rung}`);
      await el.locator('[data-preset-persp]').click();
      await shot(el, page, `studio-persp-day-${rung}`);
      await hour(el, 21);
      await shot(el, page, `studio-persp-night-${rung}`);
      await hour(el, 13);
    }
  }
  if (!ONLY || ONLY === 'zoom') {
    await el.evaluate((n) => { (n as any).backdrop = 'sky'; });
    await el.locator('[data-quality-3]').click();
    await house(el, 'L0');
    await hour(el, 13);
    await el.locator('[data-preset-iso]').click();
    await shot(el, page, 'zoom-0');
    await el.locator('[data-3d-zoom-in]').click();
    await el.locator('[data-3d-zoom-in]').click();
    await shot(el, page, 'zoom-in-2');
    for (let i = 0; i < 3; i++) await el.locator('[data-3d-zoom-out]').click();
    await shot(el, page, 'zoom-out-1');
    await el.locator('[data-preset-persp]').click();
    await el.locator('[data-3d-zoom-in]').click();
    await shot(el, page, 'zoom-persp-in-1');
  }
  if (!ONLY || ONLY === 'ab') {
    const rows: string[] = [];
    for (const rung of ['3', '3-lite']) {
      await el.locator(`[data-quality-${rung}]`).click();
      for (const level of ['L0', null]) {
        await house(el, level);
        await el.locator('[data-preset-iso]').click();
        const res: Record<string, number[]> = { on: [], off: [] };
        const calls: Record<string, number> = {};
        for (let k = 0; k < 7; k++) for (const mode of k % 2 ? ['off', 'on'] : ['on', 'off']) {
          await el.evaluate((n, m) => { const e = n as any; e.view.mergeFurniture = m === 'on'; e.view.rebuildNow(); }, mode);
          await settle(el, page);
          const r = await el.evaluate((n) => { const v = (n as any).view; const ms = v.benchFrames(20); v.benchFrames(1); return { ms, calls: v.lastFrameInfo.calls }; });
          res[mode].push(r.ms);
          calls[mode] = r.calls;
        }
        const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
        rows.push(`| house ${level ?? 'both'} iso | ${rung === '3' ? 'realistic' : 'lite'} | ${med(res.off).toFixed(2)} | ${med(res.on).toFixed(2)} | ${(med(res.on) - med(res.off)).toFixed(2)} | ${calls.off} / ${calls.on} |`);
      }
    }
    await el.evaluate((n) => { (n as any).view.mergeFurniture = true; });
    fs.writeFileSync(`${OUT}/ab-merge.md`, '| Scene | Rung | merge off ms | merge on ms | delta | calls off / on |\n|---|---|---|---|---|---|\n' + rows.join('\n') + '\n');
  }
});

test('demo floor A/B', async ({ page }) => {
  const el = await open(page);
  await el.evaluate((n) => { (n as any).minFps = 0; });
  const rows: string[] = [];
  for (const rung of ['3', '3-lite']) {
    await el.locator(`[data-quality-${rung}]`).click();
    await hour(el, 13);
    await el.locator('[data-preset-iso]').click();
    const res: Record<string, number[]> = { on: [], off: [] };
    const calls: Record<string, string> = {};
    for (let k = 0; k < 7; k++) for (const mode of k % 2 ? ['off', 'on'] : ['on', 'off']) {
      await el.evaluate((n, m) => { const e = n as any; e.view.mergeFurniture = m === 'on'; e.view.rebuildNow(); }, mode);
      await settle(el, page);
      const r = await el.evaluate((n) => { const v = (n as any).view; const ms = v.benchFrames(20); v.benchFrames(1); return { ms, calls: v.lastFrameInfo.calls, tris: v.lastFrameInfo.triangles }; });
      res[mode].push(r.ms);
      calls[mode] = `${r.calls} (${r.tris} tris)`;
    }
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
    rows.push(`| style-guide demo floor iso | ${rung === '3' ? 'realistic' : 'lite'} | ${med(res.off).toFixed(2)} | ${med(res.on).toFixed(2)} | ${(med(res.on) - med(res.off)).toFixed(2)} | ${calls.off} / ${calls.on} |`);
  }
  fs.writeFileSync(`${OUT}/ab-merge-demo.md`, rows.join(String.fromCharCode(10)) + String.fromCharCode(10));
});
