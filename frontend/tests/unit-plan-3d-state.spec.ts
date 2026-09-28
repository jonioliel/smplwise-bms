import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription, type SceneZone } from '../src/map/scene-builder';
import { tintOnlyChange } from '../src/map/scene-three';
import { PILL_CAP } from '../src/map/scene-frame';
import { roomStates, type RoomStateLayer, type StateEntity } from '../src/map/room-state';

// CR-006 slice 1b, the 3D element in headless Chromium on the style guide's demo floor with descriptions built here
// (the description is plain JSON: the spec hands the element a lit / present / open scene and a quiet one): the tints
// draw as translucent prisms in the state tokens with the fade's opacity, the open-door frame as one instanced red
// group, the temperature chip as a sprite, at both quality levels; a quiet description has none of them; the strip's
// dots are drawn over the cached thumbnails (no thumbnail redrawn); and the carried 1a nits: thumbnails are drawn in a
// pass outside render() and a failed one is not cached, a narrow canvas frames the thumbnail on the clamped size.
const NOW = Date.parse('2026-09-28T12:00:00Z');
type Probe = {
  view: { scene: { traverse: (f: (o: Record<string, unknown>) => void) => void }; renderThumbnail: (d: SceneDescription, id: string, w?: number, h?: number) => string | null; getQuality: () => number; buildCount: number };
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
/** The live layer one fade step later (room 1's tint a step lighter, everything else the same). */
const stepped = buildScene({ ...input, zones, roomStates: { ...live, rooms: { ...live.rooms, z1: { ...live.rooms.z1, presenceFade: 5 / 12 } } } });

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
    expect(lit!.opacity).toBeCloseTo(0.45, 5);
    const presence = mats.find((m) => m.name === 'room:z1#presence');
    expect(presence, `level ${q}: the presence prism (the room is not lit)`).toBeTruthy();
    expect(presence!.color).toBe(await token(el, 'map-presence'));
    expect(presence!.opacity).toBeCloseTo(0.18, 5); // half the fade of the 0.36 tint
    const ring = mats.find((m) => m.name === 'room:z1#presence-ring');
    expect(ring, `level ${q}: the presence ring`).toBeTruthy();
    expect(ring!.opacity).toBeCloseTo(0.375, 5); // half the fade of the 0.75 ring
    expect(mats.some((m) => m.name === 'room:z1#lit' || m.name === 'room:z0#presence')).toBe(false);
    const frame = mats.find((m) => m.name === 'box|danger|1');
    expect(frame, `level ${q}: the frame's instance group`).toBeTruthy();
    expect(frame!.instanced).toBe(true); // (an InstancedMesh reports type 'Mesh')
    expect(frame!.count).toBe(3); // jamb, jamb, head
    expect(frame!.color).toBe(await token(el, 'danger'));
    // the temperature chip is DOM at the projected point, not a sprite in the scene
    expect(mats.some((m) => m.name === 'room:z0#temp')).toBe(false);
    const chip = el.locator('[data-3d-chip="z0"]');
    await expect(chip).toHaveText('21.5°');
    await expect(chip).toBeVisible();
    const at = await el.evaluate((n, id) => { const e = n as unknown as { toScreen: (p: number[]) => { x: number; y: number } | null; description: SceneDescription }; const p = e.description.parts.find((x) => x.id === id)!; return e.toScreen(p.position); }, 'room:z0#temp');
    const box = (await chip.boundingBox())!;
    const host = (await el.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - host.x - at!.x)).toBeLessThan(3);
    expect(Math.abs(box.y + box.height / 2 - host.y - at!.y)).toBeLessThan(3);
    await expect(el.locator('[data-3d-chip="z1"]')).toHaveCount(0);
    // the quiet scene: no tint, no frame, no chip - the rooms themselves stay
    await setDescription(el, without);
    await expect(el).toHaveAttribute('data-parts', String(without.parts.length));
    const off = await materials(el);
    expect(off.some((m) => m.name.endsWith('#lit') || m.name.endsWith('#presence') || m.name.endsWith('#presence-ring') || m.name.endsWith('#temp') || m.name === 'box|danger|1')).toBe(false);
    expect(off.some((m) => m.name === 'room:z0')).toBe(true);
    await expect(el.locator('[data-3d-chip]')).toHaveCount(0);
  }
  // a fade step: the graph is not rebuilt (the instance groups keep their identity, the build count stays), the
  // tint materials take the new opacity in place
  expect(tintOnlyChange(withStates, stepped)).toBe(true);
  expect(tintOnlyChange(withStates, without)).toBe(false);
  expect(tintOnlyChange(withStates, withStates)).toBe(false);
  await setDescription(el, withStates);
  const marked = await el.evaluate((n) => {
    const e = n as unknown as Probe;
    let k = 0;
    e.view.scene.traverse((o) => { if (o.isInstancedMesh) { (o as { __mark?: number }).__mark = ++k; } });
    return { builds: e.view.buildCount, groups: k };
  });
  expect(marked.groups).toBeGreaterThan(2);
  await setDescription(el, stepped);
  await expect(el).toHaveAttribute('data-parts', String(stepped.parts.length));
  const after = await el.evaluate((n) => {
    const e = n as unknown as Probe;
    const marks: number[] = [];
    e.view.scene.traverse((o) => { if (o.isInstancedMesh) marks.push((o as { __mark?: number }).__mark ?? 0); });
    return { builds: e.view.buildCount, marks: marks.sort((a, b) => a - b) };
  });
  expect(after.builds).toBe(marked.builds); // a cache hit: no realisation
  expect(after.marks).toEqual(Array.from({ length: marked.groups }, (_, i) => i + 1)); // the same InstancedMesh objects
  const steppedMats = await materials(el);
  expect(steppedMats.find((m) => m.name === 'room:z1#presence')!.opacity).toBeCloseTo(0.36 * 5 / 12, 4);
  expect(steppedMats.find((m) => m.name === 'room:z1#presence-ring')!.opacity).toBeCloseTo(0.75 * 5 / 12, 4);
  expect(steppedMats.find((m) => m.name === 'room:z0#lit')!.opacity).toBeCloseTo(0.45, 5);
  // a real change (the quiet scene) rebuilds
  await setDescription(el, without);
  await expect(el).toHaveAttribute('data-parts', String(without.parts.length));
  expect(await el.evaluate((n) => (n as unknown as Probe).view.buildCount)).toBe(marked.builds + 1);
  // a tint is not pickable: the outline of the selected zone is the room's box only (no outline of the tint)
  await setDescription(el, withStates);
  await el.evaluate((n) => { (n as unknown as { selectedId: string | null }).selectedId = 'z0'; });
  await expect(el).toHaveAttribute('data-selected', 'z0');
  const lines = (await materials(el)).filter((m) => m.type === 'LineSegments');
  expect(lines.length).toBe(2); // the room prism and its name - not the lit prism, not the DOM chip
});

test('entity pills are DOM labels (slice 1c): no sprite in the scene, the state token as the colour, placed by part id, a click selects the entity', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  await setDescription(el, withStates);
  await expect(el).toHaveAttribute('data-parts', String(withStates.parts.length));
  const ents = withStates.parts.filter((p) => p.kind === 'entity');
  expect(ents.length).toBeGreaterThan(2);
  const mats = await materials(el);
  expect(mats.some((m) => m.name.startsWith('ent:'))).toBe(false); // no sprite, no pickable object for an entity
  await expect(el.locator('[data-3d-label]')).toHaveCount(ents.length);
  for (const p of ents) {
    const lbl = el.locator(`[data-3d-label="${p.userData.id}"]`);
    await expect(lbl).toHaveText(p.text!);
    await expect(lbl).toHaveAttribute('data-3d-part', p.id);
    expect(await lbl.evaluate((n) => getComputedStyle(n).color)).toBe(await el.evaluate((n, t) => { const s = document.createElement('span'); s.style.color = getComputedStyle(n).getPropertyValue(`--sw-${t}`).trim(); n.shadowRoot!.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; }, p.color));
  }
  // each pill stands on its own part's projected point - bottom edge a small gap above it, so the object under it stays
  // clickable from straight above (matched by id: reversing the description's part order moves nothing); pills are no
  // Tab stops (the list and the inspector select by keyboard)
  const first = ents[0];
  const at = await el.evaluate((n, id) => { const e = n as unknown as { toScreen: (p: number[]) => { x: number; y: number } | null; description: SceneDescription }; return e.toScreen(e.description.parts.find((x) => x.id === id)!.position); }, first.id);
  const lbl = el.locator(`[data-3d-label="${first.userData.id}"]`);
  await expect(lbl).toHaveAttribute('tabindex', '-1');
  const box = (await lbl.boundingBox())!;
  const host = (await el.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - host.x - at!.x)).toBeLessThan(3);
  expect(at!.y - (box.y + box.height - host.y)).toBeGreaterThan(3);
  expect(at!.y - (box.y + box.height - host.y)).toBeLessThan(10);
  await setDescription(el, { ...withStates, parts: [...withStates.parts].reverse() });
  await expect(el.locator('[data-3d-label]').first()).toHaveAttribute('data-3d-label', ents[ents.length - 1].userData.id);
  const again = (await lbl.boundingBox())!;
  expect(Math.abs(again.x - box.x)).toBeLessThan(2);
  expect(Math.abs(again.y - box.y)).toBeLessThan(2);
  // a click on the pill selects the entity as its sprite used to (part-select with the anchor id), and the pill shows it
  await el.evaluate((n) => { (window as unknown as { __hits: unknown[] }).__hits = []; n.addEventListener('part-select', (e) => (window as unknown as { __hits: unknown[] }).__hits.push((e as CustomEvent).detail)); });
  await lbl.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __hits: unknown[] }).__hits)).toEqual([{ id: first.userData.id, kind: 'entity' }]);
  await el.evaluate((n, id) => { (n as unknown as { selectedId: string | null }).selectedId = id; }, first.userData.id);
  await expect(lbl).toHaveAttribute('aria-pressed', 'true');
  expect((await materials(el)).filter((m) => m.type === 'LineSegments')).toHaveLength(0); // nothing in the scene to outline: the pill carries the ring
  // the description without its entities: the pills go
  await setDescription(el, { ...withStates, parts: withStates.parts.filter((p) => p.kind !== 'entity') });
  await expect(el.locator('[data-3d-label]')).toHaveCount(0);
  // a level filter hides the pills of the other levels (a lower level's pills would show through the upper floor)
  const l1 = ents.slice(0, 2).map((p) => ({ ...p, id: `${p.id}~L1`, level_id: 'L1', userData: { ...p.userData, id: `${p.userData.id}~L1` } }));
  await setDescription(el, { ...withStates, parts: [...withStates.parts, ...l1] });
  await expect(el.locator('[data-3d-label]')).toHaveCount(ents.length + 2);
  await el.evaluate((n) => { (n as unknown as { activeLevel: string | null }).activeLevel = 'L1'; });
  await expect(el.locator('[data-3d-label]')).toHaveCount(2);
  await expect(el.locator('[data-3d-label]').first()).toHaveAttribute('data-3d-label', /~L1$/);
  await el.evaluate((n) => { (n as unknown as { activeLevel: string | null }).activeLevel = null; });
  await expect(el.locator('[data-3d-label]')).toHaveCount(ents.length + 2);
  // the cap: above PILL_CAP pills at the overview only the selected, the hovered and the alerting ones (a token other
  // than text-3) are drawn, the rest counted in the "+N" hint
  await el.evaluate((n) => { (n as unknown as { selectedId: string | null }).selectedId = null; }); // (the pill clicked above is still selected: it would stay)
  const quietPill = ents.find((p) => p.color === 'text-3')!;
  const many = Array.from({ length: PILL_CAP + 10 }, (_, i) => ({ ...quietPill, id: `${quietPill.id}~m${i}`, userData: { ...quietPill.userData, id: `${quietPill.userData.id}~m${i}` }, position: [quietPill.position[0] + (i % 10) * 0.3, quietPill.position[1], quietPill.position[2] + Math.floor(i / 10) * 0.3] as [number, number, number] }));
  await setDescription(el, { ...withStates, parts: [...withStates.parts, ...many] });
  const alerting = ents.filter((p) => p.color !== 'text-3').length;
  expect(alerting).toBeGreaterThan(0);
  await expect(el.locator('[data-3d-label]')).toHaveCount(alerting);
  await expect(el.locator('[data-3d-more]')).toHaveAttribute('data-3d-more', String(ents.length + many.length - alerting));
  await el.evaluate((n, id) => { (n as unknown as { selectedId: string | null }).selectedId = id; }, many[3].userData.id);
  await expect(el.locator('[data-3d-label]')).toHaveCount(alerting + 1);
  await expect(el.locator(`[data-3d-label="${many[3].userData.id}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(el.locator('[data-3d-more]')).toHaveAttribute('data-3d-more', String(ents.length + many.length - alerting - 1));
  await setDescription(el, withStates);
  await expect(el.locator('[data-3d-more]')).toHaveCount(0);
  await expect(el.locator('[data-3d-label]')).toHaveCount(ents.length);
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
