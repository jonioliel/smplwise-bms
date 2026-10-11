import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription } from '../src/map/scene-builder';
import { WalkController, type WalkInput } from '../src/map/walk-controller';

// Plan Studio 6, slice S4 (CR-029 section 8, browser half): the walk in the real element on the style guide's sample floor.
// The description is built in node with the walk world (exactly what explore-floor-map hands in) and set on the element;
// the walk enters at the world's default start, a scripted sequence of steps in the page gives the same poses as the node
// model, the camera is the eye (perspective, orbit controls off, no cutaway), Esc returns to the preset it left, and the
// walk UI (bar, minimap, crosshair) is there. Needs the preview server (npm run build; the runner's preview lane).
type Walker = HTMLElement & {
  description: SceneDescription | null;
  walkable: boolean;
  minFps: number;
  startWalk(): void;
  walking: boolean;
  walkController: { pose(): unknown; step(dt: number, i: WalkInput): unknown[] } | null;
  view: { isWalking: boolean; controls: { enabled: boolean }; camera: { type: string; fov: number }; cutawayNow(): string[] };
};

const input = { ...demoSceneInput('f0')!, walk: true };
const desc = buildScene(input);
const script: [number, WalkInput][] = Array.from({ length: 90 }, (_, i) => [i % 5 === 0 ? 1 / 30 : 1 / 60, { forward: 1, strafe: i % 30 < 8 ? 1 : 0, turn: i > 60 ? 1 : 0, run: i % 20 < 10 }]);

async function open(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await el.evaluate((n, d) => { const w = n as unknown as Walker; w.minFps = 0; w.walkable = true; w.description = d; }, desc);
  return el;
}

test('the walk enters at the default start, follows the node model step for step, and Esc returns to the preset', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await open(page);
  expect(desc.walk?.version).toBe('walk-1');
  await expect(el.locator('[data-walk-btn]')).toBeVisible();
  await el.evaluate((n) => (n as unknown as Walker).startWalk());
  await expect(el).toHaveAttribute('data-walk', '');
  await expect(el.locator('[data-walk-bar]')).toBeVisible();
  await expect(el.locator('canvas[data-walk-minimap]')).toBeVisible();
  await expect(el.locator('[data-3d-bar]')).toBeHidden();
  const model = new WalkController(desc.walk!, { eye_m: 1.65 });
  expect(await el.evaluate((n) => (n as unknown as Walker).walkController!.pose())).toEqual(model.pose());
  const view = await el.evaluate((n) => { const v = (n as unknown as Walker).view; return { walking: v.isWalking, controls: v.controls.enabled, type: v.camera.type, cut: v.cutawayNow() }; });
  expect(view).toEqual({ walking: true, controls: false, type: 'PerspectiveCamera', cut: [] });
  const poses = await el.evaluate((n, s) => s.map(([dt, i]) => { const c = (n as unknown as Walker).walkController!; c.step(dt, i); return c.pose(); }), script);
  expect(poses).toEqual(script.map(([dt, i]) => { model.step(dt, i); return model.pose(); }));
  await page.keyboard.press('Escape');
  await expect(el).not.toHaveAttribute('data-walk', '');
  const after = await el.evaluate((n) => { const v = (n as unknown as Walker).view; return { walking: v.isWalking, controls: v.controls.enabled }; });
  expect(after).toEqual({ walking: false, controls: true });
  await expect(el).toHaveAttribute('data-preset', 'iso');
  await expect(el.locator('[data-3d-bar]')).toBeVisible();
});

test('a description without the walk world never starts a walk; the walk-change event asks the host for it', async ({ page }) => {
  const el = await open(page);
  await el.evaluate((n) => { (n as unknown as Walker).description = null; });
  await el.evaluate((n, d) => { (n as unknown as Walker).description = d; }, buildScene(demoSceneInput('f0')!));
  const asked = el.evaluate((n) => new Promise<boolean>((res) => n.addEventListener('walk-change', (e) => res((e as CustomEvent<{ on: boolean }>).detail.on), { once: true })));
  await el.locator('[data-walk-btn]').click();
  expect(await asked).toBe(true);
  await expect(el).not.toHaveAttribute('data-walk', '');
  await el.evaluate((n, d) => { (n as unknown as Walker).description = d; }, desc); // the host answers with the world
  await expect(el).toHaveAttribute('data-walk', '');
});
