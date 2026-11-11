import { test, expect } from 'C:/cloude/smplwise-3drealism2/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-3drealism2/frontend/src/map/scene-builder';
import { houseInput, houseLabels } from 'C:/cloude/smplwise-3drealism2/frontend/tests/lookdev/house';
import { denseDesc } from './dense';

// A quick look-dev probe: one view with the baked AO on and off (and the GL errors), for tuning. PROBE_OUT, PROBE_HOUR, PROBE_PRESET,
// PROBE_SCENE (house | dense), PROBE_RUNG ([data-quality-3] | [data-quality-3-lite]).
const OUT = process.env.PROBE_OUT ?? 'C:/cloude/smplwise-3drealism2/evidence/PLAN3D-REALISM2-2433/probe';
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.setTimeout(600_000);
const CLIP = JSON.parse(process.env.PROBE_CLIP ?? '{"x":560,"y":230,"width":520,"height":330}');

test('probe', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 600)); });
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; (n as any).minFps = 0; });
  if (process.env.PROBE_EXTRA) await el.evaluate((n, x) => Object.assign(n as any, JSON.parse(x)), process.env.PROBE_EXTRA);
  await el.locator(process.env.PROBE_RUNG ?? '[data-quality-3]').click();
  const dense = process.env.PROBE_SCENE === 'dense';
  const desc = dense ? denseDesc('L0') : buildScene(houseInput({ level: 'L0', walk: false, realistic: true }));
  await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = 'L0'; e.labels = a.labels; e.description = a.desc; e.timeManual = { hour: a.hour, ymd: [2026, 10, 13] }; },
    { desc, labels: dense ? {} : houseLabels(), hour: Number(process.env.PROBE_HOUR ?? 13) });
  await el.locator(process.env.PROBE_PRESET ?? '[data-preset-iso]').click();
  await el.evaluate((n) => (n as any).applySun());
  await expect.poll(() => el.evaluate((n) => (n as any).view?.realPending ?? 0), { timeout: 180_000 }).toBe(0);
  await page.waitForTimeout(1000);
  await el.locator('[data-preset-iso]').click();
  await page.waitForTimeout(500);
  await el.locator(process.env.PROBE_PRESET ?? '[data-preset-iso]').click(); // again once the graph stands (the persp fit)
  await page.waitForTimeout(1500);
  const info = await el.evaluate((n) => { const v = (n as any).view; v.benchFrames(1); return { ao: v.bakedAo, grade: v.postGrade, rough: v.realRoughness, passes: v.postPasses, frame: v.lastFrameInfo, cam: v.active?.position, camType: v.active?.type, near: v.active?.near, far: v.active?.far, preset: n.getAttribute('data-preset') }; });
  if (process.env.PROBE_JS) { await el.evaluate((n, js) => { const v = (n as any).view; new Function('v', js)(v); v.invalidate?.(); }, process.env.PROBE_JS); await page.waitForTimeout(800); }
  await page.screenshot({ path: `${OUT}/ao-on.png` });
  await page.screenshot({ path: `${OUT}/ao-on-crop.png`, clip: CLIP });
  await el.evaluate((n) => (n as any).view.setBakedAo(false));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/ao-off.png` });
  await page.screenshot({ path: `${OUT}/ao-off-crop.png`, clip: CLIP });
  fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify({ info, errors }, null, 1));
});
