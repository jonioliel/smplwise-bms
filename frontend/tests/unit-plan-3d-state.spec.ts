import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription, type SceneZone } from '../src/map/scene-builder';
import { roomStates, type RoomStateLayer, type StateEntity } from '../src/map/room-state';

// CR-006 slice 1b, the 3D element in headless Chromium on the style guide's demo floor with descriptions built here
// (the description is plain JSON: the spec hands the element a lit / present / open scene and a quiet one): the tints
// draw as translucent prisms in the state tokens with the fade's opacity, the open-door frame as one instanced red
// group, the temperature chip as a sprite, at both quality levels; a quiet description has none of them; the strip's
// dots are drawn over the cached thumbnails (no thumbnail redrawn); and the carried 1a nits: thumbnails are drawn in a
// pass outside render() and a failed one is not cached, a narrow canvas frames the thumbnail on the clamped size.
const NOW = Date.parse('2026-09-28T12:00:00Z');
type Probe = {
  view: { scene: { traverse: (f: (o: Record<string, unknown>) => void) => void }; renderThumbnail: (d: SceneDescription, id: string, w?: number, h?: number) => string | null; getQuality: () => number };
  description: SceneDescription;
  minFps: number;
  levels: unknown[];
  thumbnailScene: SceneDescription | null;
  levelDots: Record<string, unknown>;
  thumbnailCount: number;
};
type Mat = { name: string; type: string; instanced: boolean; count: number; color: string; opacity: number; transparent: boolean; visible: boolean };

const input = demoSceneInput('f0')!;
const rooms = demoRooms('f0');
const zones: SceneZone[] = rooms.map((r, i) => ({ id: `z${i}`, name: `חדר ${i}`, polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], level_id: 'L0' }));
const ent = (id: string, x: number, y: number, extra: Partial<StateEntity> = {}): StateEntity => ({ id, domain: id.split('.')[0], device_class: null, state: null, last_changed: null, attributes: null, x, y, level_id: 'L0', layer_id: null, ...extra });
const c = (i: number) => ({ x: rooms[i].x + rooms[i].w / 2, y: rooms[i].y + rooms[i].h / 2 });
/** The live layer: room 0 lit and 21.5 degrees, room 1 with motion 90 s ago (a half fade), door do0 open. */
const live: RoomStateLayer = roomStates({
  rooms: zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: 'L0' })),
  entities: [ent('light.z0', c(0).x, c(0).y, { state: 'on' }), ent('sensor.t0', c(0).x + 0.01, c(0).y, { device_class: 'temperature', state: '21.5' }), ent('binary_sensor.m1', c(1).x, c(1).y, { device_class: 'motion', state: 'off', last_changed: new Date(NOW - 90_000).toISOString() }), ent('binary_sensor.d0', 0, 0, { device_class: 'door', state: 'on' })],
  openings: [{ id: 'do0', kind: 'door', x: 0, y: 0, level_id: 'L0', entity_id: 'binary_sensor.d0' }],
  size: [input.width, input.height],
  now: NOW,
  fade: 3,
});
const quiet: RoomStateLayer = roomStates({ rooms: zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: 'L0' })), entities: [ent('light.z0', c(0).x, c(0).y, { state: 'off' })], openings: [], size: [input.width, input.height], now: NOW, fade: 3 });
const withStates = buildScene({ ...input, zones, roomStates: live });
const without = buildScene({ ...input, zones, roomStates: quiet });

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  return el;
}
const setDescription = (el: Locator, d: SceneDescription) => el.evaluate((n, desc) => { (n as unknown as Probe).description = desc; }, d);
/** Every mesh of the scene with its material's colour and opacity. */
const materials = (el: Locator): Promise<Mat[]> =>
  el.evaluate((n) => {
    const out: Mat[] = [];
    (n as unknown as Probe).view.scene.traverse((o) => {
      const m = o.material as { color?: { getHexString: () => string }; opacity?: number; transparent?: boolean } | undefined;
      if (!m) return;
      out.push({ name: String(o.name ?? ''), type: String(o.type), instanced: !!o.isInstancedMesh, count: Number(o.count ?? 0), color: m.color?.getHexString() ?? '', opacity: Number(m.opacity ?? 1), transparent: !!m.transparent, visible: o.visible !== false });
    });
    return out;
  });
const token = (el: Locator, name: string) => el.evaluate((n, t) => getComputedStyle(n).getPropertyValue(`--sw-${t}`).trim().replace('#', '').toLowerCase(), name);

test('the state layer in 3D: lit and presence prisms in the state tokens, the open-door frame, the temperature chip; a quiet scene has none; both levels', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  for (const q of [1, 2] as const) {
    await el.locator(`[data-quality-${q}]`).click();
    await expect(el).toHaveAttribute('data-quality', String(q));
    await setDescription(el, withStates);
    await expect(el).toHaveAttribute('data-parts', String(withStates.parts.length));
    const mats = await materials(el);
    const lit = mats.find((m) => m.name === 'room:z0#lit');
    expect(lit, `level ${q}: the lit prism`).toBeTruthy();
    expect(lit!.type).toBe('Mesh');
    expect(lit!.color).toBe(await token(el, 'map-lit'));
    expect(lit!.transparent).toBe(true);
    expect(lit!.opacity).toBeCloseTo(0.42, 5);
    const presence = mats.find((m) => m.name === 'room:z1#presence');
    expect(presence, `level ${q}: the presence prism`).toBeTruthy();
    expect(presence!.color).toBe(await token(el, 'map-presence'));
    expect(presence!.opacity).toBeCloseTo(0.18, 5); // half the fade of the 0.36 tint
    expect(mats.some((m) => m.name === 'room:z1#lit' || m.name === 'room:z0#presence')).toBe(false);
    const frame = mats.find((m) => m.name === 'box|danger|1');
    expect(frame, `level ${q}: the frame's instance group`).toBeTruthy();
    expect(frame!.instanced).toBe(true); // (an InstancedMesh reports type 'Mesh')
    expect(frame!.count).toBe(3); // jamb, jamb, head
    expect(frame!.color).toBe(await token(el, 'danger'));
    const chip = mats.find((m) => m.name === 'room:z0#temp');
    expect(chip?.type).toBe('Sprite');
    expect(mats.some((m) => m.name === 'room:z1#temp')).toBe(false);
    // the quiet scene: no tint, no frame, no chip - the rooms themselves stay
    await setDescription(el, without);
    await expect(el).toHaveAttribute('data-parts', String(without.parts.length));
    const off = await materials(el);
    expect(off.some((m) => m.name.endsWith('#lit') || m.name.endsWith('#presence') || m.name.endsWith('#temp') || m.name === 'box|danger|1')).toBe(false);
    expect(off.some((m) => m.name === 'room:z0')).toBe(true);
  }
  // a tint is not pickable: the outline of the selected zone is the room's box only (no outline of the tint)
  await setDescription(el, withStates);
  await el.evaluate((n) => { (n as unknown as { selectedId: string | null }).selectedId = 'z0'; });
  await expect(el).toHaveAttribute('data-selected', 'z0');
  const lines = (await materials(el)).filter((m) => m.type === 'LineSegments');
  expect(lines.length).toBe(3); // the room prism, its name and its temperature chip - not the lit prism (4 would be)
});

test('the strip dots: presence (with the fade), open and lit over the cached thumbnail, no thumbnail redrawn; thumbnails come from a pass outside render, a failed one is never cached', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  await setDescription(el, withStates);
  // two listed levels: L0 exists, LX does not (its thumbnail fails - and must not be cached)
  await el.evaluate((n, d) => {
    const e = n as unknown as Probe;
    e.thumbnailScene = d;
    e.levels = [{ id: 'L0', name: 'קומה', elevation_m: 0 }, { id: 'LX', name: 'אין', elevation_m: 3 }];
  }, without);
  const thumbs = el.locator('[data-3d-thumb]');
  await expect(thumbs).toHaveCount(2);
  await expect(thumbs.first()).toHaveAttribute('data-3d-thumb', 'LX'); // the strip lists the levels top down
  const l0 = el.locator('[data-3d-thumb="L0"] img');
  await expect.poll(() => el.getAttribute('data-3d-thumbs')).toBe('1');
  await expect(l0).toHaveAttribute('src', /^data:image\/png/);
  await expect(el.locator('[data-3d-thumb="LX"] img')).toHaveAttribute('src', '');
  expect(await el.evaluate((n) => (n as unknown as Probe).thumbnailCount)).toBe(1); // LX's failure is not cached
  const src = await l0.getAttribute('src');
  // the dots: drawn over the picture, the picture unchanged
  await el.evaluate((n) => { (n as unknown as Probe).levelDots = { L0: { presence: 0.5, open: true, lit: true }, LX: { presence: 0, open: false, lit: false } }; });
  const dots = el.locator('[data-3d-dots="L0"]');
  await expect(dots).toHaveCount(1);
  await expect(dots.locator('i[data-dot="presence"]')).toHaveAttribute('style', /--fade:0\.50/);
  await expect(dots.locator('i[data-dot="open"]')).toHaveCount(1);
  await expect(dots.locator('i[data-dot="lit"]')).toHaveCount(1);
  await expect(el.locator('[data-3d-dots="LX"]')).toHaveCount(0);
  expect(await l0.getAttribute('src')).toBe(src);
  expect(await el.evaluate((n) => (n as unknown as Probe).thumbnailCount)).toBe(1);
  // a fade that ended: the presence dot goes, the others stay
  await el.evaluate((n) => { (n as unknown as Probe).levelDots = { L0: { presence: 0, open: true, lit: false } }; });
  await expect(dots.locator('i[data-dot="presence"]')).toHaveCount(0);
  await expect(dots.locator('i[data-dot="open"]')).toHaveCount(1);
  await expect(dots.locator('i[data-dot="lit"]')).toHaveCount(0);
});

test('a narrow canvas frames the thumbnail on the clamped size: the same picture as an explicit request of that size', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  await setDescription(el, without);
  await el.evaluate((n) => { (n as HTMLElement).style.inlineSize = '120px'; });
  await page.waitForTimeout(300); // the ResizeObserver resized the renderer
  const narrow = await el.evaluate((n, d) => (n as unknown as Probe).view.renderThumbnail(d, 'L0', 160, 100), without);
  expect(narrow).toMatch(/^data:image\/png/);
  const size = await page.evaluate(async (src) => {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('bad png')); img.src = src!; });
    return { w: img.naturalWidth, h: img.naturalHeight };
  }, narrow);
  expect(size).toEqual({ w: 120, h: 100 });
  await el.evaluate((n) => { (n as HTMLElement).style.inlineSize = ''; });
  await page.waitForTimeout(300);
  const explicit = await el.evaluate((n, d) => (n as unknown as Probe).view.renderThumbnail(d, 'L0', 120, 100), without);
  expect(explicit).toBe(narrow); // the frame was fitted to 120 x 100, not squashed from 160 x 100
});
