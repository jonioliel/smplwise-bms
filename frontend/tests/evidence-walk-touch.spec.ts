import { test, expect, type CDPSession, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScene, type Catalog3DLookup, type SceneDescription } from '../src/map/scene-builder';
import type { GeometryDoc } from '../src/map/geometry';
import { inPageCheck } from './layout-guard';
import { camera, wall, walkDoc, walkInput } from './walk-fixtures';
import { skinsUnderTest } from './helpers/frozen-skins';

// Plan Studio 6, slice S5-A (CR-029 sections 4.2 / 8, the touch half of the walk) in the real element on the style guide's 3D
// card, on the dist preview (npm run build; the runner's preview lane). The description is built in node with the walk world
// (exactly what explore-floor-map hands in) and set on the element. The gestures need a touch screen: they run on the mobile
// project (Pixel 7, hasTouch) with real touch events from the browser (Input.dispatchTouchEvent, one finger or two); the
// walk bar / bottom sheet and its 44 px targets run on every project and in the five skins.
//   npx playwright test tests/evidence-walk-touch.spec.ts
// What is asserted: the floating joystick (ring under the thumb, forward by the pose, release stops), the look drag with its
// ease, the pinch (50-80 degrees, no walk), a tap that walks AROUND a low wall and one that stops a walk under way, a tap on a
// cabinet that walks to its foot and selects nothing while a long press selects it (once), the minimap under a finger, the
// saved positions in the sheet and the route that plays them (a touch stops it), and every control >= 44 px.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const items = new Map((JSON.parse(fs.readFileSync(path.join(ROOT, 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as { items: { id: string; shape: string; color_token: string; role: string; mesh?: unknown; walkable?: boolean }[] }).items.map((i) => [i.id, i]));
const catalog: Catalog3DLookup = (id) => {
  const i = items.get(id);
  return i ? ({ shape: i.shape, color_token: i.color_token, role: i.role, mesh: (i.mesh as never) ?? null, walkable: i.walkable } as ReturnType<Catalog3DLookup>) : undefined;
};

type Walker = HTMLElement & {
  description: SceneDescription | null;
  walkable: boolean;
  minFps: number;
  routeDwellMs: number;
  playRoute(): boolean;
  stopRoute(): void;
  routePlaying: boolean;
  startWalk(start?: unknown): void;
  walking: boolean;
  walkController: { pose(): { x: number; z: number; heading_deg: number; pitch_deg: number; level: string }; path: unknown[] | null; heading: number } | null;
  toScreen(p: [number, number, number]): { x: number; y: number } | null;
  view: { camera: { fov: number } };
};
type Win = { __sel: { id: string; kind: string }[]; __trail: string[] };

// 10 m x 8 m (walk-fixtures.ts). The saved positions: the entrance (3, 4.96), the living room (7, 5.6), the office (7, 2).
const positions = [
  { id: 'p1', name: 'כניסה', x: 0.3, y: 0.62, level_id: 'L0', heading_deg: 90, is_default: true },
  { id: 'p2', name: 'סלון', x: 0.7, y: 0.7, level_id: 'L0', heading_deg: 0 },
  { id: 'p3', name: 'משרד', x: 0.7, y: 0.25, level_id: 'L0', heading_deg: 180 },
];
/** The west room with a LOW wall across it (0.9 m: it stops the body, not the eye) at z = 3.6, x 2.4 .. 4.6. */
const lowDoc = (): GeometryDoc => walkDoc({ objects: [], walls: [...walkDoc().walls, wall('w-low', [0.24, 0.45], [0.46, 0.45], { kind: 'low', height_m: 0.9 })], walk_positions: positions });
/** The west room with a tall cabinet (x 3 .. 4, z 1.3 .. 1.9) on its north side. */
const cabDoc = (): GeometryDoc =>
  walkDoc({ objects: [{ id: 'cab', item_id: 'cabinet.tall', level_id: 'L0', position: [0.35, 0.2], rotation_deg: 0, size: { w_m: 1.0, d_m: 0.6, h_m: 1.8 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false }], walk_positions: positions });
const scene = (d: GeometryDoc): SceneDescription => buildScene({ ...walkInput(d, { 'binary_sensor.d1': 'on' }, [camera]), catalog, walk: true });
const descLow = scene(lowDoc());
const descCab = scene(cabDoc());
/** The west room's stair (x 2 .. 4.5, z 6.4) leads on to another floor: at its top the walk offers "continue to that floor". */
const descStair = scene(
  walkDoc({ objects: [], connectors: [{ id: 'xf', kind: 'stairs', level_from: 'L0', level_to: 'X0', floor_ids: ['f2'], far: { floor_id: 'f2', floor_name: 'קומה 2', level_name: null, direction: 'up', datum_m: 3, level_elevation_m: 0 }, polyline: [[0.2, 0.8], [0.45, 0.8]], width_m: 1.0, label: null, object_id: null, source: 'manual' }] }),
);

async function open(page: Page, d: SceneDescription, skin = 'classic'): Promise<Locator> {
  await page.goto(`/?skin=${skin}&scheme=light#/styleguide`);
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await el.evaluate((n, desc) => { const w = n as unknown as Walker; w.minFps = 0; w.walkable = true; w.routeDwellMs = 500; w.description = desc; }, d);
  await el.scrollIntoViewIfNeeded();
  return el;
}

/** `pitch` below 0 looks down a little: the floor that is a few metres ahead then sits above the bottom sheet. */
async function walkAt(el: Locator, x: number, z: number, heading: number, pitch = 0): Promise<void> {
  await el.evaluate((n, s) => (n as unknown as Walker).startWalk(s), { id: 'start', kind: 'centre', label: '', level: 'L0', x, z, heading_deg: heading, pitch_deg: pitch, eye_m: null });
  await expect(el).toHaveAttribute('data-walk', '');
  await expect(el.locator('sw-walk-hud')).toBeAttached();
  await el.scrollIntoViewIfNeeded();
  // the entry flight (the camera comes down from the orbit view) is over: what the camera projects is where the eye is
  await expect.poll(() => el.evaluate((n) => { const w = (n as unknown as { view: { walking: { fly: unknown } | null } }).view.walking; return !!w && !w.fly; }), { timeout: 8000 }).toBe(true);
}

const pose = (el: Locator) => el.evaluate((n) => (n as unknown as Walker).walkController!.pose());
const heading = (el: Locator) => el.evaluate((n) => (n as unknown as Walker).walkController!.heading);
const fov = (el: Locator) => el.evaluate((n) => (n as unknown as Walker).view.camera.fov);
const hasPath = (el: Locator) => el.evaluate((n) => (n as unknown as Walker).walkController!.path !== null);
const screenOf = async (el: Locator, p: [number, number, number]) => {
  const s = await el.evaluate((n, q) => (n as unknown as Walker).toScreen(q), p);
  expect(s, `${p.join(',')} is in view`).not.toBeNull();
  return s!;
};
/** Record every `part-select` the element fires. The style guide's own handler would re-render its card and put its demo
 * description (no walk world) back on the element, ending the walk: the event is caught on the way in and stopped there. */
const listen = (el: Locator) =>
  el.evaluate((n) => {
    const w = window as unknown as Win;
    w.__sel = [];
    n.parentElement!.addEventListener('part-select', (e) => { w.__sel.push((e as CustomEvent).detail); e.stopPropagation(); }, true);
  });
const selected = (page: Page) => page.evaluate(() => (window as unknown as Win).__sel);

interface Pt {
  x: number;
  y: number;
  id: number;
}
/** Real touch events from the browser: the fingers that are down, moving, lifting (touchEnd lists the fingers that stay). */
class Fingers {
  constructor(private readonly cdp: CDPSession) {}
  private pts = (p: Pt[]) => p.map((q) => ({ x: q.x, y: q.y, id: q.id, radiusX: 1, radiusY: 1, force: 1 }));
  start(p: Pt[]): Promise<unknown> {
    return this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.pts(p) });
  }
  move(p: Pt[]): Promise<unknown> {
    return this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this.pts(p) });
  }
  end(stay: Pt[] = []): Promise<unknown> {
    return this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.pts(stay) });
  }
}
async function fingers(page: Page): Promise<Fingers> {
  return new Fingers(await page.context().newCDPSession(page));
}
const box = async (el: Locator): Promise<{ x: number; y: number; width: number; height: number }> => {
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (!b) throw new Error('no box');
  return b;
};
/** A drag in steps of ~16 ms (a real thumb), ending where it ends. */
async function drag(page: Page, f: Fingers, from: Pt, to: { x: number; y: number }, steps = 8): Promise<void> {
  for (let i = 1; i <= steps; i++) {
    await f.move([{ id: from.id, x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]);
    await page.waitForTimeout(16);
  }
}

test.describe('the touch walk', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'mobile', 'gestures need a touch screen: the mobile project (hasTouch)');
  });

  test('the joystick floats under the thumb: forward by the pose, the ring follows, release stops', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page, descLow);
    await walkAt(el, 3.5, 5.0, 0); // north is up the screen: forward is -z
    const hud = el.locator('sw-walk-hud');
    await expect(hud.locator('.stick')).toBeHidden();
    const b = await box(el);
    const f = await fingers(page);
    const o = { id: 1, x: b.x + 70, y: b.y + 150 };
    const z0 = (await pose(el)).z;
    await f.start([o]);
    await drag(page, f, o, { x: o.x, y: o.y - 60 });
    await expect(hud.locator('.stick')).toBeVisible();
    const ring = await hud.locator('.stick').boundingBox();
    expect(Math.abs(ring!.x + ring!.width / 2 - o.x)).toBeLessThanOrEqual(2); // the ring is under the thumb where it went down
    expect(Math.abs(ring!.y + ring!.height / 2 - o.y)).toBeLessThanOrEqual(2);
    await expect(el).toHaveAttribute('data-walk-touch', '');
    await expect.poll(async () => z0 - (await pose(el)).z, { timeout: 8000 }).toBeGreaterThan(0.4); // walked north
    await f.end();
    await expect(hud.locator('.stick')).toBeHidden();
    const z1 = (await pose(el)).z;
    await page.waitForTimeout(300);
    expect(Math.abs((await pose(el)).z - z1)).toBeLessThan(0.02); // and stopped
    expect(Math.abs((await pose(el)).x - 3.5)).toBeLessThan(0.05); // straight: the axis snap, no crab step
  });

  test('the right half looks with an ease, two fingers pinch the field of view and never walk', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page, descLow);
    await walkAt(el, 3.5, 5.0, 0);
    const b = await box(el);
    const f = await fingers(page);
    const h0 = await heading(el);
    const o = { id: 1, x: b.x + b.width - 90, y: b.y + 150 };
    await f.start([o]);
    await drag(page, f, o, { x: o.x - 60, y: o.y }); // the finger goes left: the world follows it, the view turns right
    await f.end();
    const turned = async () => ((await heading(el)) - h0 + 540) % 360 - 180; // signed degrees
    await expect.poll(turned, { timeout: 4000 }).toBeGreaterThan(14); // 60 px x 0.3 = 18 degrees, eased in
    await page.waitForTimeout(400);
    expect(Math.abs((await turned()) - 18)).toBeLessThan(3); // settled on it: no overshoot
    // the pinch: two fingers apart, narrower; together, wider; always inside 50-80
    const x0 = b.x + b.width - 120;
    const y0 = b.y + 200;
    const p0 = await pose(el);
    const fov0 = await fov(el);
    await f.start([{ id: 1, x: x0, y: y0 }, { id: 2, x: x0 + 50, y: y0 }]);
    for (let i = 1; i <= 8; i++) {
      await f.move([{ id: 1, x: x0 - i * 8, y: y0 }, { id: 2, x: x0 + 50 + i * 8, y: y0 }]);
      await page.waitForTimeout(16);
    }
    const fovApart = await fov(el);
    expect(fovApart).toBeLessThan(fov0 - 5);
    expect(fovApart).toBeGreaterThanOrEqual(50);
    for (let i = 7; i >= -1; i--) {
      await f.move([{ id: 1, x: x0 - i * 8, y: y0 }, { id: 2, x: x0 + 50 + i * 8, y: y0 }]);
      await page.waitForTimeout(16);
    }
    const fovTogether = await fov(el);
    expect(fovTogether).toBeGreaterThan(fovApart + 5);
    expect(fovTogether).toBeLessThanOrEqual(80);
    await f.end();
    const p1 = await pose(el);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThan(0.01); // a pinch is not a walk
    expect(Math.abs(p1.heading_deg - p0.heading_deg)).toBeLessThan(0.5); // and not a look
  });

  test('a tap walks around a low wall to the point; a tap while walking stops it where it stands', async ({ page }) => {
    test.setTimeout(180_000);
    const el = await open(page, descLow);
    await walkAt(el, 3.5, 4.8, 0, -12); // south of the low wall (z 3.6), facing north and a little down
    const b = await box(el);
    const target = await screenOf(el, [3.5, 0, 1.5]); // the floor beyond the wall, seen over it
    await page.touchscreen.tap(b.x + target.x, b.y + target.y);
    await expect(el.locator('sw-walk-hud .target')).toBeVisible(); // the ring where the walk is going
    const xs: number[] = [];
    await expect
      .poll(async () => {
        const p = await pose(el);
        xs.push(p.x);
        return Math.hypot(p.x - 3.5, p.z - 1.5);
      }, { timeout: 60_000, intervals: [100] })
      .toBeLessThan(0.35);
    expect(Math.min(...xs) < 2.2 || Math.max(...xs) > 4.8, 'the way led around an end of the wall').toBe(true);
    await expect(el.locator('sw-walk-hud .target')).toBeHidden();
    // a tap while walking stops it where it stands (and starts nothing)
    await walkAt(el, 3.5, 4.8, 0, -12);
    const again = await screenOf(el, [3.5, 0, 1.5]);
    await page.touchscreen.tap(b.x + again.x, b.y + again.y);
    await expect.poll(() => hasPath(el), { timeout: 4000 }).toBe(true);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height * 0.6);
    await expect.poll(() => hasPath(el), { timeout: 4000 }).toBe(false);
    const stopped = await pose(el);
    await page.waitForTimeout(400);
    const later = await pose(el);
    expect(Math.hypot(later.x - stopped.x, later.z - stopped.z)).toBeLessThan(0.02);
    expect(Math.hypot(stopped.x - 3.5, stopped.z - 4.8)).toBeLessThan(2.6); // it had not got far
  });

  test('a tap on a cabinet walks to its foot and selects nothing; a long press selects it once; a long press on the floor does not', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page, descCab);
    await listen(el);
    await walkAt(el, 3.5, 3.6, 0); // the cabinet's front face (z 1.9) straight ahead
    const b = await box(el);
    const cab = await screenOf(el, [3.5, 1.2, 1.9]);
    const at = { id: 1, x: b.x + cab.x, y: b.y + cab.y };
    await page.touchscreen.tap(at.x, at.y);
    await expect.poll(() => hasPath(el), { timeout: 4000 }).toBe(true); // a tap walks...
    expect(await selected(page)).toEqual([]); // ...and selects nothing
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height * 0.55); // stop it
    await expect.poll(() => hasPath(el), { timeout: 4000 }).toBe(false);
    const f = await fingers(page);
    await f.start([at]);
    await page.waitForTimeout(250);
    expect((await selected(page)).length).toBe(0); // not yet
    await page.waitForTimeout(500);
    await f.end();
    await page.waitForTimeout(100);
    expect(await selected(page)).toEqual([{ id: 'cab', kind: 'object' }]); // once, and the lift after it is not a tap
    expect(await hasPath(el)).toBe(false);
    // a long press on the empty floor beside it opens nothing
    const floor = await screenOf(el, [2.2, 0, 1.3]);
    await f.start([{ id: 1, x: b.x + floor.x, y: b.y + floor.y }]);
    await page.waitForTimeout(800);
    await f.end();
    expect((await selected(page)).length).toBe(1);
  });

  test('the minimap takes a finger: a touch teleports, a drag follows', async ({ page }) => {
    test.setTimeout(120_000);
    const el = await open(page, descLow);
    await walkAt(el, 3.5, 5.0, 0);
    const map = el.locator('canvas[data-walk-minimap]');
    await expect(map).toBeVisible();
    expect(await map.evaluate((c) => getComputedStyle(c).touchAction)).toBe('none');
    const m = await box(map);
    expect(m.width).toBeGreaterThanOrEqual(100);
    const before = await pose(el);
    await page.touchscreen.tap(m.x + m.width * 0.75, m.y + m.height * 0.3);
    await expect.poll(async () => (await pose(el)).x, { timeout: 4000 }).toBeGreaterThan(before.x + 1);
    const f = await fingers(page);
    const o = { id: 1, x: m.x + m.width * 0.3, y: m.y + m.height * 0.5 };
    await f.start([o]);
    const a = await pose(el);
    await drag(page, f, o, { x: m.x + m.width * 0.6, y: m.y + m.height * 0.5 }, 6);
    await f.end();
    expect((await pose(el)).x).toBeGreaterThan(a.x + 0.5);
  });
});

test.describe('the walk bar and the bottom sheet', () => {
  test('every control is at least 44 px, in the five skins', async ({ page }, info) => {
    test.setTimeout(300_000);
    for (const skin of skinsUnderTest(['classic', 'domus', 'tesla', 'bubble', 'crystal'])) {
      const el = await open(page, descLow, skin);
      await walkAt(el, 3.5, 5.0, 0);
      const phone = info.project.name === 'mobile';
      await expect(el.locator(phone ? '[data-walk-sheet]' : '.walkbar')).toBeVisible();
      for (const opened of phone ? [false, true] : [false]) {
        if (opened) {
          await el.locator('[data-walk-sheet-toggle]').click();
          await expect(el.locator('[data-walk-sheet-body]')).toBeVisible();
        }
        const found = await page.evaluate(inPageCheck, { ctx: `${skin} ${info.project.name} ${opened ? 'open' : 'closed'}`, within: 'sw-plan-3d', skip: 'canvas', roots: [] });
        const mine = found.filter((x) => x.cls === 'target' || x.cls === 'escape' || x.cls === 'clipped');
        expect(mine, mine.map((x) => `[${x.cls}] ${x.el} ${x.detail}`).join('\n')).toEqual([]);
      }
    }
  });

  test('the stair prompt button is a finger target too', async ({ page }, info) => {
    test.setTimeout(120_000);
    const el = await open(page, descStair);
    await walkAt(el, 3.9, 6.4, 90); // on the stair, facing its top
    await page.keyboard.down('KeyW');
    await expect(el.locator('[data-walk-cross]')).toBeVisible({ timeout: 20_000 });
    await page.keyboard.up('KeyW');
    const b = await el.locator('[data-walk-cross-go]').boundingBox();
    expect(b, `the prompt button on ${info.project.name}`).not.toBeNull();
    expect(b!.height).toBeGreaterThanOrEqual(43.5);
    expect(b!.width).toBeGreaterThanOrEqual(43.5);
  });

  test('the sheet opens upward to the places and the numeric fields; a place goes there; the route plays and a touch stops it', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the bottom sheet is the phone layout');
    test.setTimeout(180_000);
    const el = await open(page, descLow);
    await walkAt(el, 3.5, 5.0, 0);
    await expect(el.locator('[data-walk-sheet]')).toBeVisible();
    await expect(el.locator('[data-walk-sheet-body]')).toHaveCount(0);
    const tg = el.locator('[data-walk-sheet-toggle]');
    await expect(tg).toHaveAttribute('aria-expanded', 'false');
    await tg.click();
    await expect(tg).toHaveAttribute('aria-expanded', 'true');
    await expect(el.locator('[data-walk-sheet-body]')).toBeVisible();
    for (const sel of ['[data-walk-x]', '[data-walk-y]', '[data-walk-heading]']) await expect(el.locator(sel)).toBeVisible(); // the numeric alternative to every move
    await expect(el.locator('[data-walk-place="pos:p2"]')).toHaveText('סלון');
    // the numeric field moves the walk
    await el.locator('[data-walk-heading]').fill('135');
    await el.locator('[data-walk-heading]').blur();
    await expect.poll(async () => (await pose(el)).heading_deg).toBeCloseTo(135, 0);
    // a place goes there and closes the sheet
    await el.locator('[data-walk-place="pos:p2"]').click();
    await expect.poll(async () => Math.hypot((await pose(el)).x - 7, (await pose(el)).z - 5.6)).toBeLessThan(0.4);
    await expect(tg).toHaveAttribute('aria-expanded', 'false');
    // the route: the saved positions in order, 0.5 s each here (4 s by default), then it ends by itself
    const route = el.locator('[data-walk-route]');
    await expect(route).toHaveText('מסלול');
    // every jump of the walk (a stop of the route is a `place`) is recorded as it happens: no sampling, no timing to miss
    await el.evaluate((n) => {
      const w = window as unknown as Win;
      w.__trail = [];
      const c = (n as unknown as Walker).walkController as unknown as { place(s: { id: string }): unknown };
      const place = c.place.bind(c);
      c.place = (s) => {
        w.__trail.push(s.id);
        return place(s);
      };
    });
    await route.click();
    await expect(route).toHaveText('עצירה');
    await expect(route).toHaveText('מסלול', { timeout: 8000 }); // over by itself: three stops x 0.5 s
    const trail = await page.evaluate(() => (window as unknown as Win).__trail);
    expect(trail, 'the route showed the three saved positions in order').toEqual(['pos:p1', 'pos:p2', 'pos:p3']);
    expect(Math.hypot((await pose(el)).x - 7, (await pose(el)).z - 2)).toBeLessThan(0.45); // and stayed at the last one
    // the same route through the element's own methods (the kiosk's idle route uses them): started, reported, stopped
    expect(await el.evaluate((n) => (n as unknown as Walker).playRoute())).toBe(true);
    expect(await el.evaluate((n) => (n as unknown as Walker).routePlaying)).toBe(true);
    await expect(route).toHaveText('עצירה');
    await el.evaluate((n) => (n as unknown as Walker).stopRoute());
    expect(await el.evaluate((n) => (n as unknown as Walker).routePlaying)).toBe(false);
    await expect(route).toHaveText('מסלול');
    // a finger on the view stops a route under way
    await route.click();
    await expect(route).toHaveText('עצירה');
    const b = await box(el);
    await page.touchscreen.tap(b.x + b.width - 60, b.y + 120);
    await expect(route).toHaveText('מסלול', { timeout: 3000 });
    // leaving the walk clears the touch state
    await el.locator('[data-walk-exit]').click();
    await expect(el).not.toHaveAttribute('data-walk', '');
    await expect(el).not.toHaveAttribute('data-walk-touch', '');
  });
});
