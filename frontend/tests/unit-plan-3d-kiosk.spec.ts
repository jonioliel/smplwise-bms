import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription } from '../src/map/scene-builder';

// Plan Studio 6, slice S5-B (CR-029 sections 3.4 / 4.5, docs/changes/CR-029-ST7-S5B-NOTES.md), browser half: the real 3D element on the
// style guide's sample floor. (1) Kiosk idle: after `idleS` seconds with no input the slotted still takes the screen and the frame
// loop STOPS (the frame counter stands still); an input, or a change of the plan's signature, wakes it with exactly the frames it
// needs; without a still the loop stops all the same and nothing covers the view. (2) A hidden tab draws no frames, even for a new
// description, and the tab coming back draws one. (3) A host-forced quality wins over the viewer's own choice and gives it back.
// (4) The kiosk attribute is the bare view. (5) A pointer-lock refusal moves the walk's mouse mode to drag. The pure rules are in
// unit-kiosk-idle.spec.ts / unit-pointer-lock-gate.spec.ts; this proves the wiring in a real WebGL page (SwiftShader on the runner).
type Kiosk = HTMLElement & {
  description: SceneDescription | null;
  minFps: number;
  idleS: number;
  changeKey: string;
  qualityForce: string | null;
  kiosk: boolean;
  quality: number;
  setMode(m: string): void;
  updateComplete: Promise<boolean>;
  view: { isPaused: boolean; invalidate(): void } | null;
  viewDials: { mouse_mode: string };
};

const desc = buildScene(demoSceneInput('f0')!);
const STILL = '<div slot="idle-still" data-test-still style="inline-size:100%;block-size:100%;background:#8aa4c8"></div>';

async function open(page: Page, withStill = true): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await el.evaluate((n, s) => {
    const k = n as unknown as Kiosk;
    k.minFps = 0; // no frame-budget probe: this spec counts frames itself
    const w = window as unknown as { __idle: { idle: boolean; reason: string }[] };
    w.__idle = [];
    n.addEventListener('kiosk-idle', (e) => w.__idle.push((e as CustomEvent<{ idle: boolean; reason: string }>).detail));
    if (s) n.insertAdjacentHTML('beforeend', s);
  }, withStill ? STILL : '');
  await settle(el);
  return el;
}

const frames = async (el: Locator): Promise<number> => Number((await el.getAttribute('data-frames')) ?? 0);

/** Wait until the element has stopped drawing (the on-demand loop is quiet) and answer the frame counter. */
async function settle(el: Locator): Promise<number> {
  let last = -1;
  for (let i = 0; i < 60; i++) {
    const f = await frames(el);
    if (f === last) return f;
    last = f;
    await el.page().waitForTimeout(700);
  }
  return last;
}

const idleEvents = (page: Page) => page.evaluate(() => (window as unknown as { __idle: { idle: boolean; reason: string }[] }).__idle);

test.describe('the kiosk idle swap', () => {
  test('idle: the slotted still takes the screen, the frame loop stops, an input wakes it with one frame', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page);
    const before = await frames(el);
    expect(before).toBeGreaterThan(0);
    await el.evaluate((n) => { (n as unknown as Kiosk).idleS = 2; });
    await expect(el).toHaveAttribute('data-idle', '', { timeout: 10_000 });
    await expect(el).toHaveAttribute('data-paused', '');
    await expect(el.locator('.idle-still[data-on]')).toBeVisible();
    await expect(el.locator('[data-test-still]')).toBeVisible();
    expect(await el.evaluate((n) => (n as unknown as Kiosk).view!.isPaused)).toBe(true);
    const frozen = await frames(el);
    // anything that would normally draw a frame - a new description, a resize, the view's own invalidate - draws none while idle
    await el.evaluate((n, d) => { const k = n as unknown as Kiosk; k.description = { ...d, parts: [...d.parts] }; k.view!.invalidate(); }, desc);
    await page.waitForTimeout(2500);
    expect(await frames(el)).toBe(frozen);
    // a touch anywhere on the page wakes it; the still fades out and the resume draws the frame that shows what changed meanwhile
    await page.mouse.move(40, 40);
    await page.mouse.down();
    await page.mouse.up();
    await expect(el).not.toHaveAttribute('data-idle', '');
    await expect(el).not.toHaveAttribute('data-paused', '');
    await expect.poll(() => frames(el), { timeout: 15_000 }).toBeGreaterThan(frozen);
    await expect(el.locator('.idle-still[data-on]')).toHaveCount(0);
    const evs = await idleEvents(page);
    expect(evs.map((e) => `${e.idle}:${e.reason}`)).toEqual(['true:timeout', 'false:input']);
    // and it idles again 2 s after the last input
    await expect(el).toHaveAttribute('data-idle', '', { timeout: 10_000 });
  });

  test('a change on the plan wakes an idle view and restarts the quiet period; the same signature changes nothing', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page);
    await el.evaluate((n) => { const k = n as unknown as Kiosk; k.changeKey = 'lit:'; k.idleS = 2; });
    await expect(el).toHaveAttribute('data-idle', '', { timeout: 10_000 });
    const frozen = await frames(el);
    await el.evaluate((n) => { (n as unknown as Kiosk).changeKey = 'lit:'; }); // unchanged: Lit does not even report it
    await page.waitForTimeout(500);
    await expect(el).toHaveAttribute('data-idle', '');
    await el.evaluate((n) => { (n as unknown as Kiosk).changeKey = 'lit:z1'; }); // a room lit
    await expect(el).not.toHaveAttribute('data-idle', '');
    await expect.poll(() => frames(el), { timeout: 15_000 }).toBeGreaterThan(frozen);
    expect((await idleEvents(page)).map((e) => e.reason)).toEqual(['timeout', 'change']);
    await expect(el).toHaveAttribute('data-idle', '', { timeout: 10_000 }); // quiet again
  });

  test('without a still the loop stops all the same and nothing covers the view; idleS 0 puts everything back', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page, false);
    await el.evaluate((n) => { (n as unknown as Kiosk).idleS = 2; });
    await expect(el).toHaveAttribute('data-idle', '', { timeout: 10_000 });
    await expect(el).toHaveAttribute('data-paused', '');
    await expect(el.locator('.idle-still[data-on]')).toHaveCount(0);
    await el.evaluate((n) => { (n as unknown as Kiosk).idleS = 0; }); // the setting went to "never": awake again
    await expect(el).not.toHaveAttribute('data-idle', '');
    await expect(el).not.toHaveAttribute('data-paused', '');
    await page.waitForTimeout(3500);
    await expect(el).not.toHaveAttribute('data-idle', '');
  });
});

test.describe('a hidden tab', () => {
  test('draws no frames, even for a new description, and the tab coming back draws one', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page);
    const start = await settle(el);
    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await setHidden(true);
    await expect(el).toHaveAttribute('data-paused', '');
    await el.evaluate((n, d) => { const k = n as unknown as Kiosk; k.description = { ...d, parts: [...d.parts] }; k.view!.invalidate(); }, desc);
    await page.waitForTimeout(2500);
    expect(await frames(el)).toBe(start);
    expect(await el.evaluate((n) => (n as unknown as Kiosk).view!.isPaused)).toBe(true);
    await setHidden(false);
    await expect(el).not.toHaveAttribute('data-paused', '');
    await expect.poll(() => frames(el), { timeout: 15_000 }).toBeGreaterThan(start);
  });
});

test.describe('the host-forced quality and the bare view', () => {
  test("qualityForce wins over the viewer's own choice and hands it back when cleared", async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page);
    await el.evaluate(async (n) => { const k = n as unknown as Kiosk; k.setMode('full'); await k.updateComplete; });
    await expect(el).toHaveAttribute('data-quality-mode', 'full');
    await expect(el).toHaveAttribute('data-quality', '2');
    await el.evaluate(async (n) => { const k = n as unknown as Kiosk; k.qualityForce = 'schematic'; await k.updateComplete; });
    await expect(el).toHaveAttribute('data-quality-mode', 'schematic');
    await expect(el).toHaveAttribute('data-quality', '1');
    await el.evaluate(async (n) => { const k = n as unknown as Kiosk; k.qualityForce = null; await k.updateComplete; });
    await expect(el).toHaveAttribute('data-quality-mode', 'full');
    await expect(el).toHaveAttribute('data-quality', '2');
  });

  test('the kiosk attribute is the bare view: no bar, no level strip, no time pill', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page);
    await expect(el.locator('[data-3d-bar]')).toBeVisible();
    await el.evaluate((n) => { (n as unknown as Kiosk).kiosk = true; });
    await expect(el).toHaveAttribute('kiosk', '');
    await expect(el.locator('[data-3d-bar]')).toBeHidden();
    await expect(el.locator('[data-3d-strip]')).toBeHidden();
    await expect(el.locator('[data-3d-time]')).toBeHidden();
    await el.evaluate((n) => { (n as unknown as Kiosk).kiosk = false; });
    await expect(el.locator('[data-3d-bar]')).toBeVisible();
  });
});

test.describe('pointer lock in the element', () => {
  test('a refusal anywhere moves the walk to drag for this element and the next walks; the person\'s stored dial is untouched', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page);
    const got = await el.evaluate((n) => {
      const k = n as unknown as Kiosk;
      k.viewDials.mouse_mode = 'lock'; // the person opted in
      const before = k.viewDials.mouse_mode;
      document.dispatchEvent(new Event('pointerlockerror')); // the embedding frame refused the walk's own request
      const after = k.viewDials.mouse_mode;
      document.dispatchEvent(new Event('pointerlockerror')); // a second refusal changes nothing and says nothing more
      return { before, after, remembered: sessionStorage.getItem('sw.plan3d.lockrefused') };
    });
    expect(got).toEqual({ before: 'lock', after: 'drag', remembered: 'refused' });
  });
});
