import { test, expect, type Page, type Locator } from 'C:/cloude/smplwise-3drealism2/frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import { buildScene } from 'C:/cloude/smplwise-3drealism2/frontend/src/map/scene-builder';
import { houseInput, houseLabels } from 'C:/cloude/smplwise-3drealism2/frontend/tests/lookdev/house';
import { denseDesc } from './dense';

// PLAN3D-REALISM2-2433 evidence: the round-2 shot list (headed GPU Chromium, 1280 x 800). SHOT_EXTRA: element props set first
// (e.g. {"backdrop":"studio"}); SHOT_VIEW: SceneView test switches set before every shot (e.g. {"bakedAo":false}).
const OUT = process.env.SHOT_OUT ?? 'C:/cloude/smplwise-3drealism2/evidence/PLAN3D-REALISM2-2433/after';
const TAG = process.env.SHOT_TAG ?? 'after';
const EXTRA = process.env.SHOT_EXTRA ?? '';
test.use({ viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
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
async function snap(el: Locator, page: Page, name: string) {
  await settle(el, page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const i = await el.evaluate((n) => {
    const v = (n as any).view;
    const ms = v?.benchFrames ? [v.benchFrames(30), v.benchFrames(30), v.benchFrames(30)].sort((a: number, b: number) => a - b)[1] : null;
    v?.benchFrames?.(1);
    return { ms: ms === null ? null : Math.round(ms * 100) / 100, calls: v?.lastFrameInfo?.calls, tris: v?.lastFrameInfo?.triangles, rung: n.getAttribute('data-rung'), passes: v?.postPasses?.join('+') };
  });
  rows.push(`| ${TAG} | ${name} | ${i.rung} | ${i.ms} | ${i.calls} | ${i.tris} | ${i.passes} |`);
}
async function house(el: Locator, level: string | null) {
  const desc = buildScene(houseInput({ level, walk: false, realistic: true }));
  await el.evaluate((n, a) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }]; e.activeLevel = a.level; e.labels = a.labels; e.description = a.desc; }, { desc, labels: houseLabels(), level });
}
const hour = (el: Locator, h: number) => el.evaluate((n, hh) => { const e = n as any; e.timeManual = { hour: hh, ymd: [2026, 10, 13] }; e.applySun(); }, h);

test('shots', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const el = await open(page);
  await el.evaluate((n) => { (n as any).minFps = 0; });
  if (EXTRA) await el.evaluate((n, x) => Object.assign(n as any, JSON.parse(x)), EXTRA);
  await el.locator('[data-quality-1]').click();
  await snap(el, page, '00-demo-schematic');
  await el.locator('[data-quality-3]').click();
  await el.evaluate((n, d) => { const e = n as any; e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 3.2 }]; e.activeLevel = 'L0'; e.labels = {}; e.description = d; }, denseDesc('L0'));
  await el.locator('[data-preset-iso]').click();
  await hour(el, 13);
  await snap(el, page, '09-dense-iso-day');
  if (process.env.SHOT_ONLY === 'dense') {
    fs.writeFileSync(`${OUT}/perf-dense.md`, rows.join('\n') + '\n');
    return;
  }
  await house(el, 'L0');
  await el.locator('[data-preset-iso]').click();
  await snap(el, page, '01-house-iso-day');
  await hour(el, 21);
  await snap(el, page, '02-house-iso-night');
  await hour(el, 13);
  await el.locator('[data-preset-persp]').click();
  await snap(el, page, '03-house-persp-day');
  await hour(el, 21);
  await snap(el, page, '04-house-persp-night');
  await hour(el, 13);
  await house(el, null);
  await el.locator('[data-preset-iso]').click();
  await snap(el, page, '05-house-stack-day');
  await el.evaluate((n) => { (n as any).backdrop = 'studio'; });
  await house(el, 'L0');
  await el.locator('[data-preset-iso]').click();
  await snap(el, page, '10-house-studio-iso-day');
  await hour(el, 21);
  await snap(el, page, '11-house-studio-iso-night');
  await el.evaluate((n, x) => { (n as any).backdrop = x ? (JSON.parse(x).backdrop ?? 'sky') : 'sky'; }, EXTRA);
  await el.locator('[data-quality-3-lite]').click();
  await house(el, 'L0');
  await snap(el, page, '06-house-lite-iso-night');
  await hour(el, 13);
  await snap(el, page, '07-house-lite-iso-day');
  await el.locator('[data-quality-1]').click();
  await snap(el, page, '08-house-schematic');
  const gpu = await el.evaluate((n) => (n as any).view?.rendererInfo?.());
  fs.writeFileSync(`${OUT}/perf.md`, `renderer: ${JSON.stringify(gpu)}\n\n` + rows.join('\n') + '\n');
});
