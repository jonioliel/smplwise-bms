import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneAnchor, type SceneDescription, type SceneZone } from '../src/map/scene-builder';
import { liveOnlyChange, tintOnlyChange } from '../src/map/scene-three';
import { sameScene } from '../src/map/scene-equal';
import { roomStates, type RoomStateLayer, type StateEntity } from '../src/map/room-state';

// PERF3D-295: the performance fixes of the 3D view keep the picture and the behaviour.
//   1. liveOnlyChange: a new reading on a DOM label (a temperature chip, an entity pill) or a presence fade step keeps the scene
//      graph; a lamp, a door, a level, the realistic part or a structural change still rebuild it.
//   2. In the browser (the style guide's demo element): a new reading does not rebuild the graph and the label shows it at its
//      point; the level-2 shadow map is not redrawn by a camera move and is redrawn by a new graph - and the cached map gives
//      exactly the pixels of a map drawn afresh; the labels follow the camera through an orbit.
const NOW = Date.parse('2026-09-28T12:00:00Z');
const input = demoSceneInput('f0')!;
const rooms = demoRooms('f0');
const zones: SceneZone[] = rooms.map((r, i) => ({ id: `z${i}`, name: `חדר ${i}`, polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], level_id: 'L0' }));
const ent = (id: string, x: number, y: number, extra: Partial<StateEntity> = {}): StateEntity => ({ id, domain: id.split('.')[0], device_class: null, state: null, last_changed: null, attributes: null, x, y, level_id: 'L0', layer_id: null, ...extra });
const c = (i: number) => ({ x: rooms[i].x + rooms[i].w / 2, y: rooms[i].y + rooms[i].h / 2 });
const layer = (temp: string, presenceFade = 0.5, doorOpen = true): RoomStateLayer => {
  const l = roomStates({
    rooms: zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: 'L0' })),
    entities: [ent('light.z0', c(0).x, c(0).y, { state: 'on' }), ent('sensor.t0', c(0).x + 0.01, c(0).y, { device_class: 'temperature', state: temp }), ent('binary_sensor.m1', c(1).x, c(1).y, { device_class: 'motion', state: 'off', last_changed: new Date(NOW - 90_000).toISOString() }), ent('binary_sensor.d0', 0, 0, { device_class: 'door', state: doorOpen ? 'on' : 'off' })],
    openings: [{ id: 'do0', kind: 'door', x: 0, y: 0, level_id: 'L0', entity_id: 'binary_sensor.d0' }],
    size: [input.width, input.height],
    now: NOW,
    fade: 3,
  });
  return { ...l, rooms: { ...l.rooms, z1: { ...l.rooms.z1, presenceFade } } };
};
/** A power meter on the plan (an entity pill whose text is its reading). */
const meter: SceneAnchor = { id: 'sensor.power', resource_type: 'ha_entity', resource_id: 'sensor.power', x: 0.5, y: 0.5, rotation: 0, fov: null, radius: null, polygon: null, level_id: null, layer_id: 'sensors', label: 'מונה', state: '120', online: null, mount_height_m: null, tilt_deg: null };
const scene = (o: { temp?: string; fade?: number; door?: boolean; power?: string; lobby?: string; lock?: string; realistic?: boolean } = {}): SceneDescription =>
  buildScene({
    ...input,
    anchors: [...input.anchors, meter],
    entityStates: { ...input.entityStates, 'sensor.power': o.power ?? '120', 'light.lobby': o.lobby ?? 'on', 'lock.main_door': o.lock ?? 'locked' },
    zones,
    roomStates: layer(o.temp ?? '21.5', o.fade ?? 0.5, o.door ?? true),
    realistic: o.realistic,
  });
/** The ids of the parts that differ between two descriptions of the same length. */
const diff = (a: SceneDescription, b: SceneDescription): string[] => a.parts.filter((p, i) => JSON.stringify(p) !== JSON.stringify(b.parts[i])).map((p) => p.id);

test.describe('liveOnlyChange (node)', () => {
  const base = scene();
  test('a new temperature reading changes only its chip: the graph stays', () => {
    const next = scene({ temp: '22.5' });
    expect(diff(base, next)).toEqual(['room:z0#temp']);
    expect(liveOnlyChange(base, next)).toBe(true);
    expect(tintOnlyChange(base, next)).toBe(false); // the old rule rebuilt for it
  });
  test('a new meter reading changes nothing the 3D draws: an equal description (the host keeps the shown one)', () => {
    const next = scene({ power: '133' });
    expect(next).not.toBe(base);
    expect(diff(base, next)).toEqual([]);
    expect(sameScene(base, next)).toBe(true);
    // an equal description handed to the view is still realised again (the view's own contract: the replay spec's determinism check)
    expect(liveOnlyChange(base, next)).toBe(false);
    expect(sameScene(base, scene({ temp: '22.5' }))).toBe(false);
    expect(sameScene(base, scene({ lock: 'unlocked' }))).toBe(false);
  });
  test('a lock unlocked changes only its pill (the state word and colour): the graph stays', () => {
    const next = scene({ lock: 'unlocked' });
    expect(diff(base, next)).toEqual(['ent:lock.main_door']);
    expect(liveOnlyChange(base, next)).toBe(true);
  });
  test('a presence fade step is still a live change (the tint takes its opacity in place)', () => {
    const next = scene({ fade: 0.25 });
    expect(liveOnlyChange(base, next)).toBe(true);
    expect(tintOnlyChange(base, next)).toBe(true);
  });
  test('a reading, a lock and a fade step together: live', () => {
    expect(liveOnlyChange(base, scene({ temp: '23.0', fade: 0.25, power: '7', lock: 'unlocked' }))).toBe(true);
  });
  test('a light switched off (its glow leaves, its pill changes) rebuilds', () => {
    expect(liveOnlyChange(base, scene({ lobby: 'off' }))).toBe(false);
  });
  test('a door closed (its frame colour) rebuilds', () => {
    expect(liveOnlyChange(base, scene({ door: false }))).toBe(false);
  });
  test('the same description (a copy, nothing changed) is not a live change: the caller rebuilds as before', () => {
    expect(liveOnlyChange(base, structuredClone(base))).toBe(false);
    expect(liveOnlyChange(base, base)).toBe(false);
  });
  test('a structural change rebuilds', () => {
    const moved: SceneDescription = { ...base, parts: base.parts.map((p, i) => (i === 3 ? { ...p, position: [p.position[0] + 1, p.position[1], p.position[2]] as [number, number, number] } : p)) };
    expect(liveOnlyChange(base, moved)).toBe(false);
    const level: SceneDescription = { ...base, levels: base.levels.map((l) => ({ ...l, ceiling_height_m: l.ceiling_height_m + 0.1 })) };
    expect(liveOnlyChange(base, level)).toBe(false);
  });
  test('level 3: a label change with the realistic part unchanged is live; with the realistic part changed it rebuilds', () => {
    const a = scene({ realistic: true });
    const b = scene({ realistic: true, temp: '22.5' });
    expect(a.real).toBeTruthy();
    expect(liveOnlyChange(a, b)).toBe(true);
    const turned: SceneDescription = { ...b, real: { ...b.real!, north_deg: (b.real!.north_deg ?? 0) + 15 } };
    expect(liveOnlyChange(a, turned)).toBe(false);
  });
});

type View = {
  scene: { traverse: (f: (o: Record<string, unknown>) => void) => void };
  buildCount: number;
  renderer: { shadowMap: { enabled: boolean; autoUpdate: boolean; needsUpdate: boolean; render: (...a: unknown[]) => void } };
  redrawNow(): void;
  capture(): string;
  cutawayNow(): string[];
};
type Probe = { view: View; description: SceneDescription; minFps: number; toScreen: (p: number[]) => { x: number; y: number } | null };
interface Win {
  __shadowDraws: number;
}

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  return el;
}
const setDescription = (el: Locator, d: SceneDescription) => el.evaluate((n, desc) => { (n as unknown as Probe).description = desc; }, d);
const builds = (el: Locator) => el.evaluate((n) => (n as unknown as Probe).view.buildCount);
/** Count the shadow passes three actually draws (its own gate: enabled, and autoUpdate or needsUpdate). */
const countShadows = (el: Locator) =>
  el.evaluate((n) => {
    const sm = (n as unknown as Probe).view.renderer.shadowMap;
    const w = window as unknown as Win;
    w.__shadowDraws = 0;
    const orig = sm.render.bind(sm);
    sm.render = (...a: unknown[]) => {
      if (sm.enabled && (sm.autoUpdate || sm.needsUpdate)) w.__shadowDraws++;
      orig(...a);
    };
  });
const shadowDraws = (page: Page) => page.evaluate(() => (window as unknown as Win).__shadowDraws);
/** The view's own count of drawn frames (data-frames is reported at most once a second). */
const frames = (el: Locator) => el.evaluate((n) => Number((n as unknown as { view: { frames: number } }).view.frames));

test('a new reading on a label: no rebuild of the graph, the chip and the pill show it at their points', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  await el.locator('[data-quality-2]').click();
  await expect(el).toHaveAttribute('data-quality', '2');
  await setDescription(el, scene());
  await expect(el.locator('[data-3d-chip="z0"]')).toHaveText('21.5°');
  const b0 = await builds(el);
  await setDescription(el, scene({ temp: '22.5', lock: 'unlocked' }));
  await expect(el.locator('[data-3d-chip="z0"]')).toHaveText('22.5°');
  await expect(el.locator('[data-3d-label="lock.main_door"]')).toContainText('לא נעול');
  expect(await builds(el), 'the graph was kept').toBe(b0);
  // the labels stand at their projected points
  const host = (await el.boundingBox())!;
  const at = await el.evaluate((n) => { const e = n as unknown as Probe; const p = e.description.parts.find((x) => x.id === 'room:z0#temp')!; return e.toScreen(p.position); });
  const box = (await el.locator('[data-3d-chip="z0"]').boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - host.x - at!.x)).toBeLessThan(3);
  expect(Math.abs(box.y + box.height / 2 - host.y - at!.y)).toBeLessThan(3);
  // a light switched off still rebuilds
  await setDescription(el, scene({ temp: '22.5', lock: 'unlocked', lobby: 'off' }));
  await expect.poll(() => builds(el)).toBe(b0 + 1);
});

test('level 2: the shadow map is drawn for a new graph, not for a camera move; the cached map draws the same pixels as a fresh one', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  await el.locator('[data-quality-2]').click();
  await expect(el).toHaveAttribute('data-quality', '2');
  await setDescription(el, scene());
  await page.waitForTimeout(500);
  await countShadows(el);
  // a new graph: one shadow pass with its first frame
  await setDescription(el, scene({ lobby: 'off' }));
  await expect.poll(() => shadowDraws(page)).toBe(1);
  // zoom (the azimuth, so the cutaway, stays): frames drawn, no shadow pass
  const f0 = await frames(el);
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, i < 3 ? -120 : 120);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(800);
  expect(await frames(el), 'the zoom drew frames').toBeGreaterThan(f0 + 2);
  expect(await shadowDraws(page), 'a zoom draws no shadow pass').toBe(1);
  // an orbit across the cutaway's azimuth steps: the cut walls change, so the map is drawn again - and only then
  const cut0 = await el.evaluate((n) => (n as unknown as Probe).view.cutawayNow().join(','));
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const cut1 = await el.evaluate((n) => (n as unknown as Probe).view.cutawayNow().join(','));
  const draws = await shadowDraws(page);
  if (cut1 !== cut0) expect(draws).toBeGreaterThan(1);
  // the picture with the cached map is the picture with a map drawn afresh
  // (capture() steps the orbit controls: with damping on, a residual drift moves the camera between two captures - off here,
  // and one capture first so the camera stands still)
  const pics = await el.evaluate((n) => {
    const v = (n as unknown as Probe).view as View & { controls: { enableDamping: boolean } };
    v.controls.enableDamping = false;
    v.capture();
    const cached = v.capture();
    const again = v.capture();
    v.renderer.shadowMap.needsUpdate = true;
    const fresh = v.capture();
    return { stable: cached === again, same: cached === fresh, len: cached.length };
  });
  expect(pics.len).toBeGreaterThan(1000);
  expect(pics.stable, 'two captures of the same view are the same pixels').toBe(true);
  expect(pics.same, 'the cached shadow map draws exactly the fresh one').toBe(true);
  // the labels followed the orbit
  const host = (await el.boundingBox())!;
  const at = await el.evaluate((n) => { const e = n as unknown as Probe; const p = e.description.parts.find((x) => x.id === 'room:z0#temp')!; return e.toScreen(p.position); });
  const chip = el.locator('[data-3d-chip="z0"]');
  if (at && (await chip.isVisible())) {
    const b = (await chip.boundingBox())!;
    expect(Math.abs(b.x + b.width / 2 - host.x - at.x)).toBeLessThan(3);
    expect(Math.abs(b.y + b.height / 2 - host.y - at.y)).toBeLessThan(3);
  }
});
