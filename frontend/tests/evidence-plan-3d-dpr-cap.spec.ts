import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription } from '../src/map/scene-builder';
import { DEFAULT_VIEW } from '../src/api/plan-view';
import { CAMERA, EVENT_ID, FLOOR, T_DAY, installReplayMock } from './replay-3d-mocks';
import { live as wallLive, newMock as newWallMock, open as openWall } from './wall-plan-mocks';

// ST7DPR (CR-029 section 3.5; the known limit of 2.4.7): the person's `dpr_cap` ("חדות מרבית") reaches the canvas from the FIRST
// frame at every quality level - a view that starts directly at the realistic rung, a cap changed while it draws, a rung change on
// the way (the walk guard's drop to lite and back) - and the post chain behind the canvas follows. Levels 1-2 and the lite rung do
// not move with the dial (their pictures are the baselines). The rule itself (a table) is unit-plan-3d-pixel-ratio.spec.ts.
//
// The device is emulated at pixel ratio 2 on every project (the view's own ratio is min(2, devicePixelRatio) = 2): on a 1x screen
// a cap cannot be seen, which is why the defect never showed on a desktop. Hosts: the history map and the event page on the replay
// mock and a wall display on the wall mock (all three build the view directly at the rung they are asked for), and the style
// guide's demo element for the SceneView itself and for the walk.
//   SW_BASE_URL=http://127.0.0.1:<vite>/ npx playwright test tests/evidence-plan-3d-dpr-cap.spec.ts --project=desktop --workers=1
test.use({ deviceScaleFactor: 2 });
/** The view's own ratio on this emulated device: min(2, devicePixelRatio). */
const BASE = 2;

type Node = Record<string, unknown>;
interface ViewLike {
  renderer: { getPixelRatio(): number; domElement: HTMLCanvasElement };
  post: { composer: { _pixelRatio: number; renderTarget1: { width: number } } } | null;
  postPasses: string[];
  realPending: number;
  getRealSettings(): { rung: string };
  getQuality(): number;
  setRealSettings(s: Record<string, unknown>): void;
  setQuality(q: number): void;
  setDescription(d: SceneDescription): void;
  benchFrames(n: number): number;
  dispose(): void;
  scene: { traverse: (f: (o: Node) => void) => void };
}
interface Probe {
  view: ViewLike;
  description: SceneDescription | null;
  minFps: number;
  walkable: boolean;
  startWalk(): void;
  onWalkLowFps(): void;
}
interface Case {
  level: 1 | 2 | 3;
  rung?: 'realistic' | 'lite';
  cap?: number;
}
interface Win {
  __dprViews: { view: ViewLike; mount: HTMLElement }[];
  __dprMake: (c: Case) => ViewLike;
  __dprDrop: () => void;
  __frames: FrameRecord[];
}
interface FrameRecord {
  ratio: number;
  canvasW: number;
  cssW: number;
  rung: string;
  quality: string;
}

/** What a view says about its canvas: the renderer's ratio, the drawing buffer against its CSS box, the post chain's ratio. */
interface Canvas {
  ratio: number;
  canvasW: number;
  cssW: number;
  quality: number;
  rung: string;
  passes: string[];
  composer: number | null;
  composerW: number | null;
}
const canvasOf = (el: Locator): Promise<Canvas> =>
  el.evaluate((n) => {
    const v = (n as unknown as Probe).view;
    const c = v.renderer.domElement;
    return { ratio: v.renderer.getPixelRatio(), canvasW: c.width, cssW: c.clientWidth, quality: v.getQuality(), rung: v.getRealSettings().rung, passes: v.postPasses, composer: v.post?.composer._pixelRatio ?? null, composerW: v.post?.composer.renderTarget1.width ?? null };
  });

/** The drawing buffer is the CSS box times the ratio (three floors it). */
function expectBuffer(c: Pick<Canvas, 'ratio' | 'canvasW' | 'cssW'>, ratio: number): void {
  expect(c.ratio).toBe(ratio);
  expect(c.canvasW, `canvas ${c.canvasW} px for ${c.cssW} css px at ratio ${ratio}`).toBe(Math.floor(c.cssW * ratio));
}

/** The post chain's targets are sized in device pixels: its ratio is the canvas's, whatever moved it last. */
function expectPost(c: Canvas, ratio: number): void {
  expect(c.passes.length, 'the post chain exists').toBeGreaterThan(0);
  expect(c.composer).toBe(ratio);
  expect(Math.abs((c.composerW ?? 0) - c.cssW * ratio), `post target ${c.composerW} px for ${c.cssW} css px at ratio ${ratio}`).toBeLessThan(1.01);
}

// ------------------------------------------------------------------------------------------------ the style guide's demo element

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  return el;
}

/** A factory of views of their own in the page: the class is the one the demo element runs on, the mounts are off-screen. */
async function factory(el: Locator): Promise<void> {
  await el.evaluate((n) => {
    const View = (n as unknown as Probe).view.constructor as new (o: Record<string, unknown>) => ViewLike;
    const w = window as unknown as Win;
    w.__dprViews = [];
    w.__dprMake = (c) => {
      const mount = document.createElement('div');
      mount.style.cssText = 'position:fixed;left:-500px;top:0;width:320px;height:200px;overflow:hidden;pointer-events:none;';
      document.body.appendChild(mount);
      const view = new View({ mount, color: () => '#8899aa', onSelect: () => undefined, onHover: () => undefined, onFrame: () => undefined, quality: c.level, ...(c.rung ? { real: { rung: c.rung } } : {}), ...(c.cap !== undefined ? { dprCap: c.cap } : {}) });
      w.__dprViews.push({ view, mount });
      return view;
    };
    w.__dprDrop = () => {
      for (const { view, mount } of w.__dprViews) {
        view.dispose();
        mount.remove();
      }
      w.__dprViews = [];
    };
  });
}

test('SceneView: the cap given at construction is the ratio of the first frame - realistic at the cap, lite at 1, levels 1-2 at the device ratio', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  await factory(el);
  expect(await page.evaluate(() => Math.min(2, window.devicePixelRatio || 1))).toBe(BASE);
  const rows: { c: Case; ratio: number }[] = [
    // below level 3 the dial means nothing: the device ratio, the pictures of the baselines
    { c: { level: 1, cap: 1 }, ratio: BASE },
    { c: { level: 2, cap: 1 }, ratio: BASE },
    { c: { level: 2 }, ratio: BASE },
    // the lite rung is pinned at 1 whatever the cap
    { c: { level: 3, rung: 'lite', cap: 1.5 }, ratio: 1 },
    { c: { level: 3, rung: 'lite', cap: 2 }, ratio: 1 },
    { c: { level: 3, rung: 'lite' }, ratio: 1 },
    // the realistic rung draws at the person's cap: below the default, above it, at the device's ratio, beyond it
    { c: { level: 3, rung: 'realistic', cap: 1 }, ratio: 1 },
    { c: { level: 3, rung: 'realistic', cap: 1.5 }, ratio: 1.5 },
    { c: { level: 3, rung: 'realistic', cap: 1.75 }, ratio: 1.75 },
    { c: { level: 3, rung: 'realistic', cap: 2 }, ratio: 2 },
    { c: { level: 3, rung: 'realistic', cap: 3 }, ratio: BASE },
    // no cap given: the dial's default (1.25); an unusable cap never poisons the canvas
    { c: { level: 3, rung: 'realistic' }, ratio: DEFAULT_VIEW.dpr_cap },
    { c: { level: 3, rung: 'realistic', cap: 0 }, ratio: DEFAULT_VIEW.dpr_cap },
  ];
  const seen = await page.evaluate((list) => {
    const w = window as unknown as Win;
    const out = list.map((c) => {
      const v = w.__dprMake(c);
      const cv = v.renderer.domElement;
      return { ratio: v.renderer.getPixelRatio(), canvasW: cv.width, cssW: cv.clientWidth };
    });
    w.__dprDrop();
    return out;
  }, rows.map((r) => r.c));
  for (const [i, r] of rows.entries()) expectBuffer(seen[i], r.ratio);
});

test('SceneView: a cap changed while the realistic rung draws applies at once; the lite rung and levels 1-2 ignore it; a rung or level change keeps it', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  await factory(el);
  const out = await page.evaluate(() => {
    const w = window as unknown as Win;
    const v = w.__dprMake({ level: 3, rung: 'realistic', cap: 1.25 });
    const c = v.renderer.domElement;
    const log: [string, number, number][] = [];
    const step = (what: string) => log.push([what, v.renderer.getPixelRatio(), c.width]);
    step('start, cap 1.25');
    v.setRealSettings({ dprCap: 1 }); step('cap 1 while realistic');
    v.setRealSettings({ dprCap: 2 }); step('cap 2 while realistic');
    v.setRealSettings({ dprCap: 1.5 }); step('cap 1.5 while realistic');
    v.setRealSettings({ dprCap: 1.5 }); step('the same cap again');
    v.setRealSettings({ rung: 'lite' }); step('rung lite');
    v.setRealSettings({ dprCap: 1.75 }); step('cap 1.75 while lite');
    v.setRealSettings({ rung: 'realistic' }); step('rung realistic again (keeps the cap set while lite)');
    v.setQuality(2); step('level 2');
    v.setRealSettings({ dprCap: 1 }); step('cap 1 at level 2');
    v.setQuality(1); step('level 1');
    v.setQuality(3); step('level 3 again (the cap set below applies at the switch)');
    v.setRealSettings({ dprCap: -1 }); step('an unusable cap is ignored');
    v.setRealSettings({ dprCap: Number.NaN }); step('NaN is ignored');
    const cssW = c.clientWidth;
    w.__dprDrop();
    return { log, cssW };
  });
  const want: [string, number][] = [
    ['start, cap 1.25', 1.25],
    ['cap 1 while realistic', 1],
    ['cap 2 while realistic', 2],
    ['cap 1.5 while realistic', 1.5],
    ['the same cap again', 1.5],
    ['rung lite', 1],
    ['cap 1.75 while lite', 1],
    ['rung realistic again (keeps the cap set while lite)', 1.75],
    ['level 2', BASE],
    ['cap 1 at level 2', BASE],
    ['level 1', BASE],
    ['level 3 again (the cap set below applies at the switch)', 1],
    ['an unusable cap is ignored', 1],
    ['NaN is ignored', 1],
  ];
  expect(out.log.map(([what, ratio]) => [what, ratio])).toEqual(want);
  for (const [what, ratio, w] of out.log) expect(w, `${what}: ${w} px for ${out.cssW} css px`).toBe(Math.floor(out.cssW * ratio));
});

test('SceneView: the post chain follows a cap changed while the realistic rung draws, and the picture is still drawn', async ({ page }) => {
  test.setTimeout(300_000);
  const gl: string[] = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && /INVALID_(OPERATION|FRAMEBUFFER|VALUE|ENUM)|CONTEXT_LOST|incomplete/i.test(m.text())) gl.push(m.text()); });
  const el = await openDemo(page);
  await factory(el);
  const desc = buildScene({ ...demoSceneInput('f0')!, realistic: true });
  // a view of its own at the realistic rung, cap 1.25, with the realistic description (the post chunk loads behind it)
  await page.evaluate((d) => {
    const w = window as unknown as Win;
    w.__dprMake({ level: 3, rung: 'realistic', cap: 1.25 }).setDescription(d);
  }, desc);
  const pending = () => page.evaluate(() => (window as unknown as Win).__dprViews[0].view.realPending);
  const snap = (): Promise<Canvas> => page.evaluate(() => {
    const v = (window as unknown as Win).__dprViews[0].view;
    const c = v.renderer.domElement;
    return { ratio: v.renderer.getPixelRatio(), canvasW: c.width, cssW: c.clientWidth, quality: v.getQuality(), rung: v.getRealSettings().rung, passes: v.postPasses, composer: v.post?.composer._pixelRatio ?? null, composerW: v.post?.composer.renderTarget1.width ?? null };
  });
  const set = (s: Record<string, unknown>) => page.evaluate((x) => { (window as unknown as Win).__dprViews[0].view.setRealSettings(x); }, s);
  const draws = () => page.evaluate(() => Number.isFinite((window as unknown as Win).__dprViews[0].view.benchFrames(2)));
  await expect.poll(pending, { timeout: 240_000 }).toBe(0);
  let c = await snap();
  expect(c.passes).toEqual(['render-msaa2', 'gtao', 'bloom', 'output']);
  expectBuffer(c, 1.25);
  expectPost(c, 1.25);
  for (const cap of [1, 1.75, 2, 1.5]) {
    await set({ dprCap: cap });
    c = await snap();
    expectBuffer(c, cap);
    expectPost(c, cap);
    expect(await draws(), `a frame is drawn through the resized targets at cap ${cap}`).toBe(true);
  }
  // a rung change re-creates the chain at the canvas's ratio; the chain is whole again
  await set({ rung: 'lite' });
  await expect.poll(pending, { timeout: 240_000 }).toBe(0);
  c = await snap();
  expect(c.passes).toEqual(['render-msaa2', 'bloom', 'output']);
  expectBuffer(c, 1);
  expectPost(c, 1);
  await set({ rung: 'realistic' });
  await expect.poll(pending, { timeout: 240_000 }).toBe(0);
  c = await snap();
  expect(c.passes).toEqual(['render-msaa2', 'gtao', 'bloom', 'output']);
  expectBuffer(c, 1.5);
  expectPost(c, 1.5);
  // a cap set below level 3 reaches a chain that was built earlier: back at level 3 the chain is at the canvas's ratio
  await page.evaluate(() => {
    const v = (window as unknown as Win).__dprViews[0].view;
    v.setQuality(2);
    v.setRealSettings({ dprCap: 1 });
    v.setQuality(3);
  });
  await expect.poll(pending, { timeout: 240_000 }).toBe(0);
  c = await snap();
  expectBuffer(c, 1);
  expectPost(c, 1);
  expect(await draws()).toBe(true);
  await page.evaluate(() => (window as unknown as Win).__dprDrop());
  expect(gl, 'no WebGL error while the targets were resized').toEqual([]);
});

// ------------------------------------------------------------------------------------------------ the walk

test('the walk: the realistic rung keeps the cap through the walk guard\'s drop to lite and back; the post chain is whole again', async ({ page }) => {
  test.setTimeout(300_000);
  const el = await openDemo(page);
  const desc = buildScene({ ...demoSceneInput('f0')!, walk: true, realistic: true });
  await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ dprCap: 1.5 })); // the person's dial, as the element hands it over
  await el.locator('[data-quality-3]').click();
  await expect(el).toHaveAttribute('data-rung', 'realistic');
  // the host builds the realistic description itself (realistic-change); the walk world rides on a description of ours after it
  await expect.poll(() => el.evaluate((n) => !!(n as unknown as Probe).description?.real), { timeout: 30000 }).toBe(true);
  await el.evaluate((n, d) => { const e = n as unknown as Probe; e.walkable = true; e.description = d; }, desc);
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 240_000 }).toBe(0);
  let c = await canvasOf(el);
  expectBuffer(c, 1.5);
  expectPost(c, 1.5);
  // the walk itself changes nothing about the ratio
  await el.evaluate((n) => (n as unknown as Probe).startWalk());
  await expect(el).toHaveAttribute('data-walk', '');
  c = await canvasOf(el);
  expectBuffer(c, 1.5);
  // the walk ran under its floor: the guard draws the walk one rung lower (lite: DPR 1)
  await el.evaluate((n) => (n as unknown as Probe).onWalkLowFps());
  await expect(el).toHaveAttribute('data-rung', 'lite');
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 240_000 }).toBe(0);
  c = await canvasOf(el);
  expectBuffer(c, 1);
  expectPost(c, 1);
  // leaving the walk returns to the rung the person chose, at the person's cap
  await page.keyboard.press('Escape');
  await expect(el).not.toHaveAttribute('data-walk', '');
  await expect(el).toHaveAttribute('data-rung', 'realistic');
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 240_000 }).toBe(0);
  c = await canvasOf(el);
  expect(c.passes).toEqual(['render-msaa2', 'gtao', 'bloom', 'output']);
  expectBuffer(c, 1.5);
  expectPost(c, 1.5);
});

// ------------------------------------------------------------------------------------------------ the hosts: a start at the realistic rung

/** Records, at every frame report of a sw-plan-3d (`data-frames`: the first report is the first drawn frame), the pixel ratio that
 * frame was drawn at, the drawing buffer and the rung. */
async function recordFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Win;
    w.__frames = [];
    const orig = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
      orig.call(this, name, value);
      if (name !== 'data-frames' || this.localName !== 'sw-plan-3d') return;
      const view = (this as unknown as { view?: ViewLike }).view;
      if (!view) return;
      const c = view.renderer.domElement;
      w.__frames.push({ ratio: view.renderer.getPixelRatio(), canvasW: c.width, cssW: c.clientWidth, rung: this.getAttribute('data-rung') ?? '', quality: this.getAttribute('data-quality') ?? '' });
    };
  });
}
const frames = (page: Page): Promise<FrameRecord[]> => page.evaluate(() => (window as unknown as Win).__frames);

/** The person's dials as the server sends them, with the cap under test (the replay mock's own answer is overridden: the last route wins). */
async function dialsWithCap(page: Page, cap: number): Promise<void> {
  const effective = { ...DEFAULT_VIEW, default_view: 'schematic' as const, dpr_cap: cap };
  const { default_view: _d, ...site } = effective;
  await page.route('**/api/v1/plan-view/prefs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ site, own: {}, effective, personal_dials: [], can_edit_site: false }) }));
}

/** This browser remembers the person's rung (the cache of the personal choice), so the view is built AT it, on the first mount. */
const rememberRealistic = (page: Page) => page.addInitScript(() => { try { localStorage.setItem('sw.plan3d.quality', 'realistic'); } catch { /* storage */ } });

/** From the first drawn frame on, the canvas is at the expected ratio - and so is the post chain once the assets are in. */
async function expectFromFirstFrame(page: Page, el: Locator, ratio: number): Promise<void> {
  await expect(el).toHaveAttribute('data-quality', '3', { timeout: 30000 });
  await expect(el).toHaveAttribute('data-rung', 'realistic');
  await expect.poll(async () => (await frames(page)).length, { timeout: 60000 }).toBeGreaterThan(0);
  for (const f of await frames(page)) expect(f, `frame report ${JSON.stringify(f)}`).toMatchObject({ ratio, quality: '3', rung: 'realistic' });
  await expect.poll(() => el.evaluate((n) => !!(n as unknown as Probe).description?.real), { timeout: 30000 }).toBe(true);
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 120000 }).toBe(0);
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  const c = await canvasOf(el);
  expectBuffer(c, ratio);
  expectPost(c, ratio);
  for (const f of await frames(page)) expect(f.ratio, `a later frame report ${JSON.stringify(f)}`).toBe(ratio);
}

test.describe('a start at the realistic rung draws at the person\'s cap from the first frame (mocked backend)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  async function openHistory3d(page: Page): Promise<Locator> {
    await page.goto(`/?design=a#/investigate/floors/${FLOOR}/history?t=${encodeURIComponent(T_DAY)}&camera=${CAMERA}`);
    const host = page.locator('investigate-history-map');
    await expect(host.locator('sw-plan-canvas [data-structure] [data-wall]').first()).toBeAttached({ timeout: 30000 });
    const toggle = host.locator('[data-view-3d]');
    await expect(toggle).toBeAttached({ timeout: 30000 });
    await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 30000 });
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-history-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
    return el;
  }

  for (const cap of [1, 2]) {
    test(`the history map, own rung realistic, cap ${cap}`, async ({ page }) => {
      test.setTimeout(300_000);
      await recordFrames(page);
      await rememberRealistic(page);
      await installReplayMock(page, { install: '1', own: 'realistic' });
      await dialsWithCap(page, cap);
      const el = await openHistory3d(page);
      await expectFromFirstFrame(page, el, Math.min(BASE, cap));
    });
  }

  test('the event page, own rung realistic, cap 1.5', async ({ page }) => {
    test.setTimeout(300_000);
    await recordFrames(page);
    await rememberRealistic(page);
    await installReplayMock(page, { install: '1', own: 'realistic' });
    await dialsWithCap(page, 1.5);
    await page.goto(`/?design=a#/investigate/events/${EVENT_ID}`);
    const host = page.locator('investigate-event-detail');
    await expect(host.locator('sw-plan-canvas')).toBeAttached({ timeout: 30000 });
    const toggle = host.locator('sw-button[data-event-3d-toggle]');
    await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 30000 });
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-event-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
    await expectFromFirstFrame(page, el, 1.5);
  });

  test('a wall display forced to the realistic rung draws at the cap of the installation from the first frame', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the device is emulated by the wall mock itself; one project is enough');
    test.setTimeout(300_000);
    await recordFrames(page);
    await openWall(page, newWallMock({ plan: { mode: 'live', quality: 'realistic', idle_s: 0 }, dials: { dpr_cap: 1 } }));
    const el = wallLive(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
    await expectFromFirstFrame(page, el, 1);
  });
});
