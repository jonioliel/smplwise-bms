import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription, type SceneInput, type SceneZone } from '../src/map/scene-builder';
import { roomStates, type StateEntity } from '../src/map/room-state';
import { CONTROL_H, CONTROL_STATES, CONTROL_W, allOnLayer, controlDescription, controlSceneInput, dataUrlBytes, type ControlState } from '../src/map/skin-control';

// CR-006 phase 2, slice 2a: the control image of a floor skin. (1) Node: the control scene is a pure function of the
// plan JSON and the synthetic state - no label, name, camera, cone, entity, chip, marker or presence tint survives, the
// live state never leaks in (a floor with lights on, motion and an open door gives the same control description as a
// quiet one), all_on lights every room and lamp. (2) Browser, the 1c determinism harness's floor: the element's
// off-screen level-2 isometric capture is CONTROL_W x CONTROL_H, opaque, byte-identical on every call (the same
// geometry + state -> the same bytes) whatever the viewer's quality / preset, differs between the states, and leaves the
// view on screen untouched.
const NOW = Date.parse('2026-09-28T12:00:00Z');
const input = demoSceneInput('f0')!;
const rooms = demoRooms('f0');
const zones: SceneZone[] = rooms.map((r, i) => ({ id: `z${i}`, name: `חדר ${i}`, polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], level_id: 'L0' }));
const ent = (id: string, x: number, y: number, extra: Partial<StateEntity> = {}): StateEntity => ({ id, domain: id.split('.')[0], device_class: null, state: null, last_changed: null, attributes: null, x, y, level_id: 'L0', layer_id: null, ...extra });
const c = (i: number) => ({ x: rooms[i].x + rooms[i].w / 2, y: rooms[i].y + rooms[i].h / 2 });
/** The floor as the live map sees it: lights on in room 0 (21.5 degrees), motion in room 1, door do0 open, every lamp on. */
const liveInput = (): SceneInput => {
  const layer = roomStates({
    rooms: zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: 'L0' })),
    entities: [ent('light.z0', c(0).x, c(0).y, { state: 'on' }), ent('sensor.t0', c(0).x + 0.01, c(0).y, { device_class: 'temperature', state: '21.5' }), ent('binary_sensor.m1', c(1).x, c(1).y, { device_class: 'motion', state: 'on' }), ent('binary_sensor.d0', 0, 0, { device_class: 'door', state: 'on' })],
    openings: [{ id: 'do0', kind: 'door' as const, x: 0, y: 0, level_id: 'L0', entity_id: 'binary_sensor.d0' }],
    size: [input.width, input.height],
    now: NOW,
    fade: 3,
  });
  const onStates = Object.fromEntries(Object.keys(input.entityStates).map((k) => [k, 'on']));
  return { ...input, doc: JSON.parse(JSON.stringify(input.doc)), anchors: JSON.parse(JSON.stringify(input.anchors)), entityStates: onStates, circuitStates: { ...input.circuitStates }, zones: JSON.parse(JSON.stringify(zones)), roomStates: layer };
};
const quietInput = (): SceneInput => ({ ...input, doc: JSON.parse(JSON.stringify(input.doc)), anchors: JSON.parse(JSON.stringify(input.anchors)), entityStates: { ...input.entityStates }, circuitStates: { ...input.circuitStates }, zones: JSON.parse(JSON.stringify(zones)), roomStates: null });
const control = (i: SceneInput, s: ControlState) => controlDescription(buildScene(controlSceneInput(i, s)), s);
const FORBIDDEN = new Set(['label', 'chip', 'entity', 'camera', 'cone', 'marker']);

test('the control scene is a pure function of the plan and the synthetic state: nothing that names or shows anyone, no live state', () => {
  const full = buildScene(liveInput());
  expect(full.parts.some((p) => p.kind === 'label' && p.text)).toBe(true); // the live scene does carry room names
  expect(full.parts.some((p) => p.kind === 'camera' || p.kind === 'cone')).toBe(true);
  expect(full.parts.some((p) => p.kind === 'entity')).toBe(true);
  for (const s of CONTROL_STATES) {
    const a = control(liveInput(), s);
    const b = control(quietInput(), s);
    expect(JSON.stringify(a), `${s}: the live state never reaches the control scene`).toBe(JSON.stringify(b));
    expect(JSON.stringify(control(liveInput(), s))).toBe(JSON.stringify(a)); // deterministic
    expect(a.parts.length).toBeGreaterThan(10);
    for (const p of a.parts) {
      expect(p.shape, p.id).not.toBe('sprite');
      expect(FORBIDDEN.has(p.kind), `${p.id} (${p.kind})`).toBe(false);
      expect(p.text, p.id).toBeUndefined();
      expect(p.id.includes('#presence'), p.id).toBe(false);
    }
    // the filter holds for any description, even one built with every live part
    for (const p of controlDescription(full, s).parts) expect(FORBIDDEN.has(p.kind) || p.shape === 'sprite', p.id).toBe(false);
  }
  const off = control(quietInput(), 'all_off');
  const on = control(quietInput(), 'all_on');
  expect(off.parts.some((p) => p.kind === 'tint' || p.kind === 'glow')).toBe(false);
  expect(on.parts.filter((p) => p.kind === 'tint').map((p) => p.id).sort()).toEqual(zones.map((z) => `room:${z.id}#lit`).sort());
  // the synthetic input: no names on rooms or anchors, every level, cameras and entities off
  const ci = controlSceneInput(liveInput(), 'all_on');
  expect(ci.zones!.every((z) => z.name === '')).toBe(true);
  expect(input.anchors.length).toBeGreaterThan(0);
  expect(ci.anchors, 'anchors are not part of the geometry key').toEqual([]);
  expect(ci.level).toBeNull();
  expect(ci.layers).toMatchObject({ cameras: false, entities: false, structure: true });
  expect(Object.values(allOnLayer(quietInput()).rooms).every((r) => r.lit && !r.presence && r.temperature === null)).toBe(true);
});

type El = { captureControl: (d: SceneDescription) => string | null; capture: () => string | null; minFps: number; description: SceneDescription; view: { buildCount: number } };

async function openDemo(page: Page, design: 'a' | 'b' | null = null): Promise<Locator> {
  await page.goto(design ? `/?design=${design}#/styleguide` : '/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await el.evaluate((n) => { (n as unknown as El).minFps = 0; });
  return el;
}
const shoot = (el: Locator, d: SceneDescription) => el.evaluate((n, desc) => (n as unknown as El).captureControl(desc), d);

test('the control image: fixed size, opaque, the same bytes on every call and at any viewer setting, different per state, the view untouched', async ({ page }) => {
  test.setTimeout(180_000);
  const el = await openDemo(page);
  const off = control(quietInput(), 'all_off');
  const on = control(quietInput(), 'all_on');
  const before = await el.evaluate((n) => ({ builds: (n as unknown as El).view.buildCount, parts: (n as unknown as El).description.parts.length }));
  const preset = await el.getAttribute('data-preset');
  const quality = await el.getAttribute('data-quality');
  const a = await shoot(el, off);
  expect(a, 'WebGL capture').toBeTruthy();
  expect(a!.startsWith('data:image/png;base64,')).toBe(true);
  const b = await shoot(el, off);
  expect(b, 'the same geometry and state give the same bytes').toBe(a);
  const lit = await shoot(el, on);
  expect(lit).not.toBe(a);
  expect(await shoot(el, on)).toBe(lit);
  // decoded: the fixed size, every pixel opaque, not blank
  const info = await page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let transparent = 0;
    let nonWhite = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] !== 255) transparent++;
      if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) nonWhite++;
    }
    return { w: img.naturalWidth, h: img.naturalHeight, transparent, nonWhite, total: d.length / 4 };
  }, a!);
  expect([info.w, info.h]).toEqual([CONTROL_W, CONTROL_H]);
  expect(info.transparent).toBe(0);
  expect(info.nonWhite / info.total, 'the floor is drawn').toBeGreaterThan(0.02);
  // no text chunk in the PNG (the backend refuses one): only IHDR / IDAT / IEND and colour chunks
  const bytes = dataUrlBytes(a!);
  const chunks: string[] = [];
  for (let pos = 8; pos + 8 <= bytes.length; ) {
    const len = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
    chunks.push(String.fromCharCode(...bytes.slice(pos + 4, pos + 8)));
    pos += 12 + len;
  }
  expect(chunks[0]).toBe('IHDR');
  expect(chunks.at(-1)).toBe('IEND');
  expect(chunks.some((k) => ['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(k))).toBe(false);
  // the labels are what the filter removes: the same scene with its room names draws other pixels
  const withNames = buildScene(controlSceneInput(quietInput(), 'all_off'));
  const named: SceneDescription = { ...withNames, parts: [...off.parts, ...buildScene(quietInput()).parts.filter((p) => p.kind === 'label')] };
  expect(named.parts.some((p) => p.kind === 'label')).toBe(true);
  expect(await shoot(el, named)).not.toBe(a);
  // the viewer's own settings do not reach the control image, and the view on screen is untouched
  await el.locator('[data-quality-1]').click();
  await expect(el).toHaveAttribute('data-quality', '1');
  await el.locator('[data-preset-top]').click();
  expect(await shoot(el, off), 'level 1 and the top preset on screen: the same control bytes').toBe(a);
  await el.locator(`[data-quality-${quality}]`).click();
  await el.locator(`[data-preset-${preset}]`).click();
  const after = await el.evaluate((n) => ({ parts: (n as unknown as El).description.parts.length }));
  expect(after.parts).toBe(before.parts);
  await expect(page.locator('[data-skin-control]')).toHaveCount(0); // the off-screen mount is gone
  expect(await el.evaluate((n) => (n as unknown as El).capture())).toBeTruthy(); // the on-screen view still draws
});

test('the control image is drawn in one fixed palette: the same bytes in design a and design b', async ({ page }) => {
  test.setTimeout(120_000);
  const off = control(quietInput(), 'all_off');
  const on = control(quietInput(), 'all_on');
  const shots: Record<string, { off: string | null; on: string | null; structure: string }> = {};
  for (const design of ['a', 'b'] as const) {
    const el = await openDemo(page, design);
    await expect(page.locator('html')).toHaveAttribute('data-design', design);
    const structure = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sw-map-structure').trim());
    shots[design] = { off: await shoot(el, off), on: await shoot(el, on), structure };
  }
  expect(shots.a.structure, 'the two designs do differ on the page').not.toBe(shots.b.structure);
  expect(shots.a.off).toBeTruthy();
  expect(shots.b.off, 'all_off: identical bytes across designs').toBe(shots.a.off);
  expect(shots.b.on, 'all_on: identical bytes across designs').toBe(shots.a.on);
});
