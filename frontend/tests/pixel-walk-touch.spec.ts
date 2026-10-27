import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScene, type Catalog3DLookup, type SceneDescription } from '../src/map/scene-builder';
import type { GeometryDoc } from '../src/map/geometry';
import { settlePage } from './pixel-settle';
import { camera, walkDoc, walkInput } from './walk-fixtures';
import { skinsUnderTest } from './helpers/frozen-skins';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';

// Plan Studio 6, slice S5-A pixel baselines: the NEW states of the touch walk only - the bottom sheet closed and open in the five
// skins on a 390 px phone, the joystick under a thumb, and the walk bar of a desktop. Nothing the walk showed before S5-A is
// compared here (the level 1-2 and level 3 baselines of the view do not move). The 3D canvas is hidden for the picture: what is
// compared is the HUD over the host's own background, so the baseline does not depend on the renderer (SwiftShader or a GPU).
// Baselines are per OS (fonts and text shaping differ): the Linux ones are generated on the runner with `--update-snapshots`; on an OS
// without a baseline the check is skipped instead of failing on a missing file (the design-foundation rule).
//   run_smart.py linux-pixel <branch> tests/pixel-walk-touch.spec.ts --project=mobile --project=desktop [--update-snapshots]
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const items = new Map((JSON.parse(fs.readFileSync(path.join(ROOT, 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as { items: { id: string; shape: string; color_token: string; role: string; mesh?: unknown; walkable?: boolean }[] }).items.map((i) => [i.id, i]));
const catalog: Catalog3DLookup = (id) => {
  const i = items.get(id);
  return i ? ({ shape: i.shape, color_token: i.color_token, role: i.role, mesh: (i.mesh as never) ?? null, walkable: i.walkable } as ReturnType<Catalog3DLookup>) : undefined;
};
const SKINS = skinsUnderTest(['classic', 'domus', 'tesla', 'bubble', 'crystal'] as const);

const doc = (): GeometryDoc =>
  walkDoc({
    objects: [],
    walk_positions: [
      { id: 'p1', name: 'כניסה', x: 0.3, y: 0.62, level_id: 'L0', heading_deg: 90, is_default: true },
      { id: 'p2', name: 'סלון', x: 0.7, y: 0.7, level_id: 'L0', heading_deg: 0 },
      { id: 'p3', name: 'משרד', x: 0.7, y: 0.25, level_id: 'L0', heading_deg: 180 },
    ],
  });
const desc: SceneDescription = buildScene({ ...walkInput(doc(), { 'binary_sensor.d1': 'on' }, [camera]), catalog, walk: true });

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function walking(page: Page, skin: string): Promise<Locator> {
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#/styleguide`);
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await el.evaluate((n, d) => { const w = n as unknown as { minFps: number; walkable: boolean; description: SceneDescription }; w.minFps = 0; w.walkable = true; w.description = d; }, desc);
  await el.scrollIntoViewIfNeeded();
  await el.evaluate((n) => (n as unknown as { startWalk(s: unknown): void }).startWalk({ id: 'start', kind: 'centre', label: '', level: 'L0', x: 3.5, z: 5.0, heading_deg: 0, pitch_deg: 0, eye_m: null }));
  await expect(el.locator('sw-walk-hud')).toBeAttached();
  await expect.poll(() => el.evaluate((n) => { const w = (n as unknown as { view: { walking: { fly: unknown } | null } }).view.walking; return !!w && !w.fly; }), { timeout: 8000 }).toBe(true);
  // the picture is of the HUD over the host's own background: the WebGL canvas (renderer-specific pixels) is not part of it
  // (clear, not hidden: a hidden canvas takes no touch)
  await el.evaluate((n) => { (n.shadowRoot!.querySelector('.stage canvas') as HTMLElement).style.opacity = '0'; });
  return el;
}

async function check(info: TestInfo, target: Locator, name: string): Promise<void> {
  if (noBaseline(info, name)) {
    info.annotations.push({ type: 'skipped-pixel', description: `${name}: no baseline on ${process.platform}` });
    return;
  }
  await expect(target).toHaveScreenshot(name, { maxDiffPixels: 40, animations: 'disabled' });
}

test.describe('pixel: the touch walk', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  for (const skin of SKINS) {
    // "pixel-stable" in the title: the release gate's pixel group greps for it (a title without it ran zero tests)
    // GATELANES-297: pixels for the skins in helpers/pixel-skins.ts (classic, domus), the structural smoke for the others
    test(pixelTitle(skin, 'the bottom sheet, closed and open'), async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'the phone layout');
      test.setTimeout(120_000);
      const skinShot = skinCheck(page, skin);
      const el = await walking(page, skin);
      const sheet = el.locator('[data-walk-sheet]');
      await settlePage(page);
      await skinShot(() => check(info, sheet, `walk-sheet-closed-${skin}.png`), sheet);
      await el.locator('[data-walk-sheet-toggle]').click();
      await expect(el.locator('[data-walk-sheet-body]')).toBeVisible();
      await settlePage(page);
      await skinShot(() => check(info, sheet, `walk-sheet-open-${skin}.png`), sheet);
    });
  }

  test('classic is pixel-stable: the joystick under a thumb', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'touch');
    test.setTimeout(120_000);
    const el = await walking(page, 'classic');
    const b = (await el.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const o = { id: 1, x: b.x + 90, y: b.y + 190, radiusX: 1, radiusY: 1, force: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [o] });
    for (let i = 1; i <= 5; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...o, x: o.x + i * 6, y: o.y - i * 10 }] });
      await page.waitForTimeout(24);
    }
    await expect(el.locator('sw-walk-hud .stick')).toBeVisible();
    await settlePage(page);
    await check(info, el.locator('sw-walk-hud .stick'), 'walk-joystick-classic.png');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  });

  test('classic is pixel-stable: the walk bar of a desktop', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the bar is the wide layout');
    test.setTimeout(120_000);
    const el = await walking(page, 'classic');
    await settlePage(page);
    await check(info, el.locator('.walkbar'), 'walk-bar-classic.png');
  });
});
